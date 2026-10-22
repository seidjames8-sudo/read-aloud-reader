
const conLog=[];
(function(){
  const fmt=a=>{a=[...a];if(typeof a[0]==='string'&&a[0].startsWith('%c'))a.splice(1,1);
    return a.map(x=>typeof x==='string'?x.replace(/^%c/,''):x instanceof Error?x.message:(()=>{try{return JSON.stringify(x)}catch(e){return String(x)}})()).join(' ')};
  const line=l=>{const d=document.createElement('div');d.className=l.k;d.textContent=l.t+'  '+l.m;return d};
  function add(k,m){const l={k,m,t:new Date().toLocaleTimeString([],{hour12:false})};conLog.push(l);if(conLog.length>200)conLog.shift();
    const el=document.getElementById('conOut');if(!el||!el.parentNode.classList.contains('open'))return;
    el.appendChild(line(l));while(el.childNodes.length>200)el.removeChild(el.firstChild);el.scrollTop=el.scrollHeight}
  window._drawCon=()=>{const el=document.getElementById('conOut'),f=document.createDocumentFragment();el.textContent='';conLog.forEach(l=>f.appendChild(line(l)));el.appendChild(f);el.scrollTop=el.scrollHeight};
  ['log','info','warn','error'].forEach(k=>{const f=console[k];if(typeof f!=='function')return;const o=f.bind(console);console[k]=(...a)=>{o(...a);add(k,fmt(a))}});
  addEventListener('error',e=>add('error',e.message));
  addEventListener('unhandledrejection',e=>add('error','Promise: '+(e.reason&&e.reason.message||e.reason)));
})();
const $=s=>document.querySelector(s),NOSPEECH={speak(){},cancel(){},pause(){},resume(){},getVoices(){return[]},speaking:false,paused:false,pending:false},ss=window.speechSynthesis||NOSPEECH;
const SAMPLE=`# Read aloud

Turn any text into speech while the words light up as they are spoken. **Edit text** understands *Markdown*.

## Reading tools

- Change size, spacing, font and brightness in Preferences
- Turn on line focus to dim all but a few lines
- Select text to read only that part, or use \`Read from here\`
- Add pictures with \`![Alt text](https://example.com/photo.jpg)\`

## Video References

Use a Markdown link to a YouTube video. The reader shows a thumbnail first and loads the player only when you press Play.

- [Example video](https://www.youtube.com/watch?v=khcF2ZQzTmY)

> Replace this sample by choosing Edit text and pasting your own.`;
const log=(...a)=>console.log('%c[ReadAloud]','color:#0f6cbd;font-weight:bold',...a),warn=(...a)=>console.warn('[ReadAloud]',...a);
const LANGS=[[/[\u3040-\u30ff]/,'ja-JP'],[/[\uac00-\ud7af]/,'ko-KR'],[/[\u4e00-\u9fff]/,'zh-CN'],[/[\u0400-\u04ff]/,'ru-RU'],[/[\u0600-\u06ff]/,'ar-SA'],[/[\u0900-\u097f]/,'hi-IN'],[/[\u0e00-\u0e7f]/,'th-TH'],[/[\u0370-\u03ff]/,'el-GR'],[/[\u0590-\u05ff]/,'he-IL']];
const detectLang=t=>{for(const [r,l] of LANGS)if(r.test(t))return l;return null};
let bad={},capRate={};try{bad=JSON.parse(localStorage.getItem('bad')||'{}');capRate=JSON.parse(localStorage.getItem('cap')||'{}')}catch(e){}
const saveMaps=()=>{try{localStorage.setItem('bad',JSON.stringify(bad));localStorage.setItem('cap',JSON.stringify(capRate))}catch(e){}};
const isBad=n=>bad[n]&&Date.now()-bad[n]<864e5;
const fallbackVoice=()=>voices.find(x=>/Brian/i.test(x.name)&&!/multilingual/i.test(x.name))||voices.find(x=>x.localService);
let toastT;const toast=m=>{const t=$('#toast');t.textContent=m;t.style.display='block';clearTimeout(toastT);toastT=setTimeout(()=>t.style.display='none',6000)};
window.resetVoiceFailures=()=>{bad={};capRate={};saveMaps();log('Voice failure memory cleared. Reload the page.')};
let pos={},curHash='',saveT=0;try{pos=JSON.parse(localStorage.getItem('pos')||'{}')}catch(e){}
let words=[],paras=[],lineOf=[],cur=-1,playing=false,paused=false,token=0,focusN=0,focusLine=0,rate=1,voices=[];
const store=(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}},load=k=>{try{return localStorage.getItem(k)}catch(e){return null}};

/* ---------- Markdown images ---------- */
const MAX_WORDS=60000;let capped=false,imgT=0,imgWarned=0;const blobUrls=[];
const imgIO='IntersectionObserver' in window?new IntersectionObserver(es=>es.forEach(e=>{
  const im=e.target;
  if(e.isIntersecting){if(im._rel&&!im.getAttribute('src'))im.src=im._rel}
  else if(im._ok&&im.getAttribute('src')){
    im.style.width=im.clientWidth+'px';im.style.aspectRatio=im.naturalWidth+'/'+im.naturalHeight;
    im.classList.add('unl');im.removeAttribute('src');im._ok=false}
}),{root:$('#scroll'),rootMargin:'200% 0px'}):null;
const imgLayout=()=>{clearTimeout(imgT);imgT=setTimeout(layout,150)};
function makeImg({alt,src,title,href}){
  alt=String(alt||'');src=String(src||'').trim();
  const wrap=document.createElement('span');wrap.className='mdimg ld';
  let im=null,failed=false;
  const fail=(kind,why)=>{
    if(failed)return;failed=true;
    if(im){im.onload=im.onerror=null;if(imgIO)imgIO.unobserve(im);im.removeAttribute('src')}
    wrap.className='imgfail';wrap.textContent='';
    const b=document.createElement('b');b.textContent='🖼 Image unavailable';wrap.appendChild(b);
    if(alt){const t=document.createElement('span');t.textContent=alt;wrap.appendChild(t)}
    if(/^https?:/i.test(src)){const a=document.createElement('a');a.href=src;a.target='_blank';a.rel='noopener noreferrer';a.textContent='Open image';wrap.appendChild(a)}
    if(!/^(data|blob):/i.test(src)){const rb=document.createElement('button');rb.type='button';rb.className='retry';rb.textContent='Retry';rb.onclick=()=>{wrap.replaceWith(makeImg({alt,src,title,href}))};wrap.appendChild(rb)}
    if(imgWarned++<3)warn(kind==='parse'?'Image source not allowed ('+why+'):':'Image parsed OK, but the resource failed to load ('+why+'):',src.slice(0,100),
      /^local:/i.test(src)?'| Added on another device or browser; add it again with Edit text > Add image.':'| Check the address, hotlink protection and network. The hosted page also blocks images from other sites; use Add image or your downloaded copy.');
    imgLayout()};
  if(!/^(https?:|data:image\/|blob:|local:)/i.test(src)){fail('parse','unsupported link');return wrap}
  const local=/^local:/i.test(src);
  im=new Image();im.alt=alt;if(title)im.title=title;
  im.loading='lazy';im.decoding='async';im.referrerPolicy='strict-origin-when-cross-origin';
  im.onload=()=>{im._ok=true;wrap.classList.remove('ld');im.classList.remove('unl');im.style.width=im.style.aspectRatio='';imgLayout()};
  let tries=0;
  im.onerror=()=>{
    if(!im||!im.getAttribute('src'))return;
    if(tries<2){tries++;setTimeout(()=>{if(failed||!im.isConnected)return;const u=im.getAttribute('src');if(!u)return;im.removeAttribute('src');im.src=u},tries*1500)}
    else fail('load','failed to load')};
  if(!local&&!/^data:/i.test(src)){im._rel=src;if(imgIO)imgIO.observe(im)}
  if(local)imgGet(src.slice(6)).then(b=>{if(failed)return;if(!b)return fail('load','not stored on this device');const u=URL.createObjectURL(b);blobUrls.push(u);im._rel=u;if(imgIO)imgIO.observe(im);im.src=u}).catch(()=>fail('load','could not read saved image'));
  else im.src=src;
  if(href&&/^https?:/i.test(href)){const a=document.createElement('a');a.href=href;a.target='_blank';a.rel='noopener noreferrer';a.appendChild(im);wrap.appendChild(a)}
  else wrap.appendChild(im);
  return wrap;
}
/* Inline Markdown: named groups, one explicit branch per construct.
   [text](url) = link   ![alt](url) = image   [![alt](img)](url) = clickable image */
const URLP='(?:[^()\\s]|\\([^()\\s]*\\))+';
const INLINE_RE=new RegExp([
  '(?<bm>\\*\\*|__)(?<b>.+?)\\k<bm>',
  '\\*(?<i>.+?)\\*',
  '`(?<c>[^`]+)`',
  '\\[!\\[(?<la>[^\\]]*)\\]\\((?<ls>'+URLP+')(?:\\s+"(?<lt>[^"]*)")?\\)\\]\\((?<lh>'+URLP+')\\)',
  '!\\[(?<ia>[^\\]]*)\\]\\((?<is2>'+URLP+')(?:\\s+"(?<it>[^"]*)")?\\)',
  '\\[(?<tx>[^\\]]+)\\]\\((?<hr>'+URLP+')\\)'
].join('|'),'g');
const safeHref=h=>/^(https?:\/\/|mailto:|#)/i.test(h)?h:'';
function youtubeVideoId(raw){
  try{
    const u=new URL(String(raw||''),location.href);
    const host=u.hostname.toLowerCase().replace(/^www\./,'').replace(/^m\./,'');
    let id='';
    if(host==='youtu.be') id=u.pathname.split('/').filter(Boolean)[0]||'';
    else if(['youtube.com','music.youtube.com','youtube-nocookie.com'].includes(host)){
      const seg=u.pathname.split('/').filter(Boolean);
      if(u.pathname==='/watch') id=u.searchParams.get('v')||'';
      else if(['embed','shorts','live','v'].includes(seg[0])) id=seg[1]||'';
    }
    return /^[A-Za-z0-9_-]{11}$/.test(id)?id:'';
  }catch(_){return ''}
}
const needsKeep=t=>/!\[|youtu\.?be/i.test(t);
const ytOn=()=>load('pf-yt')!=='0';
let activeYT=null;
function ytStart(raw){
  try{const u=new URL(String(raw||'')),t=u.searchParams.get('t')||u.searchParams.get('start')||(u.hash.match(/t=([0-9hms]+)/)||[])[1]||'';
    if(/^\d+$/.test(t))return +t;
    const r=t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i);return r?(+r[1]||0)*3600+(+r[2]||0)*60+(+r[3]||0):0}
  catch(_){return 0}
}
/* YouTube refuses to run its player on pages that have no web address (a saved file, or a sandboxed frame: "Error 153") */
const ytCanEmbed=()=>/^https?:$/.test(location.protocol)&&location.origin!=='null';
const ytCards=[];
function makeYouTubeCard(url,title,backups){
  const cands=[url].concat(backups||[]).filter(u=>youtubeVideoId(u));
  if(!cands.length)return null;
  let ci=0,id=youtubeVideoId(cands[0]),start=ytStart(cands[0]);
  const label=title||'YouTube video';
  const watchOf=()=>'https://www.youtube.com/watch?v='+id+(start?'&t='+start+'s':'');
  const searchUrl='https://www.youtube.com/results?search_query='+encodeURIComponent(label);
  const card=document.createElement('section');card.className='yt-card';card.setAttribute('aria-label','YouTube video: '+label);
  const frame=document.createElement('div');frame.className='yt-frame';
  const play=document.createElement('button');play.className='yt-play';play.type='button';play.textContent='▶';play.setAttribute('aria-label','Play '+label);
  let thumb=null;
  const mkBtn=(t,fn)=>{const b=document.createElement('button');b.type='button';b.textContent=t;b.onclick=fn;return b};
  const mkLink=(t,h)=>{const l=document.createElement('a');l.href=h;l.target='_blank';l.rel='noopener noreferrer';l.textContent=t;l.style.cssText='color:#93c5fd;font-weight:600;padding:8px 4px';return l};
  const panel=(text,items)=>{
    const note=document.createElement('div');note.className='yt-local-fallback';
    note.style.cssText='position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:14px;text-align:center;color:#fff;background:#111827;overflow:auto';
    const msg=document.createElement('p');msg.style.cssText='margin:0;font-size:13px;line-height:1.4';msg.textContent=text;
    const row=document.createElement('div');row.style.cssText='display:flex;gap:8px;flex-wrap:wrap;justify-content:center;align-items:center';
    row.append(...items);note.append(msg,row);frame.replaceChildren(note);
  };
  const idle=()=>{frame.textContent='';if(thumb)frame.appendChild(thumb);frame.appendChild(play);if(activeYT===card)activeYT=null};
  card._idle=idle;
  /* a video that was removed, made private, or never existed gets YouTube's small grey placeholder picture (120 px wide) */
  const checkThumb=()=>{
    if(load('net:i.ytimg.com')!=='1'||card._checked===id)return;
    card._checked=id;const probe=new Image(),mine=id;
    probe.onload=()=>{
      if(mine!==id)return;
      if(probe.naturalWidth<=120)bad();
      else if(!thumb){thumb=document.createElement('img');thumb.alt='';thumb.src=probe.src;if(!activeYT||activeYT!==card)idle()}
    };
    probe.src='https://i.ytimg.com/vi/'+id+'/hqdefault.jpg';
  };
  const bad=()=>{
    if(ci+1<cands.length){ci++;id=youtubeVideoId(cands[ci]);start=ytStart(cands[ci]);a.href=watchOf();thumb=null;idle();checkThumb();return}
    panel('This video is not available: it may have been removed, made private, or the link is wrong.',[mkLink('Search YouTube for another clip',searchUrl),mkLink('Open the original link',watchOf())]);
    lab.textContent=label+' (unavailable)';
  };
  const embed=()=>{
    if(activeYT&&activeYT!==card&&activeYT._idle)activeYT._idle();
    if(typeof playing!=='undefined'&&playing&&!paused&&typeof toggle==='function')toggle();
    const f=document.createElement('iframe');
    f.src='https://www.youtube-nocookie.com/embed/'+id+'?autoplay=1&rel=0&playsinline=1'+(start?'&start='+start:'');
    f.title=label;f.allow='autoplay; encrypted-media; picture-in-picture; fullscreen';f.allowFullscreen=true;
    f.referrerPolicy='strict-origin-when-cross-origin';
    frame.replaceChildren(f);activeYT=card;
  };
  /* options that work from a saved file (no web address): a pop-out window, or an alternative player the user sets */
  const altBase=()=>{const v=(load('pf-ytalt')||'').trim().replace(/\/+$/,'');return /^https:\/\/[^\s/]+$/i.test(v)?v:''};
  const pauseVoice=()=>{if(typeof playing!=='undefined'&&playing&&!paused&&typeof toggle==='function')toggle()};
  const popout=()=>{pauseVoice();window.open(watchOf(),'yt_popout','popup=yes,width=560,height=360')};
  const embedAlt=async()=>{
    const base=altBase();if(!base)return;
    if(!(await netAsk(new URL(base).host,'Play "'+label+'" with your alternative video player. It is a third-party site.',base+'/embed/'+id)))return;
    if(activeYT&&activeYT!==card&&activeYT._idle)activeYT._idle();
    pauseVoice();
    const f=document.createElement('iframe');
    f.src=base+'/embed/'+id+'?autoplay=1&local=true'+(start?'&start='+start:'');
    f.title=label;f.allow='autoplay; encrypted-media; picture-in-picture; fullscreen';f.allowFullscreen=true;f.referrerPolicy='strict-origin-when-cross-origin';
    frame.replaceChildren(f);activeYT=card;
  };
  const blocked=()=>{
    const items=[mkBtn('Pop-out player',popout)];
    if(altBase())items.push(mkBtn('Play in reader (alternative player)',embedAlt));
    items.push(mkBtn('Try YouTube player anyway',embed),mkLink('Open on YouTube',watchOf()),mkBtn('Back',idle));
    panel('YouTube will not run its player inside a saved file. Use the pop-out player, or put the reader at a web address.',items);
  };
  play.addEventListener('click',async()=>{
    const ok=await netAsk('www.youtube-nocookie.com','Play the video "'+label+'" inside the reader. This loads the YouTube player.','https://www.youtube-nocookie.com/embed/'+id);
    if(!ok)return;
    store('net:i.ytimg.com','1');ytCards.forEach(f=>f());
    if(ytCanEmbed())embed();else blocked();
  });
  idle();
  const meta=document.createElement('div');meta.className='yt-meta';
  const lab=document.createElement('span');lab.className='yt-title';lab.textContent=label;
  const a=document.createElement('a');a.href=watchOf();a.target='_blank';a.rel='noopener noreferrer';a.textContent='Open on YouTube ↗';
  meta.append(lab,a);card.append(frame,meta);
  ytCards.push(checkThumb);checkThumb();
  return card;
}
function fill(el,s,pi){
  s=String(s==null?'':s);
  const solo=/^\s*\[[^\]]*\]\([^)\s]+\)\s*$/.test(s);
  const ytLinks=[];
  const parts=[],re=INLINE_RE;let last=0,m;re.lastIndex=0;
  const plain=t=>{if(t)parts.push({t})};
  while((m=re.exec(s))){
    plain(s.slice(last,m.index));const g=m.groups;
    if(g.b!=null)parts.push({t:g.b,tag:'strong'});
    else if(g.i!=null)parts.push({t:g.i,tag:'em'});
    else if(g.c!=null)parts.push({t:g.c,tag:'code'});
    else if(g.ls!=null)parts.push({img:{alt:g.la,src:g.ls,title:g.lt,href:safeHref(g.lh)}});
    else if(g.is2!=null)parts.push({img:{alt:g.ia,src:g.is2,title:g.it}});
    else if(g.hr!=null){const h=safeHref(g.hr);parts.push(h?{t:g.tx,tag:'a',href:h}:{t:g.tx})}
    else plain(m[0]);
    last=re.lastIndex}
  plain(s.slice(last));
  parts.forEach(pt=>{
    if(pt.img){el.appendChild(makeImg(pt.img));return}
    if(pt.tag==='a'&&pt.href&&ytOn()&&youtubeVideoId(pt.href)){
      const lab=String(pt.t||'').replace(/\s+/g,' ').trim();
      if(solo){const card=makeYouTubeCard(pt.href,lab);if(card){el.appendChild(card);return}}
      else if(ytLinks.length<3)ytLinks.push({href:pt.href,lab});
    }
    const host=pt.tag?document.createElement(pt.tag):el;
    if(pt.href){host.href=pt.href;host.target='_blank';host.rel='noopener noreferrer'}
    String(pt.t==null?'':pt.t).split(/(\s+)/).forEach(tok=>{
      if(!tok)return;
      if(/^\s+$/.test(tok)){host.appendChild(document.createTextNode(' '));return}
      if(words.length>=MAX_WORDS){capped=true;return}
      const sp=document.createElement('span');sp.className='w';sp.textContent=tok;sp.dataset.i=words.length;
      host.appendChild(sp);words.push({el:sp,t:tok,p:pi});
    });
    if(pt.tag)el.appendChild(host);
  });
  /* a line with a title and a YouTube link keeps its text and link, and gets the player card underneath */
  if(ytLinks.length){
    const title=s.replace(/\[[^\]]*\]\([^)\s]+\)/g,'').replace(/[*_`]/g,'').replace(/[\s\u2014\u2013:|\-\u00b7]+$/,'').trim()||ytLinks[0].lab;
    const c=makeYouTubeCard(ytLinks[0].href,title,ytLinks.slice(1).map(x=>x.href));if(c)el.appendChild(c);
  }
}
function render(text){
  capped=false;cur=-1;curHash=hashText(text);if(imgIO)imgIO.disconnect();blobUrls.splice(0).forEach(u=>URL.revokeObjectURL(u));ytCards.length=0;ss.cancel();playing=paused=false;setPlay();cur=-1;
  const doc=$('#doc');doc.innerHTML='';words=[];paras=[];
  const lines=text.replace(/\r/g,'').split('\n');let list=null,para=[],box=doc;
  const add=(tag,s,parent,keep)=>{
    const el=document.createElement(tag),st=words.length;
    fill(el,s,paras.length);
    if(words.length>st){paras.push({start:st,end:words.length-1});(parent||box).appendChild(el)}else if(keep)(parent||box).appendChild(el);
  };
  const flush=()=>{if(para.length){const t=para.join(' ');add('p',t,0,needsKeep(t));para=[]}};
  for(let i=0;i<lines.length;i++){
    if(capped)break;
    const L=lines[i];let m;
    if(/^```/.test(L)){flush();list=null;const code=[];i++;
      while(i<lines.length&&!/^```/.test(lines[i]))code.push(lines[i++]);
      add('pre',code.join(' '));continue}
    if(!L.trim()){flush();list=null;continue}
    let dm;
    if(dm=L.match(/^\s*<details(\s+open)?\s*>\s*(?:<summary>(.*?)<\/summary>)?\s*$/i)){flush();list=null;const d=document.createElement('details');if(dm[1])d.open=true;box.appendChild(d);box=d;if(dm[2])add('summary',dm[2],d,true);continue}
    if(dm=L.match(/^\s*<summary>(.*?)<\/summary>\s*$/i)){flush();list=null;add('summary',dm[1],box,true);continue}
    if(/^\s*<\/details>\s*$/i.test(L)){flush();list=null;if(box!==doc)box=box.parentNode;continue}
    if(m=L.match(/^(#{1,6})\s+(.*)/)){flush();list=null;add('h'+Math.min(m[1].length,3),m[2]);continue}
    if(/^\s*([-*_]\s*){3,}$/.test(L)){flush();list=null;box.appendChild(document.createElement('hr'));continue}
    if(m=L.match(/^\s*(?:[-*+]|(\d+)[.)])\s+(.*)/)){flush();const t=m[1]?'ol':'ul';
      if(!list||list.tagName.toLowerCase()!==t){list=document.createElement(t);box.appendChild(list)}
      add('li',m[2],list,needsKeep(m[2]));continue}
    if(m=L.match(/^>\s?(.*)/)){flush();list=null;add('blockquote',m[1],0,needsKeep(m[1]));continue}
    if(/^\s*(?:\[!\[[^\]]*\]\([^)\s]+(?:\s+"[^"]*")?\)\]\([^)\s]+\)|!\[[^\]]*\]\([^)\s]+(?:\s+"[^"]*")?\))\s*$/.test(L)){
      flush();list=null;const fg=document.createElement('figure');fg.className='md';fill(fg,L.trim(),paras.length);
      const im=fg.querySelector('img'),cap=im&&(im.title||im.alt);
      if(cap){const c=document.createElement('figcaption');c.textContent=cap;fg.appendChild(c)}
      box.appendChild(fg);continue}
    list=null;para.push(L.trim());
  }
  flush();
  if(capped){toast('Very long text: showing the first '+MAX_WORDS.toLocaleString()+' words. Your full text stays in the editor.');warn('Text capped at '+MAX_WORDS+' words to keep the page responsive')}
  updateTime();
  requestAnimationFrame(()=>{layout();restorePos()});
}
const WPM=160;let vol=1,lfY=.5,lfMode='fade';
function setBr(v){$('#br').value=v;root.style.setProperty('--br',v/100);document.body.classList.toggle('dimmed',+v!==100)}
function setDim(v){root.style.setProperty('--dim',v/100);root.style.setProperty('--fade',(100-v)/100*.6)}
const stageEl=()=>$('#stage');
const lhPx=()=>{const cs=getComputedStyle($('#doc'));return parseFloat(cs.lineHeight)||parseFloat(cs.fontSize)*1.7};
const bandH=()=>Math.round(focusN*lhPx()+8);
let lines=[],winA=-9,winB=-9,lineDirty=true;
function layout(){lineDirty=true;updateLF()}
function computeLines(){
  document.querySelectorAll('.w.lit').forEach(e=>e.classList.remove('lit'));winA=winB=-9;
  const gap=lhPx()*.5;let n=-1,top0=-1e9;lines=[];lineOf=new Uint32Array(words.length);
  words.forEach((w,i)=>{const t=w.el.offsetTop;if(Math.abs(t-top0)>gap){n++;lines.push([]);top0=t}lines[n].push(i);lineOf[i]=n});
  lineDirty=false;
}
function clearLit(){for(let l=Math.max(winA,0);l<=Math.min(winB,lines.length-1);l++)lines[l].forEach(i=>words[i].el.classList.remove('lit'));winA=winB=-9}
function applyFocus(){document.body.classList.toggle('focus',focusN>0);updateLF()}
function focusViewport(){
  const sc=$('#scroll'),sr=sc.getBoundingClientRect(),st=stageEl().getBoundingClientRect();
  const br=$('#bar').getBoundingClientRect();
  const gap=8;
  const visualBottom=Math.min(sr.bottom,br.top>sr.top?br.top-gap:sr.bottom);
  const top=sr.top;
  const height=Math.max(0,visualBottom-top);
  return {sc,sr,st,top,height,bottom:visualBottom,stageTop:top-st.top};
}
function clampFocusPosition(v,height,h){
  const range=Math.max(0,height-h);
  return Math.min(Math.max(Number.isFinite(v)?v:0,0),range);
}
function syncFocusPadding(vp,h,top){
  const sc=vp.sc, bottom=Math.max(20,vp.height-(top+h));
  const oldTop=parseFloat(sc.style.getPropertyValue('--lf-pad-top'))||0;
  const newTop=Math.round(Math.max(16,top));
  sc.style.setProperty('--lf-pad-top',newTop+'px');
  sc.style.setProperty('--lf-pad-bottom',Math.round(bottom+20)+'px');
  if(Math.abs(newTop-oldTop)>=1) sc.scrollTop+=newTop-oldTop;
}
function clearReaderFocusPadding(){const sc=$('#scroll');sc.style.removeProperty('--lf-pad-top');sc.style.removeProperty('--lf-pad-bottom')}
let bandQ=0;
function positionBand(){
  const B=document.body.classList,lf=$('#lf');
  if(!B.contains('lfshade'))return;
  if(lineDirty)computeLines();
  const n=lines.length;if(!n)return;
  focusLine=Math.min(Math.max(focusLine,0),n-1);
  let a=focusLine-Math.floor(focusN/2);if(a<0)a=0;
  let b=a+focusN-1;if(b>n-1){b=n-1;a=Math.max(0,b-focusN+1)}
  const fe=words[lines[a][0]].el.getBoundingClientRect(),le=words[lines[b][lines[b].length-1]].el.getBoundingClientRect();
  if(!fe.height||!le.height){lf.style.visibility='hidden';return}
  const st=stageEl().getBoundingClientRect(),lh=lhPx();
  let top=fe.top-Math.max(0,(lh-fe.height)/2)-st.top,bot=le.bottom+Math.max(0,(lh-le.height)/2)-st.top;
  if(bot<0||top>st.height){lf.style.visibility='hidden';return}
  lf.style.visibility='';
  top=Math.max(0,top);bot=Math.min(st.height,Math.max(bot,top+4));
  $('#lfT').style.height=top+'px';$('#lfB').style.top=bot+'px';
  const w=$('#lfWin').style;w.top=top+'px';w.height=(bot-top)+'px';
}
$('#scroll').addEventListener('scroll',()=>{if(bandQ||!document.body.classList.contains('lfshade'))return;bandQ=requestAnimationFrame(()=>{bandQ=0;positionBand()})},{passive:true});
function updateLF(){
  const B=document.body.classList;
  const live=focusN>0&&((playing&&!paused)||$('#lfKeep').checked);
  B.toggle('lfshade',live&&lfMode==='shade');B.toggle('lffade',live&&lfMode==='fade');
  if(!live){clearLit();return}

  const vp=focusViewport();
  const h=Math.min(bandH(),Math.max(0,vp.height-24));
  lfY=.5;const top=clampFocusPosition((vp.height-h)/2,vp.height,h);
  syncFocusPadding(vp,h,top);

  if(lfMode==='fade'){
    if(lineDirty)computeLines();
    focusLine=Math.min(Math.max(focusLine,0),Math.max(0,lines.length-1));
    const a=focusLine-Math.floor(focusN/2),b=a+focusN-1;
    if(a!==winA||b!==winB){
      clearLit();winA=a;winB=b;
      for(let l=Math.max(a,0);l<=Math.min(b,lines.length-1);l++)lines[l].forEach(i=>words[i].el.classList.add('lit'));
    }
  }else{
    positionBand();
  }
}

let userHold=0,scAnim=0,scFrom=0,scTo=0,scT0=0;
const reduceMotion=matchMedia('(prefers-reduced-motion:reduce)');
function cancelGlide(){if(scAnim){cancelAnimationFrame(scAnim);scAnim=0}}
function glideTo(sc,top){
  top=Math.max(0,Math.min(top,sc.scrollHeight-sc.clientHeight));
  if(Math.abs(top-sc.scrollTop)<2)return;
  if(reduceMotion.matches){sc.scrollTop=top;return}
  scFrom=sc.scrollTop;scTo=top;scT0=performance.now();
  if(scAnim)return;
  const step=t=>{const k=Math.max(0,Math.min(1,(t-scT0)/240)),e=1-Math.pow(1-k,3);sc.scrollTop=scFrom+(scTo-scFrom)*e;scAnim=k<1?requestAnimationFrame(step):0};
  scAnim=requestAnimationFrame(step);
}
let scrollRAF=0,pendingScrollEl=null,pendingScrollMode='normal';
function cancelReaderScroll(){
  cancelGlide();
  pendingScrollEl=null;
  pendingScrollMode='normal';
  if(scrollRAF){cancelAnimationFrame(scrollRAF);scrollRAF=0}
}
function queueReaderScroll(el,mode='normal'){
  if(!el||!playing||paused||!document.body.contains(el))return;
  pendingScrollEl=el;pendingScrollMode=mode;
  if(scrollRAF)return;
  scrollRAF=requestAnimationFrame(()=>{
    scrollRAF=0;
    const target=pendingScrollEl,kind=pendingScrollMode;
    pendingScrollEl=null;pendingScrollMode='normal';
    if(!target||!playing||paused||!document.body.contains(target))return;
    if(performance.now()<userHold)return;
    const vp=focusViewport(),r=target.getBoundingClientRect(),mid=(r.top+r.bottom)/2;
    const delta=mid-(vp.top+vp.height/2);
    const dead=Math.max(lhPx()*.9,vp.height*.18);if(Math.abs(delta)>dead)glideTo(vp.sc,vp.sc.scrollTop+delta);
  });
}
function centerWord(el){queueReaderScroll(el,'focus')}
function requestWordScroll(el){queueReaderScroll(el,'normal')}
['touchstart','wheel','pointerdown'].forEach(ev=>$('#scroll').addEventListener(ev,()=>{userHold=performance.now()+2500;cancelGlide()},{passive:true}));
function saveLF(msg=true){focusN=[0,1,3,5].includes(focusN)?focusN:3;lfY=Math.min(1,Math.max(0,lfY));store('pf-lf',focusN);store('pf-ly',lfY.toFixed(3));if(msg){log('Line focus saved:',{lines:focusN,position:lfY.toFixed(2),dim:$('#ld').value+'%'});toast('Line focus settings saved')}}
function dragH(el,fn){el.addEventListener('pointerdown',e=>{e.preventDefault();el.setPointerCapture?.(e.pointerId);
  const mv=ev=>{if(ev.pointerId===e.pointerId)fn(ev)},up=ev=>{if(ev.pointerId!==e.pointerId)return;el.removeEventListener('pointermove',mv);el.removeEventListener('pointerup',up);el.releasePointerCapture?.(e.pointerId);saveLF()};
  el.addEventListener('pointermove',mv);el.addEventListener('pointerup',up,{once:true})})}
dragH($('#hMove'),e=>{
  const vp=focusViewport(),h=Math.min(bandH(),Math.max(0,vp.height-24));
  const y=e.clientY-vp.top;
  const top=clampFocusPosition(y-h/2,vp.height,h);
  lfY=vp.height>h?top/(vp.height-h):0;
  {const d=$('#doc').getBoundingClientRect(),x=d.left+d.width/2,lh=lhPx();let w=null;
   for(const dy of [0,-lh/2,lh/2,-lh,lh]){const el=document.elementFromPoint(x,e.clientY+dy);w=el&&el.closest&&el.closest('.w');if(w)break}
   if(w){if(lineDirty)computeLines();focusLine=lineOf[+w.dataset.i]}}
  updateLF();
});
dragH($('#hSize'),e=>{
  const vp=focusViewport();
  const wanted=Math.round((e.clientY-$('#lfWin').getBoundingClientRect().top)/lhPx());
  const sizes=[1,3,5];
  focusN=sizes.reduce((a,b)=>Math.abs(b-wanted)<Math.abs(a-wanted)?b:a,focusN||3);
  document.querySelectorAll('.seg[data-k=lf] button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.v===String(focusN)));
  store('pf-lf',String(focusN));
  updateLF();
});
const fmtT=s=>{s=Math.max(0,Math.round(s));const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60;return h?`${h}h ${String(m).padStart(2,'0')}m`:m?`${m}m ${String(sec).padStart(2,'0')}s`:`${sec}s`};
const fmtReadMins=m=>{m=Math.max(1,Math.round(m));const h=Math.floor(m/60),r=m%60;return h?`${h}h ${r}m`: `${m} min`};
let tq=0;function updateTime(){if(!tq)tq=requestAnimationFrame(()=>{tq=0;doTime()})}
function doTime(){
  const n=words.length;if(!n){$('#time').textContent='';return}
  const sp=WPM*rate/60,total=n/sp,left=n-(cur<0?0:cur+1),readMins=n/238;
  $('#time').textContent=cur<0?`${fmtT(total)} to listen · ~${fmtReadMins(readMins)} to read`:`${fmtT(left/sp)} left of ${fmtT(total)} · ~${fmtReadMins(left/238)} reading`;
  progPct=cur<0?0:(cur+1)/n;if(!raf)drawWave();
}
function mark(i){
  if(cur>=0&&words[cur])words[cur].el.classList.remove('cur');
  cur=i;updateTime();if(i<0)return;if(!saveT)saveT=setTimeout(()=>{saveT=0;savePos()},1500);
  const el=words[i].el,dt=el.closest('details');if(dt&&!dt.open)dt.open=true;
  if($('#hw').checked)el.classList.add('cur');
  if(focusN){if(lineDirty)computeLines();if(lineOf[i]!==focusLine){focusLine=lineOf[i];updateLF()}if($('#as').checked)centerWord(el)}
  else if($('#as').checked)requestWordScroll(el)
}
function speak(from,to=Infinity){
  if(ss===NOSPEECH||typeof SpeechSynthesisUtterance==='undefined'){toast('Reading aloud is not supported in this browser. You can still read and format text.');warn('speechSynthesis is unavailable');return}
  ss.cancel();const my=++token;playing=true;paused=false;setPlay();
  const run=(i,tries=0)=>{
    if(my!==token)return;
    if(i>=words.length||i>to){if(i>=words.length){delete pos[curHash];store('pos',JSON.stringify(pos));log('Finished reading; bookmark cleared')}if(i>=words.length&&window.onChapterDone&&window.onChapterDone())return;stop();return}
    let last=i,len=0;const pe=Math.min(paras[words[i].p].end,to);
    while(last<pe){len+=words[last].t.length+1;if((len>300&&/[.!?;:,]$/.test(words[last].t))||len>600)break;last++}
    const chunk=words.slice(i,last+1),offs=[];let txt='';
    chunk.forEach(w=>{offs.push(txt.length);txt+=w.t+' '});
    const u=new SpeechSynthesisUtterance(txt);u.rate=rate;u.volume=vol;
    let v=voices[+$('#voice').value];
    if(tries===0&&v&&isBad(v.name)){const b=fallbackVoice();if(b&&b!==v){log(`"${v.name}" failed earlier in this browser, using "${b.name}" instead. Run resetVoiceFailures() in the console to retry it.`);v=b}}
    if(tries===2){const b=fallbackVoice();if(b)v=b}
    if(tries>=3){const l=voices.find(x=>x.localService);if(l)v=l}
    const origV=v;
    const det=detectLang(txt),multi=v&&/multilingual/i.test(v.name);
    if(v&&det&&!multi&&!v.lang.toLowerCase().startsWith(det.slice(0,2))){
      const alt=voices.find(x=>x.lang.toLowerCase().startsWith(det.slice(0,2)));
      if(alt){warn(`Text looks like ${det} but "${v.name}" (${v.lang}) is not multilingual. Switching to "${alt.name}".`);v=alt}
      else warn(`Text looks like ${det} but no ${det.slice(0,2)} voice is installed and "${v.name}" is not multilingual: it may stay silent or mispronounce.`)}
    if(v){u.voice=v;if(tries===0)u.lang=(multi&&det)||v.lang}
    if(tries===1||(v&&capRate[v.name]))u.rate=Math.min(rate,1);
    log('speak',{attempt:tries+1,voice:v&&v.name,voiceLang:v&&v.lang,uttLang:u.lang,multilingual:multi,detectedScript:det,localService:v&&v.localService,chars:txt.length,rate});
    let gotB=false;u.addEventListener('boundary',()=>{gotB=true;noB=false});
    u.addEventListener('start',()=>setTimeout(()=>{if(my===token&&!gotB){noB=true;warn('No word-boundary events received: this voice does not report progress, so word highlighting cannot follow it (speech still works).')}},2500));
    u.addEventListener('end',()=>log('chunk finished'));
    let et=0,ek=0,lastK=-1,synced=false;
    const wordMs=w=>(Math.max(160,w.replace(/[^\p{L}\p{N}]/gu,'').length*68+90)+(/[.!?]$/.test(w)?380:/[,;:]$/.test(w)?170:0))/rate;
    const tick=()=>{if(my!==token||gotB)return;if(paused){et=setTimeout(tick,250);return}ek++;if(ek>=chunk.length)return;lastK=Math.max(lastK,ek);mark(i+ek);wavePulse(chunk[ek].t);et=setTimeout(tick,wordMs(chunk[ek].t))};
    u.addEventListener('start',()=>setTimeout(()=>{if(my===token&&!gotB){log('No word events from this voice: using estimated word timing (common on Android).');et=setTimeout(tick,wordMs(chunk[0].t))}},600));
    u.onboundary=e=>{if(my!==token||e.name&&e.name!=='word')return;
      let k=0;while(k+1<offs.length&&offs[k+1]<=e.charIndex)k++;
      if(!synced){synced=true;lastK=Math.min(lastK,k-1)}
      if(k<=lastK)return;
      lastK=k;mark(i+k);wavePulse(chunk[k].t)};
    u.onstart=()=>{if(my!==token)return;lastK=Math.max(lastK,0);mark(i);wavePulse(chunk[0].t);
      if(tries===1&&v&&/multilingual/i.test(v.name)){capRate[v.name]=1;saveMaps();log('Worked at normal speed: this cloud voice fails at fast rates. Speed will be capped at 1x for it.');toast('This voice only works at 1× speed here, so speed is capped.')}};
    u.onend=()=>{if(my===token)run(last+1)};
    u.onerror=e=>{if(e.error!=='canceled'&&e.error!=='interrupted')warn('Speech error:',e.error,'voice:',v&&v.name,e.error==='synthesis-failed'?'(online voice may need internet / is blocked)':e.error==='language-unavailable'?'(language not supported by this voice)':e.error==='voice-unavailable'?'(voice not available)':'');if(e.error!=='canceled'&&e.error!=='interrupted'&&my===token){
      if(tries===1&&v){bad[v.name]=Date.now();saveMaps();toast('"'+v.name.replace('Microsoft ','').replace(' Online (Natural)','')+'" is not responding in this browser. Using Brian instead.')}
      if(tries<3){warn('Retrying (attempt '+(tries+2)+'/4) with '+['normal speed and no language override','a non-multilingual Brian voice','a local voice'][tries]);ss.cancel();setTimeout(()=>run(i,tries+1),150)}
      else{warn('All attempts failed. Check your internet connection or pick another voice.');stop()}}};
    ss.resume();setTimeout(()=>{if(my===token)ss.speak(u)},tries?250:80);
  };
  run(from);
}
/* ---------- bookmark: continue where you left off ---------- */
function hashText(t){let h=5381;const n=Math.min(t.length,3000);for(let i=0;i<n;i++)h=((h<<5)+h+t.charCodeAt(i))|0;return h.toString(36)+'_'+t.length}
function savePos(){
  if(cur<0||!curHash||!words.length)return;
  pos[curHash]={i:cur,t:Date.now()};
  const ks=Object.keys(pos);if(ks.length>20)ks.sort((a,b)=>pos[a].t-pos[b].t).slice(0,ks.length-20).forEach(k=>delete pos[k]);
  store('pos',JSON.stringify(pos));
}
let rsT;
function showResume(m){$('#rsMsg').textContent=m;$('#resume').style.display='flex';clearTimeout(rsT);rsT=setTimeout(()=>{$('#resume').style.display='none'},12000)}
function restorePos(){
  const p=pos[curHash];if(!p||!(p.i>0)||p.i>=words.length-2)return;
  mark(p.i);if(!focusN&&$('#as').checked)requestWordScroll(words[p.i].el);
  const pct=Math.round(p.i/words.length*100);
  showResume('Saved your place at '+pct+'%. Press play to continue.');
  log('Resumed saved position',{word:p.i,of:words.length,percent:pct});
}
$('#rsOver').onclick=()=>{delete pos[curHash];store('pos',JSON.stringify(pos));stop();mark(-1);$('#scroll').scrollTo({top:0});if(focusN){focusLine=0;updateLF()}$('#resume').style.display='none';log('Bookmark cleared, starting over')};
$('#rsX').onclick=()=>{$('#resume').style.display='none'};
addEventListener('pagehide',savePos);
document.addEventListener('visibilitychange',()=>{if(document.hidden)savePos()});

/* voice waveform: driven by real word events, shaped like speech (syllable rhythm, pauses at punctuation) */
const cv=$('#wave'),cx=cv.getContext('2d'),dpr=Math.min(window.devicePixelRatio||1,2),reduceM=matchMedia('(prefers-reduced-motion:reduce)'),coarse=matchMedia('(pointer:coarse)').matches;
let progPct=0,trackCol='#d6dde4';
function sizeWave(){const w=Math.max(1,cv.clientWidth),h=Math.max(1,cv.clientHeight),cw=Math.round(w*dpr),ch=Math.round(h*dpr);if(cv.width!==cw||cv.height!==ch){cv.width=cw;cv.height=ch}}
sizeWave();
let lastAv='',amp=0,tgt=0,wEnd=0,pauseUntil=0,ph=0,raf=0,lastT=0,noB=false,waveCol='#0f6cbd';
function wavePulse(w){
  const L=w.replace(/[^\p{L}\p{N}]/gu,'').length||1,syl=Math.max(1,Math.round(L/3)),now=performance.now();
  tgt=.42+Math.min(L,9)/9*.45+Math.random()*.1;
  wEnd=now+syl*190/rate;
  pauseUntil=/[.!?…]$/.test(w)?wEnd+420/rate:/[,;:]$/.test(w)?wEnd+200/rate:0;
  waveStart();
}
function drawWave(){
  const W=cv.width,H=cv.height;if(!W||!H)return;
  cx.clearRect(0,0,W,H);
  const mid=H/2,lw=Math.max(1.5,2*dpr),px=Math.max(0,Math.min(W,Math.round(progPct*W)));
  cx.lineCap='round';cx.lineJoin='round';cx.lineWidth=lw;
  cx.strokeStyle=trackCol;cx.beginPath();cx.moveTo(px,mid);cx.lineTo(W-lw,mid);cx.stroke();
  const A=amp*(H/2-lw*1.6),L=240*dpr,step=Math.max(2,Math.round(3*dpr));
  cx.strokeStyle=waveCol;cx.beginPath();cx.moveTo(lw/2,mid);
  for(let x=Math.max(lw/2,px-L);x<=px;x+=step){
    const env=1-(px-x)/L,y=mid+A*env*(Math.sin(x/(15*dpr)-ph*1.3)*.62+Math.sin(x/(6.5*dpr)+ph*2.3)*.38);
    cx.lineTo(x,y);
  }
  cx.lineTo(px,mid);cx.stroke();
  if(px>0){cx.fillStyle=waveCol;cx.beginPath();cx.arc(px,mid,lw*1.5,0,Math.PI*2);cx.fill()}
}
function waveLoop(t){
  if(coarse&&lastT&&t-lastT<32){raf=requestAnimationFrame(waveLoop);return}
  const dt=Math.min(50,t-(lastT||t-16));lastT=t;const sp=playing&&!paused;
  if(sp&&t>wEnd){if(noB&&t>pauseUntil)wavePulse('x'.repeat(2+(Math.random()*7|0)));else tgt=t<pauseUntil?0:.07}
  if(!sp)tgt=0;
  amp+=(tgt-amp)*(1-Math.exp(-dt/(tgt>amp?40:140)));
  ph+=dt*.012*rate*(sp?1:.3);
  drawWave();const av=amp.toFixed(1);if(av!==lastAv){lastAv=av;$('#play').style.setProperty('--amp',av)}
  raf=(sp||amp>.01)?requestAnimationFrame(waveLoop):0;
}
function waveColors(){const cs=getComputedStyle(document.documentElement);waveCol=cs.getPropertyValue('--acc').trim()||waveCol;trackCol=cs.getPropertyValue('--line').trim()||trackCol}
function waveStart(){if(raf||reduceM.matches)return;waveColors();lastT=0;raf=requestAnimationFrame(waveLoop)}
waveColors();
new MutationObserver(()=>{waveColors();drawWave()}).observe(document.documentElement,{attributes:true,attributeFilter:['data-t']});
if('ResizeObserver' in window)new ResizeObserver(()=>{sizeWave();drawWave()}).observe(cv.parentNode);
drawWave();
function stop(){token++;ss.cancel();cancelReaderScroll();playing=paused=false;setPlay()}
let wl=null,nsV=null;
function noSleep(on){
  if(!on){if(nsV){clearInterval(nsV._t);nsV.pause();nsV.srcObject=null;nsV.remove();nsV=null}return}
  const c=document.createElement('canvas');c.width=c.height=8;
  if(!c.captureStream)return Promise.resolve(false);
  const x=c.getContext('2d'),draw=()=>{x.fillStyle='#'+((Math.random()*0xffffff)|0).toString(16).padStart(6,'0');x.fillRect(0,0,8,8)};draw();
  const v=document.createElement('video');v.muted=true;v.playsInline=true;v.setAttribute('playsinline','');v.srcObject=c.captureStream(2);
  v.style.cssText='position:fixed;left:0;bottom:0;width:2px;height:2px;opacity:.01;pointer-events:none';document.body.appendChild(v);
  v._t=setInterval(draw,500);
  return v.play().then(()=>{nsV=v;log('Screen kept awake (video fallback)');return true}).catch(()=>{clearInterval(v._t);v.remove();return false});
}
async function wake(on){
  try{
    if(!on){if(wl){await wl.release();wl=null}noSleep(false);return}
    if(wl||nsV)return;
    if('wakeLock' in navigator&&window.isSecureContext){wl=await navigator.wakeLock.request('screen');wl.addEventListener('release',()=>{wl=null});log('Screen kept awake (Wake Lock)');return}
    throw new Error(window.isSecureContext?'not supported':'page is not on https')
  }catch(e){
    if(!on)return;
    log('Wake Lock unavailable ('+e.message+'). Trying video fallback.');
    if(!(await noSleep(true)))warn('Could not keep the screen awake. Raise Screen timeout in Android settings, or open the https link of the page.');
  }
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&playing&&!paused)wake(true)});
function setPlay(){wake(playing&&!paused);document.body.classList.toggle('speaking',playing&&!paused);if(playing&&!paused)waveStart();else savePos();
  updateLF();const b=$('#play');b.textContent=playing&&!paused?'⏸':'▶';b.setAttribute('aria-label',playing&&!paused?'Pause':'Play')}
function toggle(){
  if(!playing||paused){speak(cur>=0&&cur<words.length-1?cur:0);return}
  token++;ss.cancel();paused=true;setPlay();log('Paused at word',cur);
}
function jump(d){
  const pi=cur<0?0:words[cur].p,t=Math.min(Math.max(pi+d,0),paras.length-1);
  mark(paras[t].start);speak(paras[t].start);
}
function loadVoices(){
  voices=ss.getVoices();const s=$('#voice');s.innerHTML='';if(!voices.length)s.innerHTML='<option>No voices available</option>';
  const groups={};
  voices.forEach((v,i)=>{const g=/multilingual/i.test(v.name)?'Multilingual':/natural|neural/i.test(v.name)?'Natural voices':v.lang;(groups[g]=groups[g]||[]).push([v,i])});
  const rk=g=>g==='Multilingual'?0:g==='Natural voices'?1:2;
  Object.keys(groups).sort((a,b)=>rk(a)-rk(b)||a.localeCompare(b)).forEach(g=>{
    const og=document.createElement('optgroup');og.label=g;
    groups[g].forEach(([v,i])=>{const o=document.createElement('option');o.value=i;
      o.textContent=v.name.replace('Microsoft ','').replace(' Online (Natural)','');og.appendChild(o)});
    s.appendChild(og)});
  let idx=voices.findIndex(v=>v.name===load('voice'));
  if(idx<0)idx=voices.findIndex(v=>/Brian.*Multilingual/i.test(v.name));
  if(idx<0)idx=voices.findIndex(v=>/Brian/i.test(v.name));
  if(idx<0&&load('pf-pn')!=='0')idx=voices.findIndex(v=>/natural|neural/i.test(v.name)&&v.lang.toLowerCase().startsWith(navigator.language.slice(0,2).toLowerCase()));
  if(idx<0)idx=voices.findIndex(v=>v.lang.startsWith(navigator.language.slice(0,2))&&v.default);
  if(idx>=0&&isBad(voices[idx].name)){const b=voices.findIndex(v=>v===fallbackVoice());if(b>=0)idx=b}
  if(voices.length)s.value=Math.max(idx,0);
  const multi=voices.filter(v=>/multilingual/i.test(v.name));
  log(`${voices.length} voices loaded. Browser: ${/Edg\//.test(navigator.userAgent)?'Edge':'NOT Edge'}`);
  if(!voices.length)log('No voices yet (normal: they load asynchronously, retrying).');
  else{
    if(!multi.length)warn('No "Multilingual" voices found. Edge online voices like "Microsoft BrianMultilingual Online (Natural)" only appear in Microsoft Edge with internet access; other browsers only list OS voices.');
    else log('Multilingual voices:',multi.map(v=>v.name));
    const online=voices.filter(v=>!v.localService).length;log(`Online voices: ${online}, local voices: ${voices.length-online}`);
    log('Selected voice:',voices[Math.max(idx,0)]&&voices[Math.max(idx,0)].name,idx<0?'(no saved/Brian match; used first voice)':'');
  }
}
ss.onvoiceschanged=loadVoices;loadVoices();
setTimeout(()=>{if(!voices.length)loadVoices()},1500);
window.diagnose=()=>{loadVoices();log('Type diagnose() any time. speaking:',ss.speaking,'paused:',ss.paused,'pending:',ss.pending)};

/* selection */
const tip=$('#tip');let selA=-1,selB=-1;
function checkSel(){
  const s=getSelection();
  if(!s.rangeCount||s.isCollapsed||!$('#doc').contains(s.anchorNode)){tip.style.display='none';return}
  const r=s.getRangeAt(0);selA=selB=-1;
  words.forEach((w,i)=>{if(r.intersectsNode(w.el)){if(selA<0)selA=i;selB=i}});
  if(selA<0){tip.style.display='none';return}
  const b=r.getBoundingClientRect(),m=$('main').getBoundingClientRect();
  tip.style.display='flex';
  tip.style.left=Math.max(8,Math.min(b.left-m.left+b.width/2-tip.offsetWidth/2,m.width-tip.offsetWidth-8))+'px';
  tip.style.top=(matchMedia('(pointer:coarse)').matches?b.bottom-m.top+46:Math.max(8,b.top-m.top-tip.offsetHeight-8))+'px';
}
$('#doc').addEventListener('mouseup',()=>setTimeout(checkSel,10));
$('#doc').addEventListener('touchend',()=>setTimeout(checkSel,300));
let selT;document.addEventListener('selectionchange',()=>{
  if(getSelection().isCollapsed){tip.style.display='none';return}
  if(matchMedia('(pointer:coarse)').matches){clearTimeout(selT);selT=setTimeout(checkSel,450)}});
tip.addEventListener('mousedown',e=>e.preventDefault());
const clear=()=>{getSelection().removeAllRanges();tip.style.display='none'};
$('#tRead').onclick=()=>{const a=selA,b=selB;clear();mark(a);speak(a,b)};
$('#tFrom').onclick=()=>{const a=selA;clear();mark(a);speak(a)};
$('#tDef').onclick=()=>{const t=getSelection().toString().trim();clear();open('https://www.google.com/search?q=define+'+encodeURIComponent(t),'_blank','noopener')};
$('#doc').addEventListener('click',e=>{
  const w=e.target.closest('.w');
  if(w&&getSelection().isCollapsed&&focusN){if(lfMode==='fade'){if(lineDirty)computeLines();focusLine=lineOf[+w.dataset.i];updateLF()}centerWord(w)}
});

/* ---------- desktop layout switch ---------- */
const viewMode=$('#viewMode');
function setDesktopLayout(on,save=true){
  document.body.classList.toggle('force-desktop',!!on);
  viewMode.setAttribute('aria-pressed',on?'true':'false');
  viewMode.textContent=on?'Mobile layout':'Desktop layout';
  viewMode.title=on?'Return to the phone-optimized layout':'Use desktop-style layout on phones';
  if(save)store('ui-desktop',on?'1':'0');
  if(panel.classList.contains('open'))setPanel(true); else layout();
}
viewMode.onclick=()=>setDesktopLayout(!document.body.classList.contains('force-desktop'));
const savedDesktop=load('ui-desktop')==='1';

/* ---------- secret emergency reset ---------- */
const resetGate=$('#resetGate');
let secretTaps=0,secretTimer=0;
function openResetGate(){resetGate.hidden=false;document.body.classList.add('reset-open');$('#resetCancel').focus({preventScroll:true})}
function closeResetGate(){resetGate.hidden=true;document.body.classList.remove('reset-open')}
$('#resetCancel').onclick=closeResetGate;
resetGate.addEventListener('click',e=>{if(e.target===resetGate)closeResetGate()});
document.addEventListener('keydown',e=>{if(!resetGate.hidden&&e.key==='Escape')closeResetGate()});
$('#resetAll').onclick=async()=>{
  $('#resetAll').disabled=true;
  try{
    try{speechSynthesis.cancel()}catch{}
    try{sessionStorage.clear()}catch{}
    try{localStorage.clear()}catch{}
    try{
      if('caches' in window){const ks=await caches.keys();await Promise.all(ks.map(k=>caches.delete(k)))}
    }catch(err){console.warn('Cache Storage reset failed',err)}
    try{
      if('serviceWorker' in navigator){const regs=await navigator.serviceWorker.getRegistrations();await Promise.all(regs.map(r=>r.unregister()))}
    }catch(err){console.warn('Service worker reset failed',err)}
    try{
      const d=indexedDB.open('ra',2);
      await new Promise((resolve,reject)=>{
        d.onerror=()=>reject(d.error);
        d.onupgradeneeded=()=>{};
        d.onsuccess=()=>{
          const db=d.result;
          const names=[...db.objectStoreNames].filter(n=>n==='f'||n==='img');
          if(!names.length){db.close();resolve();return}
          const tx=db.transaction(names,'readwrite');
          names.forEach(n=>tx.objectStore(n).clear());
          tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>{db.close();reject(tx.error)};
        };
      });
      await new Promise(resolve=>{const q=indexedDB.deleteDatabase('ra');q.onsuccess=q.onerror=q.onblocked=()=>resolve()})
    }catch(err){console.warn('IndexedDB reset failed',err)}
  }finally{
    closeResetGate();
    alert('All Read Aloud app data was cleared. The page will reload.');
    location.reload();
  }
};
const secretTitle=$('header h1');
secretTitle.title='Tap 7 times for emergency app-data reset';
secretTitle.addEventListener('click',()=>{
  secretTaps++;
  clearTimeout(secretTimer);
  secretTimer=setTimeout(()=>secretTaps=0,1800);
  if(secretTaps>=7){secretTaps=0;openResetGate()}
});
/* Also provide a keyboard escape hatch for desktop: Ctrl+Alt+Shift+R. */
document.addEventListener('keydown',e=>{
  if(e.ctrlKey&&e.altKey&&e.shiftKey&&e.key.toLowerCase()==='r'){e.preventDefault();openResetGate()}
  // A: Previous Chapter, D: Next Chapter
  if(e.key==='a'||e.key==='A'){
    if(!(e.target instanceof HTMLInputElement)&&!(e.target instanceof HTMLTextAreaElement)&&!e.target.isContentEditable){
      e.preventDefault();
      const chapSel=document.getElementById('chSel');
      if(chapSel&&chapSel.selectedIndex>0){
        chapSel.selectedIndex--;
        chapSel.onchange?.();
      }
    }
  }
  if(e.key==='d'||e.key==='D'){
    if(!(e.target instanceof HTMLInputElement)&&!(e.target instanceof HTMLTextAreaElement)&&!e.target.isContentEditable){
      e.preventDefault();
      const chapSel=document.getElementById('chSel');
      if(chapSel&&chapSel.selectedIndex<chapSel.options.length-1){
        chapSel.selectedIndex++;
        chapSel.onchange?.();
      }
    }
  }
});

/* prefs */
const root=document.documentElement;
function setSeg(k,v,save=true){
  document.querySelectorAll(`.seg[data-k=${k}] button`).forEach(b=>b.setAttribute('aria-pressed',b.dataset.v===String(v)));
  if(k==='ff'){root.style.setProperty('--ff',v);root.style.setProperty('--fz',/Garamond/.test(v)?1.12:1)}
  if(k==='cols')root.style.setProperty('--cols',v);
  if(k==='imgsz'){const W={small:'40%',medium:'70%',large:'100%'};root.style.setProperty('--img-w',W[v]||W.large)}
  if(k==='th'){setTimeout(applyColors,0);if(!load('pf-ld')){const d=v==='dark'?55:70;$('#ld').value=d}
  if(v==='light')root.dataset.t='light';else root.dataset.t=v}
  if(k==='lf'){focusN=+v;applyFocus()}
  if(k==='lm'){lfMode=v;applyFocus()}
  if(save)store('pf-'+k,v);
  requestAnimationFrame(layout);
}
document.querySelectorAll('.seg').forEach(g=>g.addEventListener('click',e=>{const b=e.target.closest('button');if(b)setSeg(g.dataset.k,b.dataset.v)}));
$('#br').oninput=e=>{setBr(e.target.value);store('pf-br',e.target.value)};
const panel=$('#panel'),isSheet=()=>!document.body.classList.contains('force-desktop')&&matchMedia('(max-width:760px)').matches;
if(savedDesktop)setDesktopLayout(true,false);
function setPanel(open){
  const sheet=isSheet();
  panel.classList.toggle('open',open);
  $('#prefs').setAttribute('aria-expanded',open?'true':'false');
  $('#scrim').hidden=!(open&&sheet);
  panel.setAttribute('aria-modal',open&&sheet?'true':'false');
  document.body.classList.toggle('prefs-open',open);
  if(open){
    requestAnimationFrame(()=>{panel.scrollTop=0;try{$('#pClose').focus({preventScroll:true})}catch(_){}});
  }else{
    $('#prefs').focus({preventScroll:true});
  }
  setTimeout(layout,50);
}
$('#prefs').onclick=()=>setPanel(!panel.classList.contains('open'));
$('#scrim').addEventListener('click',e=>{if(e.target===e.currentTarget)setPanel(false)});
document.addEventListener('keydown',e=>{
  if(!panel.classList.contains('open'))return;
  if(e.key==='Escape'){setPanel(false);return}
  if(e.key==='Tab'&&isSheet()){
    const f=[...panel.querySelectorAll('button,input:not([hidden]),select,summary,a[href]')].filter(x=>x.offsetParent!==null&&!x.disabled);
    if(!f.length)return;const a=f[0],z=f[f.length-1];
    if(e.shiftKey&&document.activeElement===a){e.preventDefault();z.focus()}
    else if(!e.shiftKey&&document.activeElement===z){e.preventDefault();a.focus()}
  }
});
$('#edit').onclick=()=>{setTimeout(layout,60);const e=document.body.classList.toggle('edit');$('#edit').textContent=e?'Back to reader':'Edit text';if(e)stop()};
$('#go').onclick=()=>{const t=$('#src').value;if(!t.trim())return;document.body.classList.remove('edit');$('#edit').textContent='Edit text';store('text',t);if(t.length<2e5){hist=[{t,d:Date.now()},...hist.filter(x=>x.t!==t)].slice(0,8);store('hist',JSON.stringify(hist));drawHist()}else log('Long text: not added to history (saved as current text only).');render(t);focusLine=0;applyFocus()};
$('#play').onclick=toggle;$('#prev').onclick=()=>jump(-1);$('#next').onclick=()=>jump(1);
/* Collapsible voice dock; preserves the user's existing reader state and controls. */
const voiceBar=$('#bar'),voiceBarToggle=$('#barToggle');
/** @param {boolean} collapsed */
function setVoiceBarCollapsed(collapsed){
  voiceBar.classList.toggle('is-collapsed',collapsed);
  voiceBar.classList.remove('hover-expanded');
  voiceBarToggle.setAttribute('aria-expanded',String(!collapsed));
  voiceBarToggle.setAttribute('aria-label',collapsed?'Expand voice player':'Collapse voice player');
  voiceBarToggle.title=collapsed?'Expand voice player':'Collapse voice player';
  const path=voiceBarToggle.querySelector('path');
  if(path)path.setAttribute('d',collapsed?'m6 10 6 6 6-6':'m6 14 6-6 6 6');
  try{localStorage.setItem('bar-collapsed',collapsed?'1':'0')}catch(_){}
}
setVoiceBarCollapsed(load('bar-collapsed')==='1'||(innerWidth>=761&&load('bar-collapsed')!=='0'));
voiceBarToggle.onclick=()=>setVoiceBarCollapsed(!voiceBar.classList.contains('is-collapsed'));
// Desktop hover opens the dock without moving the anchor; the dock grows upward from its bottom edge.
voiceBar.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse'&&innerWidth>=761&&voiceBar.classList.contains('is-collapsed'))voiceBar.classList.add('hover-expanded')});
voiceBar.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse')voiceBar.classList.remove('hover-expanded')});
voiceBar.addEventListener('focusout',()=>{requestAnimationFrame(()=>{if(!voiceBar.contains(document.activeElement))voiceBar.classList.remove('hover-expanded')})});

$('#rate').onchange=e=>{rate=+e.target.value;updateTime();if(playing&&!paused)speak(Math.max(cur,0))};
$('#voice').onchange=()=>{store('voice',voices[+$('#voice').value].name);if(playing&&!paused)speak(Math.max(cur,0))};
let rz,lastW=innerWidth;addEventListener('resize',()=>{if(innerWidth===lastW&&playing&&!paused)return;lastW=innerWidth;cancelAnimationFrame(rz);rz=requestAnimationFrame(layout)});
/* ---------- open file ---------- */
const loadScript=async u=>{if(!(await netAsk(new URL(u).host,'Load the helper that reads PDF and Word files.',u)))throw new Error('network access denied');return new Promise((ok,no)=>{if(document.querySelector('script[src="'+u+'"]'))return ok();const e=document.createElement('script');e.src=u;e.onload=ok;e.onerror=()=>no(new Error('could not load '+u));document.head.appendChild(e)})};
function htmlToMd(html){
  const d=new DOMParser().parseFromString(html,'text/html');d.querySelectorAll('script,style,noscript,svg,nav,footer').forEach(e=>e.remove());
  let out='';
  const enc=u=>u.replace(/\s/g,'%20').replace(/\(/g,'%28').replace(/\)/g,'%29');
  const imgMd=n=>{const sr=(n.getAttribute('src')||'').trim();
    if(!(/^https?:/i.test(sr)||(/^data:image\//i.test(sr)&&sr.length<2e5)))return '';
    return '!['+(n.getAttribute('alt')||'').replace(/[\[\]\n]/g,' ').trim()+']('+enc(sr)+')'};
  const kids=n=>n.childNodes.forEach(walk);
  function walk(n){
    if(n.nodeType===3){out+=n.textContent.replace(/\s+/g,' ');return}
    if(n.nodeType!==1)return;
    const t=n.tagName.toLowerCase();
    if(/^h[1-6]$/.test(t)){out+='\n\n'+'#'.repeat(Math.min(+t[1],3))+' ';kids(n);out+='\n\n';return}
    if(t==='li'){out+='\n- ';kids(n);return}
    if(t==='img'){const m=imgMd(n);if(m)out+='\n\n'+m+'\n\n';return}
    if(t==='a'){const h=(n.getAttribute('href')||'').trim();
      if(!/^(https?:|mailto:)/i.test(h)){kids(n);return}
      const im=n.querySelector('img'),mm=im&&imgMd(im);
      if(mm&&!n.textContent.trim()){out+='\n\n['+mm+']('+enc(h)+')\n\n';return}
      out+='[';kids(n);out+=']('+enc(h)+')';return}
    if(t==='br'){out+='\n';return}
    if(t==='blockquote'){out+='\n\n> ';kids(n);out+='\n\n';return}
    if(t==='strong'||t==='b'){out+='**';kids(n);out+='**';return}
    if(t==='em'||t==='i'){out+='*';kids(n);out+='*';return}
    const blk=/^(p|div|section|article|ul|ol|table|tr|pre|header|main)$/.test(t);
    if(blk)out+='\n\n';kids(n);if(blk)out+='\n\n';
  }
  walk(d.body);
  return out.replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').replace(/\*\*\s*\*\*/g,'').trim();
}
async function readFileText(file){
  const ext=(file.name.split('.').pop()||'').toLowerCase();
  if(ext==='docx'){await loadScript('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js');
    const r=await mammoth.convertToHtml({arrayBuffer:await file.arrayBuffer()});return htmlToMd(r.value)}
  if(ext==='pdf'){
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
    pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const pdf=await pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise,out=[];
    for(let p=1;p<=pdf.numPages;p++){const pg=await pdf.getPage(p),c=await pg.getTextContent();
      out.push(c.items.map(x=>x.str+(x.hasEOL?'\n':'')).join(' ').replace(/ +/g,' ').trim());pg.cleanup()}
    await pdf.destroy();return out.join('\n\n')}
  const t=await file.text();return /^(html?|xhtml)$/.test(ext)?htmlToMd(t):t;
}
async function openFile(file){
  if(!file)return;if(file.size>8e6){toast('File is too large (8 MB max)');return}
  toast('Opening '+file.name+'…');
  try{
    const t=(await readFileText(file)).trim();
    if(!t){toast('No readable text found in that file');warn('No text found in',file.name);return}
    $('#src').value=t;store('text',t);const n=t.split(/\s+/).length;
    log('Opened file:',file.name,{words:n,type:file.type||'unknown'});
    toast('Loaded '+file.name+' ('+n.toLocaleString()+' words). Press Start reading.');
  }catch(err){warn('Could not open file:',err.message||err,'(PDF and Word need to load a helper from cdnjs.cloudflare.com)');toast('Could not read that file. See Console.')}
}
$('#fOpen').onclick=()=>$('#openF').click();
$('#openF').onchange=e=>{openFile(e.target.files[0]);e.target.value=''};
$('#tCopy').onclick=()=>{const t=$('#src').value;(navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(()=>toast('Text copied'),()=>{$('#src').select();toast('Press Ctrl+C to copy')})};
$('#tPaste').onclick=async()=>{
  const src=$('#src');
  const apply=t=>{
    if(!t)return;
    if($('#ar').checked){src.value=t;store('text',t);log('Pasted text replaced the old text ('+t.length+' chars)')}
    else{const a=src.selectionStart==null?src.value.length:src.selectionStart,b=src.selectionEnd==null?a:src.selectionEnd;src.setRangeText(t,a,b,'end');log('Pasted text at the cursor ('+t.length+' chars)')}
    src.focus({preventScroll:true});toast('Pasted from clipboard');
  };
  try{
    if(!(navigator.clipboard&&navigator.clipboard.readText))throw new Error('clipboard unavailable');
    const t=await navigator.clipboard.readText();
    if(t)apply(t);else toast('Clipboard is empty');
  }catch(_){
    src.focus({preventScroll:true});
    toast('Clipboard is blocked. Press and hold in the text box, then tap Paste.');
  }
};
addEventListener('dragover',e=>{if(e.dataTransfer&&[...e.dataTransfer.types].includes('Files'))e.preventDefault()});
addEventListener('drop',e=>{const f=e.dataTransfer&&e.dataTransfer.files[0];if(!f)return;e.preventDefault();if(!document.body.classList.contains('edit'))$('#edit').click();if(f.type.startsWith('image/'))addImages(e.dataTransfer.files);else openFile(f)});

/* ---------- add local images ---------- */
async function addImage(file){
  let blob=file;
  if(!/svg|gif/.test(file.type)){
    const bmp=await createImageBitmap(file),sc=Math.min(1,(innerWidth<760?1200:1600)/Math.max(bmp.width,bmp.height));
    const c=document.createElement('canvas');c.width=Math.round(bmp.width*sc);c.height=Math.round(bmp.height*sc);
    const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.drawImage(bmp,0,0,c.width,c.height);if(bmp.close)bmp.close();
    blob=await new Promise(r=>c.toBlob(r,'image/jpeg',.85));
  }else if(file.size>2e6)throw new Error('GIF and SVG files over 2 MB are not supported');
  const id='i'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
  await imgPut(id,blob);
  const ta=$('#src'),alt=(file.name||'image').replace(/\.[^.]+$/,'').replace(/[\[\]()]/g,''),md='\n\n!['+alt+'](local:'+id+')\n\n',p=ta.selectionStart,q=ta.selectionEnd;
  ta.value=ta.value.slice(0,p)+md+ta.value.slice(q);ta.selectionStart=ta.selectionEnd=p+md.length;
  store('text',ta.value);log('Image added:',{id,kb:Math.round(blob.size/1024)});
}
async function addImages(files){
  let n=0;
  for(const f of files){if(!f.type.startsWith('image/'))continue;
    try{await addImage(f);n++}catch(e){warn('Could not add image:',e.message||e);toast('Could not add that image. See Console.')}}
  if(n)toast(n+' image'+(n>1?'s':'')+' added. Stored on this device.');
}
$('#iAdd').onclick=()=>$('#iFile').click();
$('#iFile').onchange=e=>{addImages(e.target.files);e.target.value=''};

/* ---------- keyboard shortcuts ---------- */
function stepRate(d){const sl=$('#rate'),i=Math.min(Math.max(sl.selectedIndex+d,0),sl.options.length-1);sl.selectedIndex=i;sl.dispatchEvent(new Event('change'));toast('Speed '+sl.options[i].text)}
function moveFocus(dir){
  if(!focusN)return;
  if(lineDirty)computeLines();
  {
    focusLine=Math.min(Math.max(focusLine+dir,0),Math.max(0,lines.length-1));
    updateLF();
    const L=lines[focusLine];
    if(L&&playing&&!paused)queueReaderScroll(words[L[0]].el,'focus');
    else if(L){const r=words[L[0]].el.getBoundingClientRect(),vp=focusViewport();const h=Math.min(bandH(),Math.max(0,vp.height-24)),top=clampFocusPosition(lfY*vp.height,vp.height,h),bt=vp.top+top,bb=bt+h;let d=0;if(r.top<bt)d=r.top-bt;else if(r.bottom>bb)d=r.bottom-bb;if(Math.abs(d)>2)vp.sc.scrollTop+=d}
  }
}
const ACTS={
  play:['Play / pause',()=>toggle()],
  prev:['Previous paragraph',()=>jump(-1)],
  next:['Next paragraph',()=>jump(1)],
  faster:['Faster',()=>stepRate(1)],
  slower:['Slower',()=>stepRate(-1)],
  fUp:['Line focus up',()=>moveFocus(-1)],
  fDown:['Line focus down',()=>moveFocus(1)],
  lf:['Cycle line focus',()=>{const o=[0,1,3,5];setSeg('lf',o[(o.indexOf(focusN)+1)%o.length])}],
  sel:['Read selection',()=>{checkSel();if(selA>=0)$('#tRead').click()}],
  prefs:['Preferences',()=>$('#prefs').click()],
  edit:['Edit text / back',()=>$('#edit').click()],
  con:['Console',()=>$('#conBtn').click()],
  fs:['Full screen',()=>{if(window.toggleFS)window.toggleFS()}]
};
const DEFK={play:'Space',prev:'ArrowLeft',next:'ArrowRight',faster:']',slower:'[',fUp:'ArrowUp',fDown:'ArrowDown',lf:'L',sel:'R',prefs:'P',edit:'E',con:'C',fs:'F'};
// @typedef {{play:string,prev:string,next:string,faster:string,slower:string,fUp:string,fDown:string,lf:string,sel:string,prefs:string,edit:string,con:string,fs:string}} ShortcutMap
// @type {ShortcutMap}

let keys={...DEFK},rebind=null;try{Object.assign(keys,JSON.parse(load('keys')||'{}'))}catch(e){}
const combo=e=>{const k=e.key===' '?'Space':e.key.length===1?e.key.toUpperCase():e.key;
  return(e.ctrlKey?'Ctrl+':'')+(e.altKey?'Alt+':'')+(e.metaKey?'Meta+':'')+(e.shiftKey&&k.length>1?'Shift+':'')+k};
function drawKeys(){const box=$('#keys');box.innerHTML='';
  Object.keys(ACTS).forEach(k=>{const r=document.createElement('div');r.className='krow';
    const l=document.createElement('span');l.textContent=ACTS[k][0];
    const b=document.createElement('button');b.textContent=rebind===k?'Press a key…':(keys[k]||'None');if(rebind===k)b.className='rec';
    b.onclick=()=>{rebind=k;drawKeys()};r.append(l,b);box.appendChild(r)})}
$('#kReset').onclick=()=>{keys={...DEFK};store('keys','{}');rebind=null;drawKeys();toast('Shortcuts reset')};
document.getElementById('shortcutHelp')?.addEventListener('click', function(){ document.getElementById('prefs').click(); const sections=Array.from(document.querySelectorAll('#panel details')); const section=sections.find(function(d){ const summary=d.querySelector('summary'); return summary && summary.textContent.trim()==='Keyboard shortcuts'; }); if(section){ section.open=true; section.scrollIntoView({block:'nearest',behavior:'smooth'}); } toast('Shortcuts: Space play/pause, arrows move paragraphs, brackets change speed, P preferences, E edit, C console, F full screen.'); });
addEventListener('keydown',e=>{
  if(['Shift','Control','Alt','Meta'].includes(e.key))return;
  const c=combo(e);
  if(rebind){e.preventDefault();e.stopPropagation();
    if(c==='Escape'){rebind=null;drawKeys();return}
    const val=(c==='Backspace'||c==='Delete')?'':c;
    if(val)for(const k in keys)if(k!==rebind&&keys[k]===val){keys[k]='';toast(`"${val}" moved from "${ACTS[k][0]}"`)}
    keys[rebind]=val;store('keys',JSON.stringify(keys));log('Shortcut set:',ACTS[rebind][0],'=',val||'none');rebind=null;drawKeys();return}
  const t=e.target,typing=t.tagName==='TEXTAREA'||t.tagName==='SELECT'||(t.tagName==='INPUT'&&/text|url|search|number/.test(t.type));
  if(typing)return;
  if(t.closest&&t.closest('#chapBar,#chapDrawer,#ctxMenu,#moreBtn,#floatChap,#chapBtn,#selBar'))return;
  const act=Object.keys(keys).find(k=>keys[k]&&keys[k]===c);
  if(!act)return;
  if(document.body.classList.contains('edit')&&!['edit','prefs','con'].includes(act))return;
  e.preventDefault();if(t.tagName==='BUTTON'||t.tagName==='INPUT')t.blur();
  ACTS[act][1]();
},true);
drawKeys();

/* ---------- reading-area colors ---------- */
const toHex=c=>'#'+(c.match(/\d+/g)||[0,0,0]).slice(0,3).map(x=>(+x).toString(16).padStart(2,'0')).join('');
const isLight=h=>{const n=parseInt(h.slice(1),16);return(.299*(n>>16)+.587*(n>>8&255)+.114*(n&255))/255>.55};
function applyColors(){
  const sc=$('#scroll').style,bg=load('c-bg'),ink=load('c-ink'),hl=load('c-hl');
  bg?sc.setProperty('--rbg',bg):sc.removeProperty('--rbg');
  ink?sc.setProperty('--rink',ink):sc.removeProperty('--rink');
  if(hl){sc.setProperty('--hl',hl);sc.setProperty('--hlink',isLight(hl)?'#111':'#fff')}else{sc.removeProperty('--hl');sc.removeProperty('--hlink')}
  const cs=getComputedStyle(document.documentElement),hv=cs.getPropertyValue('--hl').trim();
  $('#cBg').value=bg||toHex(getComputedStyle(document.body).backgroundColor);
  $('#cInk').value=ink||toHex(getComputedStyle($('#doc')).color);
  $('#cHl').value=hl||(/^#[0-9a-f]{6}$/i.test(hv)?hv:'#ffe27a');
}
[['cBg','c-bg'],['cInk','c-ink'],['cHl','c-hl']].forEach(([id,k])=>$('#'+id).oninput=e=>{store(k,e.target.value);applyColors()});
$('#cReset').onclick=()=>{['c-bg','c-ink','c-hl'].forEach(k=>store(k,''));applyColors();toast('Colors reset')};

/* ---------- custom fonts ---------- */
const DEFFONT='"Noto Sans",system-ui,sans-serif',fv=n=>`"${n}",sans-serif`;
let fonts=[];try{fonts=JSON.parse(load('fonts')||'[]')}catch(e){}
const idb=()=>new Promise((res,rej)=>{const r=indexedDB.open('ra',2);r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains('f'))d.createObjectStore('f',{keyPath:'n'});if(!d.objectStoreNames.contains('img'))d.createObjectStore('img',{keyPath:'id'})};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
const idbPut=async(n,buf)=>{const d=await idb();return new Promise((res,rej)=>{const t=d.transaction('f','readwrite');t.objectStore('f').put({n,buf});t.oncomplete=res;t.onerror=()=>rej(t.error)})};
const idbGet=async n=>{const d=await idb();return new Promise((res,rej)=>{const q=d.transaction('f').objectStore('f').get(n);q.onsuccess=()=>res(q.result&&q.result.buf);q.onerror=()=>rej(q.error)})};
const imgPut=async(id,blob)=>{const d=await idb();return new Promise((res,rej)=>{const t=d.transaction('img','readwrite');t.objectStore('img').put({id,blob});t.oncomplete=res;t.onerror=()=>rej(t.error)})};
const imgGet=async id=>{const d=await idb();return new Promise((res,rej)=>{const q=d.transaction('img').objectStore('img').get(id);q.onsuccess=()=>res(q.result&&q.result.blob);q.onerror=()=>rej(q.error)})};
const idbClear=async()=>{const d=await idb();d.transaction('f','readwrite').objectStore('f').clear()};
function fontBtn(n,fam=n){const g=document.querySelector('.seg[data-k=ff]');if([...g.children].some(b=>b.dataset.v===fv(fam)))return;
  const b=document.createElement('button');b.dataset.v=fv(fam);b.textContent=n;if(load('pf-ff')===fv(fam))b.setAttribute('aria-pressed','true');g.appendChild(b)}
async function loadFont(f,buf){
  try{
    if(f.t==='css'){
      const famsNow=()=>[...new Set([...document.fonts].map(x=>x.family.replace(/["']/g,'')))],before=new Set(famsNow());
      if(!(await netAsk(new URL(f.u).host,'Load the custom font "'+f.n+'".',f.u)))throw new Error('network access denied');
      await new Promise((ok,no)=>{const l=document.createElement('link');l.rel='stylesheet';l.href=f.u;l.onload=ok;l.onerror=()=>no(new Error('stylesheet blocked or not found'));document.head.appendChild(l)});
      const fams=famsNow().filter(x=>!before.has(x)),w=f.n.toLowerCase();
      f.fam=fams.find(x=>x.toLowerCase()===w)||fams.find(x=>x.toLowerCase().includes(w)||w.includes(x.toLowerCase()))||fams[0]||f.fam||f.n;
      if(f.fam!==f.n)log('That stylesheet has no font named "'+f.n+'", so it is using "'+f.fam+'" from it.');
      await document.fonts.load(`16px "${f.fam}"`)}
    else if(f.t==='url'){if(!(await netAsk(new URL(f.u).host,'Load the custom font "'+f.n+'".',f.u)))throw new Error('network access denied');const ff=new FontFace(f.n,`url(${f.u})`);await ff.load();document.fonts.add(ff)}
    else if(f.t==='idb'){const b=buf||await idbGet(f.n);if(!b)throw new Error('saved file missing');const ff=new FontFace(f.n,b);await ff.load();document.fonts.add(ff)}
    fontBtn(f.n,f.fam||f.n);log('Font ready:',f.fam||f.n,'('+f.t+')');return true
  }catch(err){warn('Font failed:',f.n,err.message||err,'| The hosted page only allows Google Fonts links. Use Upload file, or open your downloaded copy of the page.');toast('Could not load "'+f.n+'". See Console.');return false}
}
$('#fAdd').onclick=async()=>{
  let n=$('#fName').value.trim();const u=$('#fUrl').value.trim();let t='local';
  if(!n&&!u)return toast('Enter a font name or a link');
  if(u){t=/\.(woff2?|ttf|otf)(\?|#|$)/i.test(u)?'url':'css';
    if(!n&&t==='css'){const m=u.match(/family=([^:&]+)/);if(m)n=decodeURIComponent(m[1]).replace(/\+/g,' ')}
    if(!n)return toast('Enter the font name too')}
  const f={n,u,t};
  if(t==='local')fontBtn(n);else if(!(await loadFont(f)))return;
  fonts=fonts.filter(x=>x.n!==n);fonts.push(f);store('fonts',JSON.stringify(fonts));
  setSeg('ff',fv(f.fam||n));toast('Font "'+n+'" added');$('#fName').value='';$('#fUrl').value='';
};
$('#fPick').onclick=()=>$('#fFile').click();
$('#fFile').onchange=async e=>{
  const file=e.target.files[0];if(!file)return;
  const n=$('#fName').value.trim()||file.name.replace(/\.[^.]+$/,''),buf=await file.arrayBuffer();
  try{await idbPut(n,buf)}catch(err){warn('Could not save the font for next visit:',err.message||err)}
  const f={n,t:'idb'};if(!(await loadFont(f,buf)))return;
  fonts=fonts.filter(x=>x.n!==n);fonts.push(f);store('fonts',JSON.stringify(fonts));
  setSeg('ff',fv(f.fam||n));toast('Font "'+n+'" added');$('#fName').value='';e.target.value='';
};
$('#fClear').onclick=()=>{fonts=[];store('fonts','[]');idbClear().catch(()=>{});
  [...document.querySelectorAll('.seg[data-k=ff] button')].slice(5).forEach(b=>b.remove());setSeg('ff',DEFFONT);toast('Custom fonts removed')};
fonts.forEach(f=>f.t==='local'?fontBtn(f.n):loadFont(f));

/* line focus prefs + console panel */
document.querySelector('.seg[data-k=lf]').addEventListener('click',()=>saveLF());
$('#ld').oninput=e=>{setDim(e.target.value);store('pf-ld',e.target.value)};
$('#lfReset').onclick=()=>{lfY=.5;$('#ld').value=70;setDim(70);setSeg('lf',3);setSeg('lm','fade');focusLine=0;store('pf-ly','.5');store('pf-ld','70');clearReaderFocusPadding();updateLF();toast('Line focus reset');log('Line focus reset to defaults')};
{const d=load('pf-ld');if(d){$('#ld').value=d;setDim(d)}}
$('#conBtn').onclick=()=>{$('#con').classList.toggle('open');if($('#con').classList.contains('open'))_drawCon()};
$('#conX').onclick=()=>$('#con').classList.remove('open');
$('#conClr').onclick=()=>{conLog.length=0;$('#conOut').innerHTML=''};
$('#conCopy').onclick=()=>{const t=conLog.map(l=>`${l.t} [${l.k}] ${l.m}`).join('\n');(navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(()=>toast('Console log copied'),()=>toast('Could not copy: select the text instead'))};
/* ---------- network permission prompt + volume ---------- */
let netQ=Promise.resolve();
function netAsk(host,why,url){
  const sv=load('net:'+host);
  if(sv==='1')return Promise.resolve(true);
  if(sv==='0')return Promise.resolve(false);
  const run=()=>new Promise(res=>{
    const g=$('#netGate'),done=ok=>{g.hidden=true;if($('#netRem').checked)store('net:'+host,ok?'1':'0');log('Network access to',host,ok?'allowed':'denied');res(ok)};
    $('#netWhy').textContent='"Read aloud" wants to connect to the network. '+why+' If you do not recognize this request, deny it.';
    $('#netUrl').textContent=url||('https://'+host);
    g.hidden=false;$('#netAllow').onclick=()=>done(true);$('#netDeny').onclick=()=>done(false);$('#netAllow').focus({preventScroll:true});
  });
  netQ=netQ.then(run,run);return netQ;
}
const FONT_URL='https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;600;700&family=EB+Garamond:wght@400;600&family=Atkinson+Hyperlegible:wght@400;700&family=Lexend:wght@400;600&family=Comic+Neue:wght@400;700&display=swap';
function loadWebFonts(){
  netAsk('fonts.googleapis.com','Load the Noto Sans, Garamond and other reading fonts.',FONT_URL).then(ok=>{
    if(!ok){log('Web fonts not allowed; using system fonts');return}
    const l=document.createElement('link');l.rel='stylesheet';l.href=FONT_URL;l.onload=()=>layout();l.onerror=()=>warn('Web fonts could not be loaded');document.head.appendChild(l);
  });
}
$('#netReset').onclick=()=>{Object.keys(localStorage).filter(k=>k.startsWith('net:')).forEach(k=>localStorage.removeItem(k));toast('Network permissions reset. You will be asked again.')};
let volT=0;
function setVol(v,save){v=Math.min(100,Math.max(0,+v||0));vol=v/100;$('#vol').value=v;$('#vol').parentNode.querySelector('output').textContent=v+'%';if(save)store('pf-vol',String(v))}
function volRestart(){clearTimeout(volT);volT=setTimeout(()=>{if(playing&&!paused)speak(Math.max(cur,0))},300)}
$('#vol').oninput=e=>{setVol(e.target.value,true);volRestart()};
$('#volMax').onchange=e=>{store('pf-volmax',e.target.checked?'1':'0');$('#vol').disabled=e.target.checked;if(e.target.checked)setVol(100,true);volRestart()};
{const mx=load('pf-volmax')==='1';$('#volMax').checked=mx;$('#vol').disabled=mx;setVol(mx?100:(load('pf-vol')??100),false)}
/* sliders: one handler for every range with data-var */
let slT=0;
function slApply(el,save){const v=el.value,u=el.dataset.u||'';root.style.setProperty(el.dataset.var,v+u);
  el.parentNode.querySelector('output').textContent=u==='em'?(+v).toFixed(2)+'em':u==='px'?v+'px':(+v).toFixed(2);
  if(save)store('pf-'+el.id,v)}
document.querySelectorAll('input[data-var]').forEach(el=>{
  const sv=load('pf-'+el.id);if(sv!==null&&sv!=='')el.value=sv;else if(el.id==='fs'&&innerWidth<600)el.value=20;
  slApply(el,false);
  el.addEventListener('input',()=>{slApply(el,true);clearTimeout(slT);slT=setTimeout(layout,120)})});
/* Some Android WebViews dispatch range changes differently; update reading typography synchronously. */
function applyReadingTypography(){
  const d=$('#doc'); if(!d)return;
  const get=id=>$('#'+id)?.value;
  root.style.setProperty('--fs',(get('fs')||24)+'px');
  root.style.setProperty('--ls',(get('ls')||0)+'em');
  root.style.setProperty('--ws',(get('ws')||0)+'em');
  root.style.setProperty('--lh',get('lh')||1.7);
  root.style.setProperty('--pm',(get('pm')||1)+'em');
  d.style.fontSize=`${(Number(get('fs')||24)*Number(root.style.getPropertyValue('--fz')||1))}px`;
  d.style.letterSpacing=(get('ls')||0)+'em';
  d.style.wordSpacing=(get('ws')||0)+'em';
  d.style.lineHeight=get('lh')||1.7;
  d.style.fontFamily=root.style.getPropertyValue('--ff')||'"Noto Sans",system-ui,sans-serif';
  d.querySelectorAll('p,li,blockquote,details').forEach(n=>n.style.marginBottom=(get('pm')||1)+'em');
  const preview=$('#typePreview');if(preview){preview.style.fontSize=d.style.fontSize;preview.style.letterSpacing=d.style.letterSpacing;preview.style.wordSpacing=d.style.wordSpacing;preview.style.lineHeight=d.style.lineHeight;preview.style.fontFamily=d.style.fontFamily;preview.style.setProperty('--pm',(get('pm')||1)+'em');}
  requestAnimationFrame(()=>{if(typeof layout==='function')layout()});
}
document.querySelectorAll('input[data-var]').forEach(el=>{
  ['input','change','touchend'].forEach(evt=>el.addEventListener(evt,applyReadingTypography,{passive:true}));
});
document.querySelectorAll('.seg[data-k="ff"] button').forEach(b=>b.addEventListener('click',()=>setTimeout(applyReadingTypography,0)));
applyReadingTypography();

$('#lfKeep').checked=load('pf-lfKeep')==='1';$('#lfKeep').onchange=e=>{store('pf-lfKeep',e.target.checked?'1':'0');updateLF()};
$('#doc').addEventListener('toggle',imgLayout,true);
$('#pClose').onclick=()=>$('#prefs').click();
const PF_RULES={'pf-imgsz':v=>['small','medium','large'].includes(v),'pf-th':v=>['light','sepia','dark'].includes(v),'pf-cols':v=>['1','2','3'].includes(v),'pf-br':v=>isFinite(v)&&+v>=30&&+v<=120,'pf-vol':v=>isFinite(v)&&+v>=0&&+v<=100};
function validatePrefs(){let n=0;Object.keys(PF_RULES).forEach(k=>{const v=load(k);if(v!==null&&!PF_RULES[k](v)){try{localStorage.removeItem(k)}catch(_){}n++;warn('Removed invalid saved setting:',k)}});return n}
const pStatus=m=>{const s=$('#pStatus');if(s)s.textContent=m;log('Settings:',m)};
$('#pSave').onclick=()=>{const n=validatePrefs();const m=n?`Saved. ${n} invalid setting(s) reset to default.`:'Settings saved.';pStatus(m);toast(m)};
$('#pPreview').onclick=()=>{const box=$('#typePreview');if(!box)return;box.querySelectorAll('.pv-fig').forEach(x=>x.remove());const f=document.createElement('figure');f.className='pv-fig';f.style.cssText='margin:8px 0;text-align:center';const img=document.createElement('img');img.alt='Sample reference picture';img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="240"><rect width="400" height="240" rx="12" fill="#6cb2f5"/><text x="200" y="134" font-size="36" text-anchor="middle" fill="#fff">Sample</text></svg>');img.style.cssText='display:block;margin:0 auto;border-radius:8px;max-width:var(--img-w)';f.appendChild(img);box.appendChild(f);pStatus('Preview shown at '+(load('pf-imgsz')||'large')+' picture size.')};
$('#pReset').onclick=()=>{$('#pConfirm').hidden=false;$('#pConfirmNo').focus({preventScroll:true})};
$('#pConfirmNo').onclick=()=>{$('#pConfirm').hidden=true;$('#pReset').focus({preventScroll:true})};
$('#pConfirmYes').onclick=()=>{Object.keys(localStorage).filter(k=>/^(pf-|c-)/.test(k)).forEach(k=>localStorage.removeItem(k));log('Settings reset to defaults; chapter text kept');toast('Settings reset to defaults. Reloading...');setTimeout(()=>location.reload(),500)};
if($('#advLog'))$('#advLog').onclick=()=>$('#conBtn')?.click();
/* init */
const startText=load('text')||SAMPLE;$('#src').value=startText;render(startText);
let hist=[];try{hist=JSON.parse(load('hist')||'[]')}catch(e){}
const MD_SAMPLE_TEXT="# Markdown Image & Link Sample\n\nThis document tests the reader: **bold text**, *italic text* and `inline code`.\n\n## Normal link\n\nA normal link: [Wikipedia](https://www.wikipedia.org/)\n\n## Direct image\n\n![Test image](data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2NDAiIGhlaWdodD0iMjgwIj48cmVjdCB3aWR0aD0iNjQwIiBoZWlnaHQ9IjI4MCIgZmlsbD0iI2NmZTRmYiIvPjxjaXJjbGUgY3g9IjUyMCIgY3k9IjcwIiByPSIzNCIgZmlsbD0iI2ZmZTJhMSIvPjxwYXRoIGQ9Ik0wIDI4MEwxNzAgOTBsMTAwIDEwMEwzODAgNjBsMTgwIDIyMHoiIGZpbGw9IiM1ZDdhOTkiLz48L3N2Zz4=)\n\n## Clickable image\n\n[![Test image](data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2NDAiIGhlaWdodD0iMjgwIj48cmVjdCB3aWR0aD0iNjQwIiBoZWlnaHQ9IjI4MCIgZmlsbD0iI2NmZTRmYiIvPjxjaXJjbGUgY3g9IjUyMCIgY3k9IjcwIiByPSIzNCIgZmlsbD0iI2ZmZTJhMSIvPjxwYXRoIGQ9Ik0wIDI4MEwxNzAgOTBsMTAwIDEwMEwzODAgNjBsMTgwIDIyMHoiIGZpbGw9IiM1ZDdhOTkiLz48L3N2Zz4=)](https://www.wikipedia.org/)\n\n## Collapsible image\n\n<details>\n<summary>Show the test image<\/summary>\n\n![Test image](data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2NDAiIGhlaWdodD0iMjgwIj48cmVjdCB3aWR0aD0iNjQwIiBoZWlnaHQ9IjI4MCIgZmlsbD0iI2NmZTRmYiIvPjxjaXJjbGUgY3g9IjUyMCIgY3k9IjcwIiByPSIzNCIgZmlsbD0iI2ZmZTJhMSIvPjxwYXRoIGQ9Ik0wIDI4MEwxNzAgOTBsMTAwIDEwMEwzODAgNjBsMTgwIDIyMHoiIGZpbGw9IiM1ZDdhOTkiLz48L3N2Zz4=)\n\nText inside a collapsible section is read aloud too.\n\n<\/details>\n\n<details open>\n<summary>Open by default<\/summary>\n\n[![Test image](data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2NDAiIGhlaWdodD0iMjgwIj48cmVjdCB3aWR0aD0iNjQwIiBoZWlnaHQ9IjI4MCIgZmlsbD0iI2NmZTRmYiIvPjxjaXJjbGUgY3g9IjUyMCIgY3k9IjcwIiByPSIzNCIgZmlsbD0iI2ZmZTJhMSIvPjxwYXRoIGQ9Ik0wIDI4MEwxNzAgOTBsMTAwIDEwMEwzODAgNjBsMTgwIDIyMHoiIGZpbGw9IiM1ZDdhOTkiLz48L3N2Zz4=)](https://www.wikipedia.org/)\n\n<\/details>\n\n## Lists and quotes\n\n- A list item with a [link](https://www.wikipedia.org/)\n- A list item with **bold text**\n\n> A quote with *italic text* and a [link](https://www.wikipedia.org/).\n";
const FANDOM_SAMPLE=`# Read aloud

Turn any text into speech while the words light up as they are spoken. **Edit text** understands *Markdown*.

## Reading tools

- Change size, spacing, font and brightness in Preferences
- Turn on line focus to dim all but a few lines
- Select text to read only that part, or use \`Read from here\`
- Add pictures with \`![Alt text](https://example.com/photo.jpg)\`

## Fandom & Wikipedia Carousels

Images and slideshow carousels load automatically from any \`.fandom.com\` wiki or Wikipedia. Try navigating the slides, using the thumbnails, or toggling Auto-slide!

<details open>
<summary>Spoiler: Superman (Fandom Slideshow Demo)</summary>

[Superman reference](https://superman.fandom.com/wiki/Superman)
[Superman image/slideshow reference](https://superman.fandom.com/wiki/Superman?file=Superman-kirkalyn.jpg)

</details>

## Video References

Use a Markdown link to a YouTube video. The reader shows a thumbnail first and loads the player only when you press Play.

- [Example video](https://www.youtube.com/watch?v=khcF2ZQzTmY)

> Replace this sample by choosing Edit text and pasting your own.`;
const BUILTIN=[{n:'Fandom Carousel & YouTube Demo',t:FANDOM_SAMPLE},{n:'Markdown Image & Link Sample',t:MD_SAMPLE_TEXT}];
let clearAsk=false;
const saveHist=()=>{if(hist.length)store('hist',JSON.stringify(hist));else try{localStorage.removeItem('hist')}catch(e){}};
function closeHist(){$('#histPanel').hidden=true;$('#histBtn').setAttribute('aria-expanded','false');clearAsk=false}
function loadIntoEditor(t,label){$('#src').value=t;store('text',t);closeHist();toast('Loaded: '+label);log('Loaded into editor:',label,t.length+' chars')}
function drawHist(){
  const P=$('#histPanel');P.textContent='';
  const mk=(tag,cls,txt)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e};
  const row=(label,sub,onLoad,onDel)=>{
    const r=mk('div','hr'),b=mk('button','hi');b.setAttribute('role','menuitem');b.onclick=onLoad;
    b.appendChild(mk('b',0,label));if(sub)b.appendChild(mk('small',0,sub));r.appendChild(b);
    if(onDel){const x=mk('button','hx','✕');x.setAttribute('aria-label','Delete this text');x.onclick=onDel;r.appendChild(x)}
    P.appendChild(r)};
  P.appendChild(mk('div','hl','Built-in samples'));
  BUILTIN.forEach(b=>row(b.n,'Sample: links, images, clickable images, collapsible sections',()=>loadIntoEditor(b.t,b.n)));
  P.appendChild(mk('div','hl','Your texts ('+hist.length+')'));
  if(!hist.length)P.appendChild(mk('div','he','No saved texts yet. Texts you read are saved here.'));
  hist.forEach((x,i)=>{const name=x.t.replace(/\s+/g,' ').trim().slice(0,48)||'(blank)';
    row(name,new Date(x.d).toLocaleString(),()=>loadIntoEditor(x.t,name),()=>{
      delete pos[hashText(x.t)];store('pos',JSON.stringify(pos));hist.splice(i,1);saveHist();drawHist();toast('Text deleted')})});
  const f=mk('div','hf');
  if(!clearAsk){const b=mk('button',0,'Clear all my texts');b.disabled=!hist.length;b.onclick=()=>{clearAsk=true;drawHist()};f.appendChild(b)}
  else{f.appendChild(mk('span',0,'Delete all '+hist.length+' saved text'+(hist.length>1?'s':'')+' permanently? Built-in samples stay.'));
    const y=mk('button','pri','Delete all');y.onclick=()=>{hist.forEach(x=>delete pos[hashText(x.t)]);store('pos',JSON.stringify(pos));hist=[];saveHist();clearAsk=false;drawHist();toast('All saved texts deleted');log('Previous texts cleared')};
    const n=mk('button',0,'Cancel');n.onclick=()=>{clearAsk=false;drawHist()};f.append(y,n)}
  P.appendChild(f);
  $('#histBtn').textContent='Previous texts ('+hist.length+') ▾';
}
drawHist();
$('#src').addEventListener('input',e=>store('text',e.target.value));
$('#histBtn').onclick=e=>{const P=$('#histPanel');P.hidden=!P.hidden;e.currentTarget.setAttribute('aria-expanded',!P.hidden);if(!P.hidden){clearAsk=false;drawHist()}};
document.addEventListener('click',e=>{if(!$('#histPanel').hidden&&!e.target.closest('#histWrap'))closeHist()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#histPanel').hidden)closeHist()});
let clearAllTextsPending=false;
$('#clr').onclick=()=>{
  if(!clearAllTextsPending){
    clearAllTextsPending=true;
    const yes=confirm('Clear the current text AND delete all saved text history and reading positions? Preferences will be kept.');
    clearAllTextsPending=false;
    if(!yes)return;
  }
  try{speechSynthesis.cancel()}catch(_){}
  $('#src').value='';store('text','');
  hist=[];try{['hist','pos','text','lastText','reading-history','readHistory','history','bookmarks','resume','last-position'].forEach(k=>localStorage.removeItem(k));Object.keys(localStorage).filter(k=>/^(hist|history|pos|bookmark|resume)([-_:]|$)/i.test(k)).forEach(k=>localStorage.removeItem(k))}catch(_){}
  try{sessionStorage.removeItem('hist');sessionStorage.removeItem('pos');sessionStorage.removeItem('text')}catch(_){}
  if(typeof pos==='object'&&pos)Object.keys(pos).forEach(k=>delete pos[k]);
  if(typeof saveHist==='function')saveHist();
  if(typeof drawHist==='function')drawHist();
  if(typeof closeHist==='function')closeHist();
  if(typeof stop==='function')stop();
  if(typeof render==='function')render('');
  toast('Current text, saved history, and reading positions cleared. Preferences kept.');
  log('Clear completed: current text, saved history, and reading positions removed.');
  $('#src').focus();
};
$('#ar').checked=load('ar')!=='0';$('#ar').onchange=e=>store('ar',e.target.checked?'1':'0');
$('#src').addEventListener('paste',e=>{
  const pf=[...(e.clipboardData&&e.clipboardData.files||[])].filter(f=>f.type.startsWith('image/'));
  if(pf.length){e.preventDefault();addImages(pf);return}
  if(!$('#ar').checked)return;
  const t=(e.clipboardData||window.clipboardData).getData('text');
  if(!t)return;e.preventDefault();e.target.value=t;store('text',t);log('Pasted text replaced the old text ('+t.length+' chars)');
});
validatePrefs();setBr(load('pf-br')||100);setSeg('imgsz',load('pf-imgsz')||'large',false);
  migrateLegacyKeys();
setSeg('cols',load('pf-cols')||1,false);setSeg('ff',load('pf-ff')||'"Noto Sans",system-ui,sans-serif',false);
setSeg('th',load('pf-th')||(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light'),false);
{const savedLF=+load('pf-lf')||0;setSeg('lf',[0,1,3,5].includes(savedLF)?savedLF:0,false)}setSeg('lm',load('pf-lm')||'fade',false);applyColors();
if(document.fonts)document.fonts.ready.then(()=>{applyReadingTypography();layout()});
setTimeout(applyReadingTypography,0);
if(ss===NOSPEECH)toast('Speech is not available in this browser. Reading still works, but the play button cannot speak.');
setTimeout(loadWebFonts,400);
/* ---------- voice search: filter hundreds of voices by name, language or tag ---------- */
(function(){
  const sel=$('#voice'),box=$('#vSearch'),list=$('#vList'),cnt=$('#vCount');
  const clean=n=>n.replace('Microsoft ','').replace(' Online (Natural)','').replace(/\s+/g,' ');
  let t=0;
  function draw(){
    const q=box.value.trim().toLowerCase().split(/\s+/).filter(Boolean),cur=sel.value,out=document.createDocumentFragment();
    let n=0;
    for(let i=0;i<voices.length;i++){
      const v=voices[i],tags=(/multilingual/i.test(v.name)?'multilingual ':'')+(/natural|neural/i.test(v.name)?'natural neural ':'')+(v.localService?'local device':'online cloud'),hay=(v.name+' '+v.lang+' '+tags).toLowerCase();
      if(q.some(w=>hay.indexOf(w)<0))continue;
      if(n++>=80)continue;
      const b=document.createElement('button');b.type='button';b.className='vi';b.setAttribute('role','option');b.dataset.i=i;
      b.setAttribute('aria-selected',String(i)===cur?'true':'false');
      const a=document.createElement('b');a.textContent=clean(v.name);
      const m=document.createElement('small');m.textContent=v.lang+' · '+(v.localService?'on device':'online');
      b.append(a,m);out.appendChild(b);
    }
    list.textContent='';
    if(!voices.length){const e=document.createElement('div');e.className='he';e.textContent='No voices available in this browser.';list.appendChild(e)}
    else if(!out.childNodes.length){const e=document.createElement('div');e.className='he';e.textContent='No voices match your search.';list.appendChild(e)}
    else list.appendChild(out);
    cnt.textContent=voices.length?(q.length?n+' of '+voices.length:voices.length+' voices'):'';
    const s=list.querySelector('[aria-selected=true]');
    if(s&&!q.length&&list.offsetParent)list.scrollTop=Math.max(0,s.offsetTop-list.clientHeight/2+s.offsetHeight/2);
  }
  list.addEventListener('click',e=>{const b=e.target.closest('.vi');if(!b)return;sel.value=b.dataset.i;sel.dispatchEvent(new Event('change'));draw()});
  box.addEventListener('input',()=>{clearTimeout(t);t=setTimeout(draw,120)});
  box.addEventListener('keydown',e=>{if(e.key==='Enter'){const b=list.querySelector('.vi');if(b){e.preventDefault();b.click()}}});
  sel.addEventListener('change',draw);
  new MutationObserver(()=>{clearTimeout(t);t=setTimeout(draw,60)}).observe(sel,{childList:true,subtree:true});
  draw();
})();

/* ---------- Edge-style preference pages: Text | Layout | Look | Focus | Voice | More ---------- */
(function(){
  const panel=$('#panel'),head=panel.querySelector('.ph');
  const MAP={'Text':'text','Custom fonts':'text','Columns & layout':'layout','Theme & colors':'look','Line focus':'focus','Voice & audio':'voice','Network access':'more','Keyboard shortcuts':'more'};
  const TABS=[['text','Text'],['layout','Layout'],['look','Look'],['focus','Focus'],['voice','Voice'],['more','More']];
  const ds=[...panel.querySelectorAll(':scope>details')],count={};
  ds.forEach(d=>{const id=MAP[d.querySelector('summary').textContent.trim()]||'more';d.dataset.pg=id;count[id]=(count[id]||0)+1;d.classList.add('pgd');d.open=!d.classList.contains('adv')});
  ds.forEach(d=>{if(count[d.dataset.pg]>1)d.classList.add('hasT')});
  const rst=$('#pReset');rst.dataset.pg='more';rst.classList.add('pgx');
  const bar=document.createElement('div');bar.className='seg ptabs';bar.setAttribute('role','tablist');bar.setAttribute('aria-label','Preference pages');
  TABS.forEach(([id,label])=>{const b=document.createElement('button');b.type='button';b.dataset.tab=id;b.textContent=label;b.setAttribute('role','tab');bar.appendChild(b)});
  const wrap=document.createElement('div');wrap.className='phead';head.parentNode.insertBefore(wrap,head);wrap.append(head,bar);
  const hq={text:$('#prefs'),focus:$('#pgRead'),voice:$('#pgVoice')};
  function pos(){document.documentElement.style.setProperty('--hdr',Math.round(document.querySelector('header').getBoundingClientRect().bottom+8)+'px')}
  function syncHdr(){const o=panel.classList.contains('open'),t=panel.dataset.tab;Object.keys(hq).forEach(k=>hq[k].setAttribute('aria-expanded',o&&t===k?'true':'false'));if(o)pos()}
  function showTab(id,save){
    panel.dataset.tab=id;
    bar.querySelectorAll('button').forEach(b=>{const on=b.dataset.tab===id;b.setAttribute('aria-pressed',on?'true':'false');b.setAttribute('aria-selected',on?'true':'false');b.tabIndex=on?0:-1});
    panel.querySelectorAll('[data-pg]').forEach(e=>e.classList.toggle('on',e.dataset.pg===id));
    panel.scrollTop=0;if(save)store('pf-tab',id);syncHdr();
  }
  bar.addEventListener('click',e=>{const b=e.target.closest('button[data-tab]');if(b)showTab(b.dataset.tab,true)});
  bar.addEventListener('keydown',e=>{
    if(e.key!=='ArrowRight'&&e.key!=='ArrowLeft')return;
    const ids=TABS.map(t=>t[0]),i=ids.indexOf(panel.dataset.tab),n=ids[(i+(e.key==='ArrowRight'?1:ids.length-1))%ids.length];
    e.preventDefault();showTab(n,true);bar.querySelector('[data-tab="'+n+'"]').focus();
  });
  /* Edge-style header buttons: each opens its own page; clicking another switches pages instead of closing */
  Object.keys(hq).forEach(id=>hq[id].addEventListener('click',e=>{
    const open=panel.classList.contains('open');
    if(open&&panel.dataset.tab!==id){e.stopImmediatePropagation();showTab(id,false);return}
    if(!open)showTab(id,false);
  },true));
  $('#pgRead').onclick=$('#pgVoice').onclick=()=>setPanel(!panel.classList.contains('open'));
  /* click outside the popover closes it on desktop (phones use the backdrop) */
  document.addEventListener('pointerdown',e=>{
    if(!panel.classList.contains('open')||isSheet()||document.body.classList.contains('force-desktop'))return;
    if(panel.contains(e.target)||e.target.closest('#prefs,#pgRead,#pgVoice,#netGate,#toast'))return;
    setPanel(false);
  },true);
  new MutationObserver(syncHdr).observe(panel,{attributes:true,attributeFilter:['class']});
  addEventListener('resize',()=>{if(panel.classList.contains('open'))pos()});
  showTab(TABS.some(t=>t[0]===load('pf-tab'))?load('pf-tab'):'text',false);
})();

/* ---------- gliding pill: one highlight that slides to the selected option ---------- */
(function(){
  function place(g){
    const p=g._pill,b=g.querySelector('button[aria-pressed=true]');
    if(!b||!b.offsetWidth){p.style.opacity=0;g._shown=false;return}
    const first=!g._shown;g._shown=true;
    if(first)p.style.transition='none';
    p.style.width=b.offsetWidth+'px';p.style.height=b.offsetHeight+'px';
    p.style.transform='translate('+b.offsetLeft+'px,'+b.offsetTop+'px)';p.style.opacity=1;
    if(first){void p.offsetWidth;p.style.transition=''}
  }
  document.querySelectorAll('aside .seg').forEach(g=>{
    const p=document.createElement('span');p.className='pill';p.setAttribute('aria-hidden','true');g.prepend(p);g._pill=p;
    let q=0;const sched=()=>{if(!q)q=requestAnimationFrame(()=>{q=0;place(g)})};
    new MutationObserver(sched).observe(g,{subtree:true,attributes:true,attributeFilter:['aria-pressed'],childList:true});
    if('ResizeObserver' in window)new ResizeObserver(sched).observe(g);
    sched();
  });
  document.querySelectorAll('aside details').forEach(d=>d.addEventListener('toggle',()=>requestAnimationFrame(()=>d.querySelectorAll('.seg').forEach(g=>place(g)))));
  if(document.fonts)document.fonts.ready.then(()=>document.querySelectorAll('aside .seg').forEach(place));
})();
/* Migrate legacy pf-* and c-* keys to reader.* scheme on first load */
function migrateLegacyKeys() {
  /* pf-timehide -> reader.showReadingTime */
  const legacyTime = localStorage.getItem("pf-timehide");
  const curTime = localStorage.getItem("reader.showReadingTime");
  if(legacyTime && (!curTime || curTime === "")) {
    localStorage.setItem("reader.showReadingTime", legacyTime === "1" ? "0" : "1");
  }
  /* pf-floatchap -> reader.showFloatingChapterShortcut */
  const legacyFloat = localStorage.getItem("pf-floatchap");
  const curFloat = localStorage.getItem("reader.showFloatingChapterShortcut");
  if(legacyFloat && (!curFloat || curFloat === "")) {
    localStorage.setItem("reader.showFloatingChapterShortcut", legacyFloat === "1" ? "0" : "1");
  }
}

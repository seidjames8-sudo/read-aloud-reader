
/* Real pictures for Reference Cards. A spoiler block with a Reference Card and a Wikipedia link
   (article link, or a #/media/File: link) gets the real picture. Works where the page may contact
   Wikipedia, for example the downloaded copy; the hosted page blocks other sites and keeps the card. */
(function(){
  const box=document.getElementById('wpPics'),gal=document.getElementById('wpGallery'),doc=document.getElementById('doc'),reload=document.getElementById('picReload');
  if(!box||!doc||!gal)return;
  box.checked=load('pf-wp')!=='0';box.onchange=()=>store('pf-wp',box.checked?'1':'0');
  gal.checked=load('pf-wg')!=='0';gal.onchange=()=>store('pf-wg',gal.checked?'1':'0');
  const smem={},dec=t=>{try{return decodeURIComponent(t)}catch(e){return t}};
  const mem={};let fails=0,coolUntil=0,q=Promise.resolve(),warned=0;
  const titleOf=a=>{const h=a.getAttribute('href')||'';let m=h.match(/^https?:\/\/(?:[a-z-]+\.)*wikipedia\.org\/wiki\/([^?#]+)/i);if(m)return m[1];m=h.match(/^https?:\/\/(?:www\.)?wikiwand\.com\/en\/(?:articles\/)?([^?#]+)/i);return m?m[1]:null};
  const nameOf=t=>{try{return decodeURIComponent(t).replace(/_/g,' ')}catch(e){return t.replace(/_/g,' ')}};
  const mediaOf=a=>{
    const h=a.getAttribute('href')||'';
    let m=h.match(/^https?:\/\/((?:[a-z-]+\.)*wikipedia\.org|commons\.wikimedia\.org)\/wiki\/(?:[^#?]*#\/media\/|)(File:[^?#]+)/i);
    if(m)return{host:m[1],file:m[2].replace(/^File:/i,'')};
    m=h.match(/^https?:\/\/(?:www\.)?wikiwand\.com\/en\/[^#]*#\/media\/(File:[^?#]+)/i);
    if(m)return{host:'en.wikipedia.org',file:m[1].replace(/^File:/i,'')};
    m=h.match(/^https?:\/\/([a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:fandom|wikia)\.com)\/(?:[a-z-]+\/)?wiki\/(?:File:([^?#]+)|[^?#]*\?(?:[^#]*&)?file=([^&#]+))/i);
    if(m)return{host:m[1],file:(m[2]||m[3]).replace(/^File:/i,''),fandom:true};
    return null};
  async function pic(title){
    if(mem[title]!==undefined)return mem[title];
    const saved=load('wp:'+title);if(saved)return mem[title]=saved;
    const r=await fetch('https://en.wikipedia.org/api/rest_v1/page/summary/'+title,{headers:{Accept:'application/json'}});
    if(!r.ok)throw new Error('HTTP '+r.status);
    const j=await r.json(),t=j.thumbnail&&j.thumbnail.source,u=t?t.replace(/\/\d+px-/,'/480px-'):'';
    if(u)store('wp:'+title,u);
    return mem[title]=u||null;
  }
  /* all pictures of an article, from Wikipedia's media list (up to 8, no icons or logos) */
  async function slides(title){
    if(smem[title])return smem[title];
    const saved=load('wg:'+title);if(saved){try{return smem[title]=JSON.parse(saved)}catch(e){}}
    const r=await fetch('https://en.wikipedia.org/api/rest_v1/page/media-list/'+title,{headers:{Accept:'application/json'}});
    if(!r.ok)throw new Error('HTTP '+r.status);
    const j=await r.json(),out=[];
    for(const it of (j.items||[])){
      if(it.type!=='image'||!it.title||it.showInGallery===false)continue;
      const f=it.title.replace(/^File:/i,'').replace(/ /g,'_');
      if(/\.svg$/i.test(f))continue;
      out.push({file:f,cap:(((it.caption&&it.caption.text)||'').replace(/\s+/g,' ').trim()).slice(0,110)});
      if(out.length>=8)break;
    }
    if(out.length)store('wg:'+title,JSON.stringify(out));
    return smem[title]=out;
  }
  function buildGallery(items,start,title,name){
    const fig=document.createElement('figure');fig.className='md gal';
    const stage=document.createElement('div');stage.className='galstage';
    const mk=(t,l)=>{const b=document.createElement('button');b.type='button';b.className='galbtn';b.textContent=t;b.setAttribute('aria-label',l);return b};
    const prev=mk('‹','Previous picture'),next=mk('›','Next picture'),slot=document.createElement('div'),cap=document.createElement('figcaption');
    slot.className='galslot';slot.setAttribute('aria-live','polite');
    let i=Math.max(0,start||0);
    const src=n=>'https://en.wikipedia.org/wiki/Special:FilePath/'+encodeURIComponent(items[n].file)+'?width=480';
    function show(n){
      i=(n+items.length)%items.length;
      const it=items[i],label=it.cap||name;
      slot.textContent='';
      slot.appendChild(makeImg({alt:label,src:src(i),title:label,href:'https://en.wikipedia.org/wiki/'+title+'#/media/File:'+encodeURIComponent(it.file)}));
      cap.textContent=label+'  ·  '+(i+1)+'/'+items.length;
      const nx=new Image();nx.referrerPolicy='strict-origin-when-cross-origin';nx.src=src((i+1)%items.length);
    }
    prev.onclick=()=>show(i-1);next.onclick=()=>show(i+1);
    let x0=null;
    slot.addEventListener('pointerdown',e=>{x0=e.clientX});
    slot.addEventListener('pointerup',e=>{if(x0===null)return;const dx=e.clientX-x0;x0=null;if(Math.abs(dx)>45)show(i+(dx<0?1:-1))});
    stage.append(prev,slot,next);fig.append(stage,cap);show(i);
    return fig;
  }
  async function fandomPic(host,file){
    const key='fd:'+host+'/'+file,saved=load(key);if(saved)return saved;
    const r=await fetch('https://'+host+'/api.php?action=query&titles='+encodeURIComponent('File:'+file)+'&prop=imageinfo&iiprop=url&iiurlwidth=480&format=json&origin=*');
    if(!r.ok)throw new Error('HTTP '+r.status);
    const j=await r.json(),pg=j.query&&j.query.pages&&Object.values(j.query.pages)[0],ii=pg&&pg.imageinfo&&pg.imageinfo[0];
    const u=(ii&&(ii.thumburl||ii.url))||('https://'+host+'/wiki/Special:FilePath/'+encodeURIComponent(file));
    store(key,u);return u;
  }
  async function work(d){
    if(!box.checked||d._wpDone||(d._wpTries||0)>=3||Date.now()<coolUntil||!d.isConnected)return;
    const im=d.querySelector('.mdimg img[alt^="Reference card"]'),links=[...d.querySelectorAll('a')];
    const media=links.map(mediaOf).find(Boolean),tl=links.find(titleOf);
    const linkOnly=!im&&!d.querySelector('img')&&!d.querySelector('a[href*=\".fandom.com/\"],a[href*=\".wikia.com/\"]')&&/^\s*spoiler/i.test((d.querySelector('summary')||{}).textContent||'');
    if((!im&&!linkOnly)||(!media&&!tl)){d._wpDone=true;return}
    const place=node=>{
      if(im){(im.closest('figure')||im.closest('.mdimg')).replaceWith(node)}
      else{const a=links.find(x=>mediaOf(x)||titleOf(x)),host=a.closest('p')||a;host.parentNode.insertBefore(node,host)}
    };
    try{
      const art=tl?titleOf(tl):null,askHost=art?'en.wikipedia.org':media.host;
      const name=art?nameOf(art):nameOf(media.file).replace(/\.[a-z0-9]+$/i,'');
      const why=(gal.checked&&art?'Load the pictures for "'+name+'" from Wikipedia and show them as slides':'Load the picture for "'+name+'" from '+(askHost==='en.wikipedia.org'?'Wikipedia':askHost)+' and show it')+' instead of the placeholder card.';
      if(!(await netAsk(askHost,why,'https://'+askHost+'/wiki/Special:FilePath/'))){d._wpDone=true;return}
      let items=null;
      if(gal.checked&&art){try{items=await slides(art)}catch(e){log('Slide list unavailable:',(e&&e.message)||e)}}
      if(items&&items.length>=2){
        let start=0;
        if(media){const f=dec(media.file).replace(/ /g,'_'),k=items.findIndex(x=>dec(x.file)===f);if(k>=0)start=k}
        place(buildGallery(items,start,art,name));
        d._wpDone=true;fails=0;log('Wikipedia slides set for',name,'('+items.length+' pictures)');return;
      }
      let url;
      if(media&&media.fandom)url=await fandomPic(media.host,dec(media.file).replace(/ /g,'_'));
      else if(media)url='https://'+media.host+'/wiki/Special:FilePath/'+media.file+'?width=480';
      else{url=await pic(art);if(!url){log('No Wikipedia picture found for',name);d._wpDone=true;return}}
      const fresh=makeImg({alt:'Picture: '+name,src:url,title:'Picture from Wikipedia: '+name});
      const lab='Picture: '+name+(media&&media.fandom?' (Fandom)':' (Wikipedia)');
      if(im){place(fresh);const fig=fresh.closest('figure'),cap=fig&&fig.querySelector('figcaption');if(cap)cap.textContent=lab}
      else{const f=document.createElement('figure');f.className='md';const c=document.createElement('figcaption');c.textContent=lab;f.append(fresh,c);place(f)}
      d._wpDone=true;fails=0;log('Wikipedia picture set for',name);
    }catch(e){
      d._wpTries=(d._wpTries||0)+1;fails++;
      if(fails>=3)coolUntil=Date.now()+60000;
      if(warned++<3)warn('Wikipedia picture lookup failed ('+((e&&e.message)||e)+'). It will retry. The hosted page blocks other sites; the downloaded copy does not.');
      if(io&&d._wpTries<3)setTimeout(()=>{if(d.isConnected&&!d._wpDone)io.observe(d)},4000*d._wpTries);
    }
  }
  function upgrade(d){if(d._queued)return;d._queued=true;q=q.then(()=>work(d)).catch(()=>{}).then(()=>{d._queued=false})}
  const io='IntersectionObserver' in window?new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){io.unobserve(e.target);upgrade(e.target)}}),{root:document.getElementById('scroll'),rootMargin:'600px 0px'}):null;
  function scan(){doc.querySelectorAll('details').forEach(d=>{if(d._wpDone||(d._wpTries||0)>=3)return;if(io)io.observe(d);else if(d.open)upgrade(d)})}
  doc.addEventListener('toggle',e=>{const d=e.target;if(d&&d.tagName==='DETAILS'&&d.open)upgrade(d)},true);
  let t=0;new MutationObserver(()=>{clearTimeout(t);t=setTimeout(scan,300)}).observe(doc,{childList:true});
  if(reload)reload.onclick=()=>{
    fails=0;coolUntil=0;warned=0;
    doc.querySelectorAll('details').forEach(d=>{if(!d._wpDone)d._wpTries=0});
    doc.querySelectorAll('.imgfail .retry').forEach(b=>b.click());
    scan();toast('Reloading pictures…');
  };
  scan();
})();

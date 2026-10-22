
/* ---- Chapters: one chapter on screen, chapter list in the drawer, auto-advance while reading aloud ---- */
(function(){
  const renderRaw=render;
  let src=null,list=[''],chapIdx=0;
  window.chapIdx=0;window.chapCount=0;
  const split=t=>{const p=String(t).split(/\n(?=# CHAPTER )/).filter(x=>x.trim());return p.length?p:[String(t)]};
  const label=c=>{const m=c.match(/^#\s+(.+)$/m);return ((m&&m[1])||'Chapter').replace(/\s+/g,' ').trim().slice(0,90)};
  const bar=document.createElement('div');
  bar.id='chapBar';bar.setAttribute('role','navigation');bar.setAttribute('aria-label','Chapter navigation');
  bar.innerHTML='<div id="chapTitleLine" hidden><span id="chapTitleEl" aria-hidden="true"></span></div><div id="chapBody"><button id="chPrev" type="button">‹ Previous</button><select id="chSel" aria-label="Choose chapter"></select><button id="chNext" type="button">Next ›</button><span id="chCount"></span></div>';
  $('#chapDrawerBody').appendChild(bar);
  /* Reading aids in the chapter bar (title / counter) are display-only
     preferences; both default on and live in the reader.pref.* keys. */
  const pref=(k,d)=>{let v=null;try{v=localStorage.getItem('reader.'+k)}catch(e){}
    return v==null||v===''?d:v};
  function applyBarPrefs(){
    const title=document.getElementById('chapTitleLine'),
          cnt=document.getElementById('chCount'),
          chapBody=document.getElementById('chapBody');
    if(title)title.hidden=pref('showChapterTitles','1')!=='1';
    if(cnt)cnt.style.display=pref('showChapterProgress','1')==='1'?'':'none';
    if(chapBody)chapBody.classList.toggle('no-count',pref('showChapterProgress','1')!=='1');
    const head=document.getElementById('chapHead');
    if(head)head.hidden=pref('showChapterTitles','1')!=='1';
  }
  /* Remember which chapter was open, per book text, so a refresh returns to it */
  const chapKey=()=>'chap:'+hashText(src||'');
  function saveChap(i){try{localStorage.setItem(chapKey(),String(i))}catch(e){}}
  function restoreChap(n){
    /* Fallback: if the saved number is missing or out of range, start at Chapter 1 */
    let raw=null,v=-1;try{raw=localStorage.getItem(chapKey())}catch(e){}
    if(raw!=null)v=parseInt(raw,10);
    if(!Number.isInteger(v)||v<0||v>=n){
      if(raw!=null)log('Saved chapter number out of range; starting at Chapter 1',{saved:raw,chapterCount:n});
      return 0
    }
    return v
  }
  const sel=$('#chSel'),scrollEl=$('#scroll');
  function show(i,opts={}){
    if(i<0||i>=list.length)return;
    if(playing&&!opts.manual)stop();
    chapIdx=i;window.chapIdx=i;window.chapCount=list.length;
    saveChap(i);
    renderRaw(list[i]);
    sel.innerHTML=list.map((c,k)=>'<option value="'+k+'">'+(k+1)+'. '+label(c).replace(/</g,'&lt;')+'</option>').join('');
    sel.value=String(i);
    $('#chPrev').disabled=i===0;$('#chNext').disabled=i>=list.length-1;
    $('#chCount').textContent=(i+1)+' / '+list.length;
    const ttl=document.getElementById('chapTitleEl');
    if(ttl)ttl.textContent=label(list[i]);
    const head=document.getElementById('chapHeadEl');
    if(head)head.textContent=label(list[i]);
    document.title=label(list[i]).slice(0,80)+' – Read Aloud';
    applyBarPrefs();
    scrollEl.scrollTop=0;
    requestAnimationFrame(()=>scrollEl.dispatchEvent(new Event('scroll')));
    log('Chapter',i+1,'of',list.length);
  }
  render=function(t){
    const full=t==null?String(load('text')||''):String(t);
    if(full!==src){src=full;list=split(full);chapIdx=restoreChap(list.length)}
    show(Math.min(chapIdx,list.length-1));
  };
  $('#chPrev').onclick=()=>show(chapIdx-1);
  $('#chNext').onclick=()=>show(chapIdx+1);
  $('#chapPrev').onclick=()=>show(chapIdx-1);
  $('#chapNext').onclick=()=>show(chapIdx+1);
  sel.onchange=()=>show(+sel.value);
  let autoAdvanceEnabled=true;
  window.onChapterDone=()=>{if(!autoAdvanceEnabled)return false;if(chapIdx<list.length-1){show(chapIdx+1);speak(0);return true}return false};
  render();
  /* The first, chapter-restoring render is complete. The resume banner in core.js only
     speaks up after this flag is set, so it fires after the chapter was restored and
     only here — never again on later renders or auto-advances during this session. */
  window.__chapReady=true;
  window.applyBarPrefs=applyBarPrefs;
})();

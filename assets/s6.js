
/* ---- Chapters: one chapter on screen, chapter list in the drawer, auto-advance while reading aloud ---- */
(function(){
  const renderRaw=render;
  let src=null,list=[''],chapIdx=0;
  window.chapIdx=0;
  const split=t=>{const p=String(t).split(/\n(?=# CHAPTER )/).filter(x=>x.trim());return p.length?p:[String(t)]};
  const label=c=>{const m=c.match(/^#\s+(.+)$/m);return ((m&&m[1])||'Chapter').replace(/\s+/g,' ').trim().slice(0,90)};
  const bar=document.createElement('div');
  bar.id='chapBar';bar.setAttribute('role','navigation');bar.setAttribute('aria-label','Chapter navigation');
  bar.innerHTML='<div id="chapBody"><button id="chPrev" type="button">‹ Previous</button><select id="chSel" aria-label="Choose chapter"></select><button id="chNext" type="button">Next ›</button><span id="chCount"></span></div>';
  $('#chapDrawerBody').appendChild(bar);
  /* Remember which chapter was open, per book text, so a refresh returns to it */
  const chapKey=()=>'chap:'+hashText(src||'');
  function saveChap(i){try{localStorage.setItem(chapKey(),String(i))}catch(e){}}
  function restoreChap(n){
    let v=-1;try{v=parseInt(localStorage.getItem(chapKey())||'-1',10)}catch(e){}
    return Number.isInteger(v)&&v>=0&&v<n?v:0;
  }
  const sel=$('#chSel'),scrollEl=$('#scroll');
  function show(i){
    if(i<0||i>=list.length)return;
    if(playing)stop();
    chapIdx=i;window.chapIdx=i;
    saveChap(i);
    renderRaw(list[i]);
    sel.innerHTML=list.map((c,k)=>'<option value="'+k+'">'+(k+1)+'. '+label(c).replace(/</g,'&lt;')+'</option>').join('');
    sel.value=String(i);
    $('#chPrev').disabled=i===0;$('#chNext').disabled=i>=list.length-1;
    $('#chCount').textContent=(i+1)+' / '+list.length;
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
  sel.onchange=()=>show(+sel.value);
  window.onChapterDone=()=>{if(chapIdx<list.length-1){show(chapIdx+1);speak(0);return true}return false};
  render();
})();

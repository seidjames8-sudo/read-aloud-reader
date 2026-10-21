
/* ---- Reading progress bar + long-press highlights (persisted per chapter) ---- */
(function(){
  const scroll=$('#scroll'), doc=$('#doc');
  /* Reading progress shown on the existing waveform strip (#prog) */
  const pr=$('#prog');
  pr.insertAdjacentHTML('afterbegin','<span id="progFill" aria-hidden="true"></span>');
  pr.insertAdjacentHTML('beforeend','<span id="progPct">0%</span>');
  pr.setAttribute('role','progressbar');pr.setAttribute('aria-label','Reading progress');
  pr.setAttribute('aria-valuemin','0');pr.setAttribute('aria-valuemax','100');pr.setAttribute('aria-valuenow','0');
  function updProg(){
    const max=scroll.scrollHeight-scroll.clientHeight;
    const p=max>0?Math.min(1,Math.max(0,scroll.scrollTop/max)):(doc.textContent.trim()?1:0);
    const pct=Math.round(p*100);
    $('#progFill').style.width=pct+'%';$('#progPct').textContent=pct+'%';pr.setAttribute('aria-valuenow',String(pct));
  }
  scroll.addEventListener('scroll',()=>requestAnimationFrame(updProg),{passive:true});
  addEventListener('resize',updProg);

  /* Storage: one list per chapter, keyed by a hash of the chapter source */
  function hash(s){let h=5381;for(let i=0;i<s.length;i++)h=((h<<5)+h+s.charCodeAt(i))|0;return (h>>>0).toString(36)}
  const KEY=()=>'hl:'+hash(String(load('text')||''))+':'+(window.chapIdx||0);
  function getHL(){
    try{const a=JSON.parse(localStorage.getItem(KEY())||'[]');
      if(!Array.isArray(a))throw new Error('not a list');
      return a.filter(x=>x&&typeof x.t==='string'&&x.t.length>0&&Number.isInteger(x.n)&&x.n>=0&&typeof x.id==='string');
    }catch(e){warn('Saved highlights were unreadable; ignoring them',e.message);return []}
  }
  function setHL(list){try{localStorage.setItem(KEY(),JSON.stringify(list));return true}catch(e){toast('Could not save highlight (storage full)');warn('Highlight save failed',e.message);return false}}

  /* Text helpers */
  function textNodes(){
    const w=document.createTreeWalker(doc,NodeFilter.SHOW_TEXT),arr=[];let n,pos=0;
    while((n=w.nextNode())){arr.push({n,s:pos,e:pos+n.data.length});pos+=n.data.length}
    return {arr,full:arr.map(x=>x.n.data).join('')};
  }
  function rangeFromOffsets(arr,a,b){
    const r=document.createRange();let started=false;
    for(const {n,s,e} of arr){
      if(!started&&a>=s&&a<e){r.setStart(n,a-s);started=true}
      if(started&&b>s&&b<=e){r.setEnd(n,b-s);return r}
    }
    return null;
  }
  function markRange(r,id){
    const root=r.commonAncestorContainer.nodeType===3?r.commonAncestorContainer.parentNode:r.commonAncestorContainer;
    const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),nodes=[];let n;
    while((n=w.nextNode())){if(r.intersectsNode(n))nodes.push(n)}
    nodes.forEach(node=>{
      let s=0,e=node.data.length;
      if(node===r.startContainer)s=r.startOffset;
      if(node===r.endContainer)e=r.endOffset;
      if(e<=s)return;
      let t=s>0?node.splitText(s):node;
      if(e-s<t.data.length)t.splitText(e-s);
      const m=document.createElement('mark');m.className='hl';m.dataset.hid=id;m.title='Tap to remove highlight';
      t.parentNode.insertBefore(m,t);m.appendChild(t);
    });
  }
  function clearMarks(){doc.querySelectorAll('mark.hl').forEach(m=>{const p=m.parentNode;while(m.firstChild)p.insertBefore(m.firstChild,m);m.remove();p.normalize()})}

  /* Re-apply saved highlights after every render */
  function applyHL(){
    clearMarks();
    const saved=getHL();
    if(!saved.length){updProg();return}
    let applied=0,missing=0;
    saved.forEach(h=>{
      const {arr,full}=textNodes();
      let idx=-1,from=0;
      for(let i=0;i<=h.n;i++){idx=full.indexOf(h.t,from);if(idx<0)break;from=idx+1}
      if(idx<0){missing++;return}
      const r=rangeFromOffsets(arr,idx,idx+h.t.length);
      if(!r||r.startContainer.parentElement?.closest('mark.hl')){missing++;return}
      markRange(r,h.id);applied++;
    });
    log('Highlights restored:',applied,'missing:',missing);
    if(missing)warn('Some saved highlights no longer match the text:',missing);
    updProg();
  }
  const _render=render;
  render=function(){_render.apply(this,arguments);applyHL()};

  /* Long-press to highlight (touch only) */
  function caretAt(x,y){
    if(document.caretPositionFromPoint){const p=document.caretPositionFromPoint(x,y);if(p)return {node:p.offsetNode,off:p.offset}}
    if(document.caretRangeFromPoint){const r=document.caretRangeFromPoint(x,y);if(r)return {node:r.startContainer,off:r.startOffset}}
    return null;
  }
  let lpT=null,lpX=0,lpY=0,lastTouch=-Infinity,justMarked=0;
  doc.addEventListener('pointerdown',e=>{
    if(e.pointerType!=='touch')return;
    lastTouch=performance.now();lpX=e.clientX;lpY=e.clientY;
    clearTimeout(lpT);lpT=setTimeout(()=>{lpT=null;longPress(lpX,lpY)},500);
  },{passive:true});
  doc.addEventListener('pointermove',e=>{if(lpT&&Math.hypot(e.clientX-lpX,e.clientY-lpY)>10){clearTimeout(lpT);lpT=null}},{passive:true});
  ['pointerup','pointercancel'].forEach(ev=>doc.addEventListener(ev,()=>{clearTimeout(lpT);lpT=null;lastTouch=performance.now()},{passive:true}));
  /* Android fires contextmenu on long-press; block it only for touch long-presses */
  doc.addEventListener('contextmenu',e=>{if(e.target.closest&&e.target.closest('a,input,textarea,select,button,[contenteditable]'))return;if(performance.now()-lastTouch<1500){e.preventDefault();e.stopPropagation()}});

  function longPress(x,y){
    const sel=getSelection();let R=null;
    if(!sel.isCollapsed&&doc.contains(sel.anchorNode))R=sel.getRangeAt(0).cloneRange();
    else{
      const c=caretAt(x,y);
      if(!c||c.node.nodeType!==3||!doc.contains(c.node))return;
      const s=c.node.data;let a=c.off,b=c.off;
      while(a>0&&/\S/.test(s[a-1]))a--;
      while(b<s.length&&/\S/.test(s[b]))b++;
      if(a===b)return;
      R=document.createRange();R.setStart(c.node,a);R.setEnd(c.node,b);
    }
    const text=R.toString().trim();
    sel.removeAllRanges();
    if(!text){return}
    if(text.length>400){toast('Select a shorter passage to highlight');return}
    if(R.startContainer.parentElement?.closest('mark.hl')){toast('Already highlighted');return}
    const {arr,full}=textNodes();
    const start=(arr.find(x=>x.n===R.startContainer)||{s:0}).s+R.startOffset;
    let n=0,idx=full.indexOf(text);
    while(idx>=0&&idx<start){n++;idx=full.indexOf(text,idx+1)}
    const id=Date.now().toString(36)+Math.random().toString(36).slice(2,6);
    const list=getHL();list.push({t:text,n,id});
    if(!setHL(list))return;
    markRange(R,id);justMarked=performance.now();
    toast('Highlighted');log('Highlight added:',text.length,'chars');
  }
  /* Tap an existing highlight to remove it (ignored right after creating one) */
  doc.addEventListener('click',e=>{
    const m=e.target.closest&&e.target.closest('mark.hl');
    if(!m||performance.now()-justMarked<700)return;
    e.preventDefault();e.stopPropagation();
    const id=m.dataset.hid;setHL(getHL().filter(h=>h.id!==id));applyHL();toast('Highlight removed');log('Highlight removed');
  },true);
  applyHL();
})();

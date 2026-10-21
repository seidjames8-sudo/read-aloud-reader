
/* ---- Chapter drawer, toolbar and floating chapter buttons, reader context menu, mobile More button ---- */
(function(){
  const drawer=$('#chapDrawer'),chapBtn=$('#chapBtn'),floatBtn=$('#floatChap'),closeBtn=$('#chapClose');
  const moreBtn=$('#moreBtn'),menu=$('#ctxMenu'),doc=$('#doc'),bar=$('#bar');
  const isSheet=()=>matchMedia('(max-width: 600px)').matches;
  let lastTrigger=null,savedSel='';
  menu.tabIndex=-1;

  /* Reading-time visibility: one source of truth (reader.showReadingTime, set in Reading prefs).
     Legacy pf-timehide is migrated once; applyTime remains for the context-menu toggle. */
  function timePrefOn(){
    let v=null;try{v=localStorage.getItem('reader.showReadingTime')}catch(e){}
    if(v!=null&&v!=='')return v==='1';
    let legacy=null;try{legacy=localStorage.getItem('pf-timehide')}catch(e){}
    return legacy!=='1';
  }
  function applyTime(hidden){
    document.body.classList.toggle('hide-time',hidden);
    try{localStorage.setItem('reader.showReadingTime',hidden?'0':'1')}catch(e){}
    if(typeof window.applyReaderSwitches==='function')window.applyReaderSwitches();
  }
  try{const legacy=localStorage.getItem('pf-timehide');if(legacy!==null){
    let cur=null;try{cur=localStorage.getItem('reader.showReadingTime')}catch(e){}
    if(cur==null||cur==='')try{localStorage.setItem('reader.showReadingTime',legacy==='1'?'0':'1')}catch(e){}
    localStorage.removeItem('pf-timehide')
  }}catch(e){}
  document.body.classList.toggle('hide-time',!timePrefOn());

  /* Keep the floating button clear of the playback bar */
  if(bar&&window.ResizeObserver){
    new ResizeObserver(()=>document.documentElement.style.setProperty('--bar-h',bar.offsetHeight+'px')).observe(bar);
  }

  /* One source of truth for the drawer; both buttons mirror it */
  function setDrawer(open,opts){
    const hadFocus=drawer.contains(document.activeElement);
    drawer.hidden=!open;
    document.body.classList.toggle('drawer-open',open);
    chapBtn.setAttribute('aria-expanded',String(open));
    floatBtn.setAttribute('aria-expanded',String(open));
    floatBtn.setAttribute('aria-label',open?'Close chapters':'Open chapters');
    floatBtn.title=open?'Close chapters':'Chapters';
    if(open){if(!(opts&&opts.noFocus))(drawer.querySelector('#chSel')||closeBtn).focus({preventScroll:true})}
    else if(hadFocus)(opts&&opts.returnTo||chapBtn).focus({preventScroll:true});
    log('Chapter panel',open?'opened':'closed');
  }
  chapBtn.onclick=()=>setDrawer(drawer.hidden);
  floatBtn.onclick=()=>setDrawer(drawer.hidden);
  closeBtn.onclick=()=>setDrawer(false,{returnTo:chapBtn});
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&!drawer.hidden&&menu.hidden)setDrawer(false,{returnTo:chapBtn});
  });

  /* Copy: uses the selection captured when the menu opened */
  function copyText(t){
    if(!t){toast('Select some text first');return}
    const fallback=()=>{
      const ta=document.createElement('textarea');ta.value=t;ta.setAttribute('readonly','');
      ta.style.cssText='position:fixed;opacity:0;pointer-events:none';
      document.body.appendChild(ta);ta.select();
      let ok=false;try{ok=document.execCommand('copy')}catch(e){}
      ta.remove();toast(ok?'Copied':'Copy is not allowed in this browser');
    };
    if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t).then(()=>toast('Copied'),fallback)}
    else fallback();
  }

  /* Only actions the toolbar does not already provide (no duplicates of Chapters, Shortcuts, Preferences, Edit, Full screen) */
  function actions(){
    const timeHidden=document.body.classList.contains('hide-time');
    return [
      {label:timeHidden?'Show reading time':'Hide reading time',run:()=>applyTime(!document.body.classList.contains('hide-time'))},
      {label:drawer.hidden?'Show chapter panel':'Hide chapter panel',run:()=>setDrawer(drawer.hidden)},
      {label:'Copy selected text',disabled:!savedSel,run:()=>copyText(savedSel)}
    ];
  }

  function place(x,y){
    menu.classList.toggle('sheet',isSheet());
    if(isSheet()){menu.style.left='';menu.style.top='';return}
    menu.style.left='0px';menu.style.top='0px';
    const r=menu.getBoundingClientRect(),m=8;
    menu.style.left=Math.max(m,Math.min(x,innerWidth-r.width-m))+'px';
    menu.style.top=Math.max(m,Math.min(y,innerHeight-r.height-m))+'px';
  }

  function closeMenu(restore){
    if(menu.hidden)return;
    menu.hidden=true;
    moreBtn.setAttribute('aria-expanded','false');
    document.removeEventListener('pointerdown',outsideClose,true);
    document.removeEventListener('keydown',menuKeys,true);
    if(restore&&lastTrigger&&lastTrigger.focus)lastTrigger.focus({preventScroll:true});
  }
  function outsideClose(e){if(!menu.contains(e.target)&&!moreBtn.contains(e.target))closeMenu(false)}

  function menuKeys(e){
    const items=[...menu.querySelectorAll('[role=menuitem]:not([disabled])')];
    const i=items.indexOf(document.activeElement);
    if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeMenu(true);return}
    if(e.key==='Tab'){closeMenu(false);return}
    if(!items.length)return;
    if(e.key==='ArrowDown'){e.preventDefault();items[(i+1+items.length)%items.length].focus()}
    else if(e.key==='ArrowUp'){e.preventDefault();items[(i-1+items.length)%items.length].focus()}
    else if(e.key==='Home'){e.preventDefault();items[0].focus()}
    else if(e.key==='End'){e.preventDefault();items[items.length-1].focus()}
  }

  function openMenu(x,y,trigger,items){
    savedSel=String(getSelection()||'').trim();
    menu.innerHTML='';
    (items||actions()).forEach(a=>{
      const b=document.createElement('button');
      b.type='button';b.setAttribute('role','menuitem');b.tabIndex=-1;b.textContent=a.label;
      if(a.disabled){b.disabled=true;b.setAttribute('aria-disabled','true')}
      b.addEventListener('click',()=>{closeMenu(false);a.run()});
      menu.appendChild(b);
    });
    lastTrigger=trigger||null;
    menu.hidden=false;
    moreBtn.setAttribute('aria-expanded',String(trigger===moreBtn));
    place(x,y);
    const first=menu.querySelector('[role=menuitem]:not([disabled])');
    (first||menu).focus({preventScroll:true});
    document.addEventListener('pointerdown',outsideClose,true);
    document.addEventListener('keydown',menuKeys,true);
    log('Reader menu opened');
  }


  /* Read from here: start speaking at the last word that begins at or before the node */
  function readFrom(node){
    if(!node||!words||!words.length){speak(0);return}
    let idx=0;
    for(let k=0;k<words.length;k++){
      const el=words[k].el;
      if(el.compareDocumentPosition(node)&Node.DOCUMENT_POSITION_PRECEDING)break;
      idx=k;
    }
    log('Read from word',idx+1,'of',words.length);
    speak(idx);
  }
  const readHere=node=>({label:'Read from here',run:()=>readFrom(node)});

  /* Long press on text: Read from here / Highlight this / Copy text */
  window.showPressMenu=(x,y,R,text)=>{
    const node=R.startContainer;
    openMenu(x,y,null,[
      readHere(node),
      {label:'Highlight this',run:()=>window.commitHighlight(R,text)},
      {label:'Copy text',run:()=>copyText(text)}
    ]);
  };

  /* Selection toolbar: icon buttons appear above selected reader text */
  const selBar=document.createElement('div');
  selBar.id='selBar';selBar.setAttribute('role','toolbar');selBar.setAttribute('aria-label','Selected text actions');selBar.hidden=true;
  const SEL_ICON={
    read:'<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    hl:'<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M4 20h4l11-11-4-4L4 16v4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M3 22h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    copy:'<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" fill="none" stroke="currentColor" stroke-width="2"/></svg>'
  };
  const SEL_LABEL={read:'Read from here',hl:'Highlight',copy:'Copy'};
  ['read','hl','copy'].forEach(k=>{
    const b=document.createElement('button');b.type='button';b.dataset.a=k;
    b.setAttribute('aria-label',SEL_LABEL[k]);b.title=SEL_LABEL[k];b.innerHTML=SEL_ICON[k];
    selBar.appendChild(b);
  });
  document.body.appendChild(selBar);
  let selR=null,selText='';
  function currentSel(){
    const s=getSelection();
    if(!s||s.isCollapsed||!s.rangeCount)return null;
    const r=s.getRangeAt(0);
    if(!doc.contains(r.commonAncestorContainer))return null;
    const text=String(s).trim();
    return text?{r:r.cloneRange(),text}:null;
  }
  function placeSelBar(){
    const cur=currentSel();
    if(!cur||!menu.hidden){selBar.hidden=true;selR=null;return}
    const rc=cur.r.getBoundingClientRect();
    if(!rc.width&&!rc.height){selBar.hidden=true;selR=null;return}
    selR=cur.r;selText=cur.text;
    selBar.hidden=false;
    const w=selBar.offsetWidth,h=selBar.offsetHeight,m=8;
    let L=rc.left+rc.width/2-w/2,T=rc.top-h-m;
    if(T<m)T=rc.bottom+m;
    L=Math.max(m,Math.min(L,innerWidth-w-m));
    T=Math.max(m,Math.min(T,innerHeight-h-m));
    selBar.style.left=L+'px';selBar.style.top=T+'px';
  }
  let selRaf=0;
  const schedSel=()=>{if(!selRaf)selRaf=requestAnimationFrame(()=>{selRaf=0;placeSelBar()})};
  document.addEventListener('selectionchange',schedSel);
  addEventListener('scroll',schedSel,{passive:true,capture:true});
  addEventListener('resize',schedSel);
  /* Pressing an icon must not clear the selection */
  selBar.addEventListener('mousedown',e=>e.preventDefault());
  selBar.addEventListener('pointerdown',e=>e.preventDefault());
  selBar.addEventListener('click',e=>{
    const b=e.target.closest('button[data-a]');
    if(!b||!selR)return;
    const R=selR,text=selText,a=b.dataset.a;
    selBar.hidden=true;selR=null;
    if(a==='read')readFrom(R.startContainer);
    else if(a==='hl'){getSelection().removeAllRanges();window.commitHighlight(R,text)}
    else if(a==='copy')copyText(text);
  });

  /* Desktop: right-click inside the reading text only; native menu elsewhere */
  let touchAt=-Infinity;
  document.addEventListener('pointerdown',e=>{if(e.pointerType==='touch')touchAt=performance.now()},true);
  doc.addEventListener('contextmenu',e=>{
    if(performance.now()-touchAt<1500)return;
    if(e.target.closest&&e.target.closest('a,input,textarea,select,button,[contenteditable]'))return;
    e.preventDefault();
    const node=window.caretNodeAt?window.caretNodeAt(e.clientX,e.clientY):null;
    openMenu(e.clientX,e.clientY,null,[readHere(node)].concat(actions()));
  });

  /* Mobile and keyboard: visible More button opens the same menu */
  moreBtn.setAttribute('aria-expanded','false');
  moreBtn.onclick=()=>{
    if(!menu.hidden){closeMenu(true);return}
    const r=moreBtn.getBoundingClientRect();
    openMenu(r.right-220,r.bottom+6,moreBtn);
  };
  /* Keep menu semantics in sync with the menu element */
  menu.setAttribute('aria-label','Reader actions');
})();

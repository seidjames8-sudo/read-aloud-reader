
/* ---- Chapter drawer, toolbar and floating chapter buttons, reader context menu, mobile More button ---- */
(function(){
  const drawer=$('#chapDrawer'),chapBtn=$('#chapBtn'),floatBtn=$('#floatChap'),closeBtn=$('#chapClose');
  const moreBtn=$('#moreBtn'),menu=$('#ctxMenu'),doc=$('#doc'),bar=$('#bar');
  const isSheet=()=>matchMedia('(max-width: 600px)').matches;
  let lastTrigger=null,savedSel='';
  menu.tabIndex=-1;

  /* Reading-time visibility: shown by default, choice remembered */
  function applyTime(hidden){
    document.body.classList.toggle('hide-time',hidden);
    try{localStorage.setItem('pf-timehide',hidden?'1':'0')}catch(e){}
  }
  let savedTime=null;try{savedTime=localStorage.getItem('pf-timehide')}catch(e){}
  applyTime(savedTime==='1');

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

  function openMenu(x,y,trigger){
    savedSel=String(getSelection()||'').trim();
    menu.innerHTML='';
    actions().forEach(a=>{
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

  /* Desktop: right-click inside the reading text only; native menu elsewhere */
  let touchAt=0;
  document.addEventListener('pointerdown',e=>{if(e.pointerType==='touch')touchAt=performance.now()},true);
  doc.addEventListener('contextmenu',e=>{
    if(performance.now()-touchAt<1500)return;
    if(e.target.closest&&e.target.closest('a,input,textarea,select,button,[contenteditable]'))return;
    e.preventDefault();
    openMenu(e.clientX,e.clientY,null);
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

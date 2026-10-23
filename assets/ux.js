(function(){const t=document.getElementById('ytAlt');if(t){t.value=load('pf-ytalt')||'';t.onchange=()=>{store('pf-ytalt',t.value.trim());toast('Alternative player saved.')}}
  const c=document.getElementById('ytInline');if(!c)return;c.checked=load('pf-yt')!=='0';c.onchange=()=>{store('pf-yt',c.checked?'1':'0');toast('This applies the next time the text is shown (press Start reading).')}})();

/* Senior-level UX patch: persistent editor font sizing and immersive auto-hiding chrome. */
(()=>{
  const src=document.getElementById('src'),label=document.getElementById('editorFontLabel');
  let size=Number(localStorage.getItem('ra-editor-font-size'))||15;size=Math.min(30,Math.max(12,size));
  const applySize=()=>{document.documentElement.style.setProperty('--editor-font-size',size+'px');if(label)label.textContent=size+' px';try{localStorage.setItem('ra-editor-font-size',String(size))}catch(_){}};
  const change=d=>{size=Math.min(30,Math.max(12,size+d));applySize();src?.focus({preventScroll:true})};
  document.getElementById('editorSmaller')?.addEventListener('click',()=>change(-1));
  document.getElementById('editorLarger')?.addEventListener('click',()=>change(1));
  document.getElementById('editorFontReset')?.addEventListener('click',()=>{size=15;applySize();src?.focus({preventScroll:true})});applySize();
  let hideTimer=0,manual=false,hasInteracted=false;
  const interactive=()=>document.body.classList.contains('edit')||document.querySelector('#panel.open, #con.open, #histPanel:not([hidden])')||document.activeElement?.matches('input,textarea,select,[contenteditable="true"]');
  /* Touch screens have no hover pointer, so the auto-hiding toolbar can trap buttons like Edit text.
     Keep the chrome visible there and let any tap bring it back. */
  const touchOnly=matchMedia('(pointer:coarse)').matches||matchMedia('(hover: none)').matches;
  const reveal=()=>{document.body.classList.remove('chrome-hidden');clearTimeout(hideTimer);if(!manual&&!touchOnly&&!interactive())hideTimer=setTimeout(()=>{if(!interactive())document.body.classList.add('chrome-hidden')},2600)};
  const hide=()=>{if(!manual&&!touchOnly&&!interactive())document.body.classList.add('chrome-hidden')};
  // Start with chrome visible and only begin auto-hide after first interaction.
  document.body.classList.remove('chrome-hidden');
  document.addEventListener('pointermove',e=>{hasInteracted=true;if(e.clientY<70||e.clientY>innerHeight-100)reveal();else if(document.body.classList.contains('chrome-hidden'))return;else {clearTimeout(hideTimer);hideTimer=setTimeout(hide,2600)}},{passive:true});
  document.addEventListener('pointerdown',e=>{hasInteracted=true;if(document.body.classList.contains('chrome-hidden')||e.clientY<70||e.clientY>innerHeight-100)reveal()},{passive:true});
  document.addEventListener('focusin',()=>{hasInteracted=true;reveal()});
  document.addEventListener('keydown',e=>{
    hasInteracted=true;
    if((e.ctrlKey||e.metaKey)&&!e.altKey&&['+','=','-','_'].includes(e.key)&&document.activeElement===src){e.preventDefault();change(['-','_'].includes(e.key)?-1:1);return}
    if(e.key==='Escape'&&document.body.classList.contains('chrome-hidden'))reveal();
  });
  document.addEventListener('click',e=>{hasInteracted=true;if(e.target.closest('#edit,#go,#pClose,#conBtn,#conX')){manual=false;reveal()}});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)document.body.classList.remove('chrome-hidden')});
  // Keep the reader chrome available when a preference panel or editor is open.
  // Observe only the relevant panels. Observing body/subtree here causes a feedback loop:
  // reveal() changes body.classList, which would retrigger this observer indefinitely.
  const watched=['#panel','#con','#histPanel','#src'].map(sel=>document.querySelector(sel)).filter(Boolean);
  if(watched.length){const observer=new MutationObserver(()=>{if(interactive())reveal()});watched.forEach(node=>observer.observe(node,{attributes:true,attributeFilter:['class','open','hidden']}));}
  // Touch devices can reveal controls with a tap near either edge; avoid permanently hiding while editing.
  if(touchOnly){document.body.classList.remove('chrome-hidden');}
})();

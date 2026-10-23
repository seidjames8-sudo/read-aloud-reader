
/* Full screen for PC and mobile. Real full screen is used when the browser allows it.
   When it is refused (embedded page, local file on some phones, iPhone), the toolbar is hidden instead. */
(function(){
  const btn=document.getElementById('fullscreenBtn'),ex=document.getElementById('fsExit'),pb=document.getElementById('fsPrefBtn'),au=document.getElementById('fsAuto');
  if(!btn)return;
  const root=document.documentElement,B=document.body.classList;
  const isFS=()=>!!(document.fullscreenElement||document.webkitFullscreenElement);
  const active=()=>isFS()||B.contains('immersive');
  function sync(){
    const on=active(),label=on?'Exit full screen':'Full screen';
    B.toggle('app-fullscreen',isFS());
    btn.setAttribute('aria-pressed',String(on));btn.setAttribute('aria-label',label);btn.title=label+' (F)';
    btn.querySelector('.fs-i').textContent=on?'🗗':'⛶';btn.querySelector('.fs-t').textContent=label;
    if(pb)pb.textContent=on?'Exit full screen':'Enter full screen';
    setTimeout(()=>{if(typeof layout==='function')layout()},150);
  }
  async function toggle(auto){
    if(isFS()){try{await (document.exitFullscreen||document.webkitExitFullscreen).call(document)}catch(e){}sync();return}
    if(B.contains('immersive')){B.remove('immersive');sync();return}
    const req=root.requestFullscreen||root.webkitRequestFullscreen;
    if(req){
      try{
        const r=req.call(root,{navigationUI:'hide'});
        if(r&&r.then)await r;
        // Verify fullscreen actually activated; some browsers resolve the promise but deny the request
        if(isFS()){sync();return}
        if(typeof log==='function')log('Full screen request resolved but not active');
      }catch(e){if(typeof log==='function')log('Full screen refused:',(e&&e.message)||e)}
    }
    // Fall back to immersive mode (hide toolbar) when real full screen is unavailable
    if(auto===true){B.add('immersive');sync();return}
    B.add('immersive');sync();
    if(typeof toast==='function')toast('Full screen is blocked here, so the toolbar is hidden instead. Press Esc or tap Exit to return.');
  }
  window.toggleFS=()=>toggle();
  btn.addEventListener('click',()=>toggle());ex.addEventListener('click',()=>toggle());
  if(pb)pb.addEventListener('click',()=>toggle());
  document.addEventListener('fullscreenchange',sync);document.addEventListener('webkitfullscreenchange',sync);
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){if(B.contains('immersive')&&!isFS()){B.remove('immersive');sync()}else if(isFS()&&!document.fullscreenElement&&!document.webkitFullscreenElement){sync()}}
    // F key toggles full screen (primary shortcut, also registered in core.js keyboard shortcuts)
    else if(e.key==='f'||e.key==='F'){if(!e.ctrlKey&&!e.altKey&&!e.metaKey&&!(e.target instanceof HTMLInputElement)&&!(e.target instanceof HTMLTextAreaElement)){
      e.preventDefault();toggle();
    }}
  });
  /* optional: enter full screen automatically when reading starts (the play press counts as the required user gesture) */
  if(au){
    au.checked=load('pf-fsauto')==='1';au.onchange=()=>store('pf-fsauto',au.checked?'1':'0');
    let tried=false;
    new MutationObserver(()=>{
      const sp=document.body.classList.contains('speaking');
      if(!sp){tried=false;return}
      if(au.checked&&!tried&&!active()){tried=true;toggle(true)}
    }).observe(document.body,{attributes:true,attributeFilter:['class']});
  }
  sync();
})();

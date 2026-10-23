// Carousel scanner for Fandom/Wikipedia reference cards.
// Rule: one carousel per article, per spoiler block, and only one carousel
// for the same article across the whole chapter.
(function(){
  const root=document.getElementById('src')||document;
  const doc=document.getElementById('doc');
  if(!doc)return;

  const seen=new Set();
  const blockSeen=new WeakMap();

  const hostOf=a=>{const h=(a.getAttribute('href')||'').trim();const m=h.match(/^https?:\/\/([a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:fandom|wikia)\.com)/i);return m?m[1]:null};
  const articleOf=a=>{const h=(a.getAttribute('href')||'').trim();
    const m=h.match(/^https?:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:fandom|wikia)\.com\/(?:[a-z-]+\/)?wiki\/([^?#]+)/i);
    return m?decodeURIComponent(m[1].replace(/_+/g,'_')):null;
  };
  const isFandomLink=a=>{const h=(a.getAttribute('href')||'').trim();return /\.(fandom|wikia)\.com\//i.test(h)};

  function articleKey(a){
    const host=hostOf(a);const art=articleOf(a);
    if(!host||!art)return null;
    return host+'|'+art.toLowerCase();
  }

  function render(d){
    if(!d||d._carDone)return;
    const links=[...d.querySelectorAll('a')];
    if(!links.length){d._carDone=true;return}

    const linksWithKey=links.map(a=>({a,key:articleKey(a)})).filter(x=>x.key);
    if(!linksWithKey.length){d._carDone=true;return}

    const topArticle=articleOf(linksWithKey[0].a);
    if(!topArticle){d._carDone=true;return}

    const topKey=articleKey(linksWithKey[0].a);
    if(!topKey){d._carDone=true;return}

    if(seen.has(topKey)){d._carDone=true;return}
    if(blockSeen.has(d)&&blockSeen.get(d)!==topKey){d._carDone=true;return}

    seen.add(topKey);
    blockSeen.set(d,topKey);
    d._carDone=true;

    const container=document.createElement('div');
    container.className='carousels';
    container.setAttribute('data-article-key',topKey);

    const header=document.createElement('div');
    header.className='car-header';
    const title=document.createElement('div');
    title.className='car-title';
    title.textContent=topArticle;
    header.appendChild(title);
    container.appendChild(header);

    const viewport=document.createElement('div');
    viewport.className='car-viewport';
    const stage=document.createElement('div');
    stage.className='car-stage';
    viewport.appendChild(stage);
    container.appendChild(viewport);

    const caption=document.createElement('div');
    caption.className='car-caption';
    container.appendChild(caption);

    const foot=document.createElement('div');
    foot.className='car-foot';

    const counter=document.createElement('span');
    counter.className='car-counter';
    counter.textContent='1 / 1';
    foot.appendChild(counter);

    const btns=document.createElement('span');
    btns.className='car-btns';

    const prev=document.createElement('button');
    prev.type='button';
    prev.className='car-btn car-prev';
    prev.textContent='‹';
    prev.setAttribute('aria-label','Previous image');
    btns.appendChild(prev);

    const next=document.createElement('button');
    next.type='button';
    next.className='car-btn car-next';
    next.textContent='›';
    next.setAttribute('aria-label','Next image');
    btns.appendChild(next);

    foot.appendChild(btns);
    container.appendChild(foot);
    d.insertBefore(container,d.firstChild);

    let items=[];
    let i=0;
    let loaded=false;

    function renderSlide(){
      stage.textContent='';
      const img=document.createElement('img');
      img.className='car-img';
      img.alt=topArticle;
      if(items[i]&&items[i].src)img.src=items[i].src;
      if(items[i]&&items[i].alt)img.alt=items[i].alt;
      stage.appendChild(img);
      caption.textContent=items[i]&&items[i].cap||topArticle+' · '+(i+1)+' / '+(items.length||1);
      counter.textContent=(i+1)+' / '+(items.length||1);
    }

    function show(n){
      if(!items.length)return;
      i=(n%items.length+items.length)%items.length;
      renderSlide();
    }

    prev.onclick=()=>show(i-1);
    next.onclick=()=>show(i+1);

    container._carPrev=prev;
    container._carNext=next;
    container._carShow=show;
    container._carItems=items;
    container._carIndex=i;
    container._carDone=true;

    let x0=null;
    viewport.addEventListener('pointerdown',e=>{x0=e.clientX});
    viewport.addEventListener('pointerup',e=>{
      if(x0===null)return;
      const dx=e.clientX-x0;
      x0=null;
      if(Math.abs(dx)>45)show(i+(dx<0?1:-1));
    });

    async function load(){
      if(loaded)return;
      loaded=true;
      try{
        const url='https://'+hostOf(linksWithKey[0].a)+'/api.php?action=query&prop=images&format=json&origin=*&titles='+encodeURIComponent(topArticle);
        const r=await fetch(url);
        if(!r.ok)throw new Error('HTTP '+r.status);
        const j=await r.json();
        const pages=Object.values(j.query&&j.query.pages||{});
        const page=pages[0];
        if(!page||!page.images||!page.images.length){
          items=[{src:null,alt:topArticle,cap:topArticle}];
          renderSlide();
          counter.textContent='1 / 1';
          return;
        }
        const names=page.images.slice(0,8).map(it=>it.title.replace(/^File:/i,'').replace(/_/g,' '));
        items=names.map(n=>({src:null,alt:n,cap:n}));
        for(let k=0;k<items.length;k++){
          const file=names[k].replace(/ /g,'_');
          const img=new Image();
          img.src='https://'+hostOf(linksWithKey[0].a)+'/wiki/Special:FilePath/'+encodeURIComponent(file)+'?width=480';
          await new Promise(res=>{img.onload=res;img.onerror=res});
          items[k].src=img.src;
        }
        renderSlide();
        counter.textContent=(i+1)+' / '+items.length;
      }catch(e){
        items=[{src:null,alt:topArticle,cap:topArticle+' (image unavailable)'}];
        renderSlide();
        counter.textContent='1 / 1';
      }
    }
    load();
  }

  function scan(){
    doc.querySelectorAll('details').forEach(d=>{
      if(!d._carDone && !d._carScanning){
        d._carScanning=true;
        render(d);
      }
    });
  }

  doc.addEventListener('toggle',e=>{
    const d=e.target;
    if(d&&d.tagName==='DETAILS'&&d.open&&!d._carDone&&!d._carScanning){
      d._carScanning=true;
      render(d);
    }
  },true);

  let t=0;
  new MutationObserver(()=>{clearTimeout(t);t=setTimeout(scan,300)}).observe(doc,{childList:true,subtree:true});

  scan();
})();

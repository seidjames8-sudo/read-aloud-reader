// Carousel scanner for Fandom/Wikia reference cards.
// Rule: one carousel per article, per spoiler block, and only one carousel
// for the same article across the whole chapter.
/* Pictures come from the wiki API (imageinfo thumburl). /wiki/Special:FilePath must
   never be used: it answers 403 to a browser, which is why every reference card
   showed an empty frame instead of the article's picture. */
(function(){
  const doc=document.getElementById('doc');
  if(!doc)return;

  const MAX=8;
  // Files that are page furniture (icons, banners, placeholders), not pictures of the subject.
  const JUNK=/(^|[\s_(\-])(site-?logo|favicon|wiki-?wordmark|wordmark|symbol|icon|question[_ ]book|ambox|disambig|spoiler|logo|button|nav|audio|video|padlock|edit|redlink|stub|blank|transparent|namespace|bullet|oos|merge|cleanup|delete|warning|notice|featured|no[_ ]image|placeholder)([\s_)\-.0-9]|$)/i;

  const keySel=k=>'.carousels[data-article-key="'+String(k).replace(/["\\]/g,'\\$&')+'"]';
  // File names arrive as "A_B.jpg" from one API call and "A B.jpg" from another.
  const norm=s=>String(s||'').replace(/^File:/i,'').replace(/_/g,' ').trim().toLowerCase();

  /* Wikipedia links are handled by pictures.js, which builds its own gallery. */
  const NOT_HERE=/(^|\.)(wikipedia\.org|wikiwand\.com)$/i;

  /* Read a reference link: host, article, and the ?file= picture the link points at.
     Any MediaWiki is supported, not just Fandom: tfwiki.net and other independent
     wikis link the same way. */
  function info(a){
    let u;try{u=new URL(a.getAttribute('href')||'',location.href)}catch(e){return null}
    if(!/^https?:$/.test(u.protocol)||NOT_HERE.test(u.hostname))return null;
    const m=u.pathname.match(/^(?:\/[a-z-]{2,20})?\/wiki\/([^/]+)/i);
    if(!m)return null;
    let article;try{article=decodeURIComponent(m[1]).replace(/_/g,' ').trim()}catch(e){return null}
    if(!article||/^file:/i.test(article))return null;
    let file=(u.searchParams.get('file')||'').trim();
    if(!file){
      const h=decodeURIComponent(u.hash||'').replace(/^#/,'');
      if(/^\/?media\/File:/i.test(h))file=h.replace(/^\/?media\/File:/i,'');
    }
    try{file=decodeURIComponent(file)}catch(e){}
    return {host:u.hostname.toLowerCase(),article:article,file:file.replace(/_/g,' ').trim(),
      key:u.hostname.toLowerCase()+'|'+article.toLowerCase()};
  }

  /* JSONP: the only way in when a wiki sends no CORS header (tfwiki.net does not). */
  function jsonp(url){
    return new Promise((res,rej)=>{
      const cb='racb'+Math.random().toString(36).slice(2),s=document.createElement('script');
      const t=setTimeout(()=>done(new Error('timeout')),12000);
      function done(err,data){
        clearTimeout(t);
        try{delete window[cb]}catch(e){window[cb]=undefined}
        s.remove();
        err?rej(err):res(data);
      }
      window[cb]=data=>done(null,data);
      s.onerror=()=>done(new Error('script blocked'));
      s.src=url+'&callback='+cb;
      document.head.appendChild(s);
    });
  }
  async function api(host,params){
    const base='https://'+host+'/api.php?format=json&'+params;
    try{
      const r=await fetch(base+'&origin=*');
      if(!r.ok)throw new Error('HTTP '+r.status);
      return await r.json();
    }catch(e){
      return jsonp(base);
    }
  }

  /* Wikis whose API will not list a page's files (tfwiki.net answers with no images)
     still return the top of the article, so the picture names come from there. */
  function namesFromHtml(j){
    const t=j&&j.parse&&j.parse.text,html=String((t&&(t['*']||t))||'');
    const out=[],seen=new Set(),re=/<img\b[^>]*\bsrc="([^"]+)"/gi;let m;
    while((m=re.exec(html))&&out.length<12){
      let src=m[1];
      try{src=decodeURIComponent(src)}catch(e){}
      if(/skins\/|magnify|\/common\//i.test(src))continue;
      const file=src.split('?')[0].split('/').pop()||'';
      // MediaWiki thumbnails are named "NNNpx-file": template badges are 20-60 px,
      // pictures of the subject are 120 px and up.
      const w=(file.match(/^(\d+)px-/)||[])[1];
      if(w&&+w<120)continue;
      const name=file.replace(/^\d+px-/,'').replace(/_/g,' ').trim();
      if(!/\.(jpe?g|png|gif|webp)$/i.test(name))continue;
      const k=name.toLowerCase();
      // Template furniture (logos, icons, badges) sits at the top of every article.
      if(seen.has(k)||JUNK.test(name)||/logo|icon|symbol|featured|placeholder|magnify|badge/i.test(name))continue;
      seen.add(k);out.push(name);
    }
    return out;
  }

  /* Candidate file names: the picture the link names first, then the pictures shown at
     the top of the article (the infobox portrait), then the rest of the article's pictures. */
  async function candidates(host,article,prefer){
    const raw=[],prio=new Map(),page=encodeURIComponent(article);
    /* A file named after the subject is the likeliest portrait, so it ranks higher. */
    const base=article.replace(/\s*\([^)]*\)\s*$/,'').toLowerCase().replace(/[^a-z0-9]/g,'');
    const add=(n,p)=>{
      const name=String(n||'').replace(/^File:/i,'').replace(/_/g,' ').trim();
      if(!name)return;
      const k=name.toLowerCase();
      const named=base&&k.replace(/[^a-z0-9]/g,'').includes(base)?80:0;
      if(p!=null&&!prio.has(k))prio.set(k,p+named);
      raw.push(name);
    };
    if(prefer)add(prefer,1000);
    /* Independent wikis (tfwiki.net) do not list a page's files through prop=images, so
       the top of the article is read instead: what it shows at full size is its own
       pictures, while template badges are only ever shown as small icons. */
    let listed=false;
    if(!/\.(fandom|wikia)\.com$/i.test(host)){
      const files=await api(host,'action=parse&page='+page+'&prop=text&section=0')
        .then(namesFromHtml).catch(()=>[]);
      files.forEach((n,j)=>add(n,Math.max(200,400-j)));
      listed=files.length>0;
    }
    if(!listed){
      const lead=await api(host,'action=parse&page='+page+'&prop=images&section=0')
        .then(j=>(j.parse&&j.parse.images)||[]).catch(()=>[]);
      const all=await api(host,'action=query&prop=images&imlimit=60&titles='+page)
        .then(j=>{
          const pg=Object.values((j.query&&j.query.pages)||{})[0];
          return ((pg&&pg.images)||[]).map(it=>String(it.title||''));
        }).catch(e=>{log('Article pictures unavailable:',(e&&e.message)||e);return []});
      lead.forEach((n,j)=>add(n,Math.max(200,500-j)));
      all.forEach(n=>add(n,null));
    }
    const low=article.toLowerCase(),seen=new Set(),list=[];
    raw.forEach(n=>{
      const k=n.toLowerCase();
      if(seen.has(k))return;
      seen.add(k);
      if(/\.svg$/i.test(n)||JUNK.test(n)||/logo|icon|symbol|featured|placeholder|magnify|badge/i.test(n))return;
      list.push(n);
    });
    const score=n=>{
      const k=n.toLowerCase();
      if(prio.has(k))return prio.get(k);
      return k.includes(low)?20:0;
    };
    list.sort((a,b)=>score(b)-score(a));
    return list.slice(0,14);
  }

  /* One batched API call per 20 files gives the real CDN picture URL for each. */
  async function pictures(host,article,prefer){
    const names=await candidates(host,article,prefer);
    const map={},out=[];
    for(let i=0;i<names.length;i+=20){
      const batch=names.slice(i,i+20);
      try{
        const j=await api(host,'action=query&prop=imageinfo&iiprop=url|size&iiurlwidth=480&titles='+
          encodeURIComponent(batch.map(n=>'File:'+n).join('|')));
        Object.values((j.query&&j.query.pages)||{}).forEach(p=>{
          const ii=p.imageinfo&&p.imageinfo[0];
          if(ii&&(ii.thumburl||ii.url))map[norm(p.title)]={thumb:ii.thumburl||ii.url,full:ii.url||'',w:ii.width||0,h:ii.height||0};
        });
      }catch(e){log('Picture links unavailable:',(e&&e.message)||e)}
    }
    for(let i=0;i<names.length;i++){
      const hit=map[norm(names[i])];
      if(hit){
        // Badges, franchise symbols and icons are tiny files: only real pictures here.
        if((hit.w&&hit.w<120)||(hit.h&&hit.h<120))continue;
        out.push({src:hit.thumb,fallback:hit.full,cap:names[i].replace(/\.[a-z0-9]+$/i,'')});
        if(out.length>=MAX)break;
      }
    }
    return out;
  }

  function build(d,first){
    const container=document.createElement('div');
    container.className='carousels fandom-carousel';
    container.setAttribute('data-article-key',first.key);

    const header=document.createElement('div');
    header.className='car-header';
    const title=document.createElement('div');
    title.className='car-title';
    title.textContent=first.article;
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
    caption.textContent='Loading pictures…';
    container.appendChild(caption);

    const foot=document.createElement('div');
    foot.className='car-foot';

    const counter=document.createElement('span');
    counter.className='car-counter';
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
    // Inserted before the links so the picture sits above its references, and so a
    // later scan of the same chapter finds it and does not add a second one.
    d.insertBefore(container,d.firstChild);

    let items=[],i=0,tries=0;

    function sync(){
      caption.textContent=(items[i]&&items[i].cap)||'Loading pictures…';
      counter.textContent=items.length?((i+1)+' / '+items.length):'';
      prev.disabled=next.disabled=items.length<2;
    }
    /* A slide that will not draw is skipped rather than left as a broken picture. */
    function drop(){
      if(!container.isConnected)return;
      items.splice(i,1);
      if(!items.length){
        container.remove();
        log('Pictures could not be loaded for',first.article);
        return;
      }
      if(i>=items.length)i=0;
      tries=0;
      paint();
    }
    function paint(){
      stage.textContent='';
      const it=items[i];
      if(!it)return;
      const img=document.createElement('img');
      img.className='car-img';
      img.referrerPolicy='strict-origin-when-cross-origin';
      img.alt=it.cap;
      img.style.visibility='hidden';
      img.onload=()=>{tries=0;img.style.visibility=''};
      img.onerror=()=>{
        // The wiki CDN answers 404 once while it builds a thumbnail: retry it, then
        // fall back to the full-size file, and only then give up on this picture.
        tries++;
        if(tries===1){setTimeout(()=>{if(img.isConnected){img.removeAttribute('src');img.src=it.src}},900);return}
        if(tries===2&&it.fallback&&img.src!==it.fallback){img.src=it.fallback;return}
        drop();
      };
      img.src=it.src;
      stage.appendChild(img);
      sync();
    }
    function show(n){
      if(!items.length)return;
      i=(n%items.length+items.length)%items.length;
      tries=0;
      paint();
    }
    prev.onclick=()=>show(i-1);
    next.onclick=()=>show(i+1);

    let x0=null;
    viewport.addEventListener('pointerdown',e=>{x0=e.clientX});
    viewport.addEventListener('pointerup',e=>{
      if(x0===null)return;
      const dx=e.clientX-x0;
      x0=null;
      if(Math.abs(dx)>45)show(i+(dx<0?1:-1));
    });

    d._carDone=true;
    pictures(first.host,first.article,first.file).then(list=>{
      if(!container.isConnected)return;
      if(!list.length){
        container.remove();
        log('No picture found for',first.article);
        return;
      }
      items=list;i=0;
      paint();
      log('Carousel set for',first.article,'('+items.length+' pictures)');
    }).catch(e=>{
      if(container.isConnected)container.remove();
      log('Carousel failed for',first.article,(e&&e.message)||e);
    });
  }

  function start(d){
    if(!d||d._carDone||d._carScanning)return;
    const links=[...d.querySelectorAll('a')].map(info).filter(Boolean);
    if(!links.length){d._carDone=true;return}
    const first=links.find(l=>l.file)||links[0];
    // One carousel per article in the whole chapter. The chapter is re-rendered on
    // navigation, so this checks the live page instead of a list that goes stale.
    if(doc.querySelector(keySel(first.key))){d._carDone=true;return}
    d._carScanning=true;
    build(d,first);
  }

  function scan(){doc.querySelectorAll('details').forEach(start)}

  doc.addEventListener('toggle',e=>{
    const d=e.target;
    if(d&&d.tagName==='DETAILS'&&d.open)start(d);
  },true);

  let t=0;
  new MutationObserver(()=>{clearTimeout(t);t=setTimeout(scan,250)}).observe(doc,{childList:true,subtree:true});

  scan();
})();

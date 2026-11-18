/* ---- Translate / proofread the editor text with Google Gemini (Google AI Studio key) ---- */
(function(){
  const KEY='reader.geminiKey',MODEL='reader.geminiModel',AUTO='reader.trAuto',HIST='reader.trHist';
  const P_L='reader.trPromptLocalize',P_P='reader.trPromptProofread';
  const CHUNK=6000,MAXTOK=8192;
  const DEF_MODEL='gemini-3.5-flash';
  const MODELS=['gemini-3.8-flash','gemini-3.5-flash','gemini-2.5-flash','gemini-2.5-pro','gemini-2.0-flash'];

  /* The rules that ship with the reader. They are editable and stored locally; paste your full
     protocol over them and it is used verbatim from then on. */
  const DEF_L=`You are a professional English literary editor and localization engine for serialized Chinese webnovels (xianxia, isekai, transmigration, fanfiction).

Follow every rule exactly.

1. Output ONLY the finished chapter as raw Markdown. No preamble, no explanation, no code fences.
2. Preserve every sentence. Keep a 1:1 sentence mapping and maintain the original paragraph order. Never summarize, merge, compress, or skip anything.
3. Write publication-grade American English and remove every trace of translate-ese.
4. Keep the source's narrative voice, emotional intensity, profanity, combat brutality and mature tone. Do not sanitize or soften.
5. Internal thoughts: remove the brackets and set the content in *italics*.
6. Telepathy and system notifications: wrap in parentheses and italicize the whole line, *(like this)*.
7. Preserve kaomoji exactly as written; protect kaomoji containing * or _ with inline code.
8. Sound effects in ALL CAPS: BOOM, CRASH, WHOOSH, RUMBLE.
9. A scene break is a line containing only --- with a blank line before and after.
10. Convert traveling distances from meters to kilometers (1500 meters becomes 1.5 kilometers). Physical dimensions keep their original units.
11. Use straight double quotes for dialogue. Smooth stutters for text-to-speech ("P-p-please" becomes "Ple-please").
12. Keep every Markdown link, image, list, blockquote and HTML block exactly as given, including <details> and <summary>. Never invent, translate, or rewrite a URL.
13. Do not add commentary, references, notes, or sections the source does not contain.`;

  const DEF_P=`You are an expert English line editor.

1. Output ONLY the corrected text as raw Markdown. No preamble, no explanation, no code fences.
2. Fix grammar, spelling, punctuation, tense agreement and awkward phrasing.
3. Keep the author's meaning, voice and every sentence. Do not rewrite, shorten, expand, or restructure. Do not add or remove content.
4. Preserve all Markdown exactly: links, images, bold, italics, inline code, lists, blockquotes and HTML blocks (<details>, <summary>). Never change, shorten or invent a URL.
5. Keep the established formatting: ALL CAPS sound effects, *italics* for internal thoughts, *(italicized parentheses)* for telepathy and system messages.
6. Return the same text improved, not a different text.`;

  const load=(k,d)=>{try{const v=localStorage.getItem(k);return v==null?d:v}catch(e){return d}};
  const save=(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}};
  const src=document.getElementById('src');
  const anchor=document.getElementById('iAdd');
  if(!src||!anchor)return;

  /* ---------- panel ---------- */
  const gate=document.createElement('div');
  gate.id='trGate';gate.hidden=true;
  gate.setAttribute('role','dialog');gate.setAttribute('aria-modal','true');gate.setAttribute('aria-labelledby','trTitle');
  gate.innerHTML=`
<div class="netCard trCard">
  <h2 id="trTitle">Translate with Gemini</h2>
  <p class="trNote">Translate the editor text into English, or proofread English that already has errors. The result replaces the editor text, so the reader renders its links, picture carousels and video cards as usual.</p>
  <p class="trNote"><b>Already signed in to Google AI Studio?</b> Press <b>Open AI Studio</b>: the rules and your text are copied and AI Studio opens in a new tab. Paste, copy the answer back into the editor. No API key needed. The key below is only for translating inside this page.</p>
  <label class="trFld"><span>Google AI Studio API key <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener">get a key ↗</a></span>
    <input id="trKey" type="password" autocomplete="off" spellcheck="false" placeholder="AIza…"></label>
  <div class="trFld"><span>Mode</span><div class="seg" id="trMode">
    <button type="button" data-m="localize" aria-pressed="true">Chinese → English</button>
    <button type="button" data-m="proofread" aria-pressed="false">Fix my English</button></div></div>
  <label class="trFld"><span>Model</span><input id="trModel" list="trModels" spellcheck="false" autocomplete="off"><datalist id="trModels"></datalist></label>
  <details class="trRules"><summary>Rules sent to the model <span class="trHint" id="trRulesInfo"></span></summary>
    <textarea id="trSys" spellcheck="false" aria-label="Rules sent to the model"></textarea>
    <div class="row"><span class="trHint">Editable. Paste your full protocol here, or load a .md or .txt file, and it is used word for word.</span><span class="row" style="gap:6px"><button type="button" id="trLoad">Load rules file…</button><button type="button" id="trReset">Reset rules</button></span></div>
    <input type="file" id="trFile" accept=".md,.markdown,.txt,text/plain,text/markdown" hidden>
  </details>
  <label class="trAuto"><input type="checkbox" id="trAuto"> Translate automatically when I paste into the editor</label>
  <div class="trHist"><div class="row"><span>History</span><button type="button" id="trHistClr">Clear history</button></div><div id="trHistList"></div></div>
  <p id="trStatus" role="status"></p>
  <div class="trBtns"><button type="button" id="trStudio">Open AI Studio</button><button type="button" id="trCancel">Close</button><button type="button" id="trRun" class="pri">Translate</button></div>
</div>`;
  document.body.appendChild(gate);

  const $id=id=>document.getElementById(id);
  const keyEl=$id('trKey'),modelEl=$id('trModel'),sysEl=$id('trSys'),statusEl=$id('trStatus'),runEl=$id('trRun');
  const modeBtns=[...gate.querySelectorAll('#trMode button')];
  let mode=load('reader.trMode','localize'),busy=false,lastFocus=null;

  const dl=$id('trModels');MODELS.forEach(m=>{const o=document.createElement('option');o.value=m;dl.appendChild(o)});
  keyEl.value=load(KEY,'');
  modelEl.value=load(MODEL,DEF_MODEL)||DEF_MODEL;
  $id('trAuto').checked=load(AUTO,'0')==='1';
  const defaultPrompt=m=>m==='proofread'?DEF_P:DEF_L;
  /* Shows how much of the protocol is in force and whether it is the built-in summary. */
  function rulesInfo(){
    const t=sysEl.value.length,d=defaultPrompt(mode);
    $id('trRulesInfo').textContent='· '+(sysEl.value===d?'built-in summary':'your own')+', '+t.toLocaleString()+' characters';
  }
  function setMode(m,silent){
    mode=m;save('reader.trMode',m);
    modeBtns.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.m===m)));
    sysEl.value=load(m==='proofread'?P_P:P_L,defaultPrompt(m))||defaultPrompt(m);
    runEl.textContent=m==='proofread'?'Fix my English':'Translate';
    rulesInfo();
    if(!silent)statusEl.textContent='';
  }
  modeBtns.forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.m)));
  $id('trReset').onclick=()=>{try{localStorage.removeItem(mode==='proofread'?P_P:P_L)}catch(e){}sysEl.value=defaultPrompt(mode);rulesInfo();toast('Rules reset to default');log('Translate rules reset')};
  sysEl.addEventListener('input',()=>{save(mode==='proofread'?P_P:P_L,sysEl.value);rulesInfo()});

  /* Load a real protocol file (TRAINING_DATA.md) as the rules for this mode. */
  const fileEl=$id('trFile');
  $id('trLoad').onclick=()=>fileEl.click();
  fileEl.addEventListener('change',async()=>{
    const f=fileEl.files&&fileEl.files[0];
    if(!f)return;
    try{
      const raw=await f.text();
      if(!raw.trim()){toast('That file is empty');fileEl.value='';return}
      sysEl.value=raw.replace(/\r/g,'');
      save(mode==='proofread'?P_P:P_L,sysEl.value);
      rulesInfo();
      toast('Loaded '+f.name+' as the rules ('+sysEl.value.length.toLocaleString()+' characters)');
      log('Translate rules loaded',{file:f.name,chars:sysEl.value.length});
    }catch(e){
      toast('Could not read that file');
      warn('Rules file read failed',String(e&&e.message||e));
    }
    fileEl.value='';
  });
  keyEl.addEventListener('change',()=>save(KEY,keyEl.value.trim()));
  modelEl.addEventListener('change',()=>save(MODEL,modelEl.value.trim()));
  $id('trAuto').addEventListener('change',e=>save(AUTO,e.target.checked?'1':'0'));

  /* ---------- history ---------- */
  function histList(){try{return JSON.parse(load(HIST,'[]'))||[]}catch(e){return []}}
  function drawHist(){
    const box=$id('trHistList'),list=histList();
    box.textContent='';
    if(!list.length){const s=document.createElement('span');s.className='trHint';s.textContent='Nothing translated yet.';box.appendChild(s);return}
    list.slice(0,8).forEach(h=>{
      const d=document.createElement('div');d.className='trHistRow';
      const when=new Date(h.d).toLocaleString();
      d.textContent=`${h.mode==='proofread'?'Fix English':'Translate'} · ${h.chars.toLocaleString()} characters · ${when}`;
      box.appendChild(d);
    });
  }
  function addHist(entry){const list=[entry,...histList()].slice(0,8);try{localStorage.setItem(HIST,JSON.stringify(list))}catch(e){}drawHist()}
  $id('trHistClr').onclick=()=>{try{localStorage.removeItem(HIST)}catch(e){}drawHist();toast('Translation history cleared')};

  /* ---------- chunking ---------- */
  function chunks(text){
    const out=[];let buf='';
    text.replace(/\r/g,'').split(/\n\s*\n/).forEach(p=>{
      if(p.length>CHUNK){if(buf){out.push(buf);buf=''}for(let i=0;i<p.length;i+=CHUNK)out.push(p.slice(i,i+CHUNK));return}
      if(buf&&buf.length+p.length+2>CHUNK){out.push(buf);buf=''}
      buf=buf?buf+'\n\n'+p:p;
    });
    if(buf.trim())out.push(buf);
    return out.filter(s=>s.trim());
  }

  /* ---------- Gemini call ---------- */
  async function call(apiKey,model,sys,part,note){
    const url='https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent';
    const r=await fetch(url,{
      method:'POST',
      headers:{'Content-Type':'application/json','x-goog-api-key':apiKey},
      body:JSON.stringify({
        systemInstruction:{parts:[{text:sys}]},
        contents:[{role:'user',parts:[{text:(note?note+'\n\n':'')+part}]}],
        generationConfig:{temperature:0.35,maxOutputTokens:MAXTOK}
      })
    });
    const j=await r.json().catch(()=>({}));
    if(!r.ok){
      const e=new Error((j.error&&j.error.message)||('HTTP '+r.status));
      e.status=r.status;e.reason=(j.error&&j.error.details&&j.error.details[0]&&j.error.details[0].reason)||'';
      throw e;
    }
    const c=(j.candidates&&j.candidates[0])||{};
    const text=((c.content&&c.content.parts)||[]).map(p=>p.text||'').join('').trim();
    if(!text){
      const why=c.finishReason==='SAFETY'?'The model refused this chunk (safety filter).':'The model returned nothing.';
      const e=new Error(why);e.reason=c.finishReason;throw e;
    }
    return {text,truncated:c.finishReason==='MAX_TOKENS'};
  }

  /* A chunk that hits the token ceiling is split in half and retried, so no text is lost.
     The halves are cut on a paragraph break and rejoined with exactly one, so the paragraph
     separator is never duplicated (and never invented when the cut falls mid-paragraph). */
  async function runPart(apiKey,model,sys,part,note,depth){
    const r=await call(apiKey,model,sys,part,note);
    if(!r.truncated)return r.text;
    if(depth>2||part.length<1200)return r.text;
    const mid=Math.floor(part.length/2);
    const sep=part.lastIndexOf('\n\n',mid);
    const cut=sep>0?sep:mid;
    const a=await runPart(apiKey,model,sys,part.slice(0,cut),note,depth+1);
    const b=await runPart(apiKey,model,sys,part.slice(sep>0?cut+2:cut),note,depth+1);
    return a+(sep>0?'\n\n':'')+b;
  }

  function explain(e){
    const s=e.status||0;
    if(s===400&&/API key not valid/i.test(e.message))return 'That API key is not valid. Copy it again from Google AI Studio.';
    if(s===403)return 'Google refused the request (403): '+e.message+'. Check that the Gemini API is enabled for this key.';
    if(s===404)return 'Model "'+modelEl.value.trim()+'" is not available for your key. Pick another model from the list.';
    if(s===429)return 'Rate limit or quota reached (429). Wait a moment or check your Google AI Studio quota.';
    return e.message||'Request failed.';
  }

  function open(){
    lastFocus=document.activeElement;
    setMode(mode,true);drawHist();
    gate.hidden=false;
    statusEl.textContent='';
    (keyEl.value?runEl:keyEl).focus({preventScroll:true});
  }
  function close(){
    if(busy)return;
    gate.hidden=true;
    if(lastFocus&&lastFocus.focus)lastFocus.focus({preventScroll:true});
  }
  $id('trCancel').onclick=close;
  gate.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();close()}});

  function finish(out){
    const before=src.value;
    src.value=out;save('text',out);
    try{
      if(typeof hist!=='undefined'&&typeof saveHist==='function'){
        hist=[{t:out,d:Date.now()},...hist.filter(x=>x.t!==out&&x.t!==before)].slice(0,8);
        saveHist();if(typeof drawHist==='function')drawHist();
      }
    }catch(e){}
    document.body.classList.remove('edit');
    const ed=$id('edit');if(ed)ed.textContent='Edit text';
    try{render(out)}catch(e){warn('Render after translation failed',String(e&&e.message||e))}
  }

  async function run(){
    if(busy)return;
    const apiKey=keyEl.value.trim();
    const model=modelEl.value.trim()||DEF_MODEL;
    const sys=sysEl.value.trim();
    const text=src.value;
    if(!apiKey){statusEl.textContent='Add your Google AI Studio API key first.';keyEl.focus();return}
    if(!text.trim()){statusEl.textContent='The editor is empty. Paste a chapter first.';return}
    if(!sys){statusEl.textContent='The rules box is empty. Press "Reset rules".';return}
    save(KEY,apiKey);save(MODEL,model);
    const allowed=await (typeof netAsk==='function'
      ? netAsk('generativelanguage.googleapis.com',(mode==='proofread'?'Send this text to Google Gemini to fix its English.':'Send this text to Google Gemini for translation into English.'),'https://generativelanguage.googleapis.com')
      : Promise.resolve(true));
    if(!allowed){statusEl.textContent='Network access to Google Gemini is blocked. Allow it in Preferences.';return}

    const parts=chunks(text);
    busy=true;runEl.disabled=true;runEl.textContent=mode==='proofread'?'Fixing…':'Translating…';
    const started=Date.now();
    log('Translate start',{mode,model,chars:text.length,parts:parts.length});
    try{
      const out=[];
      for(let i=0;i<parts.length;i++){
        statusEl.textContent=`${mode==='proofread'?'Proofreading':'Translating'} part ${i+1} of ${parts.length}…`;
        const note=parts.length>1
          ? `This is part ${i+1} of ${parts.length} of one chapter. Process only this part, keep the running style consistent, and do not add headings, numbering or commentary.`
          : '';
        out.push(await runPart(apiKey,model,sys,parts[i],note,0));
      }
      const joined=out.join('\n\n');
      finish(joined);
      addHist({d:Date.now(),mode,chars:text.length});
      gate.hidden=true;
      toast((mode==='proofread'?'Proofread':'Translated')+' '+text.length.toLocaleString()+' characters');
      log('Translate done',{ms:Date.now()-started,out:joined.length});
    }catch(e){
      statusEl.textContent=explain(e);
      warn('Translate failed',String(e&&e.message||e));
    }finally{
      busy=false;runEl.disabled=false;runEl.textContent=mode==='proofread'?'Fix my English':'Translate';
    }
  }
  runEl.onclick=run;

  /* The signed-in route: copy rules + text, open AI Studio for pasting there. */
  $id('trStudio').onclick=()=>{
    const prompt=[sysEl.value.trim(),'---','Source text to process:','',src.value].join('\n');
    const tell=ok=>{statusEl.textContent=ok
      ?'Copied. Paste it into AI Studio, then copy the answer back into this editor.'
      :'Copy was blocked. Select the rules and text and copy them manually.'};
    const fallback=()=>{
      const ta=document.createElement('textarea');ta.value=prompt;
      ta.style.cssText='position:fixed;top:0;left:0;opacity:0';
      document.body.appendChild(ta);ta.select();
      let ok=false;try{ok=document.execCommand('copy')}catch(e){}
      ta.remove();tell(ok);
    };
    try{
      if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(prompt).then(()=>tell(true),fallback);
      else fallback();
    }catch(e){fallback()}
    window.open('https://aistudio.google.com/prompts/new_chat','_blank','noopener');
    log('AI Studio opened with the prompt copied');
  };

  /* ---------- entry point ---------- */
  const btn=document.createElement('button');
  btn.type='button';btn.id='trBtn';btn.textContent='Translate…';
  btn.title='Translate the text to English, or fix its English, with Google Gemini';
  btn.onclick=open;
  anchor.after(btn);

  /* Auto-run when text is pasted and the option is on. */
  let pasteT=0;
  src.addEventListener('paste',()=>{
    if(busy||load(AUTO,'0')!=='1'||!keyEl.value.trim())return;
    clearTimeout(pasteT);
    pasteT=setTimeout(()=>{if(!busy&&src.value.trim()&&gate.hidden)run()},120);
  });

  setMode(mode,true);
  window.openTranslate=open;
})();

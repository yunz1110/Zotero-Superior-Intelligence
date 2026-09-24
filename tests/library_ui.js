const assert = require('node:assert/strict');
const fs = require('node:fs');
const {chromium} = require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try {
  const page=await browser.newPage({viewport:{width:1060,height:850},deviceScaleFactor:1.5});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.setContent(fs.readFileSync('docs/ui-preview/library.html','utf8'));
  await page.addScriptTag({content:fs.readFileSync('plugin_src/chrome/content/scripts/markdown_renderer.js','utf8')});
  await page.addScriptTag({content:fs.readFileSync('plugin_src/chrome/content/scripts/library_index.js','utf8')});
  await page.evaluate(()=>{
   window.calls=[];window.stops=[];
   window.Zotero={getMainWindow:()=>window,MinerUAI:{describeError:e=>e.message,renderMarkdown:(node,text)=>MarkdownRenderer.render(node,text),openPreferences(){},stopLibraryTask(id){window.stops.push(id);window.release?.();},
    async libraryCall(action,json,onEvent){
     const payload=JSON.parse(json);calls.push({action,payload});let result;
     if(action==='options')result={defaultLibrary:1,activeProfile:1,libraries:[{id:1,name:'我的图书馆',collections:[{id:10,name:'生态系统',parentID:null},{id:11,name:'碳循环',parentID:10}]}],profiles:[{slot:1,name:'科研助手',model:'test-model'}],selected:[{id:1,libraryID:1,title:'Carbon cycling and climate'}]};
     else if(action==='source')result={located:true};
     else if(action==='save')result={noteID:10};
     else if(action==='index')result={items:128,papers:128,abstracts:112,annotated:46,evidenceItems:115,sources:530};
     else {
      onEvent(JSON.stringify({kind:'progress',text:'正在检索资料…'}));
      onEvent(JSON.stringify({kind:'scope',stats:{items:128,papers:128,abstracts:112,annotated:46,evidenceItems:115,sources:530}}));
      if(payload.question==='停止测试') {await new Promise(resolve=>window.release=resolve);return JSON.stringify({ok:false,error:'任务已停止。'});}
      onEvent(JSON.stringify({kind:'answer',text:'正在生成科研回答'}));
      result={id:payload.id,action,question:payload.question,markdown:'## 主要发现\n温度变化可能影响碳释放。[S1]\n\n| 主题 | 证据 |\n| --- | --- |\n| 碳循环 | 高亮原文 [S1] |',sources:[{ref:'S1',kind:'annotation',title:'Carbon cycling and climate',text:'Temperature increases carbon release.',page:'7',category:'结论'}],referencedItems:1,usage:{total:1500,unreported:0},durationMs:1200,cachedBatches:0};
     }
     return JSON.stringify({ok:true,result});
    }
   }};
  });
  await page.addScriptTag({content:fs.readFileSync('plugin_src/chrome/content/scripts/library_ui.js','utf8')});
  await page.evaluate(()=>window.dispatchEvent(new Event('load')));
  await page.locator('#library-library').selectOption('1');
  await page.locator('#library-mode').selectOption('collection');
  assert.equal(await page.locator('#library-collection-box').isVisible(),true);
  await page.locator('#library-collection').selectOption('11');
  await page.locator('#library-question').fill('碳循环机制有哪些不同解释？');
  assert.equal(await page.locator('#library-thinking').getAttribute('aria-pressed'),'false');
  await page.locator('#library-thinking').click();
  assert.equal(await page.locator('#library-thinking').getAttribute('aria-pressed'),'true');
  await page.locator('#library-limit').selectOption('16384');
  await page.locator('#library-ask').click();
  await page.waitForFunction(()=>document.querySelector('#library-status').textContent.includes('已完成'));
  assert.equal(await page.locator('.citation').count(),2);
  await page.locator('.citation').first().click();
  await page.getByText('保存为笔记',{exact:true}).click();
  await page.getByText('已保存到图书馆',{exact:true}).waitFor();
  await page.locator('article summary').click();
  await page.locator('.source').waitFor(); assert.equal(await page.locator('.source').count(),1);
  const last=await page.evaluate(()=>calls.find(c=>c.action==='ask').payload);
  assert.equal(last.options.collectionID,11);assert.equal(last.options.aiNotes,false);
  assert.equal(last.thinking,true);assert.equal(last.maxTokens,16384);
  assert.equal(await page.evaluate(()=>SILibraryIndex.plain('<p>hello &amp; world</p><script>bad</script><p>second</p>')),'hello & world\nsecond');
  const xmlRegression=await page.evaluate(()=>{
    const xml=new DOMParser().parseFromString('<window xmlns="http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul"/>','application/xml');
    const note='<p>A&nbsp;B<br>note<img src="https://example.invalid/must-not-load.png"></p><p>final<script>bad</script></p>';
    const old=xml.createElementNS('http://www.w3.org/1999/xhtml','template');
    let oldCode;
    try{old.innerHTML=note;}catch(error){oldCode=error.code;}
    const original=Zotero.getMainWindow;
    try{
      Zotero.getMainWindow=()=>({document:xml});
      return {oldCode,text:SILibraryIndex.plain(note)};
    }finally{Zotero.getMainWindow=original;}
  });
  assert.equal(xmlRegression.oldCode,12,'the former parser must reproduce XML SyntaxError');
  assert.equal(xmlRegression.text,'A\u00a0B\nnote\nfinal');
  await page.screenshot({path:'docs/ui-preview/library-chat.png',fullPage:true});
  await page.setViewportSize({width:690,height:850});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.locator('#library-question').fill('停止测试');
  await page.locator('#library-ask').click();
  await page.locator('#library-stop').click();
  await page.waitForFunction(()=>document.querySelector('#library-status').textContent.includes('任务已停止'));
  assert.equal(await page.locator('#library-ask').isEnabled(),true);
  await page.locator('#library-clear').click();assert.equal(await page.locator('article').count(),0);
  assert.deepEqual(errors,[]);
  console.log('library browser UI tests passed: scope controls, rendering, citations, save, extraction, responsive layout and stop');
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});


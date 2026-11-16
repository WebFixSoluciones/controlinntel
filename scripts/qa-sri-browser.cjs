const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const base=process.env.QA_BASE_URL||'http://127.0.0.1:3042';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Only localhost is allowed');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'inntel-sri-ui-'));
async function main(){
const browser=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless','--no-first-run','--remote-debugging-port=0','--user-data-dir='+dir,base+'/facturacion'],{windowsHide:true,stdio:'ignore'});
let ws,authorization;const runtimeErrors=[];
try{
  const portfile=path.join(dir,'DevToolsActivePort');

  for(let i=0;!fs.existsSync(portfile)&&i<100;i++)await new Promise(r=>setTimeout(r,100));

  const port=fs.readFileSync(portfile,'utf8').split('\n')[0].trim();

  const tabs=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();

  ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);

  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject});

  let sequence=0;const pending=new Map();

  ws.onmessage=e=>{const value=JSON.parse(e.data);if(value.method==='Runtime.exceptionThrown')runtimeErrors.push(value.params.exceptionDetails?.exception?.description||value.params.exceptionDetails?.text||'runtime error');if(value.method==='Runtime.consoleAPICalled'&&value.params.type==='error')runtimeErrors.push(value.params.args.map(a=>a.description||a.value||'').join(' '));if(value.method==='Network.requestWillBeSent'&&value.params.request.url.startsWith(base+'/api/')){const headers=value.params.request.headers;const key=Object.keys(headers).find(key=>key.toLowerCase()==='authorization');if(key)authorization=headers[key];}if(pending.has(value.id)){pending.get(value.id)(value);pending.delete(value.id)}};

  function cdp(method,params={}){return new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,v=>v.error?reject(new Error(JSON.stringify(v.error))):resolve(v.result));ws.send(JSON.stringify({id,method,params}))})}

  async function evaluate(expression){const output=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(output.exceptionDetails)throw Error(output.exceptionDetails.text+' '+output.result?.description);return output.result.value}

  async function settle(){await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))')}

  async function click(label){await evaluate(`(()=>{const el=[...document.querySelectorAll("button")].find(b=>b.textContent.trim()===${JSON.stringify(label)}||b.getAttribute("aria-label")===${JSON.stringify(label)});if(!el)throw Error("Missing button "+${JSON.stringify(label)});el.click()})()`);await settle()}


  await cdp('Runtime.enable');await cdp('Network.enable');
  async function wait(expression){for(let i=0;i<300;i++){if(await evaluate(expression))return;if(await evaluate('document.body?.innerText.includes("Interrupción Inesperada")'))throw Error(runtimeErrors.join('\n'));await new Promise(resolve=>setTimeout(resolve,200))}throw Error('Timed out: '+expression+'; '+(await evaluate('document.body.innerText')).slice(-700))}
  async function set(selector,value){await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing '+${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}))})()`);await settle()}
  async function containing(text){await evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.includes(${JSON.stringify(text)}));if(!b)throw Error('Missing button');b.click()})()`);await settle()}
  async function screenshot(name){const shot=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(dir,name+'.png'),Buffer.from(shot.data,'base64'))}
  await wait('!!document.querySelector("#login-email")');await set('#login-email','qa.sri.owner@example.test');await set('#login-password','Synthetic-local-QA-Only#42');await click('Iniciar sesión');
  await wait(`!!document.querySelector('button[title="Ver / Imprimir RIDE PDF"]')`);
  await evaluate(`document.querySelector('button[title="Ver / Imprimir RIDE PDF"]').click()`);await settle();
  await wait('document.body.innerText.includes("RIDE ELECTRÓNICO")');await screenshot('ride-authorized-desktop');
  await cdp('Page.navigate',{url:base+'/clientes'});
  await wait(`!!document.querySelector('button[title="Ver Facturas y Notas de Venta del Cliente"]')`);
  await evaluate(`document.querySelector('button[title="Ver Facturas y Notas de Venta del Cliente"]').click()`);await settle();
  await wait(`!!document.querySelector('[role="dialog"][aria-label="Historial de ventas del cliente"] tbody tr')`);
  assert.ok(await evaluate(`document.querySelector('[role="dialog"][aria-label="Historial de ventas del cliente"]').innerText.includes("$2.00")`));
  assert.equal(await evaluate(`document.querySelectorAll('[role="dialog"][aria-label="Historial de ventas del cliente"] tbody tr').length`),1);
  for(const [width,height] of [[360,640],[768,900],[1440,900],[844,390]]) {
    await cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await settle();
    const bounds=await evaluate(`(()=>{const d=document.querySelector('[role="dialog"][aria-label="Historial de ventas del cliente"]');const r=d.getBoundingClientRect();const t=d.querySelector('table').parentElement;return {fits:r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1,scroll:getComputedStyle(t).overflowX,page:document.documentElement.scrollWidth<=innerWidth+1}})()`);
    assert.equal(bounds.fits,true,'Dialog fits '+width);assert.equal(bounds.page,true,'No page overflow '+width);assert.ok(['auto','scroll'].includes(bounds.scroll));
    assert.equal(await evaluate(`(()=>{const d=document.querySelector('[role="dialog"][aria-label="Historial de ventas del cliente"]');const footer=d.querySelector('footer').getBoundingClientRect();return footer.bottom<=d.getBoundingClientRect().bottom})()`),true,'Footer remains reachable');
    await screenshot('history-'+width);
  }
  await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await wait(`!document.querySelector('[role="dialog"][aria-label="Historial de ventas del cliente"]')`);
  assert.deepEqual(runtimeErrors,[]);
  console.log(JSON.stringify({passed:true,checks:['authenticated SRI list','authorized RIDE rendering','history without duplicated note/invoice/charge','history fits mobile/tablet/desktop/landscape with local table scrolling','footer reachable and Escape closes dialog'],artifacts:dir}));
}finally{ws?.close();browser.kill()}}
main().catch(error=>{console.error(error);process.exitCode=1});

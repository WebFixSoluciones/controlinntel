const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const base=process.env.QA_BASE_URL||'http://127.0.0.1:3041';
if(!['localhost','127.0.0.1'].includes(new URL(base).hostname))throw Error('Only localhost is allowed');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'inntel-sales-e2e-'));
async function main(){
const browser=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless','--no-first-run','--remote-debugging-port=0','--user-data-dir='+dir,base+'/ventas?sub=nueva_venta'],{windowsHide:true,stdio:'ignore'});
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
  await wait('!!document.querySelector("#login-email")');await set('#login-email','qa.sales.user@example.test');await set('#login-password','Synthetic-local-QA-Only#42');await click('Iniciar sesión');
  await wait('!!document.querySelector("#new-sale-view-field-1")');
  assert.equal(await evaluate('[...document.querySelectorAll("aside a,aside button")].some(b=>b.textContent.trim()==="Clientes")'),false);
  await set('input[placeholder="Buscar por nombre, RUC o cédula..."]','1790010938001');await containing('PRUEBA CLIENTE VENTA HTTP');assert.ok(await evaluate('[...document.querySelectorAll("a")].find(a=>a.textContent.includes("Historial de Facturaci"))?.href.includes("/ventas?sub=notas_venta&cliente=")'));
  await set('input[placeholder="Escribe nombre, SKU o escanea código de barras..."]','EQUIPO QA HTTP');await containing('EQUIPO QA HTTP');
  await set('tbody tr input[type=number]','2');
  await evaluate('[...document.querySelectorAll("button")].find(b=>b.title==="Configurar descuento de esta línea").click()');await settle();await set('#new-sale-view-field-9','10');await click('Aplicar');
  await set('select[aria-label="Tipo de descuento general"]','percentage');await set('input[aria-label="Valor de descuento general"]','10');
  assert.ok(await evaluate('document.body.innerText.includes("$243.00")'));
  await set('#administrative-period','2026-10');await set('#new-sale-view-field-1','2026-10-01');
  for(const width of [360,768,1440]) {
    await cdp('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});await settle();
    assert.ok(await evaluate('document.documentElement.scrollWidth<=document.documentElement.clientWidth'),'Responsive sale '+width);
    const collisions=await evaluate(`(()=>{const labels=['new-sale-view-field-1','new-sale-view-field-2','new-sale-view-field-3'].flatMap(id=>{const label=document.querySelector('label[for="'+id+'"]');const range=document.createRange();range.selectNodeContents(label);return [...range.getClientRects()].map(r=>({id,left:r.left,right:r.right,top:r.top,bottom:r.bottom}))});return labels.flatMap((a,i)=>labels.slice(i+1).filter(b=>a.id!==b.id&&Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1).map(b=>[a.id,b.id]))})()`);
    assert.deepEqual(collisions,[],'Document labels must not overlap at '+width);
    await screenshot('sale-layout-'+width);
  }
  await screenshot('sale-243-before-confirmation');await click('Crédito');await click('Confirmar Plazo');
  assert.ok(authorization,'The real app must issue authenticated API requests');
  const api=async()=>{const r=await fetch(base+'/api/data',{headers:{Authorization:authorization}});assert.equal(r.status,200);return r.json()};
  const before=await api(),known=new Set(before.billingInvoices.map(row=>row.id));
  await click('Registrar Nota de Venta');await click('Sí, Registrar Nota de Venta');
  await wait('document.body.innerText.includes("010-001-")&&!document.body.innerText.includes("Sí, Registrar Nota de Venta")');
  let after,created;for(let i=0;i<100;i++){after=await api();created=after.billingInvoices.find(row=>!known.has(row.id));if(created)break;await new Promise(resolve=>setTimeout(resolve,150))}
  assert.ok(created);assert.equal(created.total,243);assert.equal(created.administrativePeriod,'2026-10');assert.equal(created.clientName,'PRUEBA CLIENTE VENTA HTTP');assert.equal(created.items[0].quantity,2);assert.equal(created.date,'2026-10-01');assert.equal(created.paymentsBreakdown.credito,243);
  await screenshot('sale-243-registered');
  await cdp('Page.navigate',{url:base+'/ventas?sub=nueva_venta'});await wait('!!document.querySelector("#new-sale-view-field-1")');
  await evaluate('[...document.querySelectorAll("button")].find(b=>b.title==="Crear cliente").click()');await settle();
  const ruc='179'+String(Date.now()).slice(-7)+'001';
  await set('input[placeholder="Ej. 1790016919001"]',ruc);await set('#new-sale-view-field-13','CLIENTE UI QA VENTAS');await set('#new-sale-view-field-14','new-client@example.test');await set('#new-sale-view-field-15','0990000000');await set('#new-sale-view-field-16','DIRECCIÓN QA');await click('Guardar y Seleccionar');
  await wait('!document.querySelector("#new-sale-view-field-13")');
  const createdClient=(await api()).clients.find(row=>row.identificationNumber===ruc);assert.ok(createdClient);assert.equal(createdClient.businessName,'CLIENTE UI QA VENTAS');assert.ok(await evaluate('document.body.innerText.includes("CLIENTE UI QA VENTAS")'));
  assert.deepEqual(runtimeErrors,[]);
  console.log(JSON.stringify({passed:true,environment:'real Next UI + Firebase Auth/Firestore emulators',checks:['login of linked sales role','quick customer creation with corporate RUC from Sales UI','customer and catalog lookup without extra modules','quantity 2, line 10%, global 10%, exact 243','October administrative assignment','persisted invoice matches confirmation','responsive 360/768/1440'],artifacts:dir}));
}finally{ws?.close();browser.kill()}}
main().catch(error=>{console.error(error);process.exitCode=1});

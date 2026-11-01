const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
let serial=0;const timers=new Map(),events={},scripts=[],frames=[],sent=[];
function parent(list){return{appendChild(x){x.parentNode=this;list.push(x);},removeChild(x){list.splice(list.indexOf(x),1);x.parentNode=null;}};}
const head=parent(scripts),body=parent(frames);
const window={setTimeout(f){timers.set(++serial,f);return serial;},clearTimeout(id){timers.delete(id);},setInterval(f){window.poll=f;return 1;},clearInterval(){},addEventListener(n,f){events[n]=f;},removeEventListener(n){delete events[n];}};
const document={head,body,createElement(kind){return{style:{},contentWindow:{postMessage(data,origin){sent.push({data,origin});}}};}};
vm.runInNewContext(fs.readFileSync('usb/lib/gui-runtime/services.js','utf8'),{window,document,Date});
const api=window.MzdGuiServices;let error,result,connections=0;api.onReady(()=>connections++);
api.request('one','get',{},e=>error=e);assert.match(error,/starting/);
assert(scripts[0].src.startsWith('/tmp/mzd-gui-service/connection.js'));
window.mzdGuiServiceConnection={origin:'http://127.0.0.1:43210',token:'a'.repeat(48)};scripts[0].onload();assert.equal(frames.length,1);
function deliver(data,source=frames[0].contentWindow,origin='http://127.0.0.1:43210'){events.message({source,origin,data});}
deliver({type:'mzd-service-ready',token:'wrong'});api.request('one','get',{},e=>error=e);assert.match(error,/starting/);
deliver({type:'mzd-service-ready',token:'a'.repeat(48)});assert.equal(connections,1);
api.request('one','get',{value:1},(e,r)=>{error=e;result=r;});assert.equal(sent[0].origin,'http://127.0.0.1:43210');assert.equal(sent[0].data.module,'one');
const id=sent[0].data.id;deliver({type:'mzd-service-result',token:'a'.repeat(48),id,result:{ok:true}},{});assert.equal(result,undefined);
deliver({type:'mzd-service-result',token:'a'.repeat(48),id,result:{ok:true}});assert(result.ok);assert.equal(timers.size,0);
api.request('one','get',{},e=>error=e);window.mzdGuiServiceConnection={origin:'http://127.0.0.1:43211',token:'b'.repeat(48)};window.poll();scripts[0].onload();assert.match(error,/restarted/);assert.equal(frames.length,1);
deliver({type:'mzd-service-ready',token:'b'.repeat(48)},frames[0].contentWindow,'http://127.0.0.1:43211');assert.equal(connections,2);api.request('one','get',{},e=>error=e);[...timers.values()][0]();assert.match(error,/timed out/);
api.dispose();api.dispose();assert.equal(frames.length,0);assert.equal(scripts.length,0);assert.equal(timers.size,0);

const posted=[],handlers={};let xhr;
function XHR(){xhr=this;this.headers={};this.open=(method,path)=>{this.method=method;this.path=path;};this.setRequestHeader=(k,v)=>this.headers[k]=v;this.send=body=>this.body=body;}
const parentWindow={postMessage:data=>posted.push(data)},bridge={location:{hash:'#'+'c'.repeat(48)},parent:parentWindow,addEventListener:(n,f)=>handlers[n]=f};
vm.runInNewContext(fs.readFileSync('usb/lib/gui-runtime/service/bridge.js','utf8'),{window:bridge,XMLHttpRequest:XHR});assert.equal(posted[0].type,'mzd-service-ready');
const request={type:'mzd-service-request',token:'c'.repeat(48),id:1,module:'one',operation:'get',args:{value:'literal'}};
handlers.message({source:{},data:request});assert.equal(xhr,undefined);
handlers.message({source:parentWindow,data:request});assert.equal(xhr.method,'POST');assert.equal(xhr.path,'/rpc');assert.equal(xhr.headers['X-Mzd-Gui-Token'],'c'.repeat(48));assert.equal(JSON.parse(xhr.body).args.value,'literal');
xhr.status=200;xhr.responseText=JSON.stringify({result:{ok:true}});xhr.onload();xhr.onerror();assert.equal(posted.length,2);assert(posted[1].result.ok);assert.equal(posted[1].id,1);
console.log('GUI_SERVICES_BRIDGE_PASSED: file-origin bridge, source/origin/token checks, RPC scoping, reconnect invalidation, timeout and cleanup.');

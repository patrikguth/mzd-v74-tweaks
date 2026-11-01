const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
function fixturePath(...parts){const relative=path.join(...parts);return path.join(relative.split(path.sep)[0]==='assets'?path.resolve(__dirname,'../../../usb/tweaks/wallpaper-manager'):path.resolve(__dirname,'../../../development/wallpaper-manager'),relative);}
const root=path.resolve(__dirname,'../../../usb/tweaks/wallpaper-manager'),window={};
vm.runInNewContext(fs.readFileSync(fixturePath('cmu/import-client.js'),'utf8'),{window});
function fixture(mode){
 const calls=[],timers=new Map();let picture,callback,result,count=0;
 const service={request(op,args,cb){calls.push({op,args});if(op==='prepare')cb(null,{ticket:'ticket',url:'staged-image'});else if(op==='commit')cb(mode==='commit-fail'?'Storage full.':null,{images:[]});else cb(null,{});}};
 const client=window.WallpaperCmuImportClient.create(service,{makeImage(){picture={naturalWidth:mode==='wrong-size'?799:800,naturalHeight:480};return picture;},delay(fn){timers.set(1,fn);return 1;},cancel(id){timers.delete(id);}});
 client.importImage({source:'sda1',name:'car.png'},(err,data)=>{count++;result={err,data};});
 return {client,calls,timers,get picture(){return picture;},get result(){return result;},get count(){return count;}};
}
let f=fixture('ok');assert.deepEqual(f.calls.map(c=>c.op),['prepare']);f.picture.onload();assert.deepEqual(f.calls.map(c=>c.op),['prepare','commit']);assert.equal(f.result.err,null);assert.equal(f.count,1);assert.equal(f.timers.size,0);
f=fixture('wrong-size');f.picture.onload();assert.deepEqual(f.calls.map(c=>c.op),['prepare','abort']);assert.match(f.result.err,/800 x 480/);
f=fixture('error');f.picture.onerror();assert.deepEqual(f.calls.map(c=>c.op),['prepare','abort']);assert.match(f.result.err,/decoded/);
f=fixture('timeout');f.timers.get(1)();assert.deepEqual(f.calls.map(c=>c.op),['prepare','abort']);assert.match(f.result.err,/timed out/);assert.equal(f.count,1);
f=fixture('commit-fail');f.picture.onload();assert.deepEqual(f.calls.map(c=>c.op),['prepare','commit','abort']);assert.equal(f.result.err,'Storage full.');
f=fixture('busy');let second;f.client.importImage({source:'sda1',name:'other.png'},err=>second=err);assert.match(second,/already/);assert.equal(f.calls.length,1);f.picture.onerror();
const Module=require('node:module'),key=Object.keys(process.binding('natives')).find(k=>k.endsWith('acorn/dist/acorn'));const parser=new Module('cmu-es5');parser._compile(process.binding('natives')[key],'cmu-es5.js');parser.exports.parse(fs.readFileSync(fixturePath('cmu/import-client.js'),'utf8'),{ecmaVersion:5});
console.log('WALLPAPER_CMU_CLIENT_PASSED: staged decode, wrong dimensions, decode error, timeout, commit failure, serialization and ES5.');

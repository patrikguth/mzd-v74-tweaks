const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../../../usb/tweaks/drivedash/assets/resident.js'), 'utf8');
let request, receive, close, dispose, pending, renders=0, inputs=0, closes=0;
let failRender=false;
const messages=[];
const sender={postMessage:value=>messages.push(value)};
const view={source:sender,token:'current'};
const frame={contentWindow:sender};
const menu={owns:(source,token)=>source===sender&&token==='current',close(){closes++;},
    render(){renders++;if(failRender)throw new Error('render failed');},input(){inputs++;}};
const calls=[];
const window={MzdGuiResidents:{createNativeMenu:()=>menu,register(id,factory){
    assert.equal(id,'drivedash');factory({view:()=>view,
        service:{request(operation,args,callback){calls.push(operation);pending=callback;}},
        onServiceRequest:fn=>{request=fn;},onMessage:fn=>{receive=fn;},
        onViewClose:fn=>{close=fn;},onDispose:fn=>{dispose=fn;}});
}}};
vm.runInNewContext(source,{window,document:{getElementsByTagName:()=>[frame]}});
let result;
request('sample',{},(error,value)=>{result={error,value};});
request('sample',{},error=>assert.equal(error,'Data reader is busy.'));
assert.equal(calls.length,1);
pending('reader failed');assert.equal(result.error,'reader failed');
request('sample',{},(error,value)=>{result={error,value};});
pending(null,{rpm:800});assert.equal(result.value.rpm,800,'A failed read releases the busy guard.');
request('preferences',{},()=>{});assert.equal(calls.at(-1),'preferences');
function message(type,source=sender,token='current') {receive({source,data:{type,token,menu:{},action:'select'}});}
message('drivedash-native-render',{},'current');
message('drivedash-native-render',sender,'expired');assert.equal(renders,0);
message('drivedash-native-render');message('drivedash-native-input');
assert.equal(renders,1);assert.equal(inputs,1);
failRender=true;message('drivedash-native-render');
assert.equal(closes,1);assert.equal(messages[0].type,'drivedash-native-error');assert.equal(messages[0].token,'current');
message('drivedash-native-release',sender,'expired');assert.equal(closes,1);
message('drivedash-native-release');close();dispose();assert.equal(closes,4);
console.log('DRIVEDASH_RESIDENT_PASSED: busy recovery, source/token filtering, render failure, release and disposal.');

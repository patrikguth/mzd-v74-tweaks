const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('usb/lib/gui-runtime/i18n.js','utf8');
function fixture(language='de_DE') {
 const intervals=new Map(),timers=new Map(),loads=[],events={};let serial=0,logs=0;
 const head={appendChild(script){script.parentNode=head;loads.push(script);},removeChild(script){script.parentNode=null;}};
 const doc={head,createElement:()=>({}),documentElement:head};
 const win={framework:{localize:{getCurrentLanguage:()=>language,getLangInGuiFormat:()=> 'de_DE'}},log:{info:()=>logs++},addEventListener:(n,f)=>events[n]=f,setInterval:f=>{intervals.set(++serial,f);return serial;},clearInterval:n=>intervals.delete(n),setTimeout:f=>{timers.set(++serial,f);return serial;},clearTimeout:n=>timers.delete(n)};
 const context={window:win,document:doc};vm.runInNewContext(source,context);const api=win.MzdGuiI18n;
 return {api,loads,win,intervals,timers,events,context,get logs(){return logs;},setLanguage(v){language=v;},complete(value){api.register('test',value);loads.at(-1).onload();}};
}
const entry={id:'test',translations:'/data/integration/mzd-gui-modules/test/assets/i18n.js'};
let f=fixture();f.api.start([{id:'plain'}]);assert.equal(f.loads.length,0);assert.equal(f.intervals.size,0,'no manifest declaration, no work');
f.api.start([entry]);assert.equal(f.loads.length,1);assert.equal(f.api.text('test','start','Start'),'Start');
const changes=[];const off=f.api.load('test',v=>changes.push(v));assert.equal(changes.length,0,'wait for dictionary before choosing texts');
f.complete({version:1,languages:{en_US:{start:'Start',missing:'English',result:'Score {score}'},de:{base:'Basis'},de_DE:{start:'Starten',result:'Punkte {score}'},ar_SA:{start:'ابدأ'}}});
assert.equal(f.api.text('test','start','Default'),'Starten');assert.equal(f.api.text('test','base','Default'),'Basis');assert.equal(f.api.text('test','missing','Default'),'English');assert.equal(f.api.text('test','result','Default',{score:123}),'Punkte 123');
assert.equal(f.api.text('test','unknown','Existing text'),'Existing text');f.setLanguage('zz_ZZ');assert.equal(changes[0].language,'de_DE','opened view keeps its startup selection');assert.equal(f.api.text('test','start','Default'),'Start');f.setLanguage('de_AT');assert.equal(f.api.text('test','start','Default'),'Starten');
f.setLanguage('ar_SA');assert.equal(f.api.snapshot('test').direction,'rtl');f.setLanguage('LANGS_DE_GERMAN');assert.equal(f.api.snapshot('test').language,'de_DE');
const count=changes.length;assert.equal(count,1,'one callback after dictionary load');off();f.setLanguage('en_US');assert.equal(changes.length,count);assert.equal(f.intervals.size,0,'no language polling');for(let i=0;i<100;i++)f.api.text('test','absent','Fallback');assert.equal(f.logs,0,'missing translations stay silent');
f.events.unload();assert.equal(f.intervals.size,0);
for(const text of ['not json','[]','{"version":2,"languages":{}}']){f=fixture();f.api.start([entry]);f.complete(text);assert.equal(f.api.text('test','start','Start'),'Start');assert.equal(f.logs,0);f.events.unload();}
f=fixture();f.api.start([entry]);for(const fn of [...f.timers.values()])fn();assert.equal(f.loads[0].parentNode,null);assert.equal(f.api.text('test','start','Start'),'Start');f.events.unload();
f=fixture();f.api.start([{id:'test',translations:'/data/integration/mzd-gui-modules/test/assets/../other.js'}]);assert.equal(f.loads.length,0);
f=fixture();f.api.start([entry]);let fallbackReady=0;
f.api.load('test',value=>{fallbackReady++;assert.equal(value.language,'de_DE');});
assert.equal(f.loads[0].charset,'utf-8');f.loads[0].onerror({preventDefault(){}});assert.equal(fallbackReady,1);assert.equal(f.logs,0);
f=fixture();f.api.start([entry]);let cancelled=0;const cancel=f.api.load('test',()=>cancelled++);cancel();f.complete({version:1,languages:{de_DE:{start:'Starten'}}});assert.equal(cancelled,0);
let catalog;vm.runInNewContext(fs.readFileSync('usb/tweaks/tetris/assets/i18n.js','utf8'),{window:{MzdGuiI18n:{register(id,value){assert.equal(id,'tetris');catalog=value;}}}});
const english=catalog.languages.en_US,keys=Object.keys(english).sort();
assert.equal(Object.keys(catalog.languages).length,41);
for(const [locale,texts] of Object.entries(catalog.languages)){
 assert.deepEqual(Object.keys(texts).sort(),keys,locale+' missing keys');
 for(const key of keys){assert.equal(typeof texts[key],'string');assert(texts[key].length>0);assert(!texts[key].includes('\uFFFD'),locale+' replacement character');assert.deepEqual((texts[key].match(/\{\w+\}/g)||[]).sort(),(english[key].match(/\{\w+\}/g)||[]).sort(),locale+' placeholders '+key);}
}
console.log('GUI_I18N_PASSED: opt-in only, native script registration, exact/base/English/default fallbacks, enum normalization, RTL metadata, startup language snapshot, cancellation, no polling, invalid dictionaries, timeout, traversal, silent misses and 41 complete Tetris locales.');

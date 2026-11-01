/* Real Wallpaper view/SDK/resident against the native-menu fixture in each locale. */
function fixturePath(...parts){const relative=path.join(...parts);return path.join(relative.split(path.sep)[0]==='assets'?path.resolve(__dirname,'../../../usb/tweaks/wallpaper-manager'):path.resolve(__dirname,'../../../development/wallpaper-manager'),relative);}
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../../usb/tweaks/wallpaper-manager');let data;
vm.runInNewContext(fs.readFileSync(fixturePath('assets/i18n.js'),'utf8'),{window:{MzdGuiI18n:{register(id,value){assert.equal(id,'wallpaper-manager');data=value;}}}});
const localeKeys=Object.keys(data.languages);assert.equal(localeKeys.length,41);
const english=data.languages.en_US,keys=Object.keys(english).sort();
for(const [locale,dict] of Object.entries(data.languages)){
 assert.deepEqual(Object.keys(dict).sort(),keys,locale+' missing keys');
 for(const key of keys){assert.equal(typeof dict[key],'string');assert(dict[key]);assert(!dict[key].includes('\uFFFD'));assert.deepEqual((dict[key].match(/\{\w+\}/g)||[]).sort(),(english[key].match(/\{\w+\}/g)||[]).sort(),locale+' placeholders '+key);}
}
const source=fs.readFileSync(path.join(__dirname,'cmu-host.cjs'),'utf8');
let prefix=source.slice(0,source.indexOf("\nflush();assert.equal(sb"));assert(prefix.length>4000);
prefix=prefix.replace("else if(op==='save')","else if(op==='usb')cb(null,{status:'missing',items:[]}); else if(op==='save')");
const body=`
document.documentElement={};
let dictionary;vm.runInNewContext(fs.readFileSync(fixturePath('assets/i18n.js'),'utf8'),{window:{MzdGuiI18n:{register(id,value){dictionary=value;}}}});
const texts=dictionary.languages[TEST_LOCALE];
for(const fn of viewEvents.message.slice())fn({source:parent,data:{type:'mzd-gui-language',token:'fixture-token',value:{language:TEST_LOCALE,direction:/^(ar|he)_/.test(TEST_LOCALE)?'rtl':'ltr',texts:texts}}});
flush();assert.equal(sb,texts['gui.label']);assert.equal(document.documentElement.lang,TEST_LOCALE.replace('_','-'));assert.equal(writes,0);
assert.equal(control.dataList.items[0].text1,texts.gallery);assert.equal(control.dataList.items[1].label1,texts.off);
click(0);assert.equal(sb,texts.gallery);assert.equal(control.dataList.items[0].text1,texts.original);assert.equal(control.dataList.items[1].text1,'User image','user filenames are unchanged');
click(2);assert.equal(control.dataList.items[0].text1,texts.folderHint);assert(!rootNode.children.some(e=>e.className.indexOf('wallpaperImportSplit')>=0),'missing-folder hints use full-width native list');input('back');
click(1);assert.equal(control.dataList.items[0].text1,texts.useBackground);assert.equal(control.dataList.items[1].text1,texts.include);
input('back');input('back');click(1);assert.equal(control.dataList.items[0].text1,texts.off);assert.equal(control.dataList.items[1].text1,texts.seconds.replace('{seconds}','5'));
click(1);assert.equal(sb,texts.chooseSlides);assert.equal(writes,0,'failed slideshow selection/language loading must not write');
input('back');click(0);click(1);click(1);assert.equal(writes,1);assert.equal(saved.slides[0],imageID);
input('back');input('back');click(1);click(1);assert.equal(saved.enabled,true);assert.equal(saved.interval,5);
resident.closed();assert.equal(host.WallpaperManager.snapshot().enabled,true,'resident slideshow survives view close');
view.MzdGuiModule._dispose();hostEvents.unload();flush();assert.equal(host.WallpaperManager,undefined);
`;
for(const locale of localeKeys)vm.runInNewContext(prefix+body,{require,__dirname,console,TEST_LOCALE:locale});
console.log('WALLPAPER_I18N_PASSED: 41 complete locales, actual view/SDK/native menus, labels/counters/intervals, filename preservation, translated empty-slideshow error, no startup writes and resident lifetime.');

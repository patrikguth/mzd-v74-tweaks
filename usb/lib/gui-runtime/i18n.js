/* Optional, silent translations for local-file GUI views and residents. */
(function (global) {
    'use strict';
    if (global.MzdGuiI18n) { return; }
    var records = {}, ended = false;
    function own(object, key) { return Object.prototype.hasOwnProperty.call(object,key); }
    function current() {
        try {
            var localize = global.framework && global.framework.localize, value = localize && localize.getCurrentLanguage();
            if (value && value.indexOf('LANGS_') === 0 && localize.getLangInGuiFormat) { value = localize.getLangInGuiFormat(value); }
            if (typeof value === 'string' && /^[a-z]{2,3}([_-][a-zA-Z]{2})?$/.test(value)) { return value.replace('-','_'); }
        } catch (ignore) {}
        return '';
    }
    function snapshot(id, selectedLanguage) {
        var language = selectedLanguage || current() || 'en_US';
        var record = records['$'+id], result = {}, languages = record && record.languages || {}, base = language.split('_')[0], order = ['en','en_US'], keys, i, key, dictionary;
        if (base) {
            keys = Object.keys(languages).sort();
            for (i = 0; i < keys.length; i += 1) { if (keys[i].split('_')[0] === base && keys[i] !== language && keys[i] !== base) { order.push(keys[i]); break; } }
            order.push(base); if (language !== base) { order.push(language); }
        }
        for (i = 0; i < order.length; i += 1) {
            dictionary = languages[order[i]];
            if (dictionary) { for (key in dictionary) { if (own(dictionary,key)) { result[key] = dictionary[key]; } } }
        }
        return {language:language || 'en_US',direction:base === 'ar' || base === 'he' ? 'rtl' : 'ltr',texts:result};
    }
    function notify(id) {
        var record = records['$'+id], list = record ? record.listeners.slice(0) : [], i;
        if (record) { record.listeners = []; }
        for (i = 0; i < list.length; i += 1) { try { list[i](); } catch (ignore) {} }
    }
    function validate(value) {
        var result = {}, locales, keys, i, j, code, dictionary, key;
        if (!value || value.version !== 1 || !value.languages || typeof value.languages !== 'object' || Array.isArray(value.languages)) { return result; }
        locales = Object.keys(value.languages); if (locales.length > 128) { return result; }
        for (i = 0; i < locales.length; i += 1) {
            code = locales[i]; dictionary = value.languages[code];
            if (!/^[a-z]{2,3}(_[a-zA-Z]{2})?$/.test(code) || !dictionary || typeof dictionary !== 'object' || Array.isArray(dictionary)) { continue; }
            keys = Object.keys(dictionary); if (keys.length > 256) { continue; } result[code] = {};
            for (j = 0; j < keys.length; j += 1) {
                key = keys[j]; if (/^[a-zA-Z][a-zA-Z0-9_.-]{0,79}$/.test(key) && typeof dictionary[key] === 'string' && dictionary[key].length > 0 && dictionary[key].length <= 2048) { result[code][key] = dictionary[key]; }
            }
        }
        return result;
    }
    function finish(id, record) {
        if (record.ready) { return; }
        record.ready = true; global.clearTimeout(record.timeout);
        if (record.script && record.script.parentNode) { record.script.parentNode.removeChild(record.script); }
        record.script = null;
        if (!ended) { notify(id); }
    }
    function register(id, value) {
        var record = records['$'+id];
        if (!record || record.ready || ended) { return; }
        record.languages = validate(value); finish(id,record);
    }
    function load(entry, record) {
        var script;
        try {
            script = document.createElement('script'); script.type = 'text/javascript'; script.charset = 'utf-8'; script.async = true; record.script = script;
            script.onload = function () { finish(entry.id,record); };
            script.onerror = function (event) { if (event && event.preventDefault) { event.preventDefault(); } finish(entry.id,record); return true; };
            record.timeout = global.setTimeout(function () { finish(entry.id,record); },5000);
            script.src = entry.translations;
            (document.head || document.documentElement).appendChild(script);
        } catch (ignore) { finish(entry.id,record); }
    }
    function start(entries) {
        var i, entry, record;
        if (ended) { return; }
        for (i = 0; i < entries.length; i += 1) {
            entry = entries[i]; if (!entry.translations || records['$'+entry.id]) { continue; }
            if (typeof entry.translations !== 'string' || entry.translations.indexOf('/data/integration/mzd-gui-modules/'+entry.id+'/assets/') !== 0 || !/^\/data\/integration\/mzd-gui-modules\/[a-z0-9-]+\/assets\/[A-Za-z0-9_.\/-]+\.js$/.test(entry.translations) || /(^|\/)\.\.?($|\/)/.test(entry.translations)) { continue; }
            record = {languages:{},listeners:[],script:null,ready:false}; records['$'+entry.id] = record; load(entry,record);
        }
    }
    function loadLanguage(id, fn) {
        var record = records['$'+id], language = current() || 'en_US', cancelled = false;
        function done() { if (!cancelled && !ended) { try { fn(snapshot(id,language)); } catch (ignore) {} } }
        if (ended || typeof fn !== 'function') { return function () {}; }
        if (!record || record.ready) { done(); } else { record.listeners.push(done); }
        return function () { cancelled = true; if (record) { var at = record.listeners.indexOf(done); if (at >= 0) { record.listeners.splice(at,1); } } };
    }
    function text(id,key,fallback,values) {
        var texts = snapshot(id).texts, value = own(texts,key) ? texts[key] : String(fallback || key);
        return value.replace(/\{([a-zA-Z0-9_]+)\}/g,function (match,name) { return values && own(values,name) ? String(values[name]) : match; });
    }
    function dispose() {
        var id, record; ended = true;
        for (id in records) { if (own(records,id)) { record = records[id]; record.listeners = []; global.clearTimeout(record.timeout); if (record.script && record.script.parentNode) { record.script.parentNode.removeChild(record.script); } } } records = {};
    }
    global.MzdGuiI18n = {register:register,start:start,load:loadLanguage,snapshot:snapshot,text:text,dispose:dispose};
    global.addEventListener('unload',dispose,false);
}(window));

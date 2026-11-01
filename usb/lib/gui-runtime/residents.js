/* Optional cooperative resident lifecycle. No module, settings or game special cases. */
(function (global) {
    'use strict';
    if (global.MzdGuiResidents) { return; }
    var records = {}, ended = false;
    function note(id, error) { try { if (global.log && global.log.info) { global.log.info('[mzd-gui resident ' + id + '] ' + error); } } catch (ignore) {} }
    function stop(id) {
        var record = records['$' + id], handlers, i;
        if (!record || record.stopped) { return; }
        record.stopped = true; global.clearTimeout(record.timeout);
        if (record.script && record.script.parentNode) { record.script.parentNode.removeChild(record.script); }
        record.view = null; record.message = null; record.closed = null;
        handlers = record.cleanup; record.cleanup = [];
        for (i = handlers.length - 1; i >= 0; i -= 1) { try { handlers[i](); } catch (error) { note(id,error); } }
    }
    function fail(id, error) { note(id,error); stop(id); }
    function register(id, factory) {
        var record = records['$' + id], context;
        if (ended || !record || record.stopped || record.registered || typeof factory !== 'function') { return false; }
        record.registered = true; global.clearTimeout(record.timeout);
        context = {
            id:id,
            language:function () { return global.MzdGuiI18n ? global.MzdGuiI18n.snapshot(id).language : 'en_US'; },
            t:function (key,fallback,values) { return global.MzdGuiI18n ? global.MzdGuiI18n.text(id,key,fallback,values) : String(fallback || key); },
            loadLanguage:function (fn) {
                if (global.MzdGuiI18n && typeof fn === 'function') { record.cleanup.push(global.MzdGuiI18n.load(id,fn)); }
            },
            onDispose:function (fn) { if (typeof fn === 'function' && !record.stopped) { record.cleanup.push(fn); } },
            service:{request:function (operation, args, callback) {
                if (record.stopped || !record.entry.service || !global.MzdGuiServices) { callback('Module service is unavailable.'); return; }
                global.MzdGuiServices.request(id,operation,args,function (error, result) {
                    if (!record.stopped) { try { callback(error,result); } catch (failure) { fail(id,failure); } }
                });
            }},
            onServiceReady:function (fn) {
                if (typeof fn === 'function' && global.MzdGuiServices && global.MzdGuiServices.onReady) {
                    record.cleanup.push(global.MzdGuiServices.onReady(function () { if (!record.stopped) { try { fn(); } catch (error) { fail(id,error); } } }));
                }
            },
            view:function () { return record.view; },
            onMessage:function (fn) { record.message = typeof fn === 'function' ? fn : null; },
            onViewClose:function (fn) { record.closed = typeof fn === 'function' ? fn : null; }
        };
        try { factory(context); } catch (error) { fail(id,error); return false; }
        return true;
    }
    function start(entries) {
        var i, entry, record, script;
        if (ended) { return; }
        for (i = 0; i < entries.length; i += 1) {
            entry = entries[i];
            if (!entry.resident || records['$' + entry.id]) { continue; }
            if (typeof entry.resident !== 'string' || !/^\/data\/integration\/mzd-gui-modules\/[a-z0-9-]+\/assets\/[A-Za-z0-9_.\/-]+\.js$/.test(entry.resident) ||
                entry.resident.indexOf('/data/integration/mzd-gui-modules/' + entry.id + '/assets/') !== 0 || /(^|\/)\.\.?($|\/)/.test(entry.resident)) { note(entry.id,'Invalid resident path.'); continue; }
            record = {entry:entry,registered:false,stopped:false,cleanup:[],view:null,message:null,closed:null};
            records['$' + entry.id] = record;
            script = document.createElement('script'); record.script = script;
            script.type = 'text/javascript'; script.async = true; script.src = entry.resident;
            (function (id, target) {
                target.onerror = function (event) { if (event && event.preventDefault) { event.preventDefault(); } fail(id,'Resident could not be loaded.'); return true; };
                record.timeout = global.setTimeout(function () { fail(id,'Resident registration timed out.'); },8000);
            }(entry.id,script));
            (document.head || document.documentElement).appendChild(script);
        }
    }
    function view(id, value) {
        var record = records['$' + id];
        if (!record || record.stopped) { return; }
        record.view = value;
        if (!value && record.closed) { try { record.closed(); } catch (error) { fail(id,error); } }
    }
    function message(id, event) {
        var record = records['$' + id], current;
        if (!record || record.stopped || !record.message) { return; }
        current = record.view;
        if (!current || event.source !== current.source || !event.data || event.data.token !== current.token) { return; }
        try { record.message(event); } catch (error) { fail(id,error); }
    }
    function dispose() { var key; if (ended) { return; } ended = true; for (key in records) { if (records.hasOwnProperty(key)) { stop(records[key].entry.id); } } }
    global.MzdGuiResidents = {start:start,register:register,view:view,message:message,stop:stop,dispose:dispose};
    global.addEventListener('unload',dispose,false);
}(window));

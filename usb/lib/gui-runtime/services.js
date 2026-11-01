/* File-origin Opera uses a same-origin HTTP bridge iframe, like the installer. */
(function (global) {
    'use strict';
    if (global.MzdGuiServices) { return; }
    var frame = null, endpoint = null, ready = false, waiting = {}, serial = 0, ended = false, loader = null, retry = null, listeners = [];
    function finish(id, error, result) {
        var item = waiting['$' + id]; if (!item) { return; }
        delete waiting['$' + id]; global.clearTimeout(item.timer); item.callback(error,result);
    }
    function clear(message) { var key; for (key in waiting) { if (waiting.hasOwnProperty(key)) { finish(waiting[key].id,message); } } }
    function connected(event) {
        var data = event.data;
        if (!frame || event.source !== frame.contentWindow || !endpoint || event.origin !== endpoint.origin || !data || data.token !== endpoint.token) { return; }
        if (data.type === 'mzd-service-ready') { if (!ready) { ready = true; var callbacks = listeners.slice(0), i; for (i = 0; i < callbacks.length; i += 1) { try { callbacks[i](); } catch (ignore) {} } } return; }
        if (data.type === 'mzd-service-result' && typeof data.id === 'number') { finish(data.id,data.error || null,data.result); }
    }
    function discover() {
        if (ended) { return; }
        if (loader && loader.parentNode) { loader.parentNode.removeChild(loader); }
        loader = document.createElement('script'); loader.type = 'text/javascript'; loader.async = true;
        loader.src = '/tmp/mzd-gui-service/connection.js?poll=' + String(new Date().getTime());
        loader.onload = function () {
            var value = global.mzdGuiServiceConnection;
            if (ended || !value || !/^http:\/\/127\.0\.0\.1:[0-9]{1,5}$/.test(value.origin) || !/^[0-9a-f]{48}$/.test(value.token)) { return; }
            if (endpoint && endpoint.origin === value.origin && endpoint.token === value.token && frame && ready) { return; }
            clear('Module service restarted. Please retry.'); ready = false; endpoint = {origin:value.origin,token:value.token};
            if (frame && frame.parentNode) { frame.parentNode.removeChild(frame); }
            frame = document.createElement('iframe'); frame.style.cssText = 'display:none;width:0;height:0;border:0;';
            frame.src = endpoint.origin + '/bridge#' + endpoint.token;
            (document.body || document.documentElement).appendChild(frame);
        };
        loader.onerror = function (event) { if (event && event.preventDefault) { event.preventDefault(); } return true; };
        (document.head || document.documentElement).appendChild(loader);
    }
    function request(module, operation, args, callback) {
        var id, count = 0, key, item;
        if (typeof callback !== 'function') { return; }
        if (ended || !ready || !frame) { callback('Module service is starting or unavailable. Please retry.'); return; }
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(module) || !/^[a-z][a-z0-9-]{0,31}$/.test(operation)) { callback('Invalid module service request.'); return; }
        for (key in waiting) { if (waiting.hasOwnProperty(key)) { count += 1; } }
        if (count >= 16) { callback('Module service is busy.'); return; }
        id = ++serial; item = {id:id,callback:callback,timer:null}; waiting['$' + id] = item;
        item.timer = global.setTimeout(function () { finish(id,'Module service timed out. Please retry.'); },120000);
        try { frame.contentWindow.postMessage({type:'mzd-service-request',token:endpoint.token,id:id,module:module,operation:operation,args:args || {}},endpoint.origin); }
        catch (error) { finish(id,String(error.message || error)); }
    }
    function dispose() {
        if (ended) { return; } ended = true; ready = false; listeners = []; global.clearInterval(retry); clear('Module service closed.');
        global.removeEventListener('message',connected,false);
        if (frame && frame.parentNode) { frame.parentNode.removeChild(frame); }
        if (loader && loader.parentNode) { loader.parentNode.removeChild(loader); }
    }
    global.MzdGuiServices = {request:request,dispose:dispose,onReady:function (fn) {
        if (typeof fn !== 'function' || ended) { return function () {}; }
        listeners.push(fn);
        return function () { var at = listeners.indexOf(fn); if (at >= 0) { listeners.splice(at,1); } };
    }};
    global.addEventListener('message',connected,false); global.addEventListener('unload',dispose,false);
    discover(); retry = global.setInterval(discover,10000);
}(window));

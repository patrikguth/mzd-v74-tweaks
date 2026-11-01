/* ES5 cooperative view SDK. This is not a security or process sandbox. */
(function () {
    'use strict';
    var match = /(?:^|[&#])mzdgui=([a-zA-Z0-9-]+)(?:&|$)/.exec(window.location.hash);
    var token = match ? match[1] : '', input = null, dispose = null, keys = {}, ended = false, originalError = window.onerror, errorHandler;
    function send(type, message) { if (token && !ended) { try { window.parent.postMessage({type:'mzd-gui-'+type,token:token,message:String(message || '').substring(0,512)}, '*'); } catch (ignore) {} } }
    function cleanup() {
        if (ended) { return; } ended = true;
        if (window.onerror === errorHandler) { window.onerror = originalError; }
        window.removeEventListener('message', receive, false); window.removeEventListener('keydown', down, true); window.removeEventListener('keyup', up, true);
        try { if (dispose) { dispose(); } } catch (ignore) {}
    }
    function handle(action, phase) {
        var handled = false;
        if (ended) { return; }
        try { if (input) { handled = input(action, phase) === true; } }
        catch (error) { send('error', String(error)); }
        if (action === 'back' && phase !== 'press' && !handled) { send('close'); }
    }
    function receive(event) {
        var data = event.data;
        if (event.source !== window.parent || !data || data.token !== token) { return; }
        if (data.type === 'mzd-gui-input' && ['left','right','up','down','select','rotateLeft','rotateRight','back'].indexOf(data.action) >= 0 && ['press','release','step'].indexOf(data.phase) >= 0) { handle(data.action,data.phase); }
    }
    function action(code) { return {37:'left',39:'right',38:'up',40:'down',13:'select',77:'rotateRight',78:'rotateLeft',27:'back'}[code]; }
    function stop(event) { if (event.preventDefault) { event.preventDefault(); } if (event.stopImmediatePropagation) { event.stopImmediatePropagation(); } event.returnValue = false; }
    function down(event) {
        var code = event.keyCode || event.which, name = action(code);
        if (code === 8) { stop(event); return; }
        if (name) { stop(event); if (!keys[code]) { keys[code] = name; handle(name,'press'); } }
    }
    function up(event) {
        var code = event.keyCode || event.which, name = keys[code];
        if (code === 8) { stop(event); handle('back','step'); return; }
        if (name) { stop(event); delete keys[code]; handle(name,'release'); }
    }
    window.MzdGuiModule = {ready:function () { send('ready'); },close:function () { send('close'); },
        onInput:function (fn) { input = typeof fn === 'function' ? fn : null; },
        onDispose:function (fn) { dispose = typeof fn === 'function' ? fn : null; },_dispose:cleanup};
    window.addEventListener('message', receive, false); window.addEventListener('keydown', down, true); window.addEventListener('keyup', up, true);
    errorHandler = function (message) { send('error',message); return true; };
    window.onerror = errorHandler;
}());

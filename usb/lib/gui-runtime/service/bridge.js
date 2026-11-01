/* Same-origin transport only; this frame never executes browser-supplied code. */
(function () {
    'use strict';
    var token = window.location.hash.substring(1);
    if (!/^[0-9a-f]{48}$/.test(token)) { return; }
    function post(value) { value.token = token; window.parent.postMessage(value,'*'); }
    window.addEventListener('message',function (event) {
        var data = event.data, xhr, body, finished = false;
        if (event.source !== window.parent || !data || data.token !== token || data.type !== 'mzd-service-request' || typeof data.id !== 'number') { return; }
        function finish(error, result) { if (finished) { return; } finished = true; post({type:'mzd-service-result',id:data.id,error:error || '',result:result}); }
        try {
            body = JSON.stringify({module:data.module,operation:data.operation,args:data.args});
            if (body.length > 8192) { finish('Module service request is too large.'); return; }
            xhr = new XMLHttpRequest(); xhr.open('POST','/rpc',true); xhr.timeout = 110000;
            xhr.setRequestHeader('Content-Type','application/json'); xhr.setRequestHeader('X-Mzd-Gui-Token',token);
            xhr.onload = function () {
                var value;
                try { value = JSON.parse(xhr.responseText); } catch (ignore) { finish('Invalid module service response.'); return; }
                finish(xhr.status === 200 ? value.error : value.error || 'Module service request failed.',value.result);
            };
            xhr.onerror = function () { finish('Module service disconnected.'); };
            xhr.ontimeout = function () { finish('Module service timed out.'); };
            xhr.send(body);
        } catch (error) { finish(String(error.message || error)); }
    },false);
    post({type:'mzd-service-ready'});
}());

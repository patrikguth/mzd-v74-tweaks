/* CMU client factory. The shared service bridge supplies authenticated requests
 * and validated image URLs. Loading this file does not start or change anything. */
(function (global) {
    'use strict';
    function create(service, options) {
        options = options || {};
        var makeImage = options.makeImage || function () { return new Image(); };
        var delay = options.delay || function (fn, ms) { return global.setTimeout(fn, ms); };
        var cancel = options.cancel || function (id) { global.clearTimeout(id); };
        var busy = false;
        function request(operation, args, callback) {
            function received(error, result) {
                // Factory cjson encodes empty Lua tables as objects, including lists.
                var keys = ['images','items'], i, value;
                if (!error && result) {
                    for (i = 0; i < keys.length; i += 1) {
                        value = result[keys[i]];
                        if (value && Object.prototype.toString.call(value) === '[object Object]' && Object.keys(value).length === 0) { result[keys[i]] = []; }
                    }
                }
                callback(error,result);
            }
            try { service.request(operation,args,received); }
            catch (error) { callback(String(error.message || error)); }
        }
        function importImage(file, callback) {
            if (busy) { callback('Another import is already in progress.'); return; }
            if (!file || typeof file.source !== 'string' || typeof file.name !== 'string') { callback('Invalid USB image selection.'); return; }
            busy = true;
            request('prepare',{source:file.source,name:file.name},function (error, prepared) {
                if (error) { busy = false; callback(error); return; }
                var picture, timer, finished = false;
                function complete(failure, result) { busy = false; callback(failure,result); }
                function abort(message) {
                    if (finished) { return; } finished = true; cancel(timer);
                    if (picture) { picture.onload = null; picture.onerror = null; picture.src = ''; }
                    request('abort',{ticket:prepared.ticket},function () { complete(message); });
                }
                timer = delay(function () { abort('Image validation timed out. Please retry.'); },15000);
                try {
                    picture = makeImage();
                    picture.onerror = function () { abort('Image could not be decoded.'); };
                    picture.onload = function () {
                        if (finished) { return; }
                        var width = typeof picture.naturalWidth === 'number' ? picture.naturalWidth : picture.width;
                        var height = typeof picture.naturalHeight === 'number' ? picture.naturalHeight : picture.height;
                        if (width !== 800 || height !== 480) { abort('Required: 800 x 480 pixels.'); return; }
                        finished = true; cancel(timer); picture.onload = null; picture.onerror = null;
                        request('commit',{ticket:prepared.ticket,width:width,height:height},function (failure, result) {
                            if (failure) { request('abort',{ticket:prepared.ticket},function () { complete(failure); }); }
                            else { complete(null,result); }
                        });
                    };
                    picture.src = prepared.url;
                } catch (failure) { abort(String(failure.message || failure)); }
            });
        }
        return {
            gallery:function (callback) { request('gallery',{},callback); },
            usb:function (callback) { request('usb',{},callback); },
            importImage:importImage,
            remove:function (id, callback) { request('delete',{id:id},callback); }
        };
    }
    global.WallpaperCmuImportClient = {create:create};
}(window));

/* Optional shared hook. No developer mode, module code or game loop at boot. */
(function () {
    'use strict';
    if (window.mzdGuiBootRequested) { return; }
    window.mzdGuiBootRequested = true;
    function load(path, next) {
        try {
            var script = document.createElement('script');
            script.type = 'text/javascript'; script.async = true; script.src = path;
            script.onload = next || function () {};
            script.onerror = function (event) { if (event && event.preventDefault) { event.preventDefault(); } return true; };
            (document.head || document.getElementsByTagName('head')[0] || document.documentElement).appendChild(script);
        } catch (ignore) {}
    }
    load('/data/integration/mzd-gui-registry.js', function () { load('/data/integration/mzd-gui-runtime/runtime.js'); });
}());

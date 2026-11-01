/* Optional shared hook. Lazy views; resident code runs only when declared. */
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
    load('/data/integration/mzd-gui-registry.js', function () {
        var entries = window.mzdGuiRegistry && window.mzdGuiRegistry.modules || [], resident = false, service = false, translations = false, i;
        for (i = 0; i < entries.length; i += 1) { resident = resident || !!entries[i].resident; service = service || !!entries[i].service; translations = translations || !!entries[i].translations; }
        function runtime() {
            function run() { load('/data/integration/mzd-gui-runtime/runtime.js'); }
            if (translations) { load('/data/integration/mzd-gui-runtime/i18n.js',run); } else { run(); }
        }
        if (resident) { load('/data/integration/mzd-gui-runtime/residents.js',function () {
            if (service) { load('/data/integration/mzd-gui-runtime/services.js',runtime); } else { runtime(); }
        }); } else { runtime(); }
    });
}());

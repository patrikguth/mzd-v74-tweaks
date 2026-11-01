/* View-local state only. Optional translations are selected once on opening. */
(function () {
    'use strict';
    var sdk = MzdGuiModule, count = 0, button = document.getElementById('close'), lastInput = null;
    function tr(key, fallback, values) {
        if (sdk.t) { return sdk.t(key,fallback,values); }
        return fallback.replace(/\{([a-zA-Z0-9_]+)\}/g,function (match,name) { return values && Object.prototype.hasOwnProperty.call(values,name) ? String(values[name]) : match; });
    }
    function showInput() {
        document.getElementById('input').textContent = lastInput ? tr('input','Input: {action} / {phase}',lastInput) : tr('inputHint','Use the controller. Select increments the counter.');
    }
    function labels(language, direction) {
        document.documentElement.lang = language.replace('_','-'); document.documentElement.dir = direction;
        document.getElementById('heading').textContent = tr('heading','Hello World');
        document.getElementById('intro').textContent = tr('intro','A general GUI extension using shared support.');
        document.getElementById('counter-label').textContent = tr('counter','Counter');
        document.getElementById('back-hint').textContent = tr('backHint','Back returns to the previous menu.');
        button.textContent = tr('back','Back'); showInput();
    }
    sdk.onInput(function (action, phase) {
        lastInput = {action:action,phase:phase}; showInput();
        if (action === 'select' && phase === 'press') {
            count += 1; document.getElementById('count').textContent = String(count);
        }
        return false; // Keep the SDK's default Back behavior.
    });
    button.onclick = function () { sdk.close(); };
    sdk.onDispose(function () { button.onclick = null; });
    sdk.ready();
    if (sdk.loadLanguage) { sdk.loadLanguage(labels); }
}());

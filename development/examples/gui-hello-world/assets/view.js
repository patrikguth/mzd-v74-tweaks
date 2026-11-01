/* View-local state only. No system configuration writes. */
(function () {
    'use strict';
    var count = 0, button = document.getElementById('close');
    MzdGuiModule.onInput(function (action, phase) {
        document.getElementById('input').textContent = action + ' / ' + phase;
        if (action === 'select' && phase === 'press') {
            count += 1; document.getElementById('count').textContent = String(count);
        }
        return false; // Keep the SDK's default Back behavior.
    });
    button.onclick = function () { MzdGuiModule.close(); };
    MzdGuiModule.onDispose(function () { button.onclick = null; });
    MzdGuiModule.ready();
}());

/* Translate shared semantic inputs to the unchanged Tetris controller API. */
(function () {
    'use strict';
    var game = window.MzdTetris, sdk = window.MzdGuiModule;
    if (!game || !sdk) { throw new Error('Tetris GUI integration is incomplete'); }
    sdk.onInput(function (action, phase) {
        if (action === 'back') {
            if (phase !== 'press') { game.release('back'); game.input('back'); }
        } else if (phase === 'press') { game.press(action); }
        else if (phase === 'release') { game.release(action); }
        else { game.input(action); }
        return true; // Tetris owns Back (pause/resume), and Exit closes via the SDK.
    });
    game.setExitHandler(function () { sdk.close(); });
    sdk.onDispose(function () { game.destroy(); });
    sdk.ready();
}());

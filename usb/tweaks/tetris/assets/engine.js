/* Adapted from javascript-tetris, Jake Gordon and contributors.
 * MIT license: see LICENSE.upstream. CMU adaptations. */
(function (root, factory) {
    'use strict';
    if (typeof module === 'object' && module.exports) { module.exports = factory(); }
    else { root.TetrisEngine = factory(); }
}(this, function () {
    'use strict';
    var TYPES = [
        { name: 'I', bits: [0x0F00, 0x2222, 0x00F0, 0x4444], color: '#54d9df' },
        { name: 'J', bits: [0x44C0, 0x8E00, 0x6440, 0x0E20], color: '#5d8ff7' },
        { name: 'L', bits: [0x4460, 0x0E80, 0xC440, 0x2E00], color: '#f2ad63' },
        { name: 'O', bits: [0xCC00, 0xCC00, 0xCC00, 0xCC00], color: '#efcf69' },
        { name: 'S', bits: [0x06C0, 0x8C40, 0x6C00, 0x4620], color: '#8fd397' },
        { name: 'T', bits: [0x0E40, 0x4C40, 0x4E00, 0x4640], color: '#b79bea' },
        { name: 'Z', bits: [0x0C60, 0x4C80, 0xC600, 0x2640], color: '#eb7e8b' }
    ];
    function each(type, x, y, rotation, fn) {
        var bit, n = 0, mask = TYPES[type].bits[rotation];
        for (bit = 0x8000; bit > 0; bit = bit >> 1) {
            if (mask & bit) { fn(x + n % 4, y + Math.floor(n / 4)); }
            n += 1;
        }
    }
    function Game(random) {
        this.random = random || Math.random;
        this.width = 10; this.height = 20;
        this.reset();
    }
    Game.prototype.take = function () {
        var n, tmp, j;
        if (!this.bag.length) {
            this.bag = [0, 1, 2, 3, 4, 5, 6];
            for (n = 6; n > 0; n -= 1) {
                j = Math.floor(this.random() * (n + 1));
                tmp = this.bag[n]; this.bag[n] = this.bag[j]; this.bag[j] = tmp;
            }
        }
        return this.bag.pop();
    };
    Game.prototype.reset = function () {
        var x, y;
        this.board = [];
        for (y = 0; y < 20; y += 1) {
            this.board[y] = [];
            for (x = 0; x < 10; x += 1) { this.board[y][x] = null; }
        }
        this.bag = []; this.score = 0; this.lines = 0; this.level = 1;
        this.time = 0; this.lockTime = 0; this.lockResets = 0;
        this.state = 'ready'; this.next = this.take(); this.spawn();
    };
    Game.prototype.spawn = function () {
        this.current = { type: this.next, x: 3, y: 0, rotation: 0 };
        this.next = this.take(); this.time = 0; this.lockTime = 0; this.lockResets = 0;
        if (!this.fits(this.current.x, this.current.y, this.current.rotation)) { this.state = 'over'; }
    };
    Game.prototype.fits = function (x, y, rotation) {
        var ok = true, board = this.board;
        each(this.current.type, x, y, rotation, function (bx, by) {
            if (bx < 0 || bx >= 10 || by < 0 || by >= 20 || board[by][bx] !== null) { ok = false; }
        });
        return ok;
    };
    Game.prototype.start = function () {
        this.reset(); this.state = 'playing';
    };
    Game.prototype.pause = function () {
        if (this.state === 'playing') { this.state = 'paused'; }
        else if (this.state === 'paused') { this.state = 'playing'; }
    };
    Game.prototype.adjustLock = function () {
        if (this.lockResets < 12) { this.lockTime = 0; this.lockResets += 1; }
    };
    Game.prototype.move = function (dx) {
        if (this.state !== 'playing' || !this.fits(this.current.x + dx, this.current.y, this.current.rotation)) { return false; }
        this.current.x += dx; this.adjustLock(); return true;
    };
    Game.prototype.rotate = function (delta) {
        var offsets = [0, -1, 1, -2, 2], n, r = (this.current.rotation + delta + 4) % 4;
        if (this.state !== 'playing') { return false; }
        // Simple horizontal wall kicks; deliberately not a full SRS implementation.
        for (n = 0; n < offsets.length; n += 1) {
            if (this.fits(this.current.x + offsets[n], this.current.y, r)) {
                this.current.x += offsets[n]; this.current.rotation = r; this.adjustLock(); return true;
            }
        }
        return false;
    };
    Game.prototype.softDrop = function () {
        if (this.state !== 'playing' || !this.fits(this.current.x, this.current.y + 1, this.current.rotation)) { return false; }
        this.current.y += 1; this.score += 1; return true;
    };
    Game.prototype.ghostY = function () {
        var y = this.current.y;
        while (this.fits(this.current.x, y + 1, this.current.rotation)) { y += 1; }
        return y;
    };
    Game.prototype.hardDrop = function () {
        var y;
        if (this.state !== 'playing') { return; }
        y = this.ghostY(); this.score += 2 * (y - this.current.y);
        this.current.y = y; this.lock();
    };
    Game.prototype.lock = function () {
        var game = this, y, x, full, n = 0, row;
        each(this.current.type, this.current.x, this.current.y, this.current.rotation, function (bx, by) {
            game.board[by][bx] = game.current.type;
        });
        for (y = 19; y >= 0; y -= 1) {
            full = true;
            for (x = 0; x < 10; x += 1) { if (this.board[y][x] === null) { full = false; } }
            if (full) {
                this.board.splice(y, 1); row = [];
                for (x = 0; x < 10; x += 1) { row.push(null); }
                this.board.unshift(row); n += 1; y += 1;
            }
        }
        this.score += [0, 100, 300, 500, 800][n] * this.level;
        this.lines += n; this.level = 1 + Math.floor(this.lines / 10); this.spawn();
        return n;
    };
    Game.prototype.tick = function (seconds) {
        var interval = Math.max(0.12, 0.8 * Math.pow(0.83, this.level - 1));
        if (this.state !== 'playing') { return; }
        seconds = Math.max(0, Math.min(0.1, seconds));
        this.time += seconds;
        if (this.time >= interval) {
            this.time -= interval;
            if (this.fits(this.current.x, this.current.y + 1, this.current.rotation)) { this.current.y += 1; }
        }
        if (!this.fits(this.current.x, this.current.y + 1, this.current.rotation)) {
            this.lockTime += seconds;
            if (this.lockTime >= 0.4) { this.lock(); }
        } else { this.lockTime = 0; }
    };
    return { Game: Game, types: TYPES, each: each };
}));

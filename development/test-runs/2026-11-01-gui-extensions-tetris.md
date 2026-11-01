# Shared GUI extensions and Tetris preparation

- Date: 2026-11-01
- Revision: development working tree based on 9a4f863; GUI API 1, Tetris 0.3.3
- Tester: maintainer observations; automated isolated tests and SSH inspection
- Types: isolated, browser emulator, physical CMU bench (separate evidence below)
- Firmware: 74.00.324A EU; bench unit, controller input
- Scope: shared GUI lifecycle, menu paths, native menu appearance, installable game

## Isolated evidence

The real package-controller fixture passed ten checks for the public Tetris
package, mixed consumers, both removal orders and saved uninstall with changed
USB assets. Twenty game checks plus the real shared SDK adapter exercise rules,
input latching, pause/Exit, game-over text, native-sized canvas and disposal.
Manifest, installer UI, ES5 and structure validation passed. DOM mocks are not
rendering evidence. Broader shared-helper failure fixtures are registered in CI.

## Browser emulator observations

The maintainer confirmed both direct Hello World and grouped Tetris views open,
accept input and return correctly. Native List2Ctrl submenus, carets and both
silver side arcs were adjusted to match Applications and confirmed by the tester.
A partial analysis copy initially lacked images; it was replaced/completed from
the original archive. Private emulator assets were checked against the original;
no OEM assets are included in the public package.

## Physical bench observations

USB updates were backed up and independently verified by file hashes. Native
BusyBox parsing exposed an unescaped slash inside an awk character class; the
first update rolled back, original hashes were confirmed, and the corrected
manifest/asset expressions and registry generator passed on the CMU. The user
reported installing Hello World and Tetris and accepted subsequent UI testing.
No package installation was automated as part of USB transfers.

These observations do not establish a complete physical first/last-consumer or
reboot-persistence matrix. Some later read-only snapshots reported both consumers
uninstalled; the CMU clock resets, so report filenames alone cannot establish
operation ordering. Logs and exact inventories remain private. Physical touch
input, long-term stability and power-loss recovery are not verified here.

## Publication scope

Only the installable Tetris GUI consumer is bundled under usb/tweaks/tetris.
Hello World stays under development/examples, and its test USB copy was removed.
The separate USB-only Run host and preview tooling remain ignored/local. The
published game references CMU OEM assets and retains its upstream MIT license.

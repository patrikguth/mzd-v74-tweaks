# Wallpaper Manager sources

Runtime: `usb/tweaks/wallpaper-manager`. The Lua backend in its assets/service
folder is canonical. `preview/core.js` is the state/rotation core; native-menu.js
adapts OEM controls. `cmu/import-client.js` and host.js bridge the installed view
to the shared service. Their names identify their origin, not bundled test data.
Run `python development/wallpaper-manager/build.py` to assemble assets/resident.js.
Run build_translations.py to regenerate the optional dictionary. It reuses only
the Cancel vocabulary and locale list from Tetris, never images or dumps.
All runtime/data assets are public and original project code; no OEM files or
private test inputs are shipped. Unit tests use synthetic image names and DOM.

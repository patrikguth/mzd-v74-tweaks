# GUI translations and Wallpaper Manager publication

- Date: 2026-11-02
- Revision: development work based on 8a746e8; installer 0.10.0
- Tweaks: Tetris 0.4.1, Wallpaper Manager 0.3.0; shared provider 0.3.1
- Types: isolated tests and maintainer-reported physical CMU observations
- Firmware: 74.00.324A EU bench unit

## Maintainer observations

The maintainer confirmed translations function and Wallpaper Manager works, and
approved publishing it. This is confirmation for the language and actions
actually exercised, not visual review of every available locale. The 41 distinct
firmware locale codes are derived from the original localization map; Korean is
mapped to English by that firmware. No OEM assets, private images, dumps, device
addresses or raw logs are included in the package.

## Isolated evidence

Generic runtime/SDK tests cover source/token checks, startup dictionaries, exact/
base/English/default fallbacks, optional metadata, load failure/timeout and cleanup.
Translation selection is once on opening; no language polling. Hello World shows
English/German and preserves its counter when startup text arrives. Tetris has
complete dictionaries and controller/rule/lifecycle coverage.

Wallpaper tests exercise all 41 dictionaries through the view, SDK, resident and
OEM-control mock, including filenames, counters, intervals, missing-folder hints,
empty-slideshow refusal and no language-induced writes. Pure Lua 5.1 storage tests
pass 95 assertions using a generated PNG and mock filesystem: bounds, CRC, quotas,
settings, recovery journals and deletion. Real saved-package fixtures cover mixed
consumers, both removal orders and retained user data. The public CI runs these
checks. DOM mocks are not native rendering evidence.

Earlier physical SSH checks verified a running factory Lua service, empty error
log, four external USB inputs, exact staged HTTP bytes and abort without import.
Install/uninstall restored the startup script byte-for-byte. The legacy BusyBox
awk field separator issue was corrected and checked on the CMU.

## Limits

Not every locale/font/layout has been manually reviewed. Arbitrary physical power
loss has not been proven; journal crash states have isolated fault coverage.
Private offline factory-runtime investigations remain outside the repository.

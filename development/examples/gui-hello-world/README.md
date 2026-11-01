# Hello World GUI example

Copy this directory to `usb/tweaks/gui-hello-world` to include the example in a
test USB package. Install using the normal launcher, then restart. Applications >
Hello World loads the view only when selected. Select increments a view-local
counter; Back returns. No configuration is changed or persisted.

`run.sh` and `reset.sh` delegate to the shared GUI helper. The first GUI consumer
installs shared support automatically; later consumers reuse it. Removing this
example retains support while another GUI consumer exists. The last removal
cleans up the owned support. Saved uninstall remains independent of a new USB.

The manifest is the only menu configuration:

```ini
gui_menu_path=
gui_label=Hello World
gui_entrypoint=assets/view.html
```

An empty menu path adds the entry directly under Applications. Change it to
`Tools/Examples` for Applications > Tools > Examples > Hello World. Intermediate
menus are shared by identical paths. Paths are relative to Applications, at most
eight segments and 240 characters; empty/dot segments and outer whitespace are
rejected. A slash separates levels and is not part of a displayed label.

Include the SDK, register input/dispose callbacks, then call ready when usable.
Do not write the developer hook or registry yourself, include another runtime,
or enable developer mode. The SDK has no privileged settings-write bridge.
See [Shared GUI extensions](../../Gui-extensions.md) and
[acceptance testing](../../Gui-extension-testing.md) for lifecycle and limits.

## Optional translations

This example includes English and German in `assets/i18n.js` and declares:

```ini
gui_translations=assets/i18n.js
```

The script registers a version-1 dictionary with `window.MzdGuiI18n.register`.
Use `MzdGuiModule.t(key, existingEnglishText, values)` for text and optional
`{name}` placeholders. `MzdGuiModule.loadLanguage(callback)` chooses the Mazda
language once when opening; the callback runs after dictionary loading or its
bounded fallback. There is no language polling. Reopen after changing language.

`gui.label` translates the Applications entry without changing its ID/path.
The input display deliberately retains normalized protocol action/phase names.
Additional locales are optional: exact locale, base language, English, then
the existing text are used in that order. Missing keys produce no log messages.
Remove the manifest field to demonstrate unchanged English behavior; the view
continues to work. No settings writes or extra backend/service are required.
An older shared provider must be removed using its saved GUI uninstallers before
installing consumers that require the new translation capability.

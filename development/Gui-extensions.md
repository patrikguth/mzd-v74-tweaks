# Shared GUI extensions (API 1, development)

The shared helper supports lazy-loaded views for any tweak. A view can display
information, provide a tool or present a tweak's settings interface. Games is
one optional grouping, not the owner of the runtime. The initial native adapter
supports Applications; a native Mazda Settings adapter is not implemented yet.
Do not use guessed native context IDs.

## Authoring

Start with [Hello World](examples/gui-hello-world/) or the
[minimal neutral fixture](examples/gui-extension/). Use `type=gui-extension`,
`gui_api=1`, a literal `gui_label` (1-80 characters), and
`gui_entrypoint=assets/view.html`. The menu location is manifest data:

```ini
gui_menu_path=Tools/Examples
gui_label=Hello World
```

This produces Applications > Tools > Examples > Hello World. An empty
`gui_menu_path=` puts the view directly under Applications; `Games` is an
ordinary path, not a special owner or adapter. The helper creates intermediate
menus using the original Mazda List2Ctrl factory and destroy APIs, merges
identical paths and takes Back one level at a time. Direct views have no caret;
only folders have submenu carets. Common Mazda chrome, status bar and Back
control are retained, and the original list is restored when leaving. No new
native MMUI context is registered. Paths are
case-sensitive display labels separated by `/`, with at most eight segments,
80 characters per segment and 240 characters total. Leading/trailing slashes,
empty/dot segments and outer whitespace are rejected. The root Applications
context is implicit; a path named Settings is an ordinary submenu, not the
native Mazda Settings context.
IDs `games` and `exit` are reserved. Include `reset_entrypoint=reset.sh`,
`status_scope=payload`, `reboot_required=true`, and install/uninstall/status actions.
No fake OEM target, OEM hash, lock group, shim or component declaration is allowed.
Asset paths use ASCII letters, digits, dots, underscores, hyphens and slashes,
without dot traversal or links; the limit is 512 asset entries.

The example delegates both workers to `lib/gui-extension.sh`. The controller
saves the module and matching helper snapshot for removal. Do not directly write
the boot hook, registry or other extensions' folders. Keep unrelated system
mutations out of a view; API 1 has no privileged settings-write bridge. Installer
settings remain the supported way to apply persistent configuration.

## Automatic shared lifecycle

The first GUI consumer creates the optional developer hook, shared runtime and
registry under `/data/integration`. The provider receipt and immutable support
snapshot live under `/tmp/mnt/data_persist/mzd-tweaks/gui-provider`, separately
from individual package receipts. No user-installed provider tweak is required.
Subsequent consumers reuse compatible, byte-verified support and update only the
derived registry. Different compatible USB runtime versions do not replace an
existing provider implicitly.

The registry contains data only. Applications entries exist at boot, while a
consumer HTML view and its JavaScript load only when selected. Each intermediate menu exists only while a registered consumer uses its path.
Removing the last consumer of one path retains other paths and shared support
while another GUI consumer remains. Removing the last GUI
consumer removes the verified hook/runtime/registry and provider receipt.
A pre-existing modules container is retained. A consumer upgrade retains shared
support during replacement. All GUI changes use one shared modification lock,
in addition to package-controller serialization.

Unknown developer hooks, links, unregistered module folders and changed owned
files cause refusal. The helper does not chain, adopt or overwrite foreign hooks.
An existing separately managed hook therefore needs an explicit migration; it
cannot be silently adopted. Status remains read-only. Backups and write verification
support rollback for caught failures. Reports retain transaction backups. A
rollback failure returns critical severity and says not to reboot. Power loss
cannot be handled by a running shell trap and is not yet proven recoverable.

## View API

Include `/data/integration/mzd-gui-runtime/sdk.js`, then use:

```js
MzdGuiModule.onInput(function (action, phase) {
    // left/right/up/down/select/rotateLeft/rotateRight/back
    // phase: press/release/step
    return false; // true consumes Back instead of the default close
});
MzdGuiModule.onDispose(function () {
    // Stop view timers and release listeners/resources.
});
MzdGuiModule.ready(); // Call after the view is usable, within eight seconds.
// MzdGuiModule.close();
```

Messages require the active iframe source and per-open token. Exceptions, load
errors and startup timeouts close a direct Applications view or return a grouped
view to its immediate parent menu. Native context changes close the view without restoring stale
focus. Disposing a view is idempotent. Custom events are consumed locally;
ordinary native events delegate to the original framework function.

Views share the browser process and origin. The iframe and cooperative SDK are
not a security boundary and cannot protect against an infinite loop or browser
engine crash. Do not install untrusted views. A failed helper initialization
restores only its own wrappers and removes its listeners. It must not modify OEM
JavaScript files or enable developer mode.

## Validation and remaining limits

Run `python tests/contract/test_gui_extensions.py`,
`python tests/contract/test_manifest.py`, `node tests/installer/test-gui-runtime.cjs`,
`node tests/installer/test-ui.cjs`, and `node tests/installer/test-es5.cjs`.
The runtime suite uses DOM mocks; it does not prove rendering or native input on
Opera. The real Restore fixture checks two saved consumers, shared cleanup and
receipt removal. Emulator, physical CMU, power-loss recovery and migration of existing consumers
remain separate acceptance work. Do not describe this development
implementation as vehicle-verified.

See [Acceptance testing](Gui-extension-testing.md) for the neutral browser and
physical CMU sequence, including the split between SSH checks and human input.

# Neutral GUI extension example

Development fixture, not a bundled end-user tweak. Copy this directory to
`usb/tweaks/gui-example` for isolated testing. It adds a direct Applications entry
and loads its HTML only when selected. No game assets or OEM files are included.

For a documented starting point with input feedback, see
[Hello World](../gui-hello-world/). Set `gui_menu_path=Tools/Examples` to test
shared nested menus; keep it empty for a direct Applications entry.

See [Shared GUI extensions](../../Gui-extensions.md) for the manifest, SDK,
automatic support lifecycle, ownership rules and current test limits. This
example does not write settings or enable developer mode.

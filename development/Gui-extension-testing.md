# GUI extension acceptance testing

Keep isolated shell tests, DOM mocks, browser-emulator results and physical CMU
results separate. The [API guide](Gui-extensions.md) describes the implemented
Applications adapter. Use two neutral direct Applications extensions for the
baseline; Nested menu paths such as Tools/Examples should also be tested with Back at
each level; Games uses the same path logic.

## Browser emulator

Use a complete private firmware GUI copy, including its images, `/jci/fonts/`
and the emulator boot videos under `/jci/resources/`. A partial analysis dump
can boot to a blank view despite successful script requests. Check completeness
against the original archive before diagnosing extension code. Expose a sibling `/data/` directory
through the emulator's existing limited HTTP mounts. Put the helper boot file at
`/data/integration/developer_mode_GuiConfig.js`, with its runtime, data registry
and two neutral modules in their documented locations. This is a browser fixture,
not evidence that the persistent shell package was installed correctly.

1. Boot to the ordinary home screen; open Applications. Both neutral entries
   appear once. No extension view should have loaded before selection.
2. Open A, use rotation, tilt and Select, then Back. Confirm input feedback and
   return to Applications. Repeat with B and alternate several times.
3. Open a view and use the native Home control. Confirm the normal menu works
   and the extension no longer consumes controller input.
4. Remove one entry from the local fixture registry, reload, and confirm the
   remaining entry works. Test a missing view and a deliberate startup failure
   only in the emulator: the normal interface must stay usable.
5. Record browser version, firmware provenance, helper source revision and
   console errors. HTTP 200 checks alone do not prove any of these UI results.

## Physical CMU: technical checks and human observations

The agent can perform technical checks over SSH. A person at the display must
confirm the visible result and physical controller behavior. Do not substitute
process state or a successful HTTP request for that confirmation.

Before any mutation, record firmware, uptime, mounts, saved installations,
existing optional developer hook, module/runtime files and relevant logs. Archive
any existing owned integration and verify its saved uninstall is usable. Refuse
unknown hooks. Migrate an existing integration deliberately through its saved
worker; do not overwrite it or remove it as an incidental test setup step.
Keep SSH and the normal installer recovery path available.

Use two neutral test packages with distinct IDs, `gui_menu_path=`,
restart required, and views that display input without changing system settings.
Stage the candidate installer files and these packages deliberately; preserve
unrelated USB customizations. Do not copy a complete staging tree blindly over a
USB containing private launcher additions.

| Phase | Automated technical checks | Human confirmation |
| --- | --- | --- |
| Install A | Saved package, helper receipt, hook/runtime/registry bytes, status, logs | Normal boot; A appears once; no unsolicited view |
| Open A | Relevant GUI logs and service health | Input feedback; Back returns; native Home remains usable |
| Install B | Same helper/hook bytes reused, two registry entries | Both entries work independently after restart |
| Remove A | A removed; B and shared support retained | B still works after restart; A absent |
| Remove B | Owned hook/runtime/registry/provider removed, status and mount checks | Stock menu works after restart; both entries absent |

Compare kernel uptime before and after operations intended only to reload GUI
services. Keep an explicit full reboot separate and record it. Collect logs after
each phase and stop on unknown changes, critical status or lost normal UI.

Do not inject write failures, kill processes during flash publication, or run
full Restore originals as part of this normal CMU sequence. Fault injection and
full-reset ordering already have isolated fixtures. A physical full-reset test
needs its own scope because it can also uninstall SSH and unrelated tweaks.
Use the test-run template for verified physical results; keep raw dumps and
personal logs private. Power-loss recovery and the native Settings adapter remain
separate work.

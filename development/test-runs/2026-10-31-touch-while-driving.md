# Touch While Driving transaction checks

- Date: 2026-10-31
- Revision: working tree after `bfbe678`, touch tweak 0.1.0
- Type: isolated Windows entrypoints and emulated Linux/BusyBox fixtures
- Target: firmware 74.00.324; synthetic target/NVRAM/mounts/setters
- No physical CMU installation or runtime configuration changes

## Results

Windows entrypoint run: **41 checks passed**. The final expanded fixture also
passed **45 checks under Linux/BusyBox**, invoked through the worker contract
dispatcher. Package validation accepted all 13 tweaks and their shell syntax.

Covered scenarios include read-only deep status, help/invalid arguments,
unsupported firmware, lock refusal, malformed NVRAM values, absent-key OEM
defaults, matching settings that still require a setter commit, both general
restriction choices, repeated installation preserving the original baseline,
unrelated Common.js edits, externally changed settings and saved removal.

Fault injection exercised a setter that changes its live key then fails,
successful exit with incorrect readback, target-file write failure, failed
rollback and a caught TERM interruption. Ordinary failures restored both entry
values and the entry file; failed rollback and interruption returned severity 2.
Malformed baselines and unknown extra files blocked automatic changes.

Reset hook checks covered read-only ownership inspection, baseline archival,
restoration and verified removal. Full package-controller install/uninstall
used the saved worker even after the USB helper and patch were replaced with
incompatible content.

Separately, the patch was applied to the privately held EU OEM Common.js and
reversed. The result matched the original bytes exactly, MD5
`60680f8a729b3a8eef1df0080c249e7c`. The OEM file is not included here.

## Limits

The fixture setters simulate commit/readback failures; they do not prove physical
NVRAM durability or touch behavior. Cold-start persistence, touch at speed,
controller/navigation/menu behavior, compass compatibility in both modes and
CarPlay/Android Auto still require vehicle testing. The existing bench touch
fault prevents using that unit as proof of touchscreen functionality.
Power loss and uncatchable signals retain the saved baseline/package for
recovery; they cannot execute shell rollback traps.

## Physical bench installation inspection

The user installed tweak 0.1.0 on the EU bench CMU, firmware 74.00.324A.
A subsequent read-only SSH inspection found:

- USB install report: exit_code=0; both OEM setter calls and readbacks succeeded.
- Saved original bus/LVDS values: enable/enable; selected configuration: disable.
- Current bus and LVDS keys: disable/disable.
- Common.js MD5: d1c66b9462ba21dd39843e561aba9516, matching the independently
  generated patched OEM file. Common.js.org matches the known OEM fingerprint.
- Saved package inventory verification succeeded; deep saved-worker status: installed.
- Root and resources mounts were read-only; watchdog disable value was 0.

Raw reports were copied to private local storage. No CMU files or runtime
settings were changed during inspection. Actual touch and at-speed behavior,
compass compatibility, uninstall and a controlled reboot-persistence sequence
remain unverified by this physical inspection.

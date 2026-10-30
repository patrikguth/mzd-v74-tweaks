# Instrument Cluster / HUD Language — test release

Standalone settings-service shim for CMU **74.00.324**. It overrides the display
language code sent to the instrument cluster/HUD, leaving the CMU interface
language unchanged. English may enable the HUD street-name line when the normal
CMU language suppresses it. This also changes cluster/HUD warning text language.
It does not install AA Mod, navigation or other AA/HUD functionality.

## Test with the launcher

1. Open **System > Instrument Cluster / HUD Language**.
2. Leave **Cluster / HUD language = english** and select Install.
3. Wait for Install completed, exit the installer and restart the CMU.
4. Check CMU language, instrument-cluster/HUD text language, and street names
   with the same navigation/AA setup used before installation.
5. Use Uninstall and restart to remove this override. To test a different value,
   uninstall first and install with the other choice. `off` installs the shim
   in passthrough mode; it does not remove its loader entry.

Own files are stored in
`/tmp/mnt/data_persist/mzd-tweaks/shims/cluster-language/`:
`libpatch-svcjciblmsettings.so` and generated `libpatch.conf`. The latter contains
only the selected `hud_display_language` value from the manifest; no other
AA Mod setting is imported or changed. Native modules must match the declared
OEM fingerprints. Both sm.conf and sm_WCP.conf receive the jciBLMSettings preload
entry, preserving other shims. There are no JS patches or AA Mod files here.

An existing reference to another copy of this same shim blocks installation.
Do not load two copies. Remove the old entry with its matching installer first;
do not restore entire SM configs just to remove one existing shim. An unused
old library/config file in the AA Mod folder is left alone.

HUD absence/unknown/combiner types produce warnings, since this shim also
changes the instrument cluster. Region and language do not gate installation:
the override may have no visible benefit when the existing language already
works. No speculative region/language query is used. Upstream reports a vehicle
test on Mazda 6 2019 EU, color HUD, 74.00.324A with Hungarian CMU language and
English override; this package still needs Piotr's own vehicle test.

## Upstream provenance and source

- Author: Patrik Guth; release supplied by Piotr Mocko.
- Release: https://github.com/piotrmocko/oem-aa-mod/releases/tag/0.10.22
- Change: https://github.com/VitaliyKurokhtin/oem-aa-mod/pull/43
- Source commit: `187f331320e647063c85068b4975a83ecd87c64d`.
- Release ZIP SHA256: `3dbdef66e4af0939617617f3cf1e5a59062b192b1f6cbe49a8cde1d260e69925`.
- Unmodified library SHA256: `b8953d42edb9f7ada2b7b4c3742b4e382e5d9f14d2207eb0163b02587eb1d33a`.

`source/oem-aa-mod-source.zip` contains the source snapshot at that commit,
including the Makefile, common headers and build instructions. Use upstream's
CMU m3-toolchain to rebuild. The source ZIP does not contain Git submodules;
the documented toolchain must be obtained separately. The library is unchanged;
the launcher integration and separate generated configuration are new.
Upstream license: AGPL-3.0-or-later, included as LICENSE and in the source ZIP.

The service has `reset_board=yes`: a library/process failure can restart the
CMU. A copied file/header check cannot prove runtime compatibility. Never reboot
after a critical installer error; inspect the USB report first.

Action reports and `run.log` are saved on the originating USB under
`reports/cluster-language/<action>-<timestamp>-<unique>/`.

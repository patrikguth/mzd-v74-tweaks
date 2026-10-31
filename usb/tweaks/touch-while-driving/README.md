# Touch While Driving

For firmware **74.00.324**. Removes the Mazda touchscreen speed restriction
and the GUI `Global.AtSpeed` handler, so Mazda menus also stop becoming
speed-disabled. Restart after installing or uninstalling.

The **General speed restriction** setting defaults to `disable`, matching the
traditional AIO unlock. Select `keep` to retain the original general speed
restriction for compass compatibility. Both choices disable the LVDS touch
restriction. DVD unlocking is outside this tweak's scope.

The worker uses the OEM NVRAM setters, verifies their return codes and reads
both values back. Before the first change, it saves the original values under
`/tmp/mnt/resources/mzd-tweaks/touch-while-driving/original.txt`. An absent key
means the OEM `enable` default; uninstall restores that value through the OEM
setter, which can leave a formerly absent key explicitly enabled.

The Common.js patch uses the shared patch engine, OEM backup and lock. Uninstall
reverses only this patch and restores the saved NVRAM values, retaining unrelated
Common.js changes. Failed transactions attempt to restore the entry file and
both entry settings. A failed rollback reports a critical result and retains
the baseline for recovery. Power loss cannot be rolled back by a shell trap;
the saved package and baseline remain available for removal.

Restore originals archives the baseline, restores the settings and removes the
owned backup only after verification. Unknown backups, extra files and legacy
AIO/TouchTune installations are not automatically adopted. Normal menu status
uses package receipts; deep worker status also checks the patch and settings.

Reports use the standard USB `reports/touch-while-driving/` directory. The
worker does not issue runtime DBus unlocks or change the native MMUI service.

## Validation

The inspected EU OEM Common.js fingerprint is recorded in manifest.conf.

Isolated entrypoint tests cover settings, patch preservation, rollback, saved
removal and reset. Vehicle behavior at speed, compass operation, and
CarPlay/Android Auto touch behavior still need vehicle testing. The bench's
existing touchscreen hardware fault cannot establish touch functionality.

# Restore originals

Supported firmware: **74.00.324**. Select **System > Restore originals**, read the
additional confirmation, and choose **Run** only if you want to reset the changes.

This restores files from internal `.org` backups and removes registered tweak
extras. **All patches on affected files are removed**, including changes from
other installers. Use a tweak's Uninstall button to remove just that tweak.
This is not a factory reset and does not reset personal settings or firmware.

Current files and backups are archived on USB under
`reports/restore-originals/run-.../`. Internal `.org` backups are deleted
only after restoration and cleanup are verified. Keep power and USB connected.

Restore cannot fix unsupported firmware, missing hardware, changes without a
backup or unknown extra files from other installers. Old backups are restored
as saved; they cannot always be authenticated as factory originals.

If a step fails, retain the report and follow the result message. If it says
**Do NOT reboot**, do not restart the CMU until the problem has been reviewed.

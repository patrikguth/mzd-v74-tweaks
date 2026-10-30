# Restore originals

System command for firmware 74.00.324. This is an explicit reset of file backups
and registered managed payloads, not a factory reset or a migration engine.
The launcher requires a second confirmation before Run. Direct shell invocation
`sh run.sh run` is the explicit request; `status` is read-only and reports readiness.

## Scope and ordering

1. Acquire the restore lock and all registered target locks. Check reset hooks.
2. Find `.org` files on root and internally mounted Linux block filesystems.
   Do not scan USB, navigation FAT filesystems, RAM or pseudo filesystems.
3. Reject links/non-files. For known targets, require the OEM hash declared in
   the matching firmware's manifest. Unknown old backups are restored as saved:
   their OEM provenance cannot be authenticated. A mismatched known hash blocks
   the entire operation before changes. There is no automatic firmware conversion.
4. Check USB space, then archive current contents and `.org` contents under
   `reports/restore-originals/run-<timestamp>-<unique>/files/<index>/`.
   `plan.tsv` and `target.path` map each index to its original path. A missing
   target gets `before.absent` instead of `before.data`.
5. Run each registered reset hook's prepare phase to archive and stop managed
   services. No arbitrary uninstaller or on-device unknown code is executed.
6. Restore whole files by verified same-directory rename, preserving current
   metadata (or backup metadata when the target was missing). Verify the entire
   batch. Until this point, failures roll file changes back where verifiable.
7. Run reset hooks' finish phase. Only after successful restoration and managed
   cleanup, delete internal `.org` files whose contents still match the archive.
   Recheck each restored target immediately before deleting its backup.
8. Restore watchdog/mount state, present the report, and refresh every tweak's
   status after OK. Restart the CMU manually after closing the launcher.

All patches on restored files are removed, including patches made by other
installers. The normal per-tweak uninstall still removes only its own diff.
Future installs create a fresh `.org` only from a known original; existing backups
are never overwritten. Archive data stays on USB after internal `.org` deletion.

## Persistent extras and failures

Tweaks owning extra files declare `reset_entrypoint=reset.sh`. Restore discovers
these declarations from the manifests; there is no list of tweak IDs or
service-specific cleanup in the installer or restore engine.

Each hook validates ownership, archives its own payload, stops its own runtime
changes, and removes its own verified extras. Unknown or modified files are not
blindly deleted. Adding another tweak requires its manifest and hook, without
changing the installer. See the reset-hook contract in `development/Worker-contract.md`
and the individual tweak's README for its specific cleanup behavior.

A filesystem rollback does not automatically restart stopped services. If a reset
fails, read the report; `.org` backups remain until the deletion phase. If cleanup
or deletion fails after file restoration has committed, restored files remain in
place and remaining backups allow another run. If rollback/system cleanup cannot
be verified, exit 2 blocks further launcher actions and says not to reboot.

Additional files created by unregistered third-party/old installers cannot be
inferred from `.org` names. They require a reviewed reset hook; they are not
silently deleted. Likewise this does not reset firmware, personal settings or
changes without a backup. Unknown/missing metadata and uncatchable power loss
cannot be repaired automatically; keep power and USB connected.

## Evidence

See `tests/contract/test_restore.py` and `development/test-runs/2026-10-25-restore-originals.md`.
Tests use synthetic files and fake system commands. Vehicle confirmation is pending.

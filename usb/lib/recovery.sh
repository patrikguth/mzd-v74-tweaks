#!/bin/sh
# Explicit recovery of one unmanaged patch target. No adoption or service cleanup.
MZD_RECOVERY_ROOT=/
MZD_RECOVERY_RESOURCES=/tmp/mnt/resources
MZD_RECOVERY_DATA=/tmp/mnt/data_persist
mzd_recovery_error() { printf 'Restore: %s\n' "$*" >&2; return 1; }
mzd_recovery_mount() (
    # Platform mount roles describe internal storage, independently of block-device
    # names. Inspect every mount: an unsupported child must not fall back to root.
    awk -v p="$APP" -v b="$APP.org" -v origin="$ROOT" \
        -v root="$MZD_RECOVERY_ROOT" -v resources="$MZD_RECOVERY_RESOURCES" -v data="$MZD_RECOVERY_DATA" '
      function contains(path,mount) {return mount=="/" || path==mount || index(path,mount "/")==1}
      {
        # Target paths reject controls/backslashes; decode accepted path spaces.
        mount=$2; gsub(/\\040/," ",mount)
        if(contains(p,mount) && length(mount)>=length(best)){best=mount; fs=$3}
        if(contains(b,mount) && length(mount)>=length(backup)){backup=mount}
        if(contains(origin,mount) && length(mount)>=length(source)){source=mount}
      }
      END {
        internal=(best==root || best=="/jci" || best==resources || best=="/mnt/resources" || best==data || best=="/mnt/data_persist")
        if(!internal || fs !~ /^(ext2|ext3|ext4|relfs|ubifs|jffs2)$/ || best!=backup || source=="" || best==source)exit 1
        print best
      }
    ' /proc/mounts
)
mzd_recovery_owners() (
    case "$APP/" in "$MZD_PACKAGE_STORE/"*) mzd_recovery_error 'Saved package files cannot be restored this way.'; exit 1 ;; esac
    [ ! -e "$MZD_PACKAGE_STORE/$ID" ] && [ ! -L "$MZD_PACKAGE_STORE/$ID" ] || {
        mzd_recovery_error 'This tweak has a saved installation. Use Uninstall or System > Restore originals.'; exit 1;
    }
    for entry in "$MZD_PACKAGE_STORE"/*; do
        [ -e "$entry" ] || [ -L "$entry" ] || continue
        mzd_package_check "$entry" || exit 1
        mzd_package_paths_ok "$entry/paths.tsv" || exit 1
        # Resolve registered aliases as well as the recovery target. Otherwise
        # two different path spellings could refer to the same managed file.
        paths=$(while IFS="$(printf '\t')" read -r kind owned; do
            canonical=$(readlink -f "$owned") && [ -e "$canonical" ] || exit 1
            printf '%s\t%s\n' "$kind" "$canonical" || exit 1
        done < "$entry/paths.tsv") || {
            mzd_recovery_error "Registered paths cannot be verified for saved tweak: ${entry##*/}. Use Uninstall or System > Restore originals."; exit 1;
        }
        printf '%s\n' "$paths" | awk -F "$(printf '\t')" -v target="$APP" '
          {p=$2; if(target==p || index(target,p "/")==1 || index(p,target "/")==1 || target ".org"==p) used=1}
          END {exit used}
        ' || {
            mzd_recovery_error "A saved tweak uses this file: ${entry##*/}. Use Uninstall or System > Restore originals."; exit 1;
        }
    done
)
# Recovery validates the saved OEM bytes, independently of any old patch format.
# Installation still performs its own complete forward/reverse preflight.
mzd_recovery_validate() {
    [ "$TYPE" = patch ] && [ -z "$RESET_ENTRYPOINT" ] || {
        mzd_recovery_error 'Single-file recovery is only available for plain file patches.'; return 1;
    }
    mzd_validate_firmware "$FIRMWARE" || return 1
    mzd_asset_readable "$APP" && mzd_asset_readable "$APP.org" || {
        mzd_recovery_error 'A readable target and original .org backup are required.'; return 1;
    }
    mzd_system_path "$APP" || return 1
    case "$APP" in *"$(printf '\t')"*|*'\'*|*'/../'*|*'/./'*) mzd_recovery_error 'Unsupported target path.'; return 1 ;; esac
    [ "$(readlink -f "$APP")" = "$APP" ] && [ "$(readlink -f "$APP.org")" = "$APP.org" ] || {
        mzd_recovery_error 'Target and backup paths must not contain symbolic links.'; return 1;
    }
    RECOVERY_MOUNT=$(mzd_recovery_mount) || {
        mzd_recovery_error 'Target and backup must share a supported internal mount, separate from the installer USB.'; return 1;
    }
    if [ -e "$ROOT/tweaks/$ID/managed-paths.tsv" ]; then
        mzd_asset_readable "$ROOT/tweaks/$ID/managed-paths.tsv" || return 1
        awk -F "$(printf '\t')" -v p="$APP" 'NF!=2 || $1!="patch" || $2!=p {bad=1} END {exit bad || NR!=1}' "$ROOT/tweaks/$ID/managed-paths.tsv" || {
            mzd_recovery_error 'This tweak owns additional paths; use its documented removal procedure.'; return 1;
        }
    fi
    mzd_recovery_owners || return 1
    RECOVERY_BACKUP_HASH=$(mzd_hash "$APP.org")
    case "$RECOVERY_BACKUP_HASH" in
        ''|*[!0-9a-f]*) mzd_recovery_error 'Cannot read a valid MD5 from the .org backup.'; return 1 ;;
    esac
    [ "${#RECOVERY_BACKUP_HASH}" = 32 ] || {
        mzd_recovery_error 'Cannot read a valid MD5 from the .org backup.'; return 1;
    }
    [ "$RECOVERY_BACKUP_HASH" = "$ORIGINAL" ] || {
        mzd_recovery_error "The .org backup has an unexpected MD5.
Expected MD5: $ORIGINAL
Actual MD5: $RECOVERY_BACKUP_HASH"; return 1;
    }
    RECOVERY_OBSERVED=$(mzd_hash "$APP")
    case "$RECOVERY_OBSERVED" in ''|*[!0-9a-f]*) return 1 ;; esac
    [ "${#RECOVERY_OBSERVED}" = 32 ] || return 1
    [ "$RECOVERY_OBSERVED" != "$ORIGINAL" ] || {
        mzd_recovery_error 'The target is already the original file.'; return 1;
    }
    # Bind consent to the displayed file AND the expected backup/version, not
    # just its bytes: a USB package may have changed while the dialog was open.
    RECOVERY_TOKEN=$(printf '%s\n' "$ID" "$VERSION" "$FIRMWARE" "$APP" "$ORIGINAL" "$RECOVERY_OBSERVED" | md5sum | cut -d' ' -f1)
    [ "${#RECOVERY_TOKEN}" = 32 ] || return 1
}
mzd_recovery_run() (
    # Report cleanup restores internal mounts and flushes USB report writes.
    ACTION=restore-original
    mzd_begin "$SELF" "restore-file-$ID" mzd_restore_cleanup
    mzd_system_begin
    RESTORE_COMMITTED=0
    : > "$MZD_REPORT/changed"
    mzd_system_lock /tmp/mzd-restore-originals.lock || exit 1
    mzd_system_lock "$MZD_PACKAGE_LOCK" || exit 1
    mzd_system_lock "$LOCK" || exit 1
    mzd_recovery_validate || exit 1
    [ "$RECOVERY_TOKEN" = "$1" ] || mzd_fail 'The file or tweak information changed after confirmation. Nothing restored; inspect it again.'
    required=$(du -sk "$APP" "$APP.org" | awk '{n+=$1} END {print n+16384}')
    available=$(df -Pk "$MZD_USB" | awk 'NR==2 {print $4}')
    case "$available:$required" in *[!0-9:]*|:*|*:) mzd_fail 'Cannot determine USB archive space.' ;; esac
    [ "$available" -ge "$required" ] || mzd_fail 'Not enough USB space to archive both files.'
    # Never replace an older archive if the CMU clock/PID repeats after reboot.
    mkdir "$MZD_REPORT/files" && mkdir "$MZD_REPORT/files/1" || mzd_fail 'This report folder already contains an archive. No internal file was restored.'
    folder="$MZD_REPORT/files/1"
    printf '%s\n' "$APP" > "$folder/target.path"
    printf '%s\n' "$RECOVERY_OBSERVED" > "$folder/before.hash"
    printf '%s\n' "$ORIGINAL" > "$folder/original.hash"
    # USB may be FAT; preserve bytes without requiring Unix metadata support.
    cp "$APP" "$folder/before.data" && cp "$APP.org" "$folder/original.data" || mzd_fail 'Cannot archive both files; nothing restored.'
    cmp -s "$APP" "$folder/before.data" && cmp -s "$APP.org" "$folder/original.data" &&
        [ "$(mzd_hash "$folder/before.data")" = "$RECOVERY_OBSERVED" ] &&
        [ "$(mzd_hash "$folder/original.data")" = "$ORIGINAL" ] || mzd_fail 'USB archive verification failed; nothing restored.'
    available=$(df -Pk "$RECOVERY_MOUNT" | awk 'NR==2 {print $4}')
    needed=$(du -sk "$APP" "$APP.org" | awk '{n+=$1} END {print n+1024}')
    case "$available:$needed" in *[!0-9:]*|:*|*:) mzd_fail 'Cannot determine internal temporary space.' ;; esac
    [ "$available" -ge "$needed" ] || mzd_fail 'Not enough internal space for a verified temporary file.'
    sync
    mzd_restore_before_matches "$folder" "$APP" && cmp -s "$APP.org" "$folder/original.data" || mzd_fail 'Files changed after archiving; nothing restored.'
    mzd_system_watchdog_disable || exit 1
    mzd_system_remount_rw "$RECOVERY_MOUNT" || exit 1
    printf '1\n' > "$MZD_REPORT/changed" || exit 1
    mzd_restore_write "$APP" "$folder/original.data" || mzd_fail 'Restore write failed; rolling back.'
    [ "$(mzd_hash "$APP")" = "$ORIGINAL" ] || mzd_fail 'Restored file verification failed; rolling back.'
    RESTORE_COMMITTED=1
    cmp -s "$APP" "$folder/original.data" || mzd_fatal 'Restored file changed before backup removal. Do NOT reboot.'
    cmp -s "$APP.org" "$folder/original.data" || mzd_fatal 'Original restored, but backup changed before removal. Do NOT reboot.'
    rm -f "$APP.org" && [ ! -e "$APP.org" ] && [ ! -L "$APP.org" ] || mzd_fail 'Original restored, but the .org backup could not be removed. Keep the USB report.'
    MZD_STATUS=$MZD_REPORT
)
mzd_recovery_main() (
    command=$1; id=$2
    for library in manifest report system patch packages restore export; do . "$ROOT/lib/$library.sh" || exit 1; done
    mzd_manifest_id "$id" || exit 1
    mzd_manifest_load "$ROOT/tweaks/$id/manifest.conf" || exit 1
    [ "$ID" = "$id" ] || exit 1
    mzd_require_tools awk md5sum cut readlink || exit 1
    if [ "$command" = restore-check ]; then
        [ ! -e "$MZD_PACKAGE_LOCK" ] && [ ! -e "$LOCK" ] || { mzd_recovery_error 'Another operation is active.'; exit 1; }
        mzd_recovery_validate || exit 1
        [ ! -e "$MZD_PACKAGE_LOCK" ] && [ ! -e "$LOCK" ] || exit 1
        printf 'available\t%s\t%s\n' "$RECOVERY_TOKEN" "$APP"
        exit 0
    fi
    confirmed=$3
    case "$confirmed" in ''|*[!0-9a-f]*) exit 1 ;; esac
    [ "${#confirmed}" = 32 ] || exit 1
    mzd_require_tools cp cmp mktemp df du mv mount sync date || exit 1
    mzd_export_mount || exit 1
    # Leave the USB writable; the report lifecycle flushes its writes.
    trap 'exit 2' INT TERM
    MZD_ORIGIN_USB=$EXPORT_MOUNT; export MZD_ORIGIN_USB
    report=$(mzd_recovery_run "$confirmed"); code=$?
    [ "$code" = 0 ] || exit "$code"
    printf 'Original file restored. ALL patches on this file were removed.\nYou can now retry Install.\nReports: %s\n' "$report"
)

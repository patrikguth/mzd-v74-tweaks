#!/bin/sh
# Component metadata and configuration generation; no target mutations.
MZD_COMPONENT_STORAGE=/tmp/mnt/data_persist
mzd_components() (
    component_mode=${1:-records}
    component_file="${MZD_MANIFEST_FILE%/*}/$COMPONENTS"
    [ -f "$component_file" ] && [ ! -L "$component_file" ] || {
        printf 'Components: Missing or linked component table.\n' >&2; exit 1;
    }
    component_reader="${MZD_MANIFEST_FILE%/*}/../../lib/components.awk"
    component_output=$(mktemp /tmp/mzd-components.XXXXXX) || exit 1
    trap 'rm -f "$component_output"' 0
    if awk -v mode="$component_mode" -v id="$ID" -v storage="$MZD_COMPONENT_STORAGE" \
        -v payload_dir="${PAYLOAD_DIR:-}" \
        -v primary="$APP" -v original="$ORIGINAL" -v lock="$LOCK" \
        -f "$component_reader" "$component_file" > "$component_output"; then
        cat "$component_output"
    else cat "$component_output" >&2; exit 1; fi
)
mzd_component_config() (
    mapping=$1; output=$2
    [ -f "$mapping" ] && [ ! -L "$mapping" ] || exit 1
    mzd_settings_check "$HERE/manifest.conf" "$MZD_SETTINGS_FILE" || exit 1
    if ! awk -f "$ROOT/lib/config-map.awk" "$MZD_SETTINGS_FILE" "$mapping" > "$output"; then
        cat "$output" >&2; rm -f "$output"; exit 1
    fi
)

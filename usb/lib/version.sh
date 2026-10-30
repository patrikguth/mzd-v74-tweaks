#!/bin/sh
# Read literal release metadata; never execute the VERSION file.
mzd_installer_version() (
    [ -f "$1/VERSION" ] && [ ! -L "$1/VERSION" ] || { printf 'unknown\n'; return; }
    awk '
      {sub(/\r$/, "")}
      NR == 1 && /^[0-9]+[.][0-9]+[.][0-9]+$/ {value=$0; next}
      {bad=1}
      END {print (!bad && value != "") ? value : "unknown"}
    ' "$1/VERSION"
)

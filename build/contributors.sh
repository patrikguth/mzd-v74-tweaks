#!/bin/sh
# Prints the GitHub users who contributed to a range of commits, one per line, sorted:
# commit authors and "Co-authored-by:" users. Bots are left out. Needs `gh` (GH_TOKEN).
#
#   sh build/contributors.sh <owner/repo> <head> [<base>]
#
# With <base>: the commits in <base>...<head> (GitHub compare, up to 250 commits).
# Without:     every commit reachable from <head>.
#
# A commit author is counted by its GitHub account, or by a users.noreply.github.com
# e-mail address when the commit is not linked to an account. Co-authors are counted
# only by such an address, because a plain e-mail cannot be mapped to a user.
set -eu
repo=$1
head=$2
base=${3:-}

jq_fields='(.author.login // empty), .commit.author.email,
  (.commit.message | split("\n")[] | select(test("^co-authored-by:"; "i")))'

if [ -n "$base" ]; then
  gh api "repos/$repo/compare/$base...$head" --jq ".commits[] | $jq_fields"
else
  gh api --paginate "repos/$repo/commits?sha=$head&per_page=100" --jq ".[] | $jq_fields"
fi |
  awk '
    # noreply address -> login: 12345+login@users.noreply.github.com or login@users.noreply.github.com
    function noreply(s,   m) {
      if (match(s, /[A-Za-z0-9._-]+@users\.noreply\.github\.com/)) {
        m = substr(s, RSTART, RLENGTH)
        sub(/@users\.noreply\.github\.com$/, "", m)
        sub(/^[0-9]+\+/, "", m)
        return m
      }
      return ""
    }
    tolower($0) ~ /^co-authored-by:/ { u = noreply($0); if (u != "") print u; next }
    /@/                              { u = noreply($0); if (u != "") print u; next }
    NF                               { print $0 }
  ' |
  awk '$0 !~ /\[bot\]$/ && $0 != "Copilot"' |
  sort -fu

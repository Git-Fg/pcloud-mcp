#!/usr/bin/env bash
set -euo pipefail

# Three-arm token-provenance probe for pCloud "1000 Log in required" errors.
#   arm 1: OAuth token as access_token=   (what the MCP server sends)
#   arm 2: the same OAuth token as auth=   (isolates parameter-name routing)
#   arm 3: legacy /getauth token as auth=  (isolates token provenance)
#
# Usage:
#   read -srp "OAuth token: " PCLOUD_ACCESS_TOKEN; export PCLOUD_ACCESS_TOKEN
#   scripts/probe-provenance.sh [--allow-mutating] [method] [extra GET params...]
# Never paste the token into a command line: it would land in shell history.
#
# Only read-only methods are allowed by default (trash_list, listrevisions,
# stat, resolve, find, userinfo, listfolder, listpublinks).
# Pass --allow-mutating before the method to probe a mutating endpoint; the
# probe would otherwise create real links or revert real files.
#
# Prints each arm's result code and a verdict. Credentials are passed to curl
# via stdin config (-K -) so they never appear in argv, ps, or this output.

allow_mutating=false
if [ "${1:-}" = "--allow-mutating" ]; then
  allow_mutating=true
  shift
fi

method="${1:-trash_list}"
shift || true

readonly ALLOWED=(trash_list listrevisions stat resolve find userinfo listfolder listpublinks)
if [ "$allow_mutating" != true ]; then
  found=false
  for m in "${ALLOWED[@]}"; do
    [ "$m" = "${method#/}" ] && found=true && break
  done
  if [ "$found" != true ]; then
    echo "refusing to probe '$method': not on the read-only allowlist (it may mutate account state)." >&2
    echo "read-only methods: ${ALLOWED[*]}" >&2
    echo "re-run with --allow-mutating before the method to override." >&2
    exit 2
  fi
fi

api="${PCLOUD_API_SERVER:-eapi.pcloud.com}"
url="https://${api}/${method#/}"

: "${PCLOUD_ACCESS_TOKEN:?set PCLOUD_ACCESS_TOKEN to the OAuth token under test}"

probe() {
  local param="$1" token="$2" extra=("${@:3}")
  {
    printf 'url = "%s"\nget\n' "$url"
    printf 'data-urlencode = "%s=%s"\n' "$param" "$token"
    local kv
    for kv in "${extra[@]:-}"; do
      [ -n "$kv" ] && printf 'data-urlencode = "%s"\n' "$kv"
    done
  } | curl -sS -K - | sed -n 's/.*"result": *\([0-9]*\).*/\1/p' | head -n1
}

run_arm() {
  local label="$1" param="$2" token="$3"
  shift 3
  local result
  result="$(probe "$param" "$token" "$@")"
  result="${result:-no-result}"
  printf '%s -> result=%s\n' "$label" "$result"
  [ "$result" = "0" ]
}

extra=("$@")
verdict=""
if run_arm "arm 1 (OAuth token as access_token=)" access_token "$PCLOUD_ACCESS_TOKEN" "${extra[@]:-}"; then
  verdict="arm 1 succeeded: the original failure was transient or argument-level, not auth."
fi

if [ -z "$verdict" ] && run_arm "arm 2 (OAuth token as auth=)" auth "$PCLOUD_ACCESS_TOKEN" "${extra[@]:-}"; then
  verdict="arm 2 succeeded: the endpoint routes on the parameter NAME (accepts auth=, rejects access_token=); provenance is not the cause."
fi

if [ -n "${PCLOUD_LEGACY_TOKEN:-}" ]; then
  if [ -z "$verdict" ] && run_arm "arm 3 (legacy /getauth token as auth=)" auth "$PCLOUD_LEGACY_TOKEN" "${extra[@]:-}"; then
    verdict="arm 3 succeeded: provenance restriction CONFIRMED for this account (OAuth token rejected, legacy session token accepted)."
  fi
else
  echo "arm 3 skipped: set PCLOUD_LEGACY_TOKEN to a legacy /getauth session token to test provenance."
fi

if [ -z "$verdict" ]; then
  if [ -n "${PCLOUD_LEGACY_TOKEN:-}" ]; then
    verdict="all three arms failed: the problem is not token provenance; re-read the result code and the RESULT_HINTS hint."
  else
    verdict="arms 1-2 failed and arm 3 was skipped: provenance remains OPEN until a legacy /getauth token is tested (set PCLOUD_LEGACY_TOKEN); re-read the result code meanwhile."
  fi
fi
printf 'verdict: %s\n' "$verdict"

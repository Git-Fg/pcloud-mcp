# pCloud API notes

Quirks observed against the real pCloud API for this account (OAuth access token). See `src/core/tools/*` for handlers.

## Tools that return `1000 Log in required` for this account

`trash_list`, `trash_restore`, `listrevisions`, `createuploadlink`, `revertrevision` return `1000 Log in required` even though the same token works for every other endpoint (verified with direct curl — not a tool bug).

- **Confirmed root cause for the trash family** (`trash_list`, `trash_restore`): token *provenance*, not scope. pCloud's OAuth tokens (`access_token=`) are silently rejected; only a legacy `/getauth` session token (sent as `auth=`) is accepted. There is no OAuth `scope` parameter to widen — `oauth2_token` documents none and returns none. Undocumented pCloud limitation reproduced since 2020 (rclone #3853, closed as Known Problem; pCloud support never acknowledged). The JS SDK encodes the same split: `createClient(token, 'pcloud')` sends `auth=`, `createClient(token, 'oauth')` sends `access_token=`.
- **For `listrevisions`, `createuploadlink`, `revertrevision`** the same `1000` symptom is observed but the cause is *unconfirmed* — treat as a hypothesis until tested against a file with known revisions or a `/getauth` session token.

All five stay in the surface in case a `PCLOUD_AUTH` session-token mode is wired later. Until then, agents needing these workflows use the pCloud web UI.

## Other endpoint quirks

- `deletepublink` returns `2027` for an unknown linkid (informative; idempotent in spirit but not literally).
- `getfilepublink`, `getfilelink`, `getvideolink`, `getaudiolink` are referrer-restricted to pcloud.com — the streaming/download URLs they return will not work when embedded in a third-party page.
- `extractarchive` runs server-side for ~2s: a `finished=false` response carries a `progresshash` that only the returned `hostname` can poll (`extractarchiveprogress` is 1000-blocked for OAuth tokens and is not exposed as a tool).
- `getthumblink` requires `size` with width 16–2048 and height 16–1024, both divisible by 4 or 5 (else error 1015); works only on files whose metadata has `thumb=true` (else 1014).

## Regenerating API docs

The per-method pCloud docs used to live under `references/pcloud-docs/` (one markdown file per page). They are no longer vendored; regenerate on demand with `python3 scripts/fetch_pcloud_docs.py <out-dir>` (see the script for usage).

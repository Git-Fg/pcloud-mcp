# pCloud API notes

Quirks observed against the real pCloud API for this account (OAuth access token). See `src/core/tools/*` for handlers.

## Tools that return `1000 Log in required` for this account

`trash_list`, `trash_restore`, `listrevisions`, `createuploadlink`, `revertrevision` return `1000 Log in required` even though the same token works for every other endpoint (verified with direct curl, not a tool bug).

- **Confirmed root cause for the trash family** (`trash_list`, `trash_restore`): token *provenance*, not scope. pCloud's OAuth tokens (`access_token=`) are silently rejected; only a legacy `/getauth` session token (sent as `auth=`) is accepted. There is no OAuth `scope` parameter to widen, `oauth2_token` documents none and returns none. Undocumented pCloud limitation reproduced since 2020 (rclone #3853, closed as Known Problem; pCloud support never acknowledged). The JS SDK encodes the same split: `createClient(token, 'pcloud')` sends `auth=`, `createClient(token, 'oauth')` sends `access_token=`.
- **For `listrevisions`, `createuploadlink`, `revertrevision`** the same `1000` symptom is observed but the cause is *unconfirmed*, treat as a hypothesis until tested against a file with known revisions or a `/getauth` session token.

All five stay in the surface in case a `PCLOUD_AUTH` session-token mode is wired later. Until then, agents needing these workflows use the pCloud web UI.

## Other endpoint quirks

- Upload links live in a separate pCloud family from public-download links: `listuploadlinks` / `deleteuploadlink` are keyed by `uploadlinkid`, while `listpublinks` / `deletepublink` cover only the public-download family (keyed by `linkid`). This server exposes neither `listuploadlinks` nor `deleteuploadlink`, so a drop created by `createuploadlink` cannot be listed or revoked through the MCP surface; close it by re-running `showuploadlink` with a past `expire` (pCloud maps the expired-link case to 7004, and its datetime parser accepts a past value) or from the pCloud web UI. The past-`expire` close is documented-plausible but has not been live-verified.
- `deletepublink` returns `2027` for an unknown linkid (informative; idempotent in spirit but not literally).
- `getfilepublink`, `getfilelink`, `getvideolink`, `getaudiolink` are referrer-restricted to pcloud.com, the streaming/download URLs they return will not work when embedded in a third-party page.
- `extractarchive` runs server-side for ~2s: a `finished=false` response carries a `progresshash` that only the returned `hostname` can poll (`extractarchiveprogress` is 1000-blocked for OAuth tokens and is not exposed as a tool).
- `getthumblink` requires `size` with width 16–2048 and height 16–1024, both divisible by 4 or 5 (else error 1015); works only on files whose metadata has `thumb=true` (else 1014).
- `listfolder` rejects a server-side `recursive=1` with `1101 Invalid request`. The walk has to happen client-side; the `listfolder` tool does it and tags each entry with its full path.
- `uploadfile` **overwrites** an existing file when the same name is uploaded into the same folder: the response carries the same `fileid` and the previous content is gone. Pass `renameifexists=1` to get `name (2).ext` instead. Parallel uploads into one folder also race on name allocation, so uploads that share a destination folder must be serialised.

## The `hash` field is not a checksum

`listfolder` entries and `uploadfile` responses carry a numeric `hash`. It is a 64-bit internal content hash, **not** SHA-1: two files with identical content share the same `hash` regardless of name or folder, and different content yields a different value. It is not reproducible with xxhash, xxh3, FNV-1a, murmur3, siphash or CRC-32 at any seed, so it cannot be computed locally to dedup a local tree against the remote one.

For byte-exact deduplication use `checksumfile`, which returns the real SHA-1 (SHA-256 on EU servers) per file. Note that `checksumfile` on a fileid returns the *current* content of that fileid, so it is only trustworthy when no concurrent upload targets the same folder.

## The 64-bit `hash` exceeds JavaScript's safe integer range

The pCloud `hash` field is a 64-bit unsigned integer. JSON serialises it as a double-precision float, which can only represent integers exactly up to 2^53 − 1 (≈ 9 × 10^15). pCloud's hash values are often larger (e.g. `2902597194296732000` ≈ 2^61), so the value is rounded on the way in.

**This is safe for grouping** because the rounding is deterministic: two files with identical content receive the *same* rounded double, so they still land in the same group. The collision probability of the rounded hash is still ≈ 2⁻⁵³, which is negligible for corpus curation. The definitive proof of identity is the SHA-1 from `checksumfile`, which the server computes exactly.

When working with the hash in TypeScript:
- Use `number` (not `bigint`) in schemas — Zod's `z.number()` accepts the rounded double.
- Do **not** compare hashes for exact equality in business logic; treat them as group keys only.
- The definitive identity proof is always `checksumfile` (SHA-1).

This behaviour was discovered during live testing of `checksum_group`; the mocks did not reproduce it because the test fixtures used small hash values.

## Regenerating API docs

The per-method pCloud docs used to live under `references/pcloud-docs/` (one markdown file per page). They are no longer vendored; regenerate on demand with `python3 scripts/fetch_pcloud_docs.py <out-dir>` (see the script for usage).

---
name: pcloud-client
description: Typed programmatic access to pCloud from TypeScript or Bun via the generated client module. 37 functions exported covering read (17), mutate (14), delete (4), and upload (2). Full inference over inputs/outputs. Stateless per-call; relies on the server's PCLOUD_ACCESS_TOKEN environment.
---

# pcloud-client

Generated typed client for pCloud, emitted from the live MCP server schema by mcporter. Lives at `./generated/pcloud-client.ts` with types in `pcloud-types.d.ts`.

## When to use

- Building scripts or services that call pCloud directly (no MCP transport).
- Needing compile-time-checked parameters and return types.
- Reusing the exact request/response shapes the MCP server validates.

## Usage

```ts
import { listfolder, readfile, resolve, find, copyfile, createuploadlink } from "./generated/pcloud-client";

const root = await listfolder({ folderid: 0, limit: 10 });
const text = await readfile({ fileid: 109711394696, maxBytes: 200 });
const id = await resolve({ path: "/docs/spec.md" });
const hits = await find({ query: "report", maxDepth: 3, maxResults: 50 });
const dup = await copyfile({ fileid: 109713632742, tofolderid: 27174731411, toname: "copy.txt" });
const link = await createuploadlink({ folderid: 0, comment: "drop files here" });
```

All functions are async, one-shot (no client state to hold). The client proxies to the MCP server, which uses the server's `PCLOUD_ACCESS_TOKEN` environment variable.

## Error envelope

pCloud returns `{ result: <int> }` where non-zero is an error code. The client surfaces non-zero results as thrown errors with the numeric code attached. Common codes:
- `1000`: auth required / no session. **Confirmed** for the trash family: pCloud silently rejects OAuth `access_token` on `trash_list`/`trash_restore` and accepts only a legacy `/getauth` session token sent as `auth=` (undocumented since 2020, rclone #3853). **Observed but unconfirmed** for `listrevisions`, `createuploadlink`, `revertrevision`: same 1000 symptom, cause not yet isolated (see `docs/pcloud-notes.md`); treat provenance as a hypothesis for those three. A file with no revision history also returns 1000 from `listrevisions`.
- `1001`: `createfolder`/`createfolderifnotexists` need a path or (folderid+name) (their Required table).
- `1002`: no full path or folderid provided.
- `1004`: `deletefile`/`stat`/etc. called with no fileid and no path.
- `1005`: `getfilelink`/`getvideolink`/`getaudiolink` got an unknown `contenttype`.
- `1013`: `diff`/`getfilepublink`/etc. could not parse the `after` datetime.
- `1014`: `getthumblink` called on a file whose metadata is not a thumb-capable type.
- `1015`: `getthumblink` `size` not in WxH form (16–2048 / 16–1024, divisible by 4 or 5).
- `1016`: `copyfile` / `copyfolder` missing destination (topath/tofolderid/toname).
- `1017`: invalid `folderid` supplied (a general id-validation code, not specific to trash).
- `1018`: invalid `fileid` supplied (a general id-validation code, not specific to trash).
- `1035`: `createuploadlink` missing `comment`.
- `1037`: `renamefile`/`copyfile`/`copyfolder`/`renamefolder` called without a destination.
- `1040`: `downloadfile` called without `url`.
- `2000`: log in failed (used uniformly across methods).
- `2001`: invalid file/folder name.
- `2002`: path component does not exist.
- `2003`: access denied / no permission.
- `2004`: destination file or folder already exists (also `copyfile`/`copyfolder` with `noover=true`).
- `2005`: directory does not exist.
- `2009`: file not found (also `revertrevision` with an unknown `revisionid`).
- `2027`: invalid or already deleted public link (deletepublink).
- `2044`: `getvideolink`/`getaudiolink` called on a non-media file.
- `4000`: too many login tries from this IP (per-IP lockout, no published duration).
- `7004` / `7007` / `7008`: `uploadtolink` code: link expired / link reached its space limit / link reached its file limit.

## Regeneration

```bash
PATH="$PWD/node_modules/.bin:$PATH" mcporter emit-ts pcloud --config config/mcporter.json --mode client --out generated/pcloud-client.ts
PATH="$PWD/node_modules/.bin:$PATH" mcporter emit-ts pcloud --config config/mcporter.json --mode types  --out generated/pcloud-types.d.ts
```

## Companion skills

Read and apply `pcloud-troubleshooting` to diagnose a thrown result code, `pcloud-recovery` for trash or revision recovery, `pcloud-sharing-security` for link and credential hygiene, and `pcloud-cli` for shell-level access or `pcloud-types` for the full schema reference.

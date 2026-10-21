---
name: pcloud-client
description: Typed programmatic access to pCloud from TypeScript or Bun via the generated client module. Every tool registered in the live server is exported as a typed function (read, mutate, delete, upload categories). Full inference over inputs/outputs. Stateless per-call; relies on the server's PCLOUD_ACCESS_TOKEN environment. Enumerate the `tools` array in `src/core/tools/index.ts` for the live list of exported function names.
---

# pcloud-client

Generated typed client for pCloud, emitted from the live MCP server schema by mcporter. Lives at `./generated/pcloud-client.ts` with types in `pcloud-types.d.ts`. The export list rotates as tools are added or removed; rely on `PcloudTools` (the generated interface) for the live bound, or `import * as pc from "./generated/pcloud-client"` to enumerate at runtime.

## When to use

- Building scripts or services that call pCloud directly (no MCP transport).
- Needing compile-time-checked parameters and return types.
- Reusing the exact request/response shapes the MCP server validates.

## Usage

All functions are async, one-shot (no client state to hold). Every parameter is an object with field names that mirror the MCP server's Zod schema verbatim. The client proxies to the MCP server, which uses the server's `PCLOUD_ACCESS_TOKEN` environment variable.

```ts
import * as pc from "./generated/pcloud-client";

// Read categories
const root    = await pc.folderListing({ folderid: 0, limit: 10 });
const text    = await pc.fileRead({ fileid: 109711394696, maxBytes: 200 });
const id      = await pc.pathResolve({ path: "/docs/spec.md" });
const hits    = await pc.folderSearch({ query: "report", maxDepth: 3, maxResults: 50 });
const dup     = await pc.fileCopy({ fileid: 109713632742, tofolderid: 27174731411, toname: "copy.txt" });
const link    = await pc.uploadLinkCreate({ folderid: 0, comment: "drop files here" });
```

Names above are illustrative. Treat the **capabilities** (folder listing, file read, path resolve, folder search, file copy server-side, upload link create) as stable; the per-capability function name may change as the schema rotates. Use TypeScript's autocomplete on the `pc` namespace or the generated `PcloudTools` interface as the source of truth for current names.

## Error envelope

pCloud returns `{ result: <int> }` where non-zero is an error code. The client surfaces non-zero results as thrown errors with the numeric code attached. Codes are stable across the API; the tool name referenced in the legacy docs column is illustrative, not authoritative.

| Code | Meaning | Common shape |
|---|---|---|
| `1000` | auth required / no session. **Confirmed** for the trash list + restore capabilities: pCloud silently rejects OAuth `access_token` and accepts only a legacy `/getauth` session token sent as `auth=` (undocumented pCloud limitation). **Observed but unconfirmed** for the revision-history, anonymous-upload-link, and revert-revision capabilities: same 1000 symptom, cause not yet isolated (see `docs/pcloud-notes.md`); treat provenance as a hypothesis. A file with no revision history also returns 1000 from the revision-history capability. |
| `1001` | Folder creation needs a path or (folder id + name). |
| `1002` | No full path or folder id provided. |
| `1004` | Stat / delete-style call with neither id nor path. |
| `1005` | Link-generation tool got an unknown `contenttype`. |
| `1013` | Cursor / time-arg tools could not parse the `after` datetime. |
| `1014` | Thumbnail tool called on a file whose metadata is not a thumb-capable type. |
| `1015` | Thumbnail `size` not in `WIDTHxHEIGHT` form (limits stated in the schema `.describe()`). |
| `1016` | Copy-style tool missing the destination side (`topath`/`tofolderid`/`toname`). |
| `1017` | Invalid folder id (general id-validation code). |
| `1018` | Invalid file id (general id-validation code). |
| `1035` | Upload-link creation missing `comment`. |
| `1037` | Move / copy-style tool called without a destination. |
| `1040` | Server-side fetch tool called without `url`. |
| `2000` | Log in failed (used uniformly across tools). |
| `2001` | Invalid file/folder name. |
| `2002` | Path component does not exist. |
| `2003` | Access denied / no permission. |
| `2004` | Destination already exists (also copy-style tool with `noover=true`). |
| `2005` | Directory does not exist. |
| `2009` | File not found (also revert-revision with unknown `revisionid`). |
| `2027` | Invalid or already deleted public link. |
| `2044` | Media-link-generation tool called on a non-media file. |
| `4000` | Too many login tries from this IP (per-IP lockout, no published duration). |
| `7004` / `7007` / `7008` | Upload-link code: link expired / reached its space limit / reached its file limit. |

The client wraps every non-zero result in a `PcloudError` with the numeric code, the original pCloud error string, and a one-line hint pointing at the row above. Program against the `result` / `hint` fields, not pCloud's prose (which is not localized).

## Regeneration

```bash
PATH="$PWD/node_modules/.bin:$PATH" mcporter emit-ts pcloud --config config/mcporter.json --mode client --out generated/pcloud-client.ts
PATH="$PWD/node_modules/.bin:$PATH" mcporter emit-ts pcloud --config config/mcporter.json --mode types  --out generated/pcloud-types.d.ts
```

## Companion skills

Read and apply `pcloud-troubleshooting` to diagnose a thrown result code, `pcloud-recovery` for trash or revision recovery, `pcloud-sharing-security` for link and credential hygiene, and `pcloud-cli` for shell-level access or `pcloud-types` for the full schema reference.

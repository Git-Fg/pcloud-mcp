---
name: pcloud-cli
description: Operate pCloud storage from the shell via the generated Bun CLI bundled at pcloud-cli.js (repo root). Stateless single calls; requires PCLOUD_ACCESS_TOKEN in the environment. Covers every tool registered in the live server, grouped as: read (userinfo, listfolder, stat, getfilelink, readfile, listrevisions, resolve, diff, find, listpublinks, trash_list, checksumfile, getthumblink, getvideolink, getaudiolink, getapiserver, currentserver), mutate (createfolder, createfolderifnotexists, renamefile, renamefolder, trash_restore, getfilepublink, getfolderpublink, createuploadlink, showuploadlink, copyfile, copyfolder, revertrevision, downloadfile, extractarchive), delete (deletefile, deletefolder, deletefolderrecursive, deletepublink), upload (uploadfile, uploadtolink). Enumerate the `tools` array in `src/core/tools/index.ts` for the live list.
---

# pcloud-cli

Generated CLI for the pCloud MCP server. Bundled by `mcporter generate-cli` and `bun build` into a self-contained Bun script with every registered tool inlined; the live list lives in the `tools` array in `src/core/tools/index.ts`, not hardcoded in this file.

## When to use

- Shell-level pCloud operations without an MCP client.
- Scripting / one-off automation.
- Verifying server behavior through the same client code path.

## Invocation

Always run with Bun from the repo root (the bundled script targets `--target=bun`; its embedded server command resolves its working directory relative to the script's own location, so the artifact must sit at the repo root):

```bash
cd /path/to/pcloud_mcp
export PCLOUD_ACCESS_TOKEN="..."          # required
bun run pcloud-cli.js --help
```

Arg style is `--key value`. Flags mirror the tool's schema field names verbatim: single-word fields stay as-is (`--folderid`, `--fileid`, `--linkid`), camelCase fields render as kebab-case (`--file-path`, `--max-bytes`, `--rename-if-exists`). There is no `--file-id`/`--folder-id` form. JSON payloads bypass commander parsing via `--raw '{...}'`.

## Tools

| Command | Read/Write | Key args |
|---|---|---|
| `userinfo` | R | n/a |
| `listfolder` | R | `--folderid <int>` (default 0), `--limit <int>`, `--offset <int>` |
| `stat` | R | `--fileid <int>` xor `--path <string>` |
| `getfilelink` | R | `--fileid <int>` xor `--path <string>` |
| `readfile` | R | `--fileid` xor `--path`, `--max-bytes <int>` (default 1 MB) |
| `listrevisions` | R | `--fileid` xor `--path` (returns 1000 on this account for all tested files, cause unproven: either an OAuth-provenance restriction like the trash family, or simply no revision history; see `docs/pcloud-notes.md`) |
| `resolve` | R | `--path <string>` → `{fileid|folderid, isfolder, name, path, size, modified}` |
| `diff` | R | `--diffid` xor `--after` xor `--last` (use `last=0` for the latest diffid), `--limit` default 100 |
| `find` | R | `--query`, `--folderid` (default 0), `--max-depth` default 3, `--max-results` default 100, BFS over `listfolder` since pCloud has no search endpoint |
| `listpublinks` | R | n/a |
| `trash_list` | R | `--folderid` (default 0), `--nofiles`, `--recursive` (returns 1000 on this account: pCloud rejects OAuth tokens on the trash family; legacy `/getauth` session token required) |
| `showuploadlink` | R/M | `--uploadlinkid <int>` (optional `--expire`, `--deleteexpire`, `--maxspace`, `--maxfiles` to mutate in the same call) |
| `createfolderifnotexists` | W | `--folderid` xor `--path` + `--name`: returns existing folder instead of erroring 2004 (idempotent) |
| `checksumfile` | R | `--fileid` xor `--path` → `sha1` (always) + `md5` (US region) / `sha256` (EU region) |
| `getthumblink` | R | `--fileid` xor `--path`, required `--size WIDTHxHEIGHT`, optional `--crop`, `--type jpeg\|png` |
| `getvideolink` | R | `--fileid` xor `--path`, optional `--abitrate` (16–320), `--vbitrate` (16–4000), `--resolution`, `--fixedbitrate` |
| `getaudiolink` | R | `--fileid` xor `--path`, optional `--abitrate` (16–320, default 192); can extract audio from a video |
| `getapiserver` | R | no args: returns closest API + binary-protocol hosts (no auth) |
| `currentserver` | R | no args: returns ip/hostname of the current API server (no auth) |
| `createfolder` | W | `--folderid <int>` (default 0), `--name <string>` |
| `renamefile` | W | source `--fileid` xor `--path`; dest `--topath` or `--tofolderid`+`--toname` |
| `renamefolder` | W | source `--folderid` xor `--path`; dest `--topath` or `--tofolderid`+`--toname` |
| `uploadfile` | W | `--file-path <string>` (local), `--folderid <int>` xor `--path`, `--filename`, `--rename-if-exists`, `--no-partial`: emits `notifications/progress` |
| `getfilepublink` | W | `--fileid` xor `--path`, optional `--expire`, `--maxdownloads`, `--maxtraffic`, `--shortlink`, `--linkpassword` |
| `getfolderpublink` | W | same as getfilepublink but for a folder |
| `trash_restore` | W | `--fileid` xor `--folderid` (use `folderid=0` to restore everything), optional `--restoreto`, `--metadata` |
| `createuploadlink` | W | `--folderid` xor `--path`, required `--comment`, optional `--expire`, `--maxspace`, `--maxfiles`: returns uploadlinkid, link, mail, code |
| `copyfile` | W | source `--fileid` xor `--path`; dest `--topath` or `--tofolderid` (+ `--toname`); optional `--noover`, `--mtime`, `--ctime` |
| `copyfolder` | W | source `--folderid` xor `--path`; dest `--topath` or `--tofolderid` (+ `--toname`); optional `--noover`, `--skipexisting`, `--copycontentonly` |
| `revertrevision` | W | `--fileid` xor `--path` + `--revisionid` (from `listrevisions`): current contents saved as a new revision |
| `downloadfile` | W | `--url <string>` (one or more whitespace-separated), `--folderid` xor `--path`, optional `--target`, `--progresshash`: server-side fetch; no bytes cross the MCP server |
| `extractarchive` | W | `--fileid` xor `--path` (the archive), required one of `--tofolderid`/`--topath`/`--toname`, optional `--password` (7009 without it), `--nooutput`, `--overwrite rename\|overwrite\|skip`: runs ~2s server-side |
| `uploadtolink` | U | `--code <string>` (from createuploadlink), `--file-path <string>`, optional `--filename`, `--no-partial`, `--progresshash`: no auth token; the link code is the credential |
| `deletefile` | D | `--fileid` xor `--path` (file only) |
| `deletefolder` | D | `--folderid` xor `--path` (folder must be empty) |
| `deletefolderrecursive` | D | `--folderid` xor `--path` (destructive) |
| `deletepublink` | D | `--linkid <int>` (returns 2027 for unknown linkids) |

## Environment

- `PCLOUD_ACCESS_TOKEN`: OAuth2 access token (required, non-empty, no `${...}` placeholders).
- `PCLOUD_API_SERVER`: `eapi.pcloud.com` (EU, default) or `api.pcloud.com` (US).

## Regeneration

```bash
# From the repo root, with the repo-local mcporter (never a global copy)
PATH="$PWD/node_modules/.bin:$PATH" mcporter generate-cli --server config/mcporter.gen.json --output pcloud.ts
bun build pcloud.ts --target=bun --outfile=pcloud-cli.js --minify
```

The `.githooks/pre-commit` hook runs exactly this on every commit. Both artifacts must stay at the repo root: the embedded server command spawns `bun run src/index.ts` with a cwd resolved relative to the script's own directory.

## Companion skills

Read and apply `pcloud-troubleshooting` to diagnose a failed call, `pcloud-recovery` for trash and revision recovery, `pcloud-sharing-security` for link and credential hygiene, `pcloud-client` for typed programmatic access, and `pcloud-types` for the full schema reference.

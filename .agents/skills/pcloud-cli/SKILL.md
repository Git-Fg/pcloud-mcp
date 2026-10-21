---
name: pcloud-cli
description: Operate pCloud storage from the shell via the generated Bun CLI bundled at pcloud-cli.js (repo root). Stateless single calls; requires PCLOUD_ACCESS_TOKEN in the environment. The CLI covers every tool the server exposes (read, mutate, delete, upload); the live list lives in the `tools` array in `src/core/tools/index.ts`, not hardcoded in this skill.
---

# pcloud-cli

Generated CLI for the pCloud MCP server. Bundled by `mcporter generate-cli` and `bun build` into a self-contained Bun script with every registered tool inlined; the live list lives in the `tools` array in `src/core/tools/index.ts`.

## When to use

- Shell-level pCloud operations without an MCP client.
- Scripting / one-off automation.
- Verifying server behavior through the same client code path the MCP transport uses.

## Invocation

Always run with Bun from the repo root (the bundled script targets `--target=bun`; its embedded server command resolves its working directory relative to the script's own location, so the artifact must sit at the repo root):

```bash
cd /path/to/pcloud_mcp
export PCLOUD_ACCESS_TOKEN="..."          # required
bun run pcloud-cli.js --help
```

Arg style is `--key value`. Flags mirror the tool's schema field names verbatim: single-word fields stay as-is (`--folderid`, `--fileid`, `--linkid`), camelCase fields render as kebab-case (`--file-path`, `--max-bytes`, `--rename-if-exists`). There is no `--file-id`/`--folder-id` form. JSON payloads bypass commander parsing via `--raw '{...}'`.

## Capabilities (semantic, not named)

The CLI mirrors the tool surface; rather than list tool names (which rotate), describe what each capability **does**. Mode column = `R` read-only idempotent / `W` write (idempotency varies) / `D` destructive / `U` upload (uses local file). Run `bun run pcloud-cli.js --help` for the exact argument list.

| Capability | Mode | What it does |
|---|---|---|
| Account introspection | R | Return current account metadata (id, email, quota) without any args |
| Folder traversal | R | List, recursive-list, or resolve a path to `{fileid\|folderid, isfolder}`; BFS search a tree by substring match |
| File / folder metadata | R | Stat a single path-or-id; checksumfile returns sha1 (always) and md5 (US) / sha256 (EU) |
| Signed download link | R | Get a short-lived, token-scoped URL for a single file |
| Streamed file read | R | Fetch + stream a file's content directly, capped by a byte limit; signed URL never returned |
| Revision history | R | List past versions of a file; revertrevision writes a current-as-revision before reverting |
| Thumbnail / preview URL | R | Get a sized-image URL (size required, WxH divisible by 4 or 5) |
| Video transcoding URL | R | Get a transcoded streaming URL (FLV/x264 by default; transcode sizes constrained) |
| Audio extract URL | R | Get an MP3 streaming URL; can also extract audio from video |
| API host discovery | R | No-auth: list closest API servers or the current one (for upload pinning) |
| Sync-state cursor | R | Cursor over account change events since a given `diffid` (events older than ~6 months get compacted) |
| Public file share | W | Create / delete a public link for a file (restricts `Referer` to pcloud.com) |
| Public folder share | W | Same, but for a folder (folder id 0 cannot be shared) |
| Public-link audit | R | List every public link on the account |
| Anonymous upload link | W | Create a public link letting anyone upload into a folder; `comment` is required |
| Anonymous upload submit | U | Upload to an upload link by `code` alone; no `access_token` is sent |
| Folder mutation | W | Create / rename / copy server-side; copyfile/copyfolder leave the original untouched |
| File mutation | W | Rename / copy / revert-to-revision (server-side) |
| Archive extraction | W | Server-side extract of a zip / tar into a folder; ~2s timeout |
| Server-side fetch | W | Tell pCloud to download one or more URLs into a folder; bytes never cross the MCP server |
| Local-to-cloud upload | U | Read a local file in chunks and POST as multipart; emits `notifications/progress` for read + send |
| File delete | D | Single file by id or path (other end of folder deletion is empty-folder only) |
| Empty-folder delete | D | Reject unless the folder is empty; use recursive variant otherwise |
| Recursive folder delete | D | Destructive; removed items land in pCloud Trash (recoverable via the trash-restore capability) |
| Public-link delete | D | By link id; unknown ids return 2027 (idempotent in spirit) |
| Trash listing | R | Browse the Trash by folder id; entries carry `origparentfolderid` |
| Trash restore | W | Restore a file or folder, optionally to a different parent; `folderid=0` restores the entire Trash |
| Show upload link | R/M | Inspect an upload link; same call optionally updates `expire` / `maxspace` / `maxfiles` |

All read-only endpoints are idempotent; all write endpoints are not. Only the trash family (list / restore) is known to silently reject OAuth `access_token` tokens on this server's account; legacy `/getauth` session tokens are the workaround. `listrevisions`, `createuploadlink`, and `revertrevision` show the same `1000` symptom with an unconfirmed cause (see `docs/pcloud-notes.md`).

## Environment

- `PCLOUD_ACCESS_TOKEN`: OAuth2 access token (required, non-empty, no `${...}` placeholders).
- `PCLOUD_API_SERVER`: one of the known pCloud endpoints (`eapi.pcloud.com` EU default, `api.pcloud.com` US, `api.europe.pcloud.com` explicit EU, `api.us.pcloud.com` explicit US); other values throw at startup.

## Regeneration

```bash
# From the repo root, with the repo-local mcporter (never a global copy)
PATH="$PWD/node_modules/.bin:$PATH" mcporter generate-cli --server config/mcporter.gen.json --output pcloud.ts
bun build pcloud.ts --target=bun --outfile=pcloud-cli.js --minify
```

The `.githooks/pre-commit` hook runs exactly this on every commit. Both artifacts must stay at the repo root: the embedded server command spawns `bun run src/index.ts` with a cwd resolved relative to the script's own directory.

## Companion skills

Read and apply `pcloud-troubleshooting` to diagnose a failed call, `pcloud-recovery` for trash and revision recovery, `pcloud-sharing-security` for link and credential hygiene, `pcloud-client` for typed programmatic access, and `pcloud-types` for the full schema reference.

# pCloud MCP server

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

Local MCP server that exposes the pCloud HTTP/JSON API as typed tools to any MCP client (Claude Code, Kimi Code, Cursor, VS Code, …). Built with `@modelcontextprotocol/sdk` v2, TypeScript, and Bun; ships stdio (default) and streamable-HTTP transports.

## Quick start

```sh
bun install
cp .env.example .env          # then fill in PCLOUD_ACCESS_TOKEN
bun run build                 # tsc → dist/
bun run dev                   # stdio transport
bun run dev:http              # http transport on http://127.0.0.1:3000
bun test                      # unit + transport tests
bun run scripts/live-mcp-e2e.ts  # exercises the real pCloud API (needs the token)
```

## Configure your MCP client

```json
{
  "mcpServers": {
    "pcloud": {
      "command": "sh",
      "args": ["-c", "set -a && . ./.env && exec bun run src/index.ts"],
      "cwd": "/path/to/pcloud_mcp"
    }
  }
}
```

Or, after `bun run build`, point at the compiled entry: `node /path/to/pcloud_mcp/dist/index.js` with `PCLOUD_ACCESS_TOKEN` in the environment.

### Self-bootstrap (for AI agents)

Paste this into any agent harness (Claude Code, Kimi Code, Cursor, …) to register the server; restart the harness after:

> Clone https://github.com/Git-Fg/pcloud-mcp, run `bun install && bun run build`, then ask the user to add `PCLOUD_ACCESS_TOKEN` to their global env or to `.env` in the workspace. Add to your MCP config (workspace-local, resolved against the current working directory, not the home directory): `{"mcpServers":{"pcloud":{"command":"sh","args":["-c","set -a && . ./.env && exec node dist/index.js"],"cwd":"/path/to/pcloud_mcp"}}}`. The tools load on restart; `pcloud-cli.js` and the skills work without a restart.

## Environment

| Variable | Required | Notes |
| --- | --- | --- |
| `PCLOUD_ACCESS_TOKEN` | yes | Static token, sent as `?access_token=` per the pCloud HTTP/JSON protocol. |
| `PCLOUD_ACCESS_ID` | no | Reserved (application/access id from the rclone token store); not currently used by this server. |
| `MODE` | no | Set to `http` to use the HTTP transport instead of stdio. |
| `PORT` | no | HTTP listen port (default 3000). |
| `BIND_ADDRESS` | no | HTTP bind address (default 127.0.0.1). Non-loopback requires `MCP_BEARER_TOKEN`. |
| `ALLOWED_HOSTS` | no | Comma-separated Host-header allowlist (DNS-rebinding defense). |
| `ALLOWED_ORIGINS` | no | Comma-separated CORS origin allowlist (deny-by-default). |
| `PCLOUD_API_SERVER` | no | Defaults to `eapi.pcloud.com` (EU region). |
| `MCP_BEARER_TOKEN` | no | Required to bind the HTTP transport to a non-loopback address. |

## Transport

| Mode | How | When |
| --- | --- | --- |
| stdio (default) | `bun run dev` | Local Claude/Kimi/Cursor against this repo |
| HTTP | `MODE=http bun run dev` | Sharing on the network, refuses to bind a non-loopback address without `MCP_BEARER_TOKEN` |

The HTTP transport defaults to `127.0.0.1:3000` and enforces a DNS-rebinding host allowlist plus a CORS deny-by-default policy. See `src/mcp/http.ts` and `src/mcp/http.test.ts`.

## Authentication

Non-OAuth. A static `PCLOUD_ACCESS_TOKEN` is read from env and sent as the `?access_token=` query parameter per the pCloud HTTP/JSON protocol. All requests hit `https://<PCLOUD_API_SERVER>/<method>` (default `https://eapi.pcloud.com/<method>`; override via `PCLOUD_API_SERVER`, see `src/core/config.ts`); every response carries `result`: `0` success, non-zero error surfaced as MCP `isError`. Known endpoint limitations are documented in `docs/pcloud-notes.md`.

## Tool surface

The authoritative list, with titles, descriptions, and Zod input/output schemas, is `src/core/tools/index.ts` (the `tools` array). Do not hardcode the count: a `grep -c 'server.registerTool'` is permanently 1 because registration is a single loop. Highlights:

- Files: `stat`, `resolve`, `readfile`, `checksumfile`, `getfilelink`, `getthumblink`, `getvideolink`, `getaudiolink`, `renamefile`, `copyfile`, `deletefile`, `listrevisions`, `revertrevision`, `downloadfile`.
- Folders: `listfolder`, `find`, `createfolder`, `createfolderifnotexists`, `renamefolder`, `copyfolder`, `deletefolder`, `deletefolderrecursive`.
- Uploads: `uploadfile`, `createuploadlink`, `showuploadlink`, `uploadtolink`.
- Sharing: `getfilepublink`, `getfolderpublink`, `listpublinks`, `deletepublink`.
- Trash: `trash_list`, `trash_restore`.
- Misc: `userinfo`, `diff`, `extractarchive`, `getapiserver`, `currentserver`.


## Companion skills

Seven agent skills ship under `.agents/skills/` (tracked in-repo). They are auto-discovered by Claude Code, Kimi Code, and Codex when the repo is cloned:

| Skill | Purpose |
| --- | --- |
| `pcloud-cli` | Shell-level pCloud operations via the bundled `pcloud-cli.js` CLI |
| `pcloud-client` | Typed TypeScript/Bun client over the generated `pcloud-client.ts` module |
| `pcloud-types` | Full Zod-inferred input/output schema reference for all 37 tools |
| `pcloud-troubleshooting` | Error diagnosis, provenance probing, blocked-endpoint rungs |
| `pcloud-recovery` | Trash and revision recovery fallback ladder |
| `pcloud-sharing-security` | Public link capability matrix and credential hygiene |
| `pcloud-reorganize` | Bulk reorganization of files/folders between local disk and pCloud |

## Development

```sh
bun run typecheck   # tsc --noEmit
bun run build       # tsc → dist/
bun run test        # bun test
bun run lint        # eslint src/**/*.ts
bun run clean       # remove dist/
```

After any change to `src/core/tools/*` or `src/mcp/*`, run `bun run typecheck && bun run build && bun test && bun run lint`.

Regenerate the mcporter artifacts (CLI, types, client) with the commands in `AGENTS.md`. The pre-commit hook always rebuilds `pcloud.ts` and `pcloud-cli.js`; the emit-ts outputs in `generated/` are rebuilt only when `REGEN_ALL=1` is set. The CLI artifacts live at the repo root because the embedded stdio server command resolves its working directory relative to the script's own location, a bundle in a subdirectory cannot start the server.

> **Note:** With mcporter 0.15.0, the generated TypeScript client now typechecks correctly under strict TypeScript and all tools including zero-argument tools work properly. The known limitations of mcporter 0.7.3 have been resolved.

## Docker

```sh
docker build -t pcloud-mcp .
docker run --rm -i -e PCLOUD_ACCESS_TOKEN=... pcloud-mcp
```

> The Dockerfile uses `npm` (`npm ci`) for reproducibility; local development uses `bun`.

## Agent-facing rules

See [`AGENTS.md`](./AGENTS.md) for agent rules and [`docs/agent-surface.md`](./docs/agent-surface.md) for the launchpad-shaped agent surface (gotchas, best practices, examples).

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for the project history.

## License

MIT. See `LICENSE`.

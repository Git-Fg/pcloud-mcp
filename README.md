# pCloud MCP server

Local MCP server that exposes the pCloud HTTP/JSON API as 36 typed tools to any MCP client (Claude Code, Kimi Code, Cursor, etc.).

## Quick start

```sh
bun install
cp .env.example .env          # then fill in PCLOUD_ACCESS_TOKEN
bun run build                 # tsc → dist/
bun run dev                   # stdio transport
bun run dev:http              # http transport on http://127.0.0.1:3000
bun test                      # 58 unit + transport tests
bun run scripts/live-mcp-e2e.ts  # exercises the real pCloud API (needs the token)
```

## Documentation

- `AGENTS.md` — workspace-level rules, tool surface, pCloud quirks, regenerating mcporter artifacts.
- `references/pcloud-docs/` — full pCloud developer docs as markdown, one file per page.
- `references/pcloud-unresolved-notes.md` — known gaps in the surface (5 tools return `1000` for this account; root cause confirmed for the trash family only).
- `.agents/skills/pcloud-{cli,client,types}/SKILL.md` — workspace-local skills for the regenerated CLI and types.

## Transport

| Mode | How | When |
| --- | --- | --- |
| stdio (default) | `bun run dev` | Local Claude/Kimi/Cursor against this repo |
| HTTP | `MODE=http bun run dev` or `MODE=http node dist/index.js` | Sharing on the network — server refuses to bind a non-loopback address without `MCP_BEARER_TOKEN` |

The HTTP transport defaults to `127.0.0.1:3000` and enforces a DNS-rebinding host allowlist plus a CORS deny-by-default policy. See `src/mcp/http.ts` and its test file `src/mcp/http.test.ts` for the exact contract.

## Authentication

Non-OAuth. A static `PCLOUD_ACCESS_TOKEN` is read from env (per `.env.example`) and sent as the `?access_token=` query parameter per the pCloud HTTP/JSON protocol. `PCLOUD_ACCESS_ID` is the application/access id from the rclone token store — not a credential for this protocol. `PCLOUD_API_SERVER` defaults to `eapi.pcloud.com` (EU region).

## License

MIT.

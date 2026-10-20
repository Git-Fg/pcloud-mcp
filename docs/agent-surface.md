---
schema_version: 1
title: pCloud MCP Agent Surface
created: 2026-10-20
updated: 2026-10-20
type: concept
tags: [mcp, pcloud, agent-tools, claude-code, kimi-code]
sources:
  - https://docs.pcloud.com/methods/
  - https://github.com/modelcontextprotocol/typescript-sdk
  - src/core/tools/index.ts
confidence: high
fetchable_urls:
  - https://docs.pcloud.com/methods/
  - https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/README.md
---

# pCloud MCP Agent Surface

A typed MCP server exposing the pCloud HTTP/JSON API methods as tools for any MCP client (Claude Code, Kimi Code, Cursor, VS Code, etc.). Built with `@modelcontextprotocol/sdk` v2, TypeScript, and Bun. Tool count: `grep -c 'server.registerTool' src/core/tools/index.ts` (do not hardcode it).

## Gotchas

1. **Token provenance split — OAuth tokens rejected by trash endpoints** — `trash_list` and `trash_restore` return `1000 Log in required` for OAuth `access_token=` while legacy `/getauth` session tokens (`auth=`) work (confirmed for this account). `listrevisions`, `createuploadlink`, and `revertrevision` show the same `1000` symptom with an unconfirmed cause. No scope parameter exists to widen access. Source: [[docs/pcloud-notes]] (live-verified state) + rclone #3853.
2. **Referrer restriction on streaming/download links** — `getfilepublink`, `getfilelink`, `getvideolink`, `getaudiolink` return URLs restricted to `pcloud.com` referrer; embedded previews in third-party pages will fail. Source: [pCloud getfilepublink](https://docs.pcloud.com/methods/getfilepublink/).
3. **Pre-commit hook pins PATH to `node_modules/.bin`** — bare `mcporter` resolves to pnpm-global (stale 0.7.3) and clobbers artifacts; the hook uses `PATH="$PWD/node_modules/.bin:$PATH" mcporter generate-cli --server pcloud`. Source: `.git/hooks/pre-commit:5-7`.


## Best Practices

1. **Run the 4-command gate before any commit** — `bun run typecheck && bun run build && bun test && bun run lint` (all tests, 0 errors expected).
2. **Import `ToolMeta` from handlers** — each handler exports `{ title, description, annotations, inputSchema }`; `registerPcloudTools` loops and registers. Eliminates param drift permanently. See `src/core/tools/listfolder.ts` for the pattern.
3. **Full artifact regen requires `REGEN_ALL=1`** — the pre-commit hook regenerates `pcloud.ts` and `generated/pcloud-cli.js` by default; set `REGEN_ALL=1` to also rebuild `generated/pcloud-types.d.ts` and `generated/pcloud-client.ts`.
4. **Verify end-to-end with live token** — `bun run scripts/live-mcp-e2e.ts` (requires `PCLOUD_ACCESS_TOKEN`; creates temp folder + file, exercises upload/getfilelink/deletefile/deletefolderrecursive, cleans up).
5. **Use `bun install` locally; Docker uses `npm ci`** — lockfiles (`bun.lock`, `package-lock.json`) are both tracked for reproducibility.

## Examples

1. **Bootstrap and run stdio transport**
   ```sh
   bun install
   cp .env.example .env  # fill PCLOUD_ACCESS_TOKEN
   bun run build
   bun run dev
   ```
   Verification: `bun run typecheck && bun run build && bun test && bun run lint` → all pass, 0 fail.

2. **Add a new tool (handler + registration)**
   ```ts
   // src/core/tools/newtool.ts
   export const NewtoolInputSchema = z.object({ fileid: z.number() });
   export const NewtoolToolMeta: ToolMeta<typeof NewtoolInputSchema> = {
     title: 'New Tool',
     description: 'Does something.',
     annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
     inputSchema: NewtoolInputSchema,
   };
   export async function newtoolHandler(args: z.infer<typeof NewtoolInputSchema>) { ... }
   ```
   ```ts
   // src/core/tools/index.ts
   import { newtoolHandler, NewtoolToolMeta } from './newtool.js';
   // add to the tools array, then the existing loop registers it:
   { name: 'newtool', meta: NewtoolToolMeta, handler: newtoolHandler, outputSchema: OUTPUT_SCHEMA },
   ```
   Verification: gate passes; `grep -c server.registerTool src/core/tools/index.ts` increments.

3. **Full artifact regen**
   ```sh
   PATH="$PWD/node_modules/.bin:$PATH" mcporter generate-cli --server '{"name":"pcloud","command":{"kind":"stdio","command":"sh","args":["-c","if [ -f ./.env ]; then set -a; . ./.env; set +a; fi; exec bun run src/index.ts"],"cwd":"."},"description":"MCP server for pCloud"}' --output pcloud.ts
   bun build pcloud.ts --target=bun --outfile=generated/pcloud-cli.js --minify
   PATH="$PWD/node_modules/.bin:$PATH" mcporter emit-ts pcloud --config config/mcporter.json --mode types --out generated/pcloud-types.d.ts
   PATH="$PWD/node_modules/.bin:$PATH" mcporter emit-ts pcloud --config config/mcporter.json --mode client --out generated/pcloud-client.ts
   ```
   Verification: `bun run pcloud.ts --help` lists all tools; `generated/pcloud-cli.js` ≈ 1.28 MB (mcporter 0.15.0 output).

## See also

- [[README]] — human quickstart (install, env, run)
- [[CHANGELOG]] — project history
- [[src/core/tools/index.ts]] — SSOT for tool registrations
- [[docs/pcloud-notes.md]] — endpoint limitations & token provenance details
- [[.github/workflows/ci.yml]] — CI gate (typecheck/build/test/lint + tool-count drift check)
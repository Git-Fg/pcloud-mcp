---
name: pcloud-types
description: Full TypeScript type surface of the pCloud MCP server: Zod-inferred input/output schemas for every registered capability, the pCloud API response envelope, and the shared metadata/content type. Reference when writing new tools or clients that must match the server contract exactly. Enumerate the `tools` array in `src/core/tools/index.ts` for the live list.
---

# pCloud types

Type declarations generated from the pCloud MCP server's live schema. Located at `generated/pcloud-types.d.ts` (repo root); regenerate it per-developer with the commands in § Regeneration. The canonical Zod source is `src/core/tools/schemas.ts` (shared envelope + metadata + content types); per-capability schemas live in `src/core/tools/<capability>.ts`.

## When to use

- Writing new code that consumes the pCloud MCP server or its client.
- Checking exact field names / nullability of pCloud responses (metadata, content entries, quota).
- Building custom tools that must compose with the existing tool surface.

## Key types

- `PcloudTools` interface with one method per registered capability. Treat the *member names* as rot-prone (they rotate with the schema). The *capability shape* (input object, output promise, function semantics) is the durable contract. Enumerate `src/core/tools/index.ts` for the live bound.
- Each method returns `Promise<object>`; the concrete shapes are defined by the Zod schemas in `src/core/tools/*.ts`.
- `PcloudSuccess`: the JSON envelope (`{ result: 0, ... }`).
- `PcloudMetadata`: folder/file metadata (timestamps are RFC-822 strings; `isfolder` is a real boolean; `contents` lives nested inside `metadata` for the folder-listing capability).
- `PcloudFileItem`: an entry inside `metadata.contents`.

## Important schema facts (captured from the live API)

These describe the contracts the server validates; tool names appear only when the contract is capability-scoped to a single tool, otherwise they describe a *category* of tools.

- `isfolder` is `boolean` (not `0|1`).
- `modified` and `created` are RFC-822 (`"Sun, 07 Apr 2024 13:09:22 +0000"`).
- Folder listing puts `contents` INSIDE `metadata`, not at the top level. The handler also exposes a top-level alias for client convenience.
- The file-delete capability only accepts `fileid` or `path`; folders must go through the empty-folder-delete capability (folder must be empty) or the recursive-folder-delete capability (destructive).
- Trash-list items carry an extra `origparentfolderid` field on the metadata; `parentfolderid` is the position inside the trash.
- The sync-cursor capability returns `{ diffid, entries: [...] }` where each entry has `{ diffid, time, event, metadata? }`. Use `last=0` to fetch only the latest diffid.
- The pCloud streaming-text endpoint returns `result: 1000 Log in required` for non-web clients on many accounts; use the server's file-read capability (which does signed-link + HTTP fetch) instead.
- The anonymous-upload-link creation capability returns `{ uploadlinkid, link, mail, code }`; the `code` is the only credential the anonymous-upload-submit capability needs (no `access_token`).
- Server-side copy / folder-copy are independent: the new file/folder has a fresh id and modifying either source or copy never touches the other.
- Revert-revision does not take a flag for "save current as new revision": pCloud saves the current content as a new revision before reverting, so the state you revert away from stays recoverable as a revision.

## Notes

- All schema validation happens at runtime via Zod v4 in the server; these types are the compile-time mirror. If you edit a schema in `src/core/tools/`, regenerate.
- `outputSchema` for write tools uses `z.object({ result: z.literal(0) }).passthrough()`; the streamed file-read capability uses `z.object({}).passthrough()` because it does not return JSON; the folder-search capability returns `{ matches, scanned, truncated }` not the raw pCloud envelope; the server-side copy / revert-revision capabilities return `{ result: 0, metadata: {...} }` matching the pCloud docs.

- The local-to-cloud-upload and anonymous-upload-submit capabilities do not return a progress envelope: they emit `notifications/progress` over the MCP transport via `ctx.mcpReq.notify`. Consumers that want progress must subscribe through the MCP client.

## Companion skills

Read and apply `pcloud-troubleshooting` to diagnose a runtime failure, `pcloud-recovery` for trash and revision recovery, `pcloud-sharing-security` for link and credential hygiene, `pcloud-cli` for shell-level access, and `pcloud-client` for typed programmatic access.

## Regeneration

```bash
PATH="$PWD/node_modules/.bin:$PATH" mcporter emit-ts pcloud --config config/mcporter.json --mode types --out generated/pcloud-types.d.ts
PATH="$PWD/node_modules/.bin:$PATH" mcporter emit-ts pcloud --config config/mcporter.json --mode client --out generated/pcloud-client.ts
```

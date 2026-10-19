# Contributing

## Development setup

```sh
bun install
cp .env.example .env   # fill in PCLOUD_ACCESS_TOKEN
bun run build          # tsc → dist/
bun run dev            # stdio transport
bun run dev:http       # http transport on http://127.0.0.1:3000
```

## Before submitting

Run the full gate locally:

```sh
bun run typecheck && bun run build && bun test && bun run lint
```

All four must pass with zero errors.

## Regenerating artifacts

After any change to `src/core/tools/*` or `src/mcp/*`, regenerate the mcporter artifacts:

```sh
npx mcporter generate-cli --server pcloud
bun build pcloud.ts --target=bun --outfile=generated/pcloud-cli.js --minify
npx mcporter emit-ts pcloud --mode types --out generated/pcloud-types.d.ts
npx mcporter emit-ts pcloud --mode client --out generated/pcloud-client.ts
```

A local pre-commit hook (`.git/hooks/pre-commit`) regenerates `pcloud.ts` automatically when `src/` is newer. Set `REGEN_ALL=1` to also rebuild the `generated/` artifacts. Keep the workspace-local skills at `.agents/skills/pcloud-{cli,client,types}/SKILL.md` in sync with the tool count.

## Live verification

```sh
bun run scripts/live-mcp-e2e.ts   # requires PCLOUD_ACCESS_TOKEN; creates and cleans up a temp folder
```

## Pull requests

- Keep changes focused and atomic.
- Update `README.md` and `AGENTS.md` when the tool surface or transport contract changes.
- Update `docs/pcloud-notes.md` when a pCloud API quirk is confirmed or refuted.
## Workspace-local skills (gitignored)

The `.agents/skills/pcloud-{cli,client,types}/SKILL.md` files are gitignored and regenerated per-developer. After cloning, create them from the templates under `.agents/skills/` (or regenerate via the mcporter workflow above) so the tool counts stay in sync.

# Diff review: origin/main..HEAD

Scope: full diff between origin/main and HEAD (14 files). Verification: `bun run typecheck`, `bun run build`, `bun run lint`, `bun test` (84 pass, 0 fail); `bun run pcloud-cli.js --help` succeeds; hook syntax checked.

## Findings

### MEDIUM

1. `package.json:5`, description hardcodes "37 typed tools", contradicting the repo's own policy in `AGENTS.md:5` and `README.md:64` ("do not hardcode the count"). The CI drift check (`.github/workflows/ci.yml`) only scans `AGENTS.md`/`README.md`, so this field can silently drift. Fix: drop the number ("typed tools over the pCloud HTTP/JSON API").

2. `.githooks/pre-commit:11`, mcporter version mismatch is a warning, not a failure (`[ "$MCPORTER_VERSION" = "0.15.0" ] || echo "WARN..."`). A contributor on a different mcporter can regenerate `pcloud.ts`/`pcloud-cli.js` with divergent output and commit it. Fix: make the mismatch fail the hook (`|| { echo ...; exit 1; }`).

### LOW

3. `.gitignore`, after the move of the bundle to the repo root, a stale `generated/pcloud-cli.js` (legacy location) is not ignored; a leftover copy would show as untracked and could be committed. Fix: add `generated/pcloud-cli.js` to `.gitignore`.

4. `scripts/live-mcp-e2e.ts` (retry loops), per-attempt failures are logged but not counted; only the final outcome increments `fail`. A run that fails 4 times then succeeds reports a clean pass with no flakiness signal. Fix: track attempt counts / print a retry summary.

5. `.githooks/pre-commit:23`, `git add pcloud.ts pcloud-cli.js config/mcporter.gen.json` stages regenerated artifacts on every commit even when the commit did not touch the tool surface; can sweep in unrelated regenerated diffs. Fix: stage only when the inputs changed (or rely on the contributor to stage).

## Not findings (checked, clean)

- No leaked credentials or personal info in tracked files; `.env` is gitignored and absent from history; `pcloud.ts`/`pcloud-cli.js` contain no `/Users` paths.
- File move `generated/pcloud-cli.js` → `pcloud-cli.js` is consistently reflected in `package.json` `files`, `.githooks/pre-commit`, `AGENTS.md`, `README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `docs/agent-surface.md`, `CHANGELOG.md`; bundle runs from root.
- `.gitignore` correctly ignores the emit-ts outputs; `generated/` dir only carries gitignored per-developer files now.
- CI workflow present and runs typecheck/build/test/lint; tool-count drift check matches the 37-registration shape.
- e2e retry logic is sound (bounded 5 attempts, 1.5s spacing, outcome-only counting, cleanup via `deletefolderrecursive`).
- No conflict markers; no stale `generated/pcloud-cli` references in `src/`/`config/`/`scripts/`.

## Verdict

PASS-WITH-NITS (0 CRITICAL, 0 HIGH, 2 MEDIUM, 3 LOW).

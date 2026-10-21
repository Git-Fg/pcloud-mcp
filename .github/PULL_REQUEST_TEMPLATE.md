## Summary

<!-- One paragraph: what this PR does and why. -->

## Changes

<!-- Bullet list of every concrete change. Cite `path/to/file.ts:42` so reviewers
can jump straight to the diff. -->

## Verification

- [ ] `bun run typecheck` passes (0 errors)
- [ ] `bun run build` passes (0 errors)
- [ ] `bun test` passes (84 pass, 0 fail; new tests added if behavior changed)
- [ ] `bun run lint` passes (0 errors)
- [ ] `bun run scripts/live-mcp-e2e.ts` passes against the real pCloud API (if tool surface changed)
- [ ] After `src/core/tools/*` change: regenerated `pcloud.ts` and `pcloud-cli.js` (via pre-commit hook or `mcporter generate-cli`)
- [ ] After tool surface change: `AGENTS.md` "Tools registered" line + every `SKILL.md` mentioned in `README.md` is in sync
- [ ] No personal info leaks: grep tracked files for `/Users/`, real tokens, real email addresses

## Related

<!-- Link to the issue(s) this closes, or explain why no issue exists. -->

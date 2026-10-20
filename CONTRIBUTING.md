# Contributing

## Development setup

```sh
bun install
cp .env.example .env   # fill in PCLOUD_ACCESS_TOKEN
git config core.hooksPath .githooks   # enable the tracked pre-commit hook
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

After any change to `src/core/tools/*` or `src/mcp/*`, regenerate the mcporter artifacts. The tracked codegen definition is `config/mcporter.gen.json` (object-form command, repo-relative `cwd`); `config/mcporter.json` is the runtime config (string + args form) read by `emit-ts`. Both are repo-relative, so no host-specific values are needed:

```sh
PATH="$PWD/node_modules/.bin:$PATH" mcporter generate-cli --server config/mcporter.gen.json --output pcloud.ts
bun build pcloud.ts --target=bun --outfile=pcloud-cli.js --minify
PATH="$PWD/node_modules/.bin:$PATH" mcporter emit-ts pcloud --config config/mcporter.json --mode types --out generated/pcloud-types.d.ts
PATH="$PWD/node_modules/.bin:$PATH" mcporter emit-ts pcloud --config config/mcporter.json --mode client --out generated/pcloud-client.ts
```

A tracked pre-commit hook (`.githooks/pre-commit`, activated by `git config core.hooksPath .githooks`) regenerates `pcloud.ts` and `pcloud-cli.js` automatically; set `REGEN_ALL=1` to also rebuild the emit-ts outputs in `generated/`. The workspace-local skills at `.agents/skills/pcloud-{cli,client,types}/SKILL.md` are gitignored and regenerated per-developer; they are not present on a fresh clone.

## Dual-config watch

Upstream (`openclaw/mcporter`, npm `mcporter` 0.15.0 = latest as of 2026-10-20): the runtime config schema accepts `mcpServers.*.command` as **string or string[] only**: the object form dies in `readConfigFile` (Zod `invalid_union` at `mcpServers.pcloud.command`), so `emit-ts`/`list` cannot read `config/mcporter.gen.json`. `generate-cli --server <file>` accepts **both** shapes, but from the string form it resolves `cwd` against the config dir and bakes an absolute host path into `pcloud.ts`; only the object form keeps `cwd "."` (script-relative → host-path-free). No upstream issue covers this split (the old "#506" reference is bogus, that number does not exist; numbering stops at #456), and there is no roadmap file (`VISION.md` is principles only).

Verdict (2026-10-20): **maintain** the dual config, do not replace mcporter. Every alternative generator covers only the emit-ts half (mcp-typegen, mcp-client-gen, official SDK, hand-rolled emitter); the standalone commander-style CLI contract (`--key value`, `--raw`, root artifacts, bun bundle, pre-commit pin) is unique to mcporter. The hand-rolled emitter is the only true one-source end-state but its cost is rebuilding mcporter's CLI; revisit only if mcporter becomes unmaintained (0.15.0 shipped 2026-10-16, healthy). Collapse is half-unblocked already: `generate-cli` accepts the string-form config; the remaining blockers are (a) config schema accepting object-form `command`, or (b) `generate-cli` preserving relative `cwd` for string-form entries. Upstreaming a NEW issue with the two probes below is cheap and cheap to verify.

**Collapse condition, delete `config/mcporter.gen.json` only when, on the pinned mcporter version, ALL of these hold with `config/mcporter.json` as the single definition:**

1. `emit-ts` accepts the object form, **or** `generate-cli --server config/mcporter.json` embeds a relative `cwd` (no `/Users/…` in `pcloud.ts`, `__mcpRelativeStdioCwd` non-null).
2. Regenerated `pcloud.ts` / `pcloud-cli.js` diff touches only cwd lines, and the spawned server still starts (help lists every tool).

**Retest recipe** (from repo root; probe into /tmp until the gate flips):

```sh
M="$PWD/node_modules/.bin/mcporter"
"$M" emit-ts pcloud --config config/mcporter.gen.json --mode types --out /tmp/gen-probe.d.ts   # still ZodError?
"$M" generate-cli --server config/mcporter.json --output /tmp/str-probe.ts                     # exits 0?
grep -n '"cwd"' /tmp/str-probe.ts                                                            # absolute path = still blocked
# when the gate flips, regenerate for real from the surviving single config:
"$M" generate-cli --server config/mcporter.json --output pcloud.ts
git diff pcloud.ts                                                                            # cwd lines only
bun build pcloud.ts --target=bun --outfile=pcloud-cli.js --minify
bun run pcloud-cli.js --help                                                                  # commander --key value flags
bun run pcloud-cli.js checksumfile --fileid 1 --raw '{"probe":true}'                          # --raw passthrough (needs token)
"$M" list pcloud                                                                             # runtime reader still happy
bun run typecheck && bun run build && bun test && bun run lint
```

**If the gate passes, update first, then delete:** the regen commands in this file; the `AGENTS.md` "Regenerate mcporter artifacts" bullet; `docs/agent-surface.md` gotcha 3 and example 3; `.githooks/pre-commit` comment + `generate-cli --server` line; the `.gitignore` mcporter comment block, then `git rm config/mcporter.gen.json`.

Note: filing the upstream issue on `openclaw/mcporter` is a maintainer action; this host's global AGENTS.md policy forbids `gh issue create` against repos outside `Git-Fg/*` / `MiaouLeChat929/*`, so track it here with the upstream URL cited. Also retest on every mcporter version bump (the pre-commit 0.15.0 pin already warns).

## Live verification

```sh
bun run scripts/live-mcp-e2e.ts   # requires PCLOUD_ACCESS_TOKEN; creates and cleans up a temp folder
```

## Pull requests

- Keep changes focused and atomic.
- Update `README.md` and `AGENTS.md` when the tool surface or transport contract changes.
- Update `docs/pcloud-notes.md` when a pCloud API quirk is confirmed or refuted.

## Workspace-local skills (gitignored)

The `.agents/skills/pcloud-{cli,client,types}/SKILL.md` files are gitignored and are **not** present on a fresh clone. They are regenerated per-developer (via the mcporter workflow above or the local skill bootstrap); do not assume templates exist under `.agents/skills/`.

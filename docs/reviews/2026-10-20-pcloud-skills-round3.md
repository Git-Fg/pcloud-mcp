# Round-3 severity review: pCloud companion skills

Date: 2026-10-20
Scope: verify round-2 fixes against the actual files; hunt for defects the edits introduced.
Verdict: **PASS-WITH-NITS**

Counts: **0 CRITICAL / 0 HIGH / 2 MEDIUM / 4 LOW**

## Round-2 fix verification (all closed, file-evidenced)

- **M1**: `scripts/probe-provenance.sh:45-46` `api="${PCLOUD_API_SERVER:-eapi.pcloud.com}"`, `url="https://${api}/${method#/}"`; server parity confirmed at `src/core/http/pcloudClient.ts:112` (`baseUrl = https://${config.apiServer}`) and `src/core/config.ts` default `eapi.pcloud.com`.
- **M2**: `script:31` `readonly ALLOWED=(trash_list listrevisions stat resolve find userinfo listfolder listpublinks showuploadlink)`, guard `:32-43`, exit 2. Live-verified locally: `PCLOUD_ACCESS_TOKEN=x scripts/probe-provenance.sh createuploadlink` → `refusing to probe 'createuploadlink': it mutates account state.` + read-only list + `re-run with --allow-mutating …` → exit=2.
- **LOW-2**: `script:10-12` `read -srp "OAuth token: " PCLOUD_ACCESS_TOKEN; export PCLOUD_ACCESS_TOKEN` + "Never paste the token into a command line".
- **M3/M4**: `troubleshooting:48` has the imperative run instruction, env-only token, `PCLOUD_API_SERVER`, guard, and the "per-developer, rebuild from the three arms above" fallback.
- **M5**: `troubleshooting:36` enumerations `1001, 1002, 1004, 1005, 1013, 1016, 1035, 1037, 1040` and `2001, 2002, 2003, 2005, 2009, 2010` all cross-checked against `RESULT_HINTS` keys (`pcloudClient.ts`), every listed code present. `grep 1003` → absent ✓. 2004 excluded because table-covered (`:31`).
- **M7**: python scan: `pcloud-troubleshooting` U+2014=0 and U+2013=0; recovery=0, sharing=0, probe script=0.
- **LOW-3**: `troubleshooting:50` states `extractarchiveprogress` "is a pCloud API method this server does not register as a tool".
- **M6**: `sharing:36` contains the rewritten "never pass it as a command-line argument (it lands in shell history); hand it to tools through the environment or a stdin config instead."
- **LOW-1**: `recovery:28` and `recovery:34` are imperative "read and apply `pcloud-troubleshooting`…".
- **LOW-4**: `types:35` softened to match `recovery:27` ("pCloud saves the current content as a new revision before reverting").
- **Descriptions**: troubleshooting 45 words / recovery 48 / sharing 40, all start "Load when".
- **deleteuploadlink correction** (the one thing to check hardest), pCloud **does** ship both methods:
  - `deleteuploadlink` ([docs](https://docs.pcloud.com/methods/upload_links/deleteuploadlink.html)): "Deletes upload link identified by `uploadlinkid`", required param `uploadlinkid`, error list includes 1036/2040.
  - `listuploadlinks` ([docs](https://docs.pcloud.com/methods/upload_links/listuploadlinks.html)): output `uploadlinks[]` with `uploadlinkid`, a genuinely separate family from `listpublinks` (output `publinks[]` with `linkid`).
  - `grep -rni "uploadlink\|deletepublink"` over `src/`, `generated/`, `pcloud.ts` → **0 occurrences** of `deleteuploadlink` or `listuploadlinks`. **37-tool count confirmed** via `grep -c "{ name: '" src/core/tools/index.ts` → 37.
  - `deletepublink` docs confirm `linkid` param and error 2027; the two families are disjoint. `sharing:26` and `sharing:36` are therefore **factually correct**. No HIGH.

Residual findings below.

## MEDIUM

### M-A: `showuploadlink` is on the read-only allowlist but the server declares it a mutation tool

Evidence:
- `scripts/probe-provenance.sh:31` `readonly ALLOWED=(trash_list … listpublinks showuploadlink)`; `script:14-15` comment reads "Only read-only methods are allowed by default (trash_list, …, showuploadlink)."
- `src/core/tools/showuploadlink.ts:8-11` input schema exposes `expire` / `deleteexpire` / `maxspace` / `maxfiles`; `:50-54` forward those params; `:31` annotations `readOnlyHint: false, idempotentHint: false`.
- pCloud's own doc: showuploadlink "Modify upload link identified by uploadlinkid. Options that, could be changed include: Expiration date / Space of the upload link / Files of the upload link." ([docs](https://docs.pcloud.com/methods/upload_links/showuploadlink.html))
- `troubleshooting:48` claims the probe "refuses mutating methods unless you pass `--allow-mutating`".
- Live probe (read-only): `PCLOUD_ACCESS_TOKEN=dummy scripts/probe-provenance.sh showuploadlink uploadlinkid=1 expire=1000000000`, **not refused**; guard passes, curls through.

Wrong claim: the guard "refuses mutating methods" when a listed method plus a mutation param (`expire`, `deleteexpire`, `maxspace`, `maxfiles`) mutates a live upload drop. Minimum fix: drop `showuploadlink` from `ALLOWED` (and from the `script:14-15` list) or narrow the guard to inspect mutation params when the method is `showuploadlink`; also rewrite `troubleshooting:48` to "refuses methods not on a read-only allowlist".

### M-B: the new API fact is absent from `docs/pcloud-notes.md`, the designated SSOT

- `AGENTS.md:3` "API quirks, token provenance, and endpoint limitations live in `docs/pcloud-notes.md`. Read it before asserting anything about pCloud behavior."
- `docs/pcloud-notes.md` (23 lines, tracked in git; `grep -n uploadlink deletepublink` returns only 3 hits at lines 7, 10, 16, none concerning the upload-link vs public-link family split) records: the 1000-provenance family, `deletepublink` 2027, referrer restriction, `extractarchiveprogress` 1000-block, `getthumblink` preconditions, nothing about `listuploadlinks` / `deleteuploadlink`.
- The claim currently lives **only** in `.agents/skills/pcloud-sharing-security/SKILL.md:26` and `:36`, and `.agents/` is gitignored (verified `git check-ignore -v .agents/…` → matched on `.gitignore:7`).
- Consequence: a fresh clone has no committed record of the fact; an agent reading the SSOT first (per `AGENTS.md:3`) gets no support for it and may contradict it.

Minimum fix: add a bullet under "Other endpoint quirks" in `docs/pcloud-notes.md` such as: "Upload links (`createuploadlink`, `uploadtolink`) live in pCloud's separate `upload_links` family (`listuploadlinks`, `deleteuploadlink` keyed by `uploadlinkid`), which this server does not expose; `listpublinks` returns only the public-download family (`deletepublink` keyed by `linkid`). Closes a drop via `showuploadlink expire=<past>` or via the pCloud web UI."

## LOW

### L-1: the probe script is untracked, not gitignored, "gitignored by design" is false

- `.gitignore` contents: `node_modules/ .mcp.json dist/ .env *.log .DS_Store .agents/ references/ .mcp.json.local .kimi-code/ config/mcporter.json`, **no `scripts/` entry**.
- `git status --short scripts/` → `?? scripts/probe-provenance.sh`.
- `git check-ignore -v scripts/probe-provenance.sh` → exit 1 (not ignored).
- `git ls-files scripts/` → only `fetch_pcloud_docs.py` and `live-mcp-e2e.ts` are tracked; the probe is not.
- `AGENTS.md:10` already cites `bun run scripts/live-mcp-e2e.ts`, i.e. `scripts/` is a tracked convention directory.
- Consequence: `troubleshooting:48` "ships alongside this gitignored skill as a workspace-local, per-developer file" implies parity; actually the skill (`.agents/`) is gitignored and the script is not. `git clean -fd` removes it; `git status` flags it.

Minimum fix: add `scripts/probe-provenance.sh` to `.gitignore` (one line), or commit it (it contains no secrets, the token arrives via stdin-config).

### L-2: usage synopsis omits the `--allow-mutating` flag

- `script:11` "Usage: … `scripts/probe-provenance.sh [method] [extra GET params...]`".
- `script:16-17` documents the flag; `troubleshooting:48` uses it.

Minimum fix: rewrite the synopsis to `[--allow-mutating] [method] [extra GET params...]`.

### L-3: past-`expire` close-a-drop path is untested; the 7004 mapping is documented-confirmed

- `sharing:36` "set `expire` to a moment that has passed; `uploadtolink` then refuses the link with the expired-link code".
- `RESULT_HINTS` `pcloudClient.ts:60` `7004: 'This link has expired (uploadtolink).'`, mapping confirmed.
- [pCloud's `uploadtolink` docs](https://docs.pcloud.com/methods/upload_links/uploadtolink.html) list 7004 as "This link has expired." ✓
- [pCloud's datetime docs](https://docs.pcloud.com/structures/datetime.html) accept ISO 8601, RFC 2822, unix timestamp, `YYYYMMDDhhmmss`, so a past `expire` is representable; **acceptance of a past-dated value was never live-tested**. The user's round-2 smoke covered only `trash_list` and the guard refusal.

Minimum fix: leave as-is and note in `docs/pcloud-notes.md` (alongside M-B's bullet) that "past-dated `expire` on `showuploadlink` closes a drop (7004 on subsequent `uploadtolink`); mechanism not live-verified."

### L-4: `pcloud-types:8` hardcodes the author's machine path

- `types:8` "Located at `generated/pcloud-types.d.ts`."
- Pre-existing (round 2 did not introduce it; not raised in round 1 either). The file is regenerated per-developer on other checkouts where the workspace lives elsewhere.

Minimum fix: "Located at `generated/pcloud-types.d.ts` (repo root), regenerated per-developer via the commands in §Regeneration."

## Not raised (pre-existing / settled, per user direction)

- Em-dashes in `pcloud-types` (5), `pcloud-cli` (16 em, 3 en), `pcloud-client` (26 em, 2 en), sibling generated files, not in round-2 scope.
- Sibling descriptions not opening with "Load when": cli 67 words, client 39, types 41.
- `version: 1.0.0` frontmatter in the three new skills, deliberate, no concrete harm flagged.
- Round-1 **L1** rename to gerunds, rejected.
- User's smoke run (trash_list arm1=1000, arm2=2000, arm3 skipped, exit 0) not independently reproduced, the review environment does not hold a live token.

## Path-citation audit (shipped-surface)

The workspace-path shape cited in the new skills is `scripts/probe-provenance.sh` (`troubleshooting:48`, run contract). It is **co-shipped with the skill in the same workspace**: and falls under the "co-shipped script's own path" carve-out; not a finding. (See L-1 for the actual defect: gitignored-state mismatch, which is a `.gitignore` concern, not a citation concern.)

---
name: pcloud-troubleshooting
version: 1.0.0
author: Felix (pCloud MCP workspace)
license: MIT
description: "Load when a pCloud MCP tool errors, returns a non-zero result code, or the MCP server itself fails to start. Diagnoses failures via a result-code taxonomy and the token-provenance probe. Do NOT use for trash/revision recovery workflows or link/sharing setup; those have dedicated companion skills."
---

# pCloud troubleshooting

Decision-tree diagnostics for pCloud MCP and API failures. The pCloud HTTP/JSON API returns `{ result: <int> }` where non-zero is an error; most failures fall into one of a handful of classes, and picking the wrong class wastes the most time.

## When to Use

Load when any pCloud tool call fails, returns an unexpected result code, or an MCP client reports that the pcloud server could not spawn or closed its connection. The skill gives the agent a diagnosis order: transport first, then result code, then token provenance, before ever assuming the tool is broken.

## Diagnosis order

1. **Transport failures are not API failures.** An MCP client message like `spawn ... ENOENT` means the registered command path does not exist (stale config after a runtime upgrade or a moved bundle); `MCP error -32000: Connection closed` means the server process exited at startup, usually a missing `PCLOUD_ACCESS_TOKEN`, a corrupt bundle, or a runtime mismatch. Verify the command path resolves and the process starts manually before touching the API layer.
2. **Read the result code** from the error envelope. Classify with the taxonomy below.
3. **If the code is 1000, run the token-provenance probe** (see below) before blaming the tool or the token itself.

## Result-code taxonomy

The server's error envelope already appends an actionable hint for every code it knows (`RESULT_HINTS` in `src/core/http/pcloudClient.ts`), so read that hint first. This table only covers the codes where the *next move* is a judgment call.

| Code | Meaning | Judgment call |
|---|---|---|
| 1000 | Log in required | Run the token-provenance probe (below); do NOT regenerate the token yet |
| 2000 | Login failed | Token invalid; re-provision outside this surface |
| 2004 | Destination already exists | Not a failure for `createfolderifnotexists`; otherwise pick another name or allow overwrite |
| 2027 | Unknown or already deleted public link | Treat as already-done only when the `linkid` came from `listpublinks` |
| 4000 | Too many login tries from this IP | Back off; per-IP lockout with no published duration |
| 7004 / 7007 / 7008 | Upload-link expired / space limit / file limit | Inspect or recreate the link via `showuploadlink` |

Argument-shape codes (1001, 1002, 1004, 1005, 1013, 1016, 1035, 1037, 1040) and path/permission codes (2001, 2002, 2003, 2005, 2009, 2010) are self-describing in the hint: fix the call arguments or re-`resolve` the path. 1017 / 1018 are a general invalid-`folderid` / invalid-`fileid` pair; Zod rejects a missing id client-side before the API is reached, so seeing these means the id was present but wrong. 1014 / 1015 are `getthumblink`'s type and size preconditions.

## The 1000 token-provenance family

pCloud silently distinguishes token *provenance*: OAuth tokens sent as `access_token=` are rejected by some endpoint families while legacy `/getauth` session tokens sent as `auth=` are accepted, with no scope difference to explain it. This is an undocumented pCloud behavior, independently reproduced in rclone's issue tracker.

Probe before asserting anything. Read the token into a shell variable so it never enters argv or the transcript, then replay the failing request with three arms:

1. the OAuth token as `access_token=`, the arm the MCP server already uses.
2. the *same* OAuth token as `auth=`, which isolates routing on the parameter *name*.
3. a legacy `/getauth` session token as `auth=`, which isolates token *provenance*.

Only arm 3 succeeding establishes a provenance restriction for the account; arm 2 succeeding means the endpoint routes on the parameter name rather than the token's origin; arm 1 succeeding means the original failure was transient or argument-level, not auth. From the workspace root, run `scripts/probe-provenance.sh [--allow-mutating] <method> [extra params]`. It reads `PCLOUD_ACCESS_TOKEN` from the environment and hands it to curl through a stdin config, so the token never enters argv, `ps`, or this transcript; it targets `PCLOUD_API_SERVER` (default `eapi.pcloud.com`) exactly as the server does; and it refuses any method not on its read-only allowlist unless you pass `--allow-mutating` before the method, since off-list methods such as `showuploadlink` or `createuploadlink` would otherwise change real account state. The script ships in the repo's `scripts/` directory; when it is absent from your checkout, rebuild it from the three arms above.

The trash family (`trash_list`, `trash_restore`) is confirmed provenance-restricted. For `listrevisions`, `createuploadlink`, and `revertrevision` the same 1000 symptom is observed with an unconfirmed cause: a file with no revision history also produces 1000 from `listrevisions`. `extractarchiveprogress` is separately confirmed 1000-blocked for OAuth tokens; it is a pCloud API method this server does not register as a tool. Treat provenance as a hypothesis for the unconfirmed three and read the workspace's pCloud API notes, `docs/pcloud-notes.md`, which owns the live-verified state of this question.

## Fallback for confirmed-blocked endpoints

When the probe confirms a 1000 provenance block: stop retrying through the MCP layer (retries only burn rate limit), tell the user the endpoint is blocked for OAuth tokens on this account, and route them to the pCloud web UI, where trash and version-history operations are self-service.

No auth mode currently unblocks the endpoint inside this surface: the server's config module reads `PCLOUD_ACCESS_TOKEN` only and always sends it as the `access_token` query parameter, so there is nothing to switch to. The tool stays registered because the API method itself works; it is the credential the server can supply that does not.

## Companion skills

Read and apply `pcloud-recovery` for trash and revision recovery, `pcloud-sharing-security` for link and credential hygiene, and `pcloud-cli` or `pcloud-client` for exact tool signatures.

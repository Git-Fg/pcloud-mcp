---
name: pcloud-recovery
version: 1.0.0
author: Felix (pCloud MCP workspace)
license: MIT
description: "Load when the user lost a pCloud file, wants an old version back, or asks whether a delete can be undone. Covers trash restore and file-revision revert workflows, plus the fallback ladder for endpoints blocked to OAuth tokens. Do NOT use for generic error diagnosis or link/sharing setup."
---

# pCloud recovery

Trash and file-revision recovery workflows for pCloud. Data-loss recovery is the highest-stakes consumer workflow in this MCP surface, so getting the workflow right matters more than anywhere else.

## When to Use

Load when the user reports a deleted pCloud file or folder, asks "can this be undone", wants to see or restore an older version of a file, or when a `trash_*` or revision tool returns a non-zero result. The skill walks the trash and revision ladders and, when the API path is blocked, degrades to a concrete fallback instead of dead-ending.

## Trash workflow

1. `trash_list` lists trashed items. Read `origparentfolderid` on each item: it is where the item came from. `parentfolderid` is only the item's position inside the trash, so routing a restore from `parentfolderid` puts files in the wrong place.
2. `trash_restore` by `fileid` or `folderid`. Pass `restoreto` to choose a destination; omit it to send the item back to its original parent.
3. `trash_restore` with `folderid=0` restores the entire trash. Confirm with the user before using it: it is broad and mixes items from many origins into one destination.
4. Restoring onto the trash itself is rejected (the restore-target-is-trash error); pick a real destination folder.

## Revision workflow

1. `listrevisions` returns the version history of a file, newest first, each with a `revisionid`.
2. `revertrevision` targets a `revisionid`. pCloud saves the current content as a new revision before reverting, so the state you reverted away from stays recoverable as a revision; no flag controls this. Confirm the outcome with `listrevisions` after a revert rather than assuming it landed.
3. An unknown `revisionid` returns the file-not-found code, and a file with no revision history can produce a login-required code (the empty-history and provenance-block cases are indistinguishable from the error alone; read and apply `pcloud-troubleshooting` for the probe that separates them).

## Blocked-endpoint fallback ladder

The trash endpoint family is known to reject OAuth `access_token` auth on some accounts, returning a login-required code; `listrevisions` and `revertrevision` show the same symptom with an unconfirmed cause. When that symptom appears, walk the ladder in order:

1. Read and apply `pcloud-troubleshooting` and run its provenance probe before concluding anything; do not burn retries through the MCP layer on an endpoint that is proven blocked.
2. If a legacy `/getauth` session token is available, the same calls succeed with it. The MCP server implements no session-token mode (it reads only `PCLOUD_ACCESS_TOKEN`), so this rung means calling the API outside the surface; if no session token exists, the rung is closed.
3. Route the user to the pCloud web UI: trash browsing/restore and version history are fully self-service there, with the same account.
4. If the pCloud desktop client is installed, its trash view is a second self-service path.

The honest summary for the user: for an account whose trash family is provenance-blocked, the MCP surface can *inspect* intent and plan the recovery, but the restoring call happens in the web UI. Say so early rather than after three failed calls.

## Companion skills

Read and apply `pcloud-troubleshooting` for error diagnosis and the result-code taxonomy, and `pcloud-sharing-security` for link and credential hygiene.

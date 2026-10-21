---
name: pcloud-sharing-security
version: 1.0.0
author: Felix (pCloud MCP workspace)
license: MIT
description: "Load when creating or managing pCloud public file and folder links, anonymous upload links, or when handling the PCLOUD_ACCESS_TOKEN credential. Covers the link capability matrix, referrer restrictions, and token hygiene. Do NOT use for trash/revision recovery or generic error diagnosis."
---

# pCloud sharing and security

Public-link and upload-link workflows plus credential hygiene for the pCloud MCP surface. Two footguns dominate this area: links whose URLs silently do not work outside pCloud's own pages, and credentials that are one careless echo away from a leak.

## When to Use

Load when the user wants to share a pCloud file or folder publicly, wire up an anonymous upload drop, revoke or audit existing links, or when the agent is about to handle `PCLOUD_ACCESS_TOKEN` in any script, config, or transcript. The skill provides the capability matrix and the safety rules that keep shares and credentials correct.

## Link capability matrix

| Tool | Purpose | Constraints available | Credential model |
|---|---|---|---|
| `getfilepublink` | Public download link for one file | `expire`, `maxdownloads`, `maxtraffic`, `linkpassword`, `shortlink` | The URL itself |
| `getfolderpublink` | Public link to a folder's contents | same set as file links | The URL itself |
| `createuploadlink` | Anonymous upload destination | `expire`, `maxspace`, `maxfiles`; `comment` is required | Returns `uploadlinkid`, `link`, `mail`, and `code` |
| `uploadtolink` | Upload into a link created above | `filename` override, `nopartial` | The link `code` IS the credential; no account token is sent |

Lifecycle companions: `listpublinks` audits the account's public download links (upload links belong to a separate `listuploadlinks` family this server does not expose, so a drop will not show up there); `showuploadlink` inspects or mutates an upload link's expiry and caps in one call (pass `deleteexpire` to clear an expiry, zero to remove a cap); `deletepublink` revokes a download link by `linkid` and returns an unknown-link error for an already-gone id. Treat that error as already-done only when the `linkid` came from `listpublinks`; otherwise re-list to confirm the link is gone rather than assuming the revocation succeeded.

This surface is link-based only. User-to-user shares (account-to-account folder collaboration) are not exposed as tools here, so such a request has no in-surface answer and belongs in the pCloud web UI.

## The referrer restriction footgun

Download and streaming URLs returned by `getfilepublink`, `getfilelink`, `getvideolink`, and `getaudiolink` are referrer-restricted to pCloud's own domain. A link that works perfectly when pasted into a browser will return an error when embedded in a third-party page, hotlinked from a blog, or fetched through a proxy that sets a foreign `Referer`. Verify the consuming context before promising a link works there; for programmatic access to content, prefer the server's own read tools over hand-passing URLs between systems.

## Upload-link credential model

The `code` returned by `createuploadlink` is a bearer credential: anyone holding it can upload into the target folder until an expiry or cap stops it. Treat it like a password: never echo it into shared transcripts or committed configs, never pass it as a command-line argument (it lands in shell history), and hand it to tools through the environment or a stdin config instead. This surface has no upload-link revocation tool: pCloud's `deleteuploadlink` method takes an `uploadlinkid` and is not registered here, so closing a drop means expiring it with `showuploadlink` (set `expire` to a moment that has passed; `uploadtolink` then refuses the link with the expired-link code) using the `uploadlinkid` returned at creation, or revoking it in the pCloud web UI. A public *download* link and an *upload* link are different grants; do not describe one as the other.

## Token hygiene

`PCLOUD_ACCESS_TOKEN` is a long-lived bearer token for the whole account. The rules that keep it contained: read it from the environment, never print it (including in debug logs or error messages), never inline it into files that get committed or shared, and prefer the server's env-var contract over per-call passing so the token appears in the fewest places. pCloud access tokens do not expire on their own, so a leaked token stays valid until manually revoked in the account dashboard.

## Untrusted-name awareness

pCloud folder and file names are attacker-controlled input: a shared folder can literally be named `..`. When composing paths from names that arrived via a share, an upload link, or another user, treat every component as untrusted; prefer numeric `fileid`/`folderid` addressing (via the resolve tool) over path concatenation wherever the tools allow it.

## Companion skills

Read and apply `pcloud-troubleshooting` for error diagnosis, `pcloud-recovery` for trash and revision recovery, and `pcloud-cli` or `pcloud-client` for exact tool signatures.

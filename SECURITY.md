# Security Policy

## Supported versions

Only the latest commit on `main` is supported. There are no long-term support branches.

## Reporting a vulnerability

This is a public repository. If you believe you have found a security vulnerability, please report it privately rather than opening a public issue:

- **Preferred:** open a private security advisory at https://github.com/Git-Fg/pcloud-mcp/security/advisories/new
- **Alternative:** contact the maintainer on GitHub at https://github.com/Git-Fg (user `@Git-Fg`) with a description, reproduction steps, and impact assessment.

Please do **not** include live `PCLOUD_ACCESS_TOKEN` values, session tokens, or `.env` contents in any report. Redact credentials before sharing.

## Sensitive data

- `PCLOUD_ACCESS_TOKEN` is a static credential sent as a query parameter per the pCloud HTTP/JSON protocol. Treat it like a password.
- The HTTP transport refuses to bind a non-loopback address without `MCP_BEARER_TOKEN`.
- The generated CLI artifacts (`pcloud.ts`, `pcloud-cli.js`) contain no secrets; they are safe to commit.

## pCloud-specific security gotchas

- **Token provenance split**: pCloud silently rejects OAuth `access_token=` tokens on the trash family (`trash_list`, `trash_restore`); only legacy `/getauth` session tokens (`auth=`) work there. `listrevisions`, `createuploadlink`, and `revertrevision` show the same `1000` symptom with an unconfirmed cause (see `docs/pcloud-notes.md`, which owns the live-verified state). No OAuth scope parameter exists to widen access. Source: [pCloud API docs](https://docs.pcloud.com/methods/trash_list/) + rclone #3853.
- **Referrer restriction**: URLs returned by `getfilepublink`, `getfilelink`, `getvideolink`, and `getaudiolink` are restricted to `pcloud.com` referrer; embedding them in third-party pages will fail. Source: [pCloud getfilepublink](https://docs.pcloud.com/methods/getfilepublink/).
- **Upload link codes are credentials**: `uploadtolink` authenticates by the link code only; anyone with the code can upload files to the destination folder. Treat codes as secrets.
- **Signed download URLs**: `getfilelink` deliberately returns the short-lived, token-scoped download URL to the client; treat any transcript or log it lands in as sensitive for the URL's lifetime. `readfile` is the alternative that streams content without surfacing the signed URL.

## Unauthenticated endpoints

The `/health` endpoint returns `{ status: "ok", service: "pcloud-mcp" }` without authentication. It is intentionally minimal (no account or filesystem data) so it can serve as a liveness probe. If you bind to a non-loopback address, be aware that `/health` is reachable without a bearer token; gate it behind a reverse proxy if that matters for your deployment.

## Response

The maintainer will acknowledge reports within a reasonable time and coordinate a fix and disclosure. There is no bug bounty program.

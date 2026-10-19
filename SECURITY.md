# Security Policy

## Supported versions

Only the latest commit on `main` is supported. There are no long-term support branches.

## Reporting a vulnerability

This is a private repository. If you believe you have found a security vulnerability, please report it privately rather than opening a public issue:

- **Preferred:** open a private security advisory at https://github.com/Git-Fg/pcloud-mcp/security/advisories/new
- **Alternative:** contact the maintainer on GitHub at https://github.com/Git-Fg (user `@Git-Fg`) with a description, reproduction steps, and impact assessment.

Please do **not** include live `PCLOUD_ACCESS_TOKEN` values, session tokens, or `.env` contents in any report. Redact credentials before sharing.

## Sensitive data

- `PCLOUD_ACCESS_TOKEN` is a static credential sent as a query parameter per the pCloud HTTP/JSON protocol. Treat it like a password.
- The HTTP transport refuses to bind a non-loopback address without `MCP_BEARER_TOKEN`.
- The generated CLI (`pcloud.ts`) and `generated/` artifacts contain no secrets; they are safe to commit.

## Unauthenticated endpoints

The `/health` endpoint returns `{ status: "ok", service: "pcloud-mcp" }` without authentication. It is intentionally minimal (no account or filesystem data) so it can serve as a liveness probe. If you bind to a non-loopback address, be aware that `/health` is reachable without a bearer token; gate it behind a reverse proxy if that matters for your deployment.

## Response

The maintainer will acknowledge reports within a reasonable time and coordinate a fix and disclosure. There is no bug bounty program.
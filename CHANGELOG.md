# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Upgrade mcporter from ^0.7.3 to ^0.15.0, fixing all known defects in the generated client:
  - Zero-arg tools like userinfo() no longer throw 'Too many positional arguments'
  - Generated .d.ts is valid TypeScript with proper optional parameters
  - Hidden optional params are properly omitted by default but can be included with --include-optional flag
- Regenerate all mcporter artifacts with the new version

### Changed

- Clean repository layout with a full README, AGENTS.md, and MIT `LICENSE`.
- `docs/pcloud-notes.md` documenting pCloud endpoint limitations and access-token provenance.
- Local pre-commit hook that regenerates `pcloud.ts` before each commit.
- Generated mcporter artifacts tracked as build artifacts: the CLI (`pcloud.ts` → `generated/pcloud-cli.js`), TypeScript client (`generated/pcloud-client.ts`, `generated/pcloud-client.d.ts`), and type definitions (`generated/pcloud-types.d.ts`).
- `SECURITY.md` with vulnerability reporting guidance and supported versions.
- `CONTRIBUTING.md` with the development workflow and contribution guidelines.
- CI workflow running typecheck, build, tests, and lint.
- `bun.lock` tracked in version control for reproducible installs.
- Environment-variable table in the README.
- Vendored pCloud API reference documentation replaced by the focused `docs/pcloud-notes.md`.
- `.mcp.json` is now gitignored; `.mcp.json.example` ships as the template.
- README Docker note clarified: the Dockerfile uses npm for reproducibility while local development uses Bun.

### Fixed

- Environment documentation gaps and example configs, following the self-critique review.

### Removed

- Vendored `references/pcloud-docs/` tree and `references/pcloud-unresolved-notes.md`.

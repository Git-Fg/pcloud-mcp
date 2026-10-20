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
- Local pre-commit hook that regenerates `pcloud.ts` and `pcloud-cli.js` before each commit.
- Generated mcporter artifacts tracked as build artifacts at the repo root: the CLI (`pcloud.ts` → `pcloud-cli.js`). The emit-ts outputs (`generated/pcloud-client.ts`, `generated/pcloud-client.d.ts`, `generated/pcloud-types.d.ts`) are gitignored and rebuilt with `REGEN_ALL=1`.
- `SECURITY.md` with vulnerability reporting guidance and supported versions.
- `CONTRIBUTING.md` with the development workflow and contribution guidelines.
- CI workflow running typecheck, build, tests, and lint.
- `bun.lock` tracked in version control for reproducible installs.
- Environment-variable table in the README.
- Vendored pCloud API reference documentation replaced by the focused `docs/pcloud-notes.md`.
- `.mcp.json` is now gitignored; `.mcp.json.example` ships as the template.
- README Docker note clarified: the Dockerfile uses npm for reproducibility while local development uses Bun.

### Fixed

- Bundled CLI (`pcloud-cli.js`) could not make any real call when placed in `generated/`: the embedded stdio server command spawns `bun run src/index.ts` with a cwd resolved relative to the script's own directory, so a subdirectory bundle started the server in `generated/` and died with "Module not found". The bundle now lives at the repo root next to `pcloud.ts`.
- Environment documentation gaps and example configs, following the self-critique review.

### Removed

- Vendored `references/pcloud-docs/` tree and `references/pcloud-unresolved-notes.md`.

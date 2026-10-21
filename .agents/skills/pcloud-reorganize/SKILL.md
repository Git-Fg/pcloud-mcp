---
name: pcloud-reorganize
description: "Plan and execute bulk reorganization of files between local disk and pCloud: scan, classify, archive, deduplicate, and restructure folder trees locally and remotely. Load when the user wants to tidy, migrate, or archive large folder collections, compare local vs pCloud trees, or move stale projects to cloud storage. Do NOT use for single-file upload/download or link sharing; use pcloud-cli or pcloud-sharing-security for those."
---

# pcloud-reorganize

Skill for bulk reorganization of files and folders between local disk and pCloud cloud storage. Covers scanning, classification, archiving, deduplication, and restructuring of folder trees on both sides.

## When to use

- User wants to clean up, migrate, or archive large collections of local folders
- Comparing local directory trees with pCloud folder structures
- Moving stale projects (>6 months untouched) to cloud storage
- Unzipping and reclassifying course/media/data bundles into pCloud
- Identifying duplicate or redundant files across local and remote

## When NOT to use

- Single-file upload/download (use `pcloud-cli`)
- Link sharing or credential handling (use `pcloud-sharing-security`)
- Error diagnosis or blocked endpoints (use `pcloud-troubleshooting`)
- Trash/revision recovery (use `pcloud-recovery`)

## Workflow: local-to-pCloud reorganization

### Phase 1: Scan

1. List top-level folders with sizes: `du -sh ~/Documents/*/ | sort -rh`
2. Identify candidates by age: `find ~/Documents -maxdepth 2 -type d -mtime +180`
3. Classify each folder:
   - **Git repo with remote**: sync (push/pull), then move to `~/GitHub/`
   - **Git repo without remote**: commit locally, archive as tar.gz to pCloud
   - **Upstream clone (no local changes)**: delete (re-clone if needed)
   - **Non-git folder, >6 months old**: archive as tar.gz to pCloud
   - **Non-git folder, recent**: keep locally
   - **Media/data >50 MB, old**: archive directly (not tar.gz) to pCloud

### Phase 2: Classify and prepare

- For git repos: resolve conflicts with upstream first (`git fetch && git status`)
- For non-git folders: create tar.gz in /tmp/ before upload
- For course bundles (zip/7z): unzip locally, classify by subject, upload individually
- For game files (.cia, .nds, .3ds): trash directly (not archivable value)
- For build artifacts (node_modules, target/, dist/): trash (rebuildable)

### Phase 3: Upload to pCloud

Organize into `/Archive/{Code,Documents,Media,Data}/`:

| Category | Contents | pCloud path |
|---|---|---|
| Code | Git repos, MCP servers, scripts, web apps | `/Archive/Code/` |
| Documents | PDFs, course notes, research papers | `/Archive/Documents/` |
| Media | Audio, video, soundfonts, images | `/Archive/Media/` |
| Data | Databases, RDF, CSV, XML dumps | `/Archive/Data/` |
| Secure | Credentials, tokens, sensitive files | `/_secure/` |

Upload rules:
- Use `pcloud-cli` or MCP `uploadfile` for files <100 MB
- Use curl with `--max-time 300` for files >100 MB (MCP tool times out at ~34s)
- Verify upload by listing the destination folder after upload
- Delete local tarball from /tmp/ only after confirmed upload

### Phase 4: Clean up local

- Delete archived folders from ~/Documents/ (use `trash`, never `rm -rf`)
- Move active git repos to `~/GitHub/` or `~/dev/`
- Clean /tmp/ of all tarballs and scratch files
- Empty ~/.Trash after confirming everything is on pCloud

### Phase 5: Verify

- List each pCloud Archive subfolder to confirm all files present
- Check pCloud quota: `mcp__pcloud__userinfo`
- Verify no orphaned tarballs in /tmp/
- Run `df -h` to confirm disk space freed

## pCloud folder structure conventions

```
/Archive/
  Code/        # tar.gz of git repos and code projects
  Documents/   # PDFs, course notes, research
  Media/       # Audio, video, images, soundfonts
  Data/        # Databases, RDF, CSV, XML
/_secure/      # Sensitive files (never shared)
```

## Common pitfalls

- **MCP upload timeout**: Files >100 MB fail through the MCP tool (~34s limit). Use curl with `--max-time 300` directly.
- **Git repos with no remote**: Commit locally first, then tar.gz. Don't lose uncommitted work.
- **Upstream clones**: Check `git status` and `git log` before deleting. If there are local commits not pushed, archive first.
- **Course bundles**: Unzip before classifying. A single zip may contain multiple subjects.
- **Game ROMs**: .cia/.nds/.3ds files have no archivable value. Trash directly.
- **Build artifacts**: node_modules/, target/, dist/, .next/ are rebuildable. Trash, don't archive.

## Companion skills

Read and apply `pcloud-troubleshooting` for upload failures, `pcloud-recovery` for trash recovery, `pcloud-sharing-security` for credential hygiene, and `pcloud-cli`/`pcloud-client` for the actual upload commands.

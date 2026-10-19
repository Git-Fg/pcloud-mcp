#!/usr/bin/env python3
"""Fetch pCloud developer docs and convert to markdown.

Extracts the div.dev-content from each docs.pcloud.com page and pipes it
through pandoc. Writes one .md per page into the directory given as argv[1].

Usage:
    python3 scripts/fetch_pcloud_docs.py <out-dir>

Conventional output directory: docs/pcloud-api/ (not tracked; create on demand).

This is an on-demand tool — the output directory is caller-supplied so
developers can place the generated docs wherever they need them. The
directory does not need to exist in the repo beforehand; the script
creates it.

No tracked file references this script; it is maintained for local
regeneration of current pCloud API reference when needed.
"""
import re
import subprocess
import sys
import urllib.request
from pathlib import Path

BASE = "https://docs.pcloud.com"

# Curated set: protocol + structures + errors + the method families that
# matter for this server (general/folder/file/streaming/auth/oauth).
PAGES = [
    ("protocols/http_json_protocol/index.html", "http_json_protocol.md"),
    ("protocols/http_json_protocol/authentication.html", "http_protocol_authentication.md"),
    ("protocols/http_json_protocol/single_connection.html", "http_protocol_single_connection.md"),
    ("protocols/http_json_protocol/uploading_files.html", "http_protocol_uploading_files.md"),
    ("methods/intro/global_parameters.html", "global_parameters.md"),
    ("methods/intro/authentication.html", "methods_authentication.md"),
    ("structures/metadata.html", "structure_metadata.md"),
    ("structures/datetime.html", "structure_datetime.md"),
    ("structures/filenames.html", "structure_filenames.md"),
    ("structures/tree.html", "structure_tree.md"),
    ("structures/share.html", "structure_share.md"),
    ("errors/index.html", "errors.md"),
    ("methods/general/userinfo.html", "method_userinfo.md"),
    ("methods/general/getapiserver.html", "method_getapiserver.md"),
    ("methods/general/currentserver.html", "method_currentserver.md"),
    ("methods/folder/listfolder.html", "method_listfolder.md"),
    ("methods/folder/createfolder.html", "method_createfolder.md"),
    ("methods/folder/createfolderifnotexists.html", "method_createfolderifnotexists.md"),
    ("methods/folder/deletefolder.html", "method_deletefolder.md"),
    ("methods/folder/deletefolderrecursive.html", "method_deletefolderrecursive.md"),
    ("methods/folder/renamefolder.html", "method_renamefolder.md"),
    ("methods/folder/copyfolder.html", "method_copyfolder.md"),
    ("methods/file/deletefile.html", "method_deletefile.md"),
    ("methods/file/uploadfile.html", "method_uploadfile.md"),
    ("methods/file/downloadfile.html", "method_downloadfile.md"),
    ("methods/file/stat.html", "method_stat.md"),
    ("methods/file/renamefile.html", "method_renamefile.md"),
    ("methods/file/copyfile.html", "method_copyfile.md"),
    ("methods/streaming/getfilelink.html", "method_getfilelink.md"),
    ("methods/streaming/getvideolink.html", "method_getvideolink.md"),
    ("methods/streaming/getaudiolink.html", "method_getaudiolink.md"),
    ("methods/oauth_2.0/authorize.html", "method_oauth_authorize.md"),
    ("methods/oauth_2.0/oauth2_token.html", "method_oauth2_token.md"),
    ("methods/public_links/getfilepublink.html", "method_getfilepublink.md"),
    ("methods/trash/trash_list.html", "method_trash_list.md"),
    ("methods/revisions/listrevisions.html", "method_listrevisions.md"),
    ("methods/streaming/gettextfile.html", "method_gettextfile.md"),
    ("methods/trash/trash_restore.html", "method_trash_restore.md"),
    ("methods/trash/trash_clear.html", "method_trash_clear.md"),
    ("methods/revisions/revertrevision.html", "method_revertrevision.md"),
    ("methods/file/checksumfile.html", "method_checksumfile.md"),
    ("methods/public_links/getfolderpublink.html", "method_getfolderpublink.md"),
    ("methods/public_links/listpublinks.html", "method_listpublinks.md"),
    ("methods/public_links/deletepublink.html", "method_deletepublink.md"),
    ("methods/general/diff.html", "method_diff.md"),
    ("methods/thumbnails/getthumblink.html", "method_getthumblink.md"),
    ("methods/archiving/getziplink.html", "method_getziplink.md"),
    ("methods/archiving/extractarchive.html", "method_extractarchive.md"),
    ("methods/sharing/sharefolder.html", "method_sharefolder.md"),
    ("methods/sharing/listshares.html", "method_listshares.md"),
    ("methods/oauth_2.0/index.html", "methods_oauth_index.md"),
]


def extract_dev_content(html: str) -> str:
    # Content lives in <div class="dev-content"> ... </div> followed by nav/footer.
    m = re.search(r'<div class="dev-content">(.*?)</div>\s*(?:<div class="docs-nav|<div class="row")', html, re.S)
    if m:
        return m.group(1)
    m = re.search(r'<div class="dev-content">(.*)', html, re.S)
    return m.group(1) if m else html


def main() -> int:
    outdir = Path(sys.argv[1])
    outdir.mkdir(parents=True, exist_ok=True)
    failures = []
    for path, name in PAGES:
        url = f"{BASE}/{path}"
        try:
            with urllib.request.urlopen(url, timeout=30) as r:
                html = r.read().decode("utf-8", "replace")
        except Exception as e:  # noqa: BLE001
            failures.append((path, str(e)))
            continue
        body = extract_dev_content(html)
        header = f"# pCloud docs: {path}\n\n> Source: {url}\n\n"
        try:
            md = subprocess.run(
                ["pandoc", "-f", "html", "-t", "gfm-raw_html", "--wrap=none"],
                input=body, capture_output=True, text=True, check=True,
            ).stdout
        except subprocess.CalledProcessError as e:
            failures.append((path, f"pandoc: {e.stderr[:200]}"))
            continue
        clean = re.sub(r"\n{3,}", "\n\n", md).strip()
        (outdir / name).write_text(header + clean + "\n", encoding="utf-8")
        print(f"OK  {name} ({len(clean)} chars)")
    for path, err in failures:
        print(f"FAIL {path}: {err}", file=sys.stderr)
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())

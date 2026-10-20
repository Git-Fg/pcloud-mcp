// Generated on 2026-10-20T03:01:18.565Z by pcloud-mcp@1.0.0
// Server: pcloud
// Source: /Users/felix/Documents/pcloud_mcp/.tower/worktrees/wt-7/config/mcporter.json
// Transport: STDIO sh -c set -a && . /Users/felix/Documents/pcloud_mcp/.env && cd /Users/felix/Documents/pcloud_mcp && exec bun run src/index.ts

import type { CallResult } from 'mcporter';

export interface PcloudTools {
  /**
   * Get account info for the authenticated pCloud user (id, email, quota, premium status).
   */
  userinfo(params?: Record<string, unknown>): Promise<CallResult>;

  /**
   * List the contents of a pCloud folder by folderid. pCloud does not paginate natively; use
   * limit/offset to slice client-side and avoid blowing the context window on large folders.
   *
   * @param folderid? Numeric folder ID to list (0 for root folder)
   * @param nofiles? If true, list only subfolders, not files
   * @param noshares? If true, exclude shared folders from the listing
   * @param recursive? If true, list subfolders of the folder (pCloud performs the recursion)
   * @param showdeleted? If true, include deleted (trashed) items in the listing
   * @param limit? Client-side cap on items returned (pCloud does not paginate; default 200)
   * @param offset? Client-side offset into the listing (use with limit for paging)
   */
  listfolder(params?: { folderid?: number; nofiles?: boolean; noshares?: boolean; recursive?: boolean; showdeleted?: boolean } & Record<string, unknown>): Promise<CallResult>;
  // optional (2): limit, offset

  /**
   * Return the metadata for one file or folder by fileid or path. Cheap existence check.
   *
   * @param fileid? File or folder ID (discouraged: path is preferred)
   * @param path? Path to file or folder (preferred)
   */
  stat(params?: { fileid?: number; path?: string } & Record<string, unknown>): Promise<CallResult>;

  /**
   * Return a download URL for a file by fileid or path. URL is short-lived and token-scoped. This method
   * can't be used from web applications. Referrer is restricted to pcloud.com.
   *
   * @param fileid? File ID to get a download link for
   * @param path? Path to file (mutually exclusive with fileid)
   * @param forcedownload? If true, force Content-Disposition: attachment (download instead of inline)
   * @param contenttype? Override the response Content-Type (e.g. "application/octet-stream")
   * @param maxspeed? Throttle the download to this many bytes per second
   * @param skipfilename? If true, omit the filename from Content-Disposition
   */
  getfilelink(params?: { fileid?: number; path?: string; forcedownload?: boolean; contenttype?: string; maxspeed?: number } & Record<string, unknown>): Promise<CallResult>;
  // optional (1): skipfilename

  /**
   * Read a file from pCloud (getfilelink + streamed HTTP fetch) and return its content as a UTF-8
   * string. The response is capped to maxBytes (default 1 MB) and the upstream download is cancelled at
   * the cap. The signed download URL is never returned (short-lived credential). Output is best-effort:
   * binary files are decoded as UTF-8 with replacement on invalid sequences, so use the result for text
   * or treat `bytes` as the source of truth.
   *
   * @param fileid? File ID to read
   * @param path? File path (discouraged)
   * @param maxBytes? Safety cap on returned bytes (default 1 MB)
   */
  readfile(params?: { fileid?: number; path?: string; maxBytes?: number } & Record<string, unknown>): Promise<CallResult>;

  /**
   * Return the version history of a file by fileid or path (newest first).
   *
   * @param fileid? File ID
   * @param path? File path (discouraged)
   */
  listrevisions(params?: { fileid?: number; path?: string } & Record<string, unknown>): Promise<CallResult>;

  /**
   * Create a new folder under a parent folder (id 0 = root). Errors if the name already exists.
   *
   * @param folderid? Parent folder ID (0 for root)
   * @param name Name of the new folder
   */
  createfolder(params: { folderid?: number; name: string } & Record<string, unknown>): Promise<CallResult>;

  /**
   * Rename or move a file in a single atomic call. Provide topath, or tofolderid+toname. If the
   * destination already exists, it is replaced and the old fileid is returned in
   * `metadata.deletedfileid`.
   *
   * @param fileid? Source file ID
   * @param path? Source file path (discouraged)
   * @param topath? Destination path; must end with `/` if you only want to move into a folder without
   *                renaming
   * @param tofolderid? Destination folder ID
   * @param toname? Destination filename
   */
  renamefile(params?: { fileid?: number; path?: string; topath?: string; tofolderid?: number; toname?: string } & Record<string, unknown>): Promise<CallResult>;

  /**
   * Rename or move a folder in a single atomic call. Provide topath, or tofolderid+toname.
   *
   * @param folderid? Source folder ID
   * @param path? Source folder path (discouraged)
   * @param topath? Destination path; must end with `/` if you only want to move into a folder without
   *                renaming
   * @param tofolderid? Destination parent folder ID
   * @param toname? New folder name
   */
  renamefolder(params?: { folderid?: number; path?: string; topath?: string; tofolderid?: number; toname?: string } & Record<string, unknown>): Promise<CallResult>;

  /**
   * Read a local file and upload it to a pCloud folder via multipart POST. Specify the destination with
   * folderid + filename (preferred) or path; if both folderid and path are omitted, the root folder is
   * selected. Set renameifexists to avoid overwriting; set nopartial to drop incomplete files on
   * connection drops. mtime sets the modified time (unix seconds); ctime sets the creation time but
   * requires mtime to be provided as well. The server has access to the local filesystem.
   *
   * @param filePath Local filesystem path of the file to upload
   * @param folderid? Destination folder ID (default 0 = root)
   * @param path? Destination path (discouraged; prefer folderid + filename)
   * @param filename? Override filename in pCloud; defaults to the basename of filePath
   * @param renameifexists? If true, append (2)/(3)… instead of overwriting
   * @param nopartial? If true, discard the file on a connection drop instead of saving a partial
   * @param mtime? Set the file's modified time (unix seconds). pCloud applies it after upload.
   * @param ctime? Set the file's creation time (unix seconds). mtime is required when ctime is set.
   * @param progresshash? Hash returned to the client for resumable-upload polling (used by pCloud's
   *                      binary protocol, not by this MCP server).
   */
  uploadfile(params: { filePath: string; folderid?: number; path?: string; filename?: string; renameifexists?: boolean } & Record<string, unknown>): Promise<CallResult>;
  // optional (4): nopartial, mtime, ctime, progresshash

  /**
   * Delete a single file by fileid or path. For empty folders use deletefolder; for non-empty folders
   * use deletefolderrecursive. The deleted file moves to the pCloud Trash and can be recovered via
   * trash_restore (note: trash_restore currently returns 1000 for OAuth access tokens; see
   * docs/pcloud-notes.md).
   *
   * @param fileid? File ID to delete
   * @param path? Path to file (mutually exclusive with fileid)
   */
  deletefile(params?: { fileid?: number; path?: string } & Record<string, unknown>): Promise<CallResult>;

  /**
   * Delete a folder that is already empty, by folderid or path. For non-empty folders use
   * deletefolderrecursive. pCloud requires the folder to be empty for this endpoint to succeed.
   *
   * @param folderid? Folder ID to delete (must be empty)
   * @param path? Path to empty folder (mutually exclusive with folderid)
   */
  deletefolder(params?: { folderid?: number; path?: string } & Record<string, unknown>): Promise<CallResult>;

  /**
   * Resolve a pCloud absolute path to the canonical {fileid|folderid, isfolder} form via stat. Use this
   * when an agent has only a path and needs to chain into tools that prefer numeric ids (e.g. delete by
   * id, download by id).
   *
   * @param path Absolute path to a file or folder (e.g. "/docs/spec.md")
   */
  resolve(params: { path: string } & Record<string, unknown>): Promise<CallResult>;

  /**
   * List the contents of the pCloud Trash (root folderid=0 unless nested). Items in trash have
   * origparentfolderid showing the folder they were deleted from. Use trash_restore to recover an item
   * by its fileid/folderid.
   */
  trash_list(params?: { folderid?: number; nofiles?: boolean; recursive?: boolean } & Record<string, unknown>): Promise<CallResult>;

  /**
   * Restore a file or folder from the trash by fileid or folderid. Optionally target a destination
   * folder via restoreto. Set folderid=0 to restore the entire trash.
   *
   * @param fileid? File id to restore (mutually exclusive with folderid)
   * @param folderid? Folder id to restore (0 = restore the entire trash)
   * @param restoreto? Destination folder id
   */
  trash_restore(params?: { fileid?: number; folderid?: number; restoreto?: number; metadata?: boolean } & Record<string, unknown>): Promise<CallResult>;

  /**
   * Create a public share link to a file. Returns the link URL and code. Optional constraints: expire,
   * maxdownloads, maxtraffic, shortlink, linkpassword. Note: pCloud restricts the referrer to pcloud.com
   * for these links, so some embedded preview flows will not work.
   */
  getfilepublink(params?: { fileid?: number; path?: string; expire?: string; maxdownloads?: number; maxtraffic?: number } & Record<string, unknown>): Promise<CallResult>;
  // optional (2): shortlink, linkpassword

  /**
   * Create a public share link to a folder. Same optional constraints as getfilepublink; maxdownloads
   * here limits total downloads from the folder, not per-file. Root folder (folderid=0) cannot be
   * shared.
   */
  getfolderpublink(params?: { folderid?: number; path?: string; expire?: string; maxdownloads?: number; maxtraffic?: number } & Record<string, unknown>): Promise<CallResult>;
  // optional (2): shortlink, linkpassword

  /**
   * Return every public link the account has created, with their metadata, expiry, and traffic/download
   * counters.
   */
  listpublinks(params?: Record<string, unknown>): Promise<CallResult>;

  /**
   * Delete a single public link by its linkid. Idempotent: a missing linkid returns error 2027.
   */
  deletepublink(params: { linkid: number } & Record<string, unknown>): Promise<CallResult>;

  /**
   * pCloud's only sync primitive. With no args, returns the latest diffid (use last=0). Pass diffid to
   * receive only changes since that point. Use after as RFC-822 datetime for time-based polling. limit
   * caps the entries array. block long-polls until new changes arrive, but only works when diffid is
   * provided and does not work together with after or last. pCloud compacts events older than ~6 months,
   * so re-download state from zero if a diffid is stale.
   *
   * @param diffid? Return only changes after this diffid cursor
   * @param after? RFC-822 datetime; return only changes after this time (alternative to diffid)
   * @param last? Return the last N events; 0 = just the latest diffid cursor
   * @param limit? Max entries returned (default 100)
   * @param block? If true, block the server response until new changes are available (advanced;
   *               long-poll)
   */
  diff(params?: { diffid?: number; after?: string; last?: number; limit?: number; block?: boolean } & Record<string, unknown>): Promise<CallResult>;

  /**
   * Search a folder tree (default root) for entries whose name contains the query substring
   * (case-insensitive). pCloud exposes no documented search endpoint, so this walks listfolder
   * recursively. maxDepth caps the descent (default 3, max 10) and maxResults caps matches (default
   * 100). Returned matches carry the full path so callers can chain into readfile/stat without a
   * separate resolve.
   *
   * @param query Substring to search for (case-insensitive)
   */
  find(params: { query: string; folderid?: number; maxDepth?: number; maxResults?: number } & Record<string, unknown>): Promise<CallResult>;

  /**
   * Create an upload link that lets anyone with the link upload files into a folder you own. comment is
   * required and is the only context uploaders see. Optional expire / maxspace / maxfiles. Returns the
   * uploadlinkid, the public link URL, a mail-upload address, and the upload code.
   *
   * @param folderid? Destination folder id (owned by user)
   * @param path? Destination folder path (mutually exclusive with folderid)
   * @param comment Comment shown to uploaders (required)
   * @param expire? Datetime at which the link expires
   * @param maxspace? Max total bytes the link will accept
   * @param maxfiles? Max total files the link will accept
   */
  createuploadlink(params: { folderid?: number; path?: string; comment: string; expire?: string; maxspace?: number } & Record<string, unknown>): Promise<CallResult>;
  // optional (1): maxfiles

  /**
   * Upload a local file to a pCloud upload link by code. The link owner gets the file in the destination
   * folder. No access token is sent — pCloud authenticates by the link code. Emits
   * notifications/progress while reading the local file.
   *
   * @param code Upload link code returned by createuploadlink
   * @param filePath Local filesystem path of the file to upload
   * @param filename? Override filename on pCloud (defaults to basename of filePath)
   * @param nopartial? If true, partially uploaded files are discarded on connection drop
   * @param progresshash? Hash used with uploadlinkprogress to poll progress
   */
  uploadtolink(params: { code: string; filePath: string; filename?: string; nopartial?: boolean; progresshash?: string } & Record<string, unknown>): Promise<CallResult>;

  /**
   * Inspect an upload link (returns code, link, mail, comment, expires, maxspace, maxfiles) and
   * optionally modify its expire / maxspace / maxfiles in the same call. Pass deleteexpire=true to clear
   * the existing expiry; pass 0 for maxspace or maxfiles to remove those caps.
   *
   * @param uploadlinkid Upload link id returned by createuploadlink
   */
  showuploadlink(params: { uploadlinkid: number; expire?: string; deleteexpire?: boolean; maxspace?: number; maxfiles?: number } & Record<string, unknown>): Promise<CallResult>;

  /**
   * Server-side copy of a file. Source by fileid or path; destination by topath, or tofolderid (+
   * optional toname). If toname is omitted, the source filename is used. The copy is a new, independent
   * file. Optionally set noover=true to fail on conflicts instead of overwriting, and mtime/ctime to pin
   * timestamps (unix seconds).
   *
   * @param fileid? Source file id (mutually exclusive with path)
   * @param path? Source file path (mutually exclusive with fileid)
   * @param tofolderid? Destination folder id
   * @param topath? Destination path (mutually exclusive with tofolderid unless toname also given)
   * @param toname? Destination filename; defaults to the source filename
   * @param noover? If true and the destination exists, fail with 2004 instead of overwriting
   * @param mtime? Set modified time (unix seconds)
   * @param ctime? Set created time (unix seconds); requires mtime
   */
  copyfile(params?: { fileid?: number; path?: string; tofolderid?: number; topath?: string; toname?: string } & Record<string, unknown>): Promise<CallResult>;
  // optional (3): noover, mtime, ctime

  /**
   * Server-side copy of a folder. Source by folderid or path; destination by topath, or tofolderid (+
   * optional toname). set copycontentonly=true to copy the contents of the source into the destination
   * rather than nesting a new folder under it. skipexisting and noover control conflict behaviour.
   *
   * @param folderid? Source folder id (mutually exclusive with path)
   * @param path? Source folder path (mutually exclusive with folderid)
   * @param tofolderid? Destination parent folder id
   * @param topath? Destination path (mutually exclusive with tofolderid unless toname also given)
   * @param toname? Destination folder name
   * @param noover? If true and a conflict exists, fail with 2004
   * @param skipexisting? If true, skip files that already exist in the destination
   * @param copycontentonly? If true, copy the contents of source into dest rather than nesting under
   *                         dest
   */
  copyfolder(params?: { folderid?: number; path?: string; tofolderid?: number; topath?: string; toname?: string } & Record<string, unknown>): Promise<CallResult>;
  // optional (3): noover, skipexisting, copycontentonly

  /**
   * Revert a file by fileid or path to a previous revision (from listrevisions). The current contents
   * are saved as a new revision so nothing is lost. Returns the updated metadata.
   *
   * @param fileid? File id to revert (mutually exclusive with path)
   * @param path? File path to revert (mutually exclusive with fileid)
   * @param revisionid Revision id to revert to
   */
  revertrevision(params: { fileid?: number; path?: string; revisionid: number } & Record<string, unknown>): Promise<CallResult>;

  /**
   * Idempotent version of createfolder: if a folder with the same name already exists under the parent
   * (or the path already resolves to a folder), its existing metadata is returned instead of erroring
   * with 2004. Use this when the caller does not know whether the folder exists. `created` is true on a
   * fresh folder, false when the existing one was returned.
   *
   * @param folderid? Parent folder ID (0 for root)
   * @param name? Name of the folder to create or return
   * @param path? Full path to the folder (discouraged; prefer folderid + name)
   */
  createfolderifnotexists(params?: { folderid?: number; name?: string; path?: string } & Record<string, unknown>): Promise<CallResult>;

  /**
   * Ask pCloud to fetch one or more URLs and store the resulting file(s) in a folder you own. Pass a
   * single `url` string or several URLs separated by whitespace. Optionally pass `target` as a
   * comma-separated urlencoded list of desired filenames (one per URL; empty positions keep the
   * URL-derived name). Bytes never cross the MCP server — pCloud does the fetching. Blocks until all
   * URLs are downloaded (large downloads hold the tool call open).
   *
   * @param url One or more URLs to download, separated by whitespace
   * @param folderid? Destination folder ID (default 0 = root)
   * @param path? Destination path (discouraged; prefer folderid)
   * @param target? Comma-separated urlencoded list of desired filenames, one per URL. Empty positions
   *                keep the URL-derived name.
   * @param progresshash? Optional client-side progress token (not polled by the MCP server; returned to
   *                      the caller for its own tracking).
   */
  downloadfile(params: { url: string; folderid?: number; path?: string; target?: string; progresshash?: string } & Record<string, unknown>): Promise<CallResult>;

  /**
   * Return the cryptographic hash(es) for a file. SHA-1 is always returned. MD5 is added by US API
   * servers, SHA-256 by EU API servers — call once on each region to get the full set. Use this to
   * compare two files, or to verify an upload / download round-trip without re-reading the bytes.
   *
   * @param fileid? File ID to checksum
   * @param path? Path to file (mutually exclusive with fileid)
   */
  checksumfile(params?: { fileid?: number; path?: string } & Record<string, unknown>): Promise<CallResult>;

  /**
   * Return a thumbnail download URL for an image file. size is required (WIDTHxHEIGHT; width 16–2048,
   * height 16–1024, both divisible by 4 or 5 — pCloud returns error 1015 otherwise). Set crop=true for
   * exactly the requested size (edges may be cut), type=png for PNG output (default jpeg). Works only on
   * files whose metadata has thumb=true (error 1014 otherwise). Thumbnails are created on first request
   * and cached server-side; re-request after the file hash changes.
   *
   * @param fileid? File ID of the image
   * @param path? Path to the image (mutually exclusive with fileid)
   * @param size Thumbnail size, WIDTHxHEIGHT (width 16–2048, height 16–1024; both divisible by 4 or 5)
   * @param crop? If true, crop to exactly the requested size (may cut edges)
   * @param type? Only "png" is documented (default format is jpeg)
   */
  getthumblink(params: { fileid?: number; path?: string; size: string; crop?: boolean; type?: string } & Record<string, unknown>): Promise<CallResult>;

  /**
   * Return a transcoded streaming URL for a video file (FLV container, x264/mp3, adaptive bitrate by
   * default). Optional transcode controls: abitrate (16–320 kbit), vbitrate (16–4000 kbit), resolution
   * (64x64–1280x960), fixedbitrate (disable adaptive streaming). The generated link accepts a start GET
   * parameter to skip ahead N seconds. Returns error 2044 if the file is not a video. This method can't
   * be used from web applications. Referrer is restricted to pcloud.com.
   *
   * @param fileid? File ID of the video
   * @param path? Path to the video (mutually exclusive with fileid)
   * @param forcedownload? If true, force Content-Disposition: attachment
   * @param contenttype? Override the response Content-Type
   * @param maxspeed? Throttle the download speed (bytes/sec)
   * @param skipfilename? If true, omit the filename from Content-Disposition
   * @param abitrate? Audio bitrate in kbit (16–320, default 128)
   * @param vbitrate? Initial video bitrate in kbit (16–4000, default 1000, adaptive unless fixedbitrate)
   * @param resolution? Transcode resolution WIDTHxHEIGHT (64x64 to 1280x960)
   * @param fixedbitrate? If true, disable adaptive streaming (constant bitrate)
   */
  getvideolink(params?: { fileid?: number; path?: string; forcedownload?: boolean; contenttype?: string; maxspeed?: number } & Record<string, unknown>): Promise<CallResult>;
  // optional (5): skipfilename, abitrate, vbitrate, resolution, fixedbitrate

  /**
   * Return an MP3 streaming URL for an audio (or video) file — also usable to extract the audio track
   * from a video, or to play FLAC etc. on MP3-only devices. abitrate controls the transcode bitrate
   * (16–320 kbit, default 192). The generated link accepts a start GET parameter to skip ahead N
   * seconds. This method can't be used from web applications. Referrer is restricted to pcloud.com.
   *
   * @param fileid? File ID of the audio (or video) file
   * @param path? Path to the file (mutually exclusive with fileid)
   * @param forcedownload? If true, force Content-Disposition: attachment
   * @param contenttype? Override the response Content-Type
   * @param abitrate? Audio bitrate in kbit (16–320, default 192)
   */
  getaudiolink(params?: { fileid?: number; path?: string; forcedownload?: boolean; contenttype?: string; abitrate?: number } & Record<string, unknown>): Promise<CallResult>;

  /**
   * Return the API servers closest to the requesting client (no auth required). Biggest speed gain is
   * for upload methods. Clients should keep fallback logic: if a regional server fails with a network
   * error, fall back to api.pcloud.com.
   */
  getapiserver(params?: Record<string, unknown>): Promise<CallResult>;

  /**
   * Return the ip and hostname of the server currently handling requests (no auth required). The
   * hostname resolves only to the same server. Useful to pin an upload target when polling upload
   * progress.
   */
  currentserver(params?: Record<string, unknown>): Promise<CallResult>;

  /**
   * Ask pCloud to extract an archive (zip/tar/etc.) already in your filesystem into a destination
   * folder. Runs for ~2s; if the extraction finishes in that window, `finished=true` in the response,
   * otherwise `finished=false` and `progresshash` is returned — poll it on the `hostname` returned in
   * the same response. On a password-protected archive, pCloud returns error 7009: retry with the
   * `password` parameter. `overwrite` (default "rename") controls behaviour on name conflicts.
   *
   * @param fileid? File ID of the archive
   * @param path? Path to the archive (mutually exclusive with fileid)
   * @param tofolderid? Destination folder ID (0 = root)
   * @param topath? Destination folder path
   * @param toname? Name for the extracted output
   * @param password? Password for a password-protected archive (else pCloud returns 7009)
   * @param nooutput? If true, omit the extraction output lines from the response
   * @param overwrite? What to do when a target file already exists (default 'rename')
   */
  extractarchive(params?: { fileid?: number; path?: string; tofolderid?: number; topath?: string; toname?: string } & Record<string, unknown>): Promise<CallResult>;
  // optional (3): password, nooutput, overwrite

  /**
   * Recursively delete a folder and every file and subfolder inside it. DESTRUCTIVE: removed items go to
   * the trash and can be recovered with trash_restore; this is a one-way `deletefolderrecursive` call
   * that cannot be undone from this server.
   *
   * @param folderid? Folder ID to delete (with all contents)
   * @param path? Path to folder (discouraged)
   */
  deletefolderrecursive(params?: { folderid?: number; path?: string } & Record<string, unknown>): Promise<CallResult>;
}


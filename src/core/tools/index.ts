import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { listfolderHandler, ListfolderInputSchema } from './listfolder.js';
import { userinfoHandler, UserinfoInputSchema } from './userinfo.js';
import { createfolderHandler, CreatefolderInputSchema } from './createfolder.js';
import { deletefileHandler, DeletefileInputSchema } from './deletefile.js';
import { getfilelinkHandler, GetfilelinkInputSchema } from './getfilelink.js';
import { statHandler, StatInputSchema } from './stat.js';
import { deletefolderrecursiveHandler, DeletefolderrecursiveInputSchema } from './deletefolderrecursive.js';
import { renamefileHandler, RenamefileInputSchema } from './renamefile.js';
import { renamefolderHandler, RenamefolderInputSchema } from './renamefolder.js';
import { listrevisionsHandler, ListrevisionsInputSchema } from './listrevisions.js';
import { uploadfileHandler, UploadfileInputSchema } from './uploadfile.js';
import { readfileHandler, ReadfileInputSchema } from './readfile.js';
import { deletefolderHandler, DeletefolderInputSchema } from './deletefolder.js';
import { resolveHandler, ResolveInputSchema } from './resolve.js';
import { trashListHandler, TrashListInputSchema } from './trash_list.js';
import { trashRestoreHandler, TrashRestoreInputSchema } from './trash_restore.js';
import { getfilepublinkHandler, GetfilepublinkInputSchema } from './getfilepublink.js';
import { getfolderpublinkHandler, GetfolderpublinkInputSchema } from './getfolderpublink.js';
import { listpublinksHandler, ListpublinksInputSchema } from './listpublinks.js';
import { deletepublinkHandler, DeletepublinkInputSchema } from './deletepublink.js';
import { diffHandler, DiffInputSchema } from './diff.js';
import { findHandler, FindInputSchema } from './find.js';
import { createuploadlinkHandler, CreateuploadlinkInputSchema } from './createuploadlink.js';
import { uploadtolinkHandler, UploadtolinkInputSchema } from './uploadtolink.js';
import { showuploadlinkHandler, ShowuploadlinkInputSchema } from './showuploadlink.js';
import { copyfileHandler, CopyfileInputSchema } from './copyfile.js';
import { copyfolderHandler, CopyfolderInputSchema } from './copyfolder.js';
import { revertrevisionHandler, RevertrevisionInputSchema } from './revertrevision.js';
import { createfolderifnotexistsHandler, CreatefolderifnotexistsInputSchema } from './createfolderifnotexists.js';
import { downloadfileHandler, DownloadfileInputSchema } from './downloadfile.js';
import { checksumfileHandler, ChecksumfileInputSchema } from './checksumfile.js';
import { getthumblinkHandler, GetthumblinkInputSchema } from './getthumblink.js';
import { getvideolinkHandler, GetvideolinkInputSchema } from './getvideolink.js';
import { getaudiolinkHandler, GetaudiolinkInputSchema } from './getaudiolink.js';
import { getapiserverHandler, GetapiserverInputSchema } from './getapiserver.js';
import { currentserverHandler, CurrentserverInputSchema } from './currentserver.js';
import { extractarchiveHandler, ExtractarchiveInputSchema } from './extractarchive.js';

const READ_ONLY = { readOnlyHint: true, idempotentHint: true, openWorldHint: false } as const;
const DESTRUCTIVE = { readOnlyHint: false, destructiveHint: true, openWorldHint: false } as const;
const MUTATING = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false } as const;
const UPLOAD = { readOnlyHint: false, destructiveHint: false, openWorldHint: true } as const;

export function registerPcloudTools(server: McpServer): void {
  server.registerTool(
    'userinfo',
    {
      title: 'Get pCloud User Info',
      description: 'Get account info for the authenticated pCloud user (id, email, quota, premium status).',
      inputSchema: UserinfoInputSchema,
      outputSchema: z.object({ result: z.literal(0) }).passthrough(),
      annotations: READ_ONLY,
    },
    userinfoHandler
  );

  server.registerTool(
    'listfolder',
    {
      title: 'List pCloud Folder',
      description:
        'List the contents of a pCloud folder by folderid. pCloud does not paginate natively; ' +
        'use limit/offset to slice client-side and avoid blowing the context window on large folders.',
      inputSchema: ListfolderInputSchema,
      outputSchema: z.object({ result: z.literal(0) }).passthrough(),
      annotations: READ_ONLY,
    },
    listfolderHandler
  );

  server.registerTool(
    'stat',
    {
      title: 'Get File or Folder Metadata',
      description: 'Return the metadata for one file or folder by fileid or path. Cheap existence check.',
      inputSchema: StatInputSchema,
      outputSchema: z.object({ result: z.literal(0) }).passthrough(),
      annotations: READ_ONLY,
    },
    statHandler
  );

  server.registerTool(
    'getfilelink',
    {
      title: 'Get pCloud File Download Link',
      description:
        'Return a download URL for a file by fileid or path. URL is short-lived and token-scoped. ' +
        "This method can't be used from web applications. Referrer is restricted to pcloud.com.",
      inputSchema: GetfilelinkInputSchema,
      outputSchema: z.object({ result: z.literal(0) }).passthrough(),
      annotations: READ_ONLY,
    },
    getfilelinkHandler
  );

  server.registerTool(
    'readfile',
    {
      title: 'Read a File (UTF-8)',
      description:
        'Read a file from pCloud (getfilelink + streamed HTTP fetch) and return its content as a ' +
        'UTF-8 string. The response is capped to maxBytes (default 1 MB) and the upstream ' +
        'download is cancelled at the cap. The signed download URL is never returned (short-lived ' +
        'credential). Output is best-effort: binary files are decoded as UTF-8 with replacement ' +
        'on invalid sequences, so use the result for text or treat `bytes` as the source of truth.',
      inputSchema: ReadfileInputSchema,
      outputSchema: z.object({}).passthrough(),
      annotations: READ_ONLY,
    },
    readfileHandler
  );

  server.registerTool(
    'listrevisions',
    {
      title: 'List File Revisions',
      description: 'Return the version history of a file by fileid or path (newest first).',
      inputSchema: ListrevisionsInputSchema,
      outputSchema: z.object({ result: z.literal(0) }).passthrough(),
      annotations: READ_ONLY,
    },
    listrevisionsHandler
  );

  server.registerTool(
    'createfolder',
    {
      title: 'Create pCloud Folder',
      description: 'Create a new folder under a parent folder (id 0 = root). Errors if the name already exists.',
      inputSchema: CreatefolderInputSchema,
      outputSchema: z.object({ result: z.literal(0) }).passthrough(),
      annotations: { ...MUTATING, idempotentHint: false },
    },
    createfolderHandler
  );

  server.registerTool(
    'renamefile',
    {
      title: 'Rename / Move File',
      description:
        'Rename or move a file in a single atomic call. Provide topath, or tofolderid+toname. If the ' +
        'destination already exists, it is replaced and the old fileid is returned in `metadata.deletedfileid`.',
      inputSchema: RenamefileInputSchema,
      outputSchema: z.object({ result: z.literal(0) }).passthrough(),
      annotations: MUTATING,
    },
    renamefileHandler
  );

  server.registerTool(
    'renamefolder',
    {
      title: 'Rename / Move Folder',
      description: 'Rename or move a folder in a single atomic call. Provide topath, or tofolderid+toname.',
      inputSchema: RenamefolderInputSchema,
      outputSchema: z.object({ result: z.literal(0) }).passthrough(),
      annotations: MUTATING,
    },
    renamefolderHandler
  );

  server.registerTool(
    'uploadfile',
    {
      title: 'Upload a File to pCloud',
      description:
        'Read a local file and upload it to a pCloud folder via multipart POST. Specify the ' +
        'destination with folderid + filename (preferred) or path; if both folderid and path are ' +
        'omitted, the root folder is selected. Set renameifexists to avoid overwriting; set ' +
        'nopartial to drop incomplete files on connection drops. mtime sets the modified time ' +
        '(unix seconds); ctime sets the creation time but requires mtime to be provided as well. ' +
        'The server has access to the local filesystem.',
      inputSchema: UploadfileInputSchema,
      outputSchema: z.object({ result: z.literal(0) }).passthrough(),
      annotations: UPLOAD,
    },
    uploadfileHandler
  );

  server.registerTool(
    'deletefile',
    {
      title: 'Delete a File',
      description:
        'Delete a single file by fileid or path. For empty folders use deletefolder; for non-empty ' +
        'folders use deletefolderrecursive. The deleted file moves to the pCloud Trash and can ' +
        'be recovered via trash_restore (note: trash_restore currently returns 1000 for OAuth ' +
        'access tokens; see docs/pcloud-notes.md).',
      inputSchema: DeletefileInputSchema,
      outputSchema: z.object({ result: z.literal(0) }).passthrough(),
      annotations: DESTRUCTIVE,
    },
    deletefileHandler
  );

  server.registerTool(
    'deletefolder',
    {
      title: 'Delete an Empty Folder',
      description:
        'Delete a folder that is already empty, by folderid or path. For non-empty folders use ' +
        'deletefolderrecursive. pCloud requires the folder to be empty for this endpoint to succeed.',
      inputSchema: DeletefolderInputSchema,
      outputSchema: z.object({ result: z.literal(0) }).passthrough(),
      annotations: DESTRUCTIVE,
    },
    deletefolderHandler
  );

  server.registerTool(
    'resolve',
    {
      title: 'Resolve a Path to File/Folder ID',
      description:
        'Resolve a pCloud absolute path to the canonical {fileid|folderid, isfolder} form via ' +
        'stat. Use this when an agent has only a path and needs to chain into tools that prefer ' +
        'numeric ids (e.g. delete by id, download by id).',
      inputSchema: ResolveInputSchema,
      outputSchema: z.object({}).passthrough(),
      annotations: READ_ONLY,
    },
    resolveHandler
  );

  server.registerTool(
    'trash_list',
    {
      title: 'List Items in Trash',
      description:
        'List the contents of the pCloud Trash (root folderid=0 unless nested). Items in trash ' +
        'have origparentfolderid showing the folder they were deleted from. Use trash_restore to ' +
        'recover an item by its fileid/folderid.',
      inputSchema: TrashListInputSchema,
      outputSchema: z.object({ result: z.literal(0) }).passthrough(),
      annotations: READ_ONLY,
    },
    trashListHandler
  );

  server.registerTool(
    'trash_restore',
    {
      title: 'Restore an Item from Trash',
      description:
        'Restore a file or folder from the trash by fileid or folderid. Optionally target a ' +
        'destination folder via restoreto. Set folderid=0 to restore the entire trash.',
      inputSchema: TrashRestoreInputSchema,
      outputSchema: z.object({ result: z.literal(0) }).passthrough(),
      annotations: MUTATING,
    },
    trashRestoreHandler
  );

  server.registerTool(
    'getfilepublink',
    {
      title: 'Create Public Link to a File',
      description:
        'Create a public share link to a file. Returns the link URL and code. Optional constraints: ' +
        'expire, maxdownloads, maxtraffic, shortlink, linkpassword. Note: pCloud restricts the ' +
        'referrer to pcloud.com for these links, so some embedded preview flows will not work.',
      inputSchema: GetfilepublinkInputSchema,
      outputSchema: z.object({ result: z.literal(0) }).passthrough(),
      annotations: MUTATING,
    },
    getfilepublinkHandler
  );

  server.registerTool(
    'getfolderpublink',
    {
      title: 'Create Public Link to a Folder',
      description:
        'Create a public share link to a folder. Same optional constraints as getfilepublink; ' +
        'maxdownloads here limits total downloads from the folder, not per-file. Root folder ' +
        '(folderid=0) cannot be shared.',
      inputSchema: GetfolderpublinkInputSchema,
      outputSchema: z.object({ result: z.literal(0) }).passthrough(),
      annotations: MUTATING,
    },
    getfolderpublinkHandler
  );

  server.registerTool(
    'listpublinks',
    {
      title: 'List All Public Links',
      description: 'Return every public link the account has created, with their metadata, expiry, and traffic/download counters.',
      inputSchema: ListpublinksInputSchema,
      outputSchema: z.object({ result: z.literal(0) }).passthrough(),
      annotations: READ_ONLY,
    },
    listpublinksHandler
  );

  server.registerTool(
    'deletepublink',
    {
      title: 'Delete a Public Link',
      description: 'Delete a single public link by its linkid. Idempotent: a missing linkid returns error 2027.',
      inputSchema: DeletepublinkInputSchema,
      outputSchema: z.object({ result: z.literal(0) }).passthrough(),
      annotations: DESTRUCTIVE,
    },
    deletepublinkHandler
  );

  server.registerTool(
    'diff',
    {
      title: 'List Account Changes (Sync Primitive)',
      description:
        "pCloud's only sync primitive. With no args, returns the latest diffid (use last=0). " +
        'Pass diffid to receive only changes since that point. Use after as RFC-822 datetime for ' +
        'time-based polling. limit caps the entries array. block long-polls until new changes ' +
        'arrive, but only works when diffid is provided and does not work together with after or ' +
        'last. pCloud compacts events older than ~6 months, so re-download state from zero if a ' +
        'diffid is stale.',
      inputSchema: DiffInputSchema,
      outputSchema: z.object({ result: z.literal(0) }).passthrough(),
      annotations: READ_ONLY,
    },
    diffHandler
  );

  server.registerTool(
    'find',
    {
      title: 'Find Files / Folders by Name',
      description:
        'Search a folder tree (default root) for entries whose name contains the query substring ' +
        '(case-insensitive). pCloud exposes no documented search endpoint, so this walks listfolder ' +
        'recursively. maxDepth caps the descent (default 3, max 10) and maxResults caps matches ' +
        '(default 100). Returned matches carry the full path so callers can chain into readfile/' +
        'stat without a separate resolve.',
      inputSchema: FindInputSchema,
      outputSchema: z.object({}).passthrough(),
      annotations: READ_ONLY,
    },
    findHandler
  );

  server.registerTool(
    'createuploadlink',
    {
      title: 'Create an Upload Link',
      description:
        'Create an upload link that lets anyone with the link upload files into a folder you own. ' +
        'comment is required and is the only context uploaders see. Optional expire / maxspace / maxfiles. ' +
        'Returns the uploadlinkid, the public link URL, a mail-upload address, and the upload code.',
      inputSchema: CreateuploadlinkInputSchema,
      outputSchema: z.object({ result: z.literal(0) }).passthrough(),
      annotations: MUTATING,
    },
    createuploadlinkHandler
  );

  server.registerTool(
    'uploadtolink',
    {
      title: 'Upload a File to an Upload Link',
      description:
        'Upload a local file to a pCloud upload link by code. The link owner gets the file in the ' +
        'destination folder. No access token is sent — pCloud authenticates by the link code. ' +
        'Emits notifications/progress while reading the local file.',
      inputSchema: UploadtolinkInputSchema,
      outputSchema: z.object({ result: z.literal(0) }).passthrough(),
      annotations: UPLOAD,
    },
    uploadtolinkHandler
  );

  server.registerTool(
    'showuploadlink',
    {
      title: 'Show / Modify an Upload Link',
      description:
        'Inspect an upload link (returns code, link, mail, comment, expires, maxspace, maxfiles) and ' +
        'optionally modify its expire / maxspace / maxfiles in the same call. Pass deleteexpire=true to ' +
        'clear the existing expiry; pass 0 for maxspace or maxfiles to remove those caps.',
      inputSchema: ShowuploadlinkInputSchema,
      outputSchema: z.object({ result: z.literal(0) }).passthrough(),
      annotations: MUTATING,
    },
    showuploadlinkHandler
  );

  server.registerTool(
    'copyfile',
    {
      title: 'Copy a File',
      description:
        'Server-side copy of a file. Source by fileid or path; destination by topath, or ' +
        'tofolderid (+ optional toname). If toname is omitted, the source filename is used. ' +
        'The copy is a new, independent file. Optionally set noover=true to fail on conflicts ' +
        'instead of overwriting, and mtime/ctime to pin timestamps (unix seconds).',
      inputSchema: CopyfileInputSchema,
      outputSchema: z.object({ result: z.literal(0) }).passthrough(),
      annotations: MUTATING,
    },
    copyfileHandler
  );

  server.registerTool(
    'copyfolder',
    {
      title: 'Copy a Folder',
      description:
        'Server-side copy of a folder. Source by folderid or path; destination by topath, or ' +
        'tofolderid (+ optional toname). set copycontentonly=true to copy the contents of the ' +
        'source into the destination rather than nesting a new folder under it. skipexisting ' +
        'and noover control conflict behaviour.',
      inputSchema: CopyfolderInputSchema,
      outputSchema: z.object({ result: z.literal(0) }).passthrough(),
      annotations: MUTATING,
    },
    copyfolderHandler
  );

  server.registerTool(
    'revertrevision',
    {
      title: 'Revert a File to a Previous Revision',
      description:
        'Revert a file by fileid or path to a previous revision (from listrevisions). The current ' +
        'contents are saved as a new revision so nothing is lost. Returns the updated metadata.',
      inputSchema: RevertrevisionInputSchema,
      outputSchema: z.object({ result: z.literal(0) }).passthrough(),
      annotations: MUTATING,
    },
    revertrevisionHandler
  );

  server.registerTool(
    'createfolderifnotexists',
    {
      title: 'Create a Folder (Idempotent)',
      description:
        'Idempotent version of createfolder: if a folder with the same name already exists under ' +
        'the parent (or the path already resolves to a folder), its existing metadata is returned ' +
        'instead of erroring with 2004. Use this when the caller does not know whether the folder ' +
        'exists. `created` is true on a fresh folder, false when the existing one was returned.',
      inputSchema: CreatefolderifnotexistsInputSchema,
      outputSchema: z.object({}).passthrough(),
      annotations: { ...MUTATING, idempotentHint: true },
    },
    createfolderifnotexistsHandler
  );

  server.registerTool(
    'downloadfile',
    {
      title: 'Server-Side Download from URL',
      description:
        'Ask pCloud to fetch one or more URLs and store the resulting file(s) in a folder you own. ' +
        'Pass a single `url` string or several URLs separated by whitespace. Optionally pass `target` ' +
        'as a comma-separated urlencoded list of desired filenames (one per URL; empty positions ' +
        'keep the URL-derived name). Bytes never cross the MCP server — pCloud does the fetching. ' +
        'Blocks until all URLs are downloaded (large downloads hold the tool call open).',
      inputSchema: DownloadfileInputSchema,
      outputSchema: z.object({ result: z.literal(0) }).passthrough(),
      annotations: MUTATING,
    },
    downloadfileHandler
  );

  server.registerTool(
    'checksumfile',
    {
      title: 'Get File Checksum(s)',
      description:
        'Return the cryptographic hash(es) for a file. SHA-1 is always returned. MD5 is added by ' +
        'US API servers, SHA-256 by EU API servers — call once on each region to get the full set. ' +
        'Use this to compare two files, or to verify an upload / download round-trip without ' +
        're-reading the bytes.',
      inputSchema: ChecksumfileInputSchema,
      outputSchema: z.object({}).passthrough(),
      annotations: READ_ONLY,
    },
    checksumfileHandler
  );

  server.registerTool(
    'getthumblink',
    {
      title: 'Get Image Thumbnail Link',
      description:
        'Return a thumbnail download URL for an image file. size is required (WIDTHxHEIGHT; width ' +
        '16–2048, height 16–1024, both divisible by 4 or 5 — pCloud returns error 1015 otherwise). ' +
        'Set crop=true for exactly the requested size (edges may be cut), type=png for PNG output ' +
        '(default jpeg). Works only on files whose metadata has thumb=true (error 1014 otherwise). ' +
        'Thumbnails are created on first request and cached server-side; re-request after the file ' +
        'hash changes.',
      inputSchema: GetthumblinkInputSchema,
      outputSchema: z.object({ result: z.literal(0) }).passthrough(),
      annotations: READ_ONLY,
    },
    getthumblinkHandler
  );

  server.registerTool(
    'getvideolink',
    {
      title: 'Get Video Streaming Link',
      description:
        'Return a transcoded streaming URL for a video file (FLV container, x264/mp3, adaptive ' +
        'bitrate by default). Optional transcode controls: abitrate (16–320 kbit), vbitrate ' +
        '(16–4000 kbit), resolution (64x64–1280x960), fixedbitrate (disable adaptive streaming). ' +
        'The generated link accepts a start GET parameter to skip ahead N seconds. Returns error ' +
        "2044 if the file is not a video. This method can't be used from web applications. " +
        'Referrer is restricted to pcloud.com.',
      inputSchema: GetvideolinkInputSchema,
      outputSchema: z.object({ result: z.literal(0) }).passthrough(),
      annotations: READ_ONLY,
    },
    getvideolinkHandler
  );

  server.registerTool(
    'getaudiolink',
    {
      title: 'Get Audio Streaming Link',
      description:
        'Return an MP3 streaming URL for an audio (or video) file — also usable to extract the ' +
        'audio track from a video, or to play FLAC etc. on MP3-only devices. abitrate controls the ' +
        'transcode bitrate (16–320 kbit, default 192). The generated link accepts a start GET ' +
        "parameter to skip ahead N seconds. This method can't be used from web applications. " +
        'Referrer is restricted to pcloud.com.',
      inputSchema: GetaudiolinkInputSchema,
      outputSchema: z.object({ result: z.literal(0) }).passthrough(),
      annotations: READ_ONLY,
    },
    getaudiolinkHandler
  );

  server.registerTool(
    'getapiserver',
    {
      title: 'Get Closest API Server',
      description:
        'Return the API servers closest to the requesting client (no auth required). Biggest speed ' +
        'gain is for upload methods. Clients should keep fallback logic: if a regional server ' +
        'fails with a network error, fall back to api.pcloud.com.',
      inputSchema: GetapiserverInputSchema,
      outputSchema: z.object({ result: z.literal(0) }).passthrough(),
      annotations: READ_ONLY,
    },
    getapiserverHandler
  );

  server.registerTool(
    'currentserver',
    {
      title: 'Get Current API Server',
      description:
        'Return the ip and hostname of the server currently handling requests (no auth required). ' +
        'The hostname resolves only to the same server. Useful to pin an upload target when polling ' +
        'upload progress.',
      inputSchema: CurrentserverInputSchema,
      outputSchema: z.object({ result: z.literal(0) }).passthrough(),
      annotations: READ_ONLY,
    },
    currentserverHandler
  );

  server.registerTool(
    'extractarchive',
    {
      title: 'Extract an Archive',
      description:
        'Ask pCloud to extract an archive (zip/tar/etc.) already in your filesystem into a destination ' +
        'folder. Runs for ~2s; if the extraction finishes in that window, `finished=true` in the ' +
        'response, otherwise `finished=false` and `progresshash` is returned — poll it on the ' +
        '`hostname` returned in the same response. On a password-protected archive, pCloud returns ' +
        'error 7009: retry with the `password` parameter. `overwrite` (default "rename") controls ' +
        'behaviour on name conflicts.',
      inputSchema: ExtractarchiveInputSchema,
      outputSchema: z.object({ result: z.literal(0) }).passthrough(),
      annotations: MUTATING,
    },
    extractarchiveHandler
  );

  server.registerTool(
    'deletefolderrecursive',
    {
      title: 'Delete Folder and All Contents',
      description:
        'Recursively delete a folder and every file and subfolder inside it. DESTRUCTIVE: removed ' +
        'items go to the trash and can be recovered with trash_restore; this is a one-way ' +
        '`deletefolderrecursive` call that cannot be undone from this server.',
      inputSchema: DeletefolderrecursiveInputSchema,
      outputSchema: z.object({ result: z.literal(0) }).passthrough(),
      annotations: DESTRUCTIVE,
    },
    deletefolderrecursiveHandler
  );
}

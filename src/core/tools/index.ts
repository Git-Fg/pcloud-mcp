import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { listfolderHandler } from './listfolder.js';
import { userinfoHandler } from './userinfo.js';
import { createfolderHandler } from './createfolder.js';
import { deletefileHandler } from './deletefile.js';
import { getfilelinkHandler } from './getfilelink.js';
import { statHandler } from './stat.js';
import { deletefolderrecursiveHandler } from './deletefolderrecursive.js';
import { renamefileHandler } from './renamefile.js';
import { renamefolderHandler } from './renamefolder.js';
import { listrevisionsHandler } from './listrevisions.js';
import { uploadfileHandler } from './uploadfile.js';
import { readfileHandler } from './readfile.js';
import { deletefolderHandler } from './deletefolder.js';
import { resolveHandler } from './resolve.js';
import { trashListHandler } from './trash_list.js';
import { trashRestoreHandler } from './trash_restore.js';
import { getfilepublinkHandler } from './getfilepublink.js';
import { getfolderpublinkHandler } from './getfolderpublink.js';
import { listpublinksHandler } from './listpublinks.js';
import { deletepublinkHandler } from './deletepublink.js';
import { diffHandler } from './diff.js';
import { findHandler } from './find.js';
import { createuploadlinkHandler } from './createuploadlink.js';
import { uploadtolinkHandler } from './uploadtolink.js';
import { showuploadlinkHandler } from './showuploadlink.js';
import { copyfileHandler } from './copyfile.js';
import { copyfolderHandler } from './copyfolder.js';
import { revertrevisionHandler } from './revertrevision.js';

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
      inputSchema: z.object({}),
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
      inputSchema: z.object({
        folderid: z.number().int().gte(0).optional().default(0).describe('Folder ID (0 = root)'),
        limit: z.number().int().positive().max(500).optional().describe('Max items returned (default 200)'),
        offset: z.number().int().nonnegative().optional().describe('Offset into the listing'),
      }),
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
      inputSchema: z
        .object({
          fileid: z.number().int().positive().optional(),
          path: z.string().optional(),
        })
        .refine((v) => (v.fileid === undefined) !== (v.path === undefined), {
          message: 'Provide exactly one of fileid or path',
        }),
      outputSchema: z.object({ result: z.literal(0) }).passthrough(),
      annotations: READ_ONLY,
    },
    statHandler
  );

  server.registerTool(
    'getfilelink',
    {
      title: 'Get pCloud File Download Link',
      description: 'Return a download URL for a file by fileid or path. URL is short-lived and token-scoped.',
      inputSchema: z
        .object({
          fileid: z.number().int().positive().optional(),
          path: z.string().optional(),
        })
        .refine((v) => (v.fileid === undefined) !== (v.path === undefined), {
          message: 'Provide exactly one of fileid or path',
        }),
      outputSchema: z.object({ result: z.literal(0) }).passthrough(),
      annotations: READ_ONLY,
    },
    getfilelinkHandler
  );

  server.registerTool(
    'readfile',
    {
      title: 'Read a Text File',
      description:
        'Read a text file from pCloud (getfilelink + HTTP fetch) and return its content. Capped to ' +
        'maxBytes (default 1 MB) to keep the response inside the context window.',
      inputSchema: z
        .object({
          fileid: z.number().int().positive().optional(),
          path: z.string().optional(),
          maxBytes: z.number().int().positive().max(10_000_000).optional(),
        })
        .refine((v) => (v.fileid === undefined) !== (v.path === undefined), {
          message: 'Provide exactly one of fileid or path',
        }),
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
      inputSchema: z
        .object({
          fileid: z.number().int().positive().optional(),
          path: z.string().optional(),
        })
        .refine((v) => (v.fileid === undefined) !== (v.path === undefined), {
          message: 'Provide exactly one of fileid or path',
        }),
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
      inputSchema: z.object({
        folderid: z.number().int().gte(0).optional().default(0).describe('Parent folder ID (0 = root)'),
        name: z.string().min(1).describe('Folder name'),
      }),
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
      inputSchema: z
        .object({
          fileid: z.number().int().positive().optional(),
          path: z.string().optional(),
          topath: z.string().optional(),
          tofolderid: z.number().int().nonnegative().optional(),
          toname: z.string().optional(),
        })
        .refine((v) => (v.fileid === undefined) !== (v.path === undefined), {
          message: 'Provide exactly one of fileid or path for the source',
        })
        .refine((v) => v.topath !== undefined || v.tofolderid !== undefined || v.toname !== undefined, {
          message: 'Provide a destination: topath, or one of tofolderid/toname',
        }),
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
      inputSchema: z
        .object({
          folderid: z.number().int().nonnegative().optional(),
          path: z.string().optional(),
          topath: z.string().optional(),
          tofolderid: z.number().int().nonnegative().optional(),
          toname: z.string().optional(),
        })
        .refine((v) => (v.folderid === undefined) !== (v.path === undefined), {
          message: 'Provide exactly one of folderid or path for the source',
        })
        .refine((v) => v.topath !== undefined || v.tofolderid !== undefined || v.toname !== undefined, {
          message: 'Provide a destination: topath, or one of tofolderid/toname',
        }),
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
        'Read a local file and upload it to a pCloud folder via multipart POST. Provide folderid + ' +
        'filename (preferred) or path. Set renameifexists to avoid overwriting; set nopartial to drop ' +
        'incomplete files on connection drops. The server has access to the local filesystem.',
      inputSchema: z
        .object({
          filePath: z.string().describe('Local file path to read from disk'),
          folderid: z.number().int().nonnegative().optional().describe('Destination folder ID (default 0)'),
          path: z.string().optional().describe('Destination path (discouraged)'),
          filename: z.string().optional().describe('Override the filename in pCloud'),
          renameifexists: z.boolean().optional(),
          nopartial: z.boolean().optional(),
        })
        .refine((v) => v.folderid !== undefined || v.path !== undefined, {
          message: 'Provide folderid or path',
        }),
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
        'folders use deletefolderrecursive (which is unrecoverable through this server).',
      inputSchema: z
        .object({
          fileid: z.number().int().positive().optional(),
          path: z.string().optional(),
        })
        .refine((v) => (v.fileid === undefined) !== (v.path === undefined), {
          message: 'Provide exactly one of fileid or path',
        }),
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
      inputSchema: z
        .object({
          folderid: z.number().int().nonnegative().optional(),
          path: z.string().optional(),
        })
        .refine((v) => (v.folderid === undefined) !== (v.path === undefined), {
          message: 'Provide exactly one of folderid or path',
        }),
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
      inputSchema: z.object({
        path: z.string().min(1).describe('Absolute path, e.g. "/docs/spec.md"'),
      }),
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
      inputSchema: z.object({
        folderid: z.number().int().nonnegative().optional().default(0).describe('Trash folder id (0 = root)'),
        nofiles: z.boolean().optional().describe('If true, only folders are listed'),
        recursive: z.boolean().optional().describe('If true, list subfolders of the trash folder recursively'),
      }),
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
      inputSchema: z
        .object({
          fileid: z.number().int().positive().optional(),
          folderid: z.number().int().nonnegative().optional(),
          restoreto: z.number().int().nonnegative().optional().describe('Destination folder id (0 = root)'),
          metadata: z.boolean().optional().describe('If true and restoring a folder, include contents metadata'),
        })
        .refine((v) => !(v.fileid !== undefined && v.folderid !== undefined), {
          message: 'Provide fileid or folderid, not both',
        })
        .refine((v) => v.fileid !== undefined || v.folderid !== undefined, {
          message: 'Provide fileid or folderid',
        }),
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
      inputSchema: z
        .object({
          fileid: z.number().int().positive().optional(),
          path: z.string().optional(),
          expire: z.string().optional().describe('Datetime when the link expires'),
          maxdownloads: z.number().int().positive().optional(),
          maxtraffic: z.number().int().nonnegative().optional(),
          shortlink: z.boolean().optional(),
          linkpassword: z.string().optional(),
        })
        .refine((v) => (v.fileid === undefined) !== (v.path === undefined), {
          message: 'Provide exactly one of fileid or path',
        }),
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
      inputSchema: z
        .object({
          folderid: z.number().int().nonnegative().optional(),
          path: z.string().optional(),
          expire: z.string().optional(),
          maxdownloads: z.number().int().positive().optional(),
          maxtraffic: z.number().int().nonnegative().optional(),
          shortlink: z.boolean().optional(),
          linkpassword: z.string().optional(),
        })
        .refine((v) => (v.folderid === undefined) !== (v.path === undefined), {
          message: 'Provide exactly one of folderid or path',
        }),
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
      inputSchema: z.object({}),
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
      inputSchema: z.object({
        linkid: z.number().int().positive().describe('Public link id (from listpublinks / get*publink)'),
      }),
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
        'pCloud\'s only sync primitive. With no args, returns the latest diffid (use last=0). ' +
        'Pass diffid to receive only changes since that point. Use after as RFC-822 datetime for ' +
        'time-based polling. limit caps the entries array. pCloud compacts events older than ~6 ' +
        'months, so re-download state from zero if a diffid is stale.',
      inputSchema: z
        .object({
          diffid: z.number().int().nonnegative().optional().describe('Return only changes after this diffid'),
          after: z.string().optional().describe('RFC-822 datetime, return only changes after this time'),
          last: z.number().int().nonnegative().optional().describe('Return last N events; 0 = just the latest diffid'),
          limit: z.number().int().positive().max(1000).optional().default(100).describe('Max entries returned'),
        })
        .refine(
          (v) => [v.diffid !== undefined, v.after !== undefined, v.last !== undefined].filter(Boolean).length <= 1,
          { message: 'Provide at most one of diffid, after, last' }
        ),
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
      inputSchema: z.object({
        query: z.string().min(1).describe('Substring to search for (case-insensitive)'),
        folderid: z.number().int().nonnegative().optional().default(0).describe('Root folder to search (0 = root)'),
        maxDepth: z.number().int().nonnegative().max(10).optional().default(3).describe('Max tree depth to descend'),
        maxResults: z.number().int().positive().max(500).optional().default(100).describe('Max matches to return'),
      }),
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
      inputSchema: z
        .object({
          folderid: z.number().int().nonnegative().optional(),
          path: z.string().optional(),
          comment: z.string().min(1).describe('Comment shown to uploaders (required)'),
          expire: z.string().optional(),
          maxspace: z.number().int().nonnegative().optional(),
          maxfiles: z.number().int().nonnegative().optional(),
        })
        .refine((v) => (v.folderid === undefined) !== (v.path === undefined), {
          message: 'Provide exactly one of folderid or path',
        }),
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
        'destination folder. Optionally set progresshash and poll uploadlinkprogress for percent. ' +
        'No access token is sent — pCloud authenticates by the link code. Emits notifications/progress ' +
        'while reading the local file.',
      inputSchema: z
        .object({
          code: z.string().min(1).describe('Upload link code from createuploadlink'),
          filePath: z.string().describe('Local file to upload'),
          filename: z.string().optional(),
          nopartial: z.boolean().optional(),
          progresshash: z.string().optional(),
        })
        .refine((v) => v.code.length > 0 && v.filePath.length > 0, {
          message: 'code and filePath are required',
        }),
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
      inputSchema: z.object({
        uploadlinkid: z.number().int().positive(),
        expire: z.string().optional(),
        deleteexpire: z.boolean().optional(),
        maxspace: z.number().int().nonnegative().optional(),
        maxfiles: z.number().int().nonnegative().optional(),
      }),
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
      inputSchema: z
        .object({
          fileid: z.number().int().positive().optional(),
          path: z.string().optional(),
          tofolderid: z.number().int().nonnegative().optional(),
          topath: z.string().optional(),
          toname: z.string().optional(),
          noover: z.boolean().optional(),
          mtime: z.number().int().optional(),
          ctime: z.number().int().optional(),
        })
        .refine((v) => (v.fileid === undefined) !== (v.path === undefined), {
          message: 'Provide exactly one of fileid or path for the source',
        })
        .refine(
          (v) => v.topath !== undefined || v.tofolderid !== undefined || v.toname !== undefined,
          { message: 'Provide a destination: topath, or one of tofolderid/toname' }
        ),
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
      inputSchema: z
        .object({
          folderid: z.number().int().nonnegative().optional(),
          path: z.string().optional(),
          tofolderid: z.number().int().nonnegative().optional(),
          topath: z.string().optional(),
          toname: z.string().optional(),
          noover: z.boolean().optional(),
          skipexisting: z.boolean().optional(),
          copycontentonly: z.boolean().optional(),
        })
        .refine((v) => (v.folderid === undefined) !== (v.path === undefined), {
          message: 'Provide exactly one of folderid or path for the source',
        })
        .refine(
          (v) => v.topath !== undefined || v.tofolderid !== undefined || v.toname !== undefined,
          { message: 'Provide a destination: topath, or one of tofolderid/toname' }
        ),
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
      inputSchema: z
        .object({
          fileid: z.number().int().positive().optional(),
          path: z.string().optional(),
          revisionid: z.number().int().positive().describe('Target revision id from listrevisions'),
        })
        .refine((v) => (v.fileid === undefined) !== (v.path === undefined), {
          message: 'Provide exactly one of fileid or path',
        }),
      outputSchema: z.object({ result: z.literal(0) }).passthrough(),
      annotations: MUTATING,
    },
    revertrevisionHandler
  );

  server.registerTool(
    'deletefolderrecursive',
    {
      title: 'Delete Folder and All Contents',
      description:
        'Recursively delete a folder and every file and subfolder inside it. DESTRUCTIVE: removed ' +
        'items go to the trash and can be recovered with trash_restore; this is a one-way ' +
        '`deletefolderrecursive` call that cannot be undone from this server.',
      inputSchema: z
        .object({
          folderid: z.number().int().nonnegative().optional(),
          path: z.string().optional(),
        })
        .refine((v) => (v.folderid === undefined) !== (v.path === undefined), {
          message: 'Provide exactly one of folderid or path',
        }),
      outputSchema: z.object({ result: z.literal(0) }).passthrough(),
      annotations: DESTRUCTIVE,
    },
    deletefolderrecursiveHandler
  );
}

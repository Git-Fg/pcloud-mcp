import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { listfolderHandler, ListfolderToolMeta } from './listfolder.js';
import { userinfoHandler, UserinfoToolMeta } from './userinfo.js';
import { createfolderHandler, CreatefolderToolMeta } from './createfolder.js';
import { deletefileHandler, DeletefileToolMeta } from './deletefile.js';
import { getfilelinkHandler, GetfilelinkToolMeta } from './getfilelink.js';
import { statHandler, StatToolMeta } from './stat.js';
import { deletefolderrecursiveHandler, DeletefolderrecursiveToolMeta } from './deletefolderrecursive.js';
import { renamefileHandler, RenamefileToolMeta } from './renamefile.js';
import { renamefolderHandler, RenamefolderToolMeta } from './renamefolder.js';
import { listrevisionsHandler, ListrevisionsToolMeta } from './listrevisions.js';
import { uploadfileHandler, UploadfileToolMeta } from './uploadfile.js';
import { readfileHandler, ReadfileToolMeta } from './readfile.js';
import { deletefolderHandler, DeletefolderToolMeta } from './deletefolder.js';
import { resolveHandler, ResolveToolMeta } from './resolve.js';
import { trashListHandler, TrashListToolMeta } from './trash_list.js';
import { trashRestoreHandler, TrashRestoreToolMeta } from './trash_restore.js';
import { getfilepublinkHandler, GetfilepublinkToolMeta } from './getfilepublink.js';
import { getfolderpublinkHandler, GetfolderpublinkToolMeta } from './getfolderpublink.js';
import { listpublinksHandler, ListpublinksToolMeta } from './listpublinks.js';
import { deletepublinkHandler, DeletepublinkToolMeta } from './deletepublink.js';
import { diffHandler, DiffToolMeta } from './diff.js';
import { findHandler, FindToolMeta } from './find.js';
import { createuploadlinkHandler, CreateuploadlinkToolMeta } from './createuploadlink.js';
import { uploadtolinkHandler, UploadtolinkToolMeta } from './uploadtolink.js';
import { showuploadlinkHandler, ShowuploadlinkToolMeta } from './showuploadlink.js';
import { copyfileHandler, CopyfileToolMeta } from './copyfile.js';
import { copyfolderHandler, CopyfolderToolMeta } from './copyfolder.js';
import { revertrevisionHandler, RevertrevisionToolMeta } from './revertrevision.js';
import { createfolderifnotexistsHandler, CreatefolderifnotexistsToolMeta } from './createfolderifnotexists.js';
import { downloadfileHandler, DownloadfileToolMeta } from './downloadfile.js';
import { checksumfileHandler, ChecksumfileToolMeta } from './checksumfile.js';
import { getthumblinkHandler, GetthumblinkToolMeta } from './getthumblink.js';
import { getvideolinkHandler, GetvideolinkToolMeta } from './getvideolink.js';
import { getaudiolinkHandler, GetaudiolinkToolMeta } from './getaudiolink.js';
import { getapiserverHandler, GetapiserverToolMeta } from './getapiserver.js';
import { currentserverHandler, CurrentserverToolMeta } from './currentserver.js';
import { extractarchiveHandler, ExtractarchiveToolMeta } from './extractarchive.js';
import { batchrenameHandler, BatchrenameToolMeta } from './batchrename.js';
import { listRecursiveHandler, ListRecursiveToolMeta } from './list-recursive.js';
import { rangeReadHandler, RangeReadToolMeta } from './range-read.js';
import { checksumGroupHandler, ChecksumGroupToolMeta } from './checksum-group.js';

const OUTPUT_SCHEMA = z.object({ result: z.literal(0) }).passthrough();
const OUTPUT_SCHEMA_PASSTHROUGH = z.object({}).passthrough();

export function registerPcloudTools(server: McpServer): void {
  const tools = [
    { name: 'userinfo', meta: UserinfoToolMeta, handler: userinfoHandler, outputSchema: OUTPUT_SCHEMA },
    { name: 'listfolder', meta: ListfolderToolMeta, handler: listfolderHandler, outputSchema: OUTPUT_SCHEMA },
    { name: 'stat', meta: StatToolMeta, handler: statHandler, outputSchema: OUTPUT_SCHEMA },
    { name: 'getfilelink', meta: GetfilelinkToolMeta, handler: getfilelinkHandler, outputSchema: OUTPUT_SCHEMA },
    { name: 'readfile', meta: ReadfileToolMeta, handler: readfileHandler, outputSchema: OUTPUT_SCHEMA_PASSTHROUGH },
    { name: 'listrevisions', meta: ListrevisionsToolMeta, handler: listrevisionsHandler, outputSchema: OUTPUT_SCHEMA },
    { name: 'createfolder', meta: CreatefolderToolMeta, handler: createfolderHandler, outputSchema: OUTPUT_SCHEMA },
    { name: 'renamefile', meta: RenamefileToolMeta, handler: renamefileHandler, outputSchema: OUTPUT_SCHEMA },
    { name: 'renamefolder', meta: RenamefolderToolMeta, handler: renamefolderHandler, outputSchema: OUTPUT_SCHEMA },
    { name: 'uploadfile', meta: UploadfileToolMeta, handler: uploadfileHandler, outputSchema: OUTPUT_SCHEMA },
    { name: 'deletefile', meta: DeletefileToolMeta, handler: deletefileHandler, outputSchema: OUTPUT_SCHEMA },
    { name: 'deletefolder', meta: DeletefolderToolMeta, handler: deletefolderHandler, outputSchema: OUTPUT_SCHEMA },
    { name: 'resolve', meta: ResolveToolMeta, handler: resolveHandler, outputSchema: OUTPUT_SCHEMA_PASSTHROUGH },
    { name: 'trash_list', meta: TrashListToolMeta, handler: trashListHandler, outputSchema: OUTPUT_SCHEMA },
    { name: 'trash_restore', meta: TrashRestoreToolMeta, handler: trashRestoreHandler, outputSchema: OUTPUT_SCHEMA },
    { name: 'getfilepublink', meta: GetfilepublinkToolMeta, handler: getfilepublinkHandler, outputSchema: OUTPUT_SCHEMA },
    { name: 'getfolderpublink', meta: GetfolderpublinkToolMeta, handler: getfolderpublinkHandler, outputSchema: OUTPUT_SCHEMA },
    { name: 'listpublinks', meta: ListpublinksToolMeta, handler: listpublinksHandler, outputSchema: OUTPUT_SCHEMA },
    { name: 'deletepublink', meta: DeletepublinkToolMeta, handler: deletepublinkHandler, outputSchema: OUTPUT_SCHEMA },
    { name: 'diff', meta: DiffToolMeta, handler: diffHandler, outputSchema: OUTPUT_SCHEMA },
    { name: 'find', meta: FindToolMeta, handler: findHandler, outputSchema: OUTPUT_SCHEMA_PASSTHROUGH },
    { name: 'createuploadlink', meta: CreateuploadlinkToolMeta, handler: createuploadlinkHandler, outputSchema: OUTPUT_SCHEMA },
    { name: 'uploadtolink', meta: UploadtolinkToolMeta, handler: uploadtolinkHandler, outputSchema: OUTPUT_SCHEMA },
    { name: 'showuploadlink', meta: ShowuploadlinkToolMeta, handler: showuploadlinkHandler, outputSchema: OUTPUT_SCHEMA },
    { name: 'copyfile', meta: CopyfileToolMeta, handler: copyfileHandler, outputSchema: OUTPUT_SCHEMA },
    { name: 'copyfolder', meta: CopyfolderToolMeta, handler: copyfolderHandler, outputSchema: OUTPUT_SCHEMA },
    { name: 'revertrevision', meta: RevertrevisionToolMeta, handler: revertrevisionHandler, outputSchema: OUTPUT_SCHEMA },
    { name: 'createfolderifnotexists', meta: CreatefolderifnotexistsToolMeta, handler: createfolderifnotexistsHandler, outputSchema: OUTPUT_SCHEMA_PASSTHROUGH },
    { name: 'downloadfile', meta: DownloadfileToolMeta, handler: downloadfileHandler, outputSchema: OUTPUT_SCHEMA },
    { name: 'checksumfile', meta: ChecksumfileToolMeta, handler: checksumfileHandler, outputSchema: OUTPUT_SCHEMA_PASSTHROUGH },
    { name: 'getthumblink', meta: GetthumblinkToolMeta, handler: getthumblinkHandler, outputSchema: OUTPUT_SCHEMA },
    { name: 'getvideolink', meta: GetvideolinkToolMeta, handler: getvideolinkHandler, outputSchema: OUTPUT_SCHEMA },
    { name: 'getaudiolink', meta: GetaudiolinkToolMeta, handler: getaudiolinkHandler, outputSchema: OUTPUT_SCHEMA },
    { name: 'getapiserver', meta: GetapiserverToolMeta, handler: getapiserverHandler, outputSchema: OUTPUT_SCHEMA },
    { name: 'currentserver', meta: CurrentserverToolMeta, handler: currentserverHandler, outputSchema: OUTPUT_SCHEMA },
    { name: 'extractarchive', meta: ExtractarchiveToolMeta, handler: extractarchiveHandler, outputSchema: OUTPUT_SCHEMA },
    { name: 'deletefolderrecursive', meta: DeletefolderrecursiveToolMeta, handler: deletefolderrecursiveHandler, outputSchema: OUTPUT_SCHEMA },
    { name: 'batchrename', meta: BatchrenameToolMeta, handler: batchrenameHandler, outputSchema: OUTPUT_SCHEMA_PASSTHROUGH },
    { name: 'list_recursive', meta: ListRecursiveToolMeta, handler: listRecursiveHandler, outputSchema: OUTPUT_SCHEMA_PASSTHROUGH },
    { name: 'range_read', meta: RangeReadToolMeta, handler: rangeReadHandler, outputSchema: OUTPUT_SCHEMA_PASSTHROUGH },
    { name: 'checksum_group', meta: ChecksumGroupToolMeta, handler: checksumGroupHandler, outputSchema: OUTPUT_SCHEMA_PASSTHROUGH },
  ];

  for (const tool of tools) {
    server.registerTool(tool.name, {
      title: tool.meta.title,
      description: tool.meta.description,
      inputSchema: tool.meta.inputSchema,
      outputSchema: tool.outputSchema,
      annotations: tool.meta.annotations,
    }, tool.handler);
  }
}

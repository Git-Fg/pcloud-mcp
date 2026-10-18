import { z } from 'zod';

/**
 * Live pCloud response shapes (captured from the real API).
 *
 * - Timestamps are RFC-822 strings (e.g. "Sun, 07 Apr 2024 13:09:22 +0000").
 * - `isfolder` is a real boolean, not 0/1.
 * - `id` and `folderid` are numeric IDs; `id` is the canonical identifier,
 *   `folderid`/`fileid` are aliases.
 * - listfolder puts `contents` INSIDE `metadata`, not at the top level.
 */

export const PcloudTimestamp = z.string();

export const PcloudFileItem = z
  .object({
    name: z.string(),
    path: z.string().optional(),
    isfolder: z.boolean(),
    created: PcloudTimestamp.optional(),
    modified: PcloudTimestamp.optional(),
    icon: z.string().optional(),
    thumb: z.boolean().optional(),
    ismine: z.boolean().optional(),
    isshared: z.boolean().optional(),
    parentfolderid: z.number().int().optional(),
    fileid: z.number().int().positive().optional(),
    folderid: z.number().int().nonnegative().optional(),
    id: z.string().optional(),
    size: z.number().int().nonnegative().optional(),
    contenttype: z.string().optional(),
    category: z.number().int().optional(),
    hash: z.number().int().optional(),
    comments: z.number().int().optional(),
  })
  .passthrough();

export const PcloudMetadata = z
  .object({
    name: z.string().optional(),
    path: z.string().optional(),
    created: PcloudTimestamp.optional(),
    modified: PcloudTimestamp.optional(),
    isfolder: z.boolean().optional(),
    ismine: z.boolean().optional(),
    isshared: z.boolean().optional(),
    icon: z.string().optional(),
    thumb: z.boolean().optional(),
    parentfolderid: z.number().int().optional(),
    folderid: z.number().int().nonnegative().optional(),
    fileid: z.number().int().positive().optional(),
    id: z.string().optional(),
    contents: z.array(PcloudFileItem).optional(),
  })
  .passthrough();

export const PcloudSuccess = z
  .object({
    result: z.literal(0),
  })
  .passthrough();

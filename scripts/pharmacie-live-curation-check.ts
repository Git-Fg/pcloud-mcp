/**
 * Checks the curation tools against the live pCloud API.
 *
 * A tool that works on a mock can still be wrong about the API: the field
 * names may differ, the content server may ignore the Range header, the
 * hash may not be what the docs say. This script runs the three tools on
 * real files and compares what they return with the truth.
 *
 * Usage: bun run scripts/pharmacie-live-curation-check.ts [folderid]
 */
import { listRecursiveHandler } from '../src/core/tools/list-recursive.js';
import { rangeReadHandler } from '../src/core/tools/range-read.js';
import { checksumGroupHandler } from '../src/core/tools/checksum-group.js';
import { PcloudHttpClient } from '../src/core/http/pcloudClient.js';

const folderid = Number(process.argv[2] ?? 12758060591);

const listing = await listRecursiveHandler({ folderid, maxdepth: 3, limit: 200 }, undefined);
const files = (listing.structuredContent as { files: Array<Record<string, unknown>> }).files;

console.log(`list_recursive: ${files.length} files under folder ${folderid}`);
const withHash = files.filter((f) => f.hash !== undefined).length;
const withSize = files.filter((f) => f.size !== undefined).length;
const withType = files.filter((f) => f.contenttype !== undefined).length;
console.log(`  with hash: ${withHash}, with size: ${withSize}, with contenttype: ${withType}`);
console.log(`  sample: ${JSON.stringify(files[0])}`);

// The hash must be the same for two files with the same content, and the
// size must come back exactly.
const client = new PcloudHttpClient();
if (files.length > 0) {
  const first = files[0];
  const stat = await client.json<{ result: 0; metadata: { size?: number; hash?: number } }>('stat', {
    fileid: first.fileid as number,
  });
  console.log(
    `  stat agrees on size: ${stat.metadata.size === first.size}, on hash: ${stat.metadata.hash === first.hash}`
  );
}

// range_read must return the real beginning of the file.
const target = files.find((f) => (f.size as number) > 0);
if (target) {
  const read = await rangeReadHandler({ fileid: target.fileid as number, range: '0-1023' }, undefined);
  const body = read.structuredContent as { bytes: number; base64: string; contentType: string };
  const decoded = Buffer.from(body.base64, 'base64');
  console.log(`range_read: ${body.bytes} bytes, content-type ${body.contentType}`);
  console.log(`  first 16 bytes: ${decoded.subarray(0, 16).toString('hex')}`);

  // The same bytes fetched without a Range header must match.
  const link = await client.json<{ result: 0; hosts: string[]; path: string }>('getfilelink', {
    fileid: target.fileid as number,
  });
  const full = await fetch(`https://${link.hosts[0]}${link.path}`);
  const fullBytes = new Uint8Array(await full.arrayBuffer());
  const same = decoded.every((byte, index) => byte === fullBytes[index]);
  console.log(`  matches the beginning of the whole file: ${same}`);
}

// checksum_group must cost one call per candidate group, not one per file.
const sample = files.slice(0, 12);
if (sample.length > 0) {
  const grouped = await checksumGroupHandler(
    { files: sample.map((f) => ({ fileid: f.fileid as number, size: f.size as number, hash: f.hash as number })) },
    undefined
  );
  const stats = (grouped.structuredContent as { stats: { apiCalls: number; files: number; groups: number } }).stats;
  console.log(
    `checksum_group: ${stats.files} files in ${stats.groups} groups, ${stats.apiCalls} checksumfile call(s)`
  );
  const digests = (grouped.structuredContent as { digests: Record<string, string> }).digests;
  const firstId = String(sample[0].fileid);
  if (digests[firstId]) {
    const direct = await client.json<{ result: 0; sha1?: string }>('checksumfile', {
      fileid: sample[0].fileid as number,
    });
    console.log(`  digest agrees with a direct checksumfile call: ${digests[firstId] === direct.sha1}`);
  }
}
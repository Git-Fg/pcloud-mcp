/**
 * Creates a tar archive from the local mirror, using canonical paths.
 *
 * The mapping gives, for each file in the mirror, its canonical path in the
 * organised tree. The tar is built by reading each file from the mirror
 * (where it sits under its old relative path) and writing it to the tar
 * under its canonical path (with the /Pharmacie prefix stripped).
 *
 * Files whose content was deleted during deduplication are noted but do not
 * block the archive — the tar contains what exists.
 *
 * Usage: bun run scripts/pharmacie-create-tar.ts [mapping] [mirrorRoot] [outTar] [concurrency]
 */
import { readFile, _writeFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { _PcloudHttpClient } from '../src/core/http/pcloudClient.js';

interface MappedEntry {
  mirrorPath: string;
  canonicalPath: string;
  name: string;
  size: number;
  sha1: string;
}

const mappingPath = process.argv[2] ?? '/tmp/pharmacie-tar-mapping-final.json';
const mirrorRoot = process.argv[3] ?? '/Users/felix/Downloads/pharmacie_mirror';
const outTar = process.argv[4] ?? '/Users/felix/Downloads/pharmacie_canonical.tar';
const _concurrency = Number(process.argv[5] ?? 4);

const mappingData = JSON.parse(await readFile(mappingPath, 'utf8')) as { mapping: MappedEntry[]; notFound: number };
const entries = mappingData.mapping;

console.error(`creating tar with ${entries.length} files (${mappingData.notFound} missing from mirror)`);

const tar = createWriteStream(outTar);

// Simple tar format: ustar. Each file gets a 512-byte header + data padded to 512 bytes.
// We write sequentially; no compression.
async function writeHeader(entry: MappedEntry): Promise<Buffer> {
  const header = Buffer.alloc(512);
  // name (100 bytes)
  const canonicalRelative = entry.canonicalPath.replace(/^\/Pharmacie\//, '');
  const nameBuf = Buffer.from(canonicalRelative, 'utf8');
  nameBuf.copy(header, 0, 0, Math.min(nameBuf.length, 100));
  // mode (8 bytes) - 0644
  Buffer.from('0000644').copy(header, 100, 0, 7);
  header[107] = 0;
  // uid (8 bytes)
  Buffer.from('0000000').copy(header, 108, 0, 7);
  header[115] = 0;
  // gid (8 bytes)
  Buffer.from('0000000').copy(header, 116, 0, 7);
  header[123] = 0;
  // size (12 bytes, octal)
  const sizeOctal = entry.size.toString(8).padStart(11, '0');
  Buffer.from(sizeOctal).copy(header, 124, 0, 11);
  header[135] = 0;
  // mtime (12 bytes, octal) - current time
  const mtimeOctal = Math.floor(Date.now() / 1000).toString(8).padStart(11, '0');
  Buffer.from(mtimeOctal).copy(header, 136, 0, 11);
  header[147] = 0;
  // chksum (8 bytes) - filled later
  Buffer.from('        ').copy(header, 148, 0, 8);
  // typeflag (1 byte) - '0' for regular file
  header[156] = 48;
  // linkname (100 bytes) - empty
  // magic (6 bytes) - 'ustar'
  Buffer.from('ustar').copy(header, 257, 0, 5);
  header[262] = 0;
  // version (2 bytes) - '00'
  Buffer.from('00').copy(header, 263, 0, 2);
  // uname (32 bytes) - empty
  // gname (32 bytes) - empty
  // devmajor (8 bytes) - empty
  // devminor (8 bytes) - empty
  // prefix (155 bytes) - for long names
  if (canonicalRelative.length > 100) {
    const prefix = canonicalRelative.slice(0, 155);
    Buffer.from(prefix).copy(header, 345, 0, prefix.length);
    header[345 + prefix.length] = 0;
    const namePart = canonicalRelative.slice(155);
    Buffer.from(namePart).copy(header, 0, 0, namePart.length);
  }
  // Compute checksum
  let chksum = 0;
  for (let i = 0; i < 512; i += 1) chksum += header[i];
  const chksumOctal = chksum.toString(8).padStart(6, '0');
  Buffer.from(chksumOctal + '\0 ').copy(header, 148, 0, 8);
  return header;
}

let written = 0;
let failed = 0;

async function processEntry(entry: MappedEntry): Promise<void> {
  const sourcePath = `${mirrorRoot}/${entry.mirrorPath}`;
  try {
    const header = await writeHeader(entry);
    tar.write(header);
    // Read file and write content
    const { default: fs } = await import('node:fs');
    const { default: stream } = await import('node:stream');
    await pipeline(
      fs.createReadStream(sourcePath),
      new stream.Writable({
        write(chunk, _enc, callback) {
          tar.write(chunk);
          callback();
        },
        final(callback) {
          // Pad to 512 bytes
          const mod = entry.size % 512;
          if (mod !== 0) tar.write(Buffer.alloc(512 - mod));
          callback();
        },
      })
    );
    written += 1;
  } catch (err) {
    failed += 1;
    console.error(`  FAIL ${entry.mirrorPath}: ${err instanceof Error ? err.message : err}`);
  }
}

// Process in batches to control memory
const BATCH_SIZE = 50;
for (let i = 0; i < entries.length; i += BATCH_SIZE) {
  const batch = entries.slice(i, i + BATCH_SIZE);
  await Promise.all(batch.map(processEntry));
  if (written % 500 === 0) console.error(`  ${written}/${entries.length} written`);
}

tar.end();
console.error(`tar written: ${written} files, ${failed} failed -> ${outTar}`);
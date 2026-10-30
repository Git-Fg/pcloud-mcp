/**
 * CP437 codec and mojibake repair for legacy pCloud names and titles.
 *
 * A batch of course files was uploaded with their names decoded through
 * CP437 instead of UTF-8: the UTF-8 bytes for "é" (0xC3 0xA9) were read as
 * the two CP437 characters "├" and "©". The damage is reversible because
 * CP437 is a single-byte encoding.
 *
 * Document titles carry a second flavour: PDF metadata read through latin-1,
 * where "é" comes out as the two characters "Ã©".
 *
 * Node has no CP437 codec, so the high half is embedded below as the
 * characters for bytes 0x80..0xFF.
 */

const HIGH_HALF =
  'ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■\xa0';

/** byte -> code point, for the CP437 high half. */
const HIGH_TO_BYTE = new Map<string, number>();
for (let i = 0; i < HIGH_HALF.length; i += 1) {
  HIGH_TO_BYTE.set(HIGH_HALF[i], 0x80 + i);
}

/**
 * Encodes a string to CP437 bytes.
 * @returns the bytes, or null when the string contains a character CP437
 *   cannot represent (which means the string was never CP437-mangled).
 */
export function encodeCp437(input: string): Uint8Array | null {
  const out: number[] = [];
  for (const ch of input) {
    const code = ch.codePointAt(0)!;
    if (code < 0x80) {
      out.push(code);
      continue;
    }
    const byte = HIGH_TO_BYTE.get(ch);
    if (byte === undefined) return null;
    out.push(byte);
  }
  return Uint8Array.from(out);
}

const UTF8_DECODER = new TextDecoder('utf-8', { fatal: true });

/**
 * Repairs a name that was decoded through CP437 instead of UTF-8.
 *
 * The repaired text is returned in NFC form: the original names were stored
 * decomposed (an "e" followed by a combining acute accent), which renders
 * inconsistently across viewers.
 *
 * @returns the repaired name, or null when the name was not mangled.
 */
export function repairMojibake(input: string): string | null {
  const bytes = encodeCp437(input);
  if (bytes === null) return null;
  let decoded: string;
  try {
    decoded = UTF8_DECODER.decode(bytes);
  } catch {
    return null;
  }
  // A control character means the bytes were not UTF-8 text; rewriting the
  // name would corrupt a name that was already fine.
  if (/[\u0000-\u001f\u007f]/.test(decoded)) return null;
  // An unchanged round trip means the name was never mangled.
  if (decoded === input) return null;
  // The repaired text must encode back to exactly the bytes we decoded.
  // The original names used characters outside the CP437 repertoire (a
  // typographic apostrophe, for one), so this is checked as UTF-8.
  const reencoded = new TextEncoder().encode(decoded);
  if (reencoded.length !== bytes.length) return null;
  for (let i = 0; i < bytes.length; i += 1) {
    if (reencoded[i] !== bytes[i]) return null;
  }
  return decoded.normalize('NFC');
}

/**
 * Counts the lead-plus-continuation pairs that UTF-8 bytes read as latin-1
 * leave in text: "Ã©" is a 0xC3 lead byte followed by a 0xA9 continuation
 * byte. A lone accented letter has no pair, so legitimate French survives.
 */
function mangleCount(text: string): number {
  return (text.match(/[\u00c0-\u00df][\u0080-\u00bf]/g) ?? []).length;
}

/**
 * Repairs text whose UTF-8 bytes were decoded as latin-1, the flavour PDF
 * metadata produces: "Ã©" is the two latin-1 characters for the UTF-8 bytes
 * of "é". Reading the text back as latin-1 bytes and decoding them as UTF-8
 * undoes it; the result is only kept when it really has fewer mangled
 * characters, so legitimate accents survive untouched.
 */
export function repairUtf8Mojibake(input: string): string {
  // PDF titles arrive decomposed ("A" + combining tilde); fold first so the
  // mangled characters land in the range the repair recognises.
  const text = input.normalize('NFC');
  if (!mangleCount(text)) return text;
  let decoded: string;
  try {
    decoded = UTF8_DECODER.decode(Buffer.from(text, 'latin1'));
  } catch {
    return text;
  }
  if (decoded === text || mangleCount(decoded) >= mangleCount(text)) return text;
  return decoded.normalize('NFC');
}

import { describe, it, expect } from 'bun:test';
import { repairMojibake, encodeCp437 } from './cp437.js';

describe('cp437 mojibake repair', () => {
  it('repairs a name mangled through CP437', () => {
    expect(repairMojibake('Thalasse╠ümies')).toBe('Thalassémies');
    expect(repairMojibake('Chimie The╠ürapeutique')).toBe('Chimie Thérapeutique');
    expect(repairMojibake('1e╠Çre session')).toBe('1ère session');
    expect(repairMojibake('syste╠Çme nerveux')).toBe('système nerveux');
  });

  it('repairs a name mangled through CP437 with a typographic quote', () => {
    expect(repairMojibake('Capture dΓÇÖe╠ücran 2021')).toBe('Capture d’écran 2021');
  });

  it('leaves an unmangled name untouched', () => {
    expect(repairMojibake('UE1.1.1. OMS1 - Introduction.pdf')).toBeNull();
    expect(repairMojibake('Chimie Thérapeutique')).toBeNull();
  });

  it('does not mangle a name containing a character CP437 cannot hold', () => {
    expect(repairMojibake('Thalassémies')).toBeNull();
    expect(repairMojibake('emoji ✅ notes')).toBeNull();
  });

  it('encodes the CP437 high half', () => {
    const bytes = encodeCp437('é');
    expect(bytes).not.toBeNull();
    expect(Array.from(bytes!)).toEqual([0x82]);
  });

  it('returns null for a name with an unmappable character', () => {
    expect(encodeCp437('✅')).toBeNull();
  });
});

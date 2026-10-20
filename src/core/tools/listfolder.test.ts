import { describe, it, expect } from 'bun:test';
import { ListfolderInputSchema, ListfolderOutputSchema } from './listfolder.js';

describe('listfolder schemas', () => {
  describe('ListfolderInputSchema', () => {
    it('should accept valid folderid', () => {
      const result = ListfolderInputSchema.safeParse({ folderid: 0 });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.folderid).toBe(0);
    });

    it('should default to folderid 0 when not provided', () => {
      const result = ListfolderInputSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should reject negative folderid', () => {
      expect(ListfolderInputSchema.safeParse({ folderid: -1 }).success).toBe(false);
    });

    it('should reject non-integer folderid', () => {
      expect(ListfolderInputSchema.safeParse({ folderid: 1.5 }).success).toBe(false);
    });
  });

  describe('ListfolderOutputSchema', () => {
    it('accepts a real pCloud payload (contents inside metadata, boolean isfolder)', () => {
      const response = {
        result: 0 as const,
        metadata: {
          path: '/',
          name: '/',
          isfolder: true,
          contents: [
            { name: 'test.txt', isfolder: false, fileid: 12345, size: 1024, modified: 'Sun, 18 Oct 2026 19:00:00 +0000' },
            { name: 'documents', isfolder: true, folderid: 67890 },
          ],
        },
      };
      const result = ListfolderOutputSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it('rejects non-zero result codes', () => {
      const result = ListfolderOutputSchema.safeParse({
        result: 1,
        metadata: { contents: [] },
      });
      expect(result.success).toBe(false);
    });

    it('rejects when isfolder is not boolean', () => {
      const result = ListfolderOutputSchema.safeParse({
        result: 0,
        metadata: {
          contents: [{ name: 'test', isfolder: 2 }],
        },
      });
      expect(result.success).toBe(false);
    });
  });
});

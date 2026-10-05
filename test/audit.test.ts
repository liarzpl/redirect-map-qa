import { describe, expect, it } from 'vitest';
import { applyFlattenSuggestions, runAudits } from '../src/lib/audit';
import { normalizeUrl } from '../src/lib/normalize';
import type { RedirectRecord } from '../src/lib/types';

function rec(
  partial: Partial<RedirectRecord> & {
    sourceRaw: string;
    destinationRaw: string;
  },
): RedirectRecord {
  const sourceNorm = normalizeUrl(partial.sourceRaw);
  const destinationNorm = normalizeUrl(partial.destinationRaw);
  return {
    index: partial.index ?? 0,
    sourceRaw: partial.sourceRaw,
    destinationRaw: partial.destinationRaw,
    sourceNorm,
    destinationNorm,
    type: partial.type ?? '301',
    matching: partial.matching ?? '',
    isUnsupported: partial.isUnsupported ?? false,
    fileName: partial.fileName ?? 't.csv',
    lineNo: partial.lineNo ?? 1,
    kind: partial.kind ?? 'plain',
    flags: partial.flags ?? [],
    chainLength: 0,
    flattenTo: null,
    applyFlatten: false,
    gscClicks: null,
    gscImpressions: null,
  };
}

describe('runAudits', () => {
  it('duplicate source (aynı destination, farklı dosya)', () => {
    const rows = [
      rec({ sourceRaw: '/a', destinationRaw: '/b', fileName: '1.csv', lineNo: 1 }),
      rec({
        sourceRaw: '/a',
        destinationRaw: '/b',
        fileName: '2.csv',
        lineNo: 1,
        index: 1,
      }),
    ];
    runAudits(rows);
    expect(rows.every((r) => r.flags.includes('duplicate'))).toBe(true);
  });

  it('conflict (aynı source farklı destination)', () => {
    const rows = [
      rec({ sourceRaw: '/x', destinationRaw: '/y1' }),
      rec({ sourceRaw: '/x', destinationRaw: '/y2', index: 1 }),
    ];
    runAudits(rows);
    expect(rows.every((r) => r.flags.includes('conflict'))).toBe(true);
  });

  it('chain A→B→C', () => {
    const rows = [
      rec({ sourceRaw: '/a', destinationRaw: '/b' }),
      rec({ sourceRaw: '/b', destinationRaw: '/c', index: 1 }),
    ];
    runAudits(rows);
    const a = rows[0]!;
    expect(a.flags).toContain('chain');
    expect(a.chainLength).toBeGreaterThanOrEqual(2);
    expect(a.flattenTo).toBe('/c');
  });

  it('uzun chain A→B→C→D', () => {
    const rows = [
      rec({ sourceRaw: '/a', destinationRaw: '/b' }),
      rec({ sourceRaw: '/b', destinationRaw: '/c', index: 1 }),
      rec({ sourceRaw: '/c', destinationRaw: '/d', index: 2 }),
    ];
    runAudits(rows);
    expect(rows[0]!.flags).toContain('chain');
    expect(rows[0]!.flattenTo).toBe('/d');
    expect(rows[0]!.chainLength).toBe(3);
  });

  it('loop A→B→A', () => {
    const rows = [
      rec({ sourceRaw: '/a', destinationRaw: '/b' }),
      rec({ sourceRaw: '/b', destinationRaw: '/a', index: 1 }),
    ];
    runAudits(rows);
    expect(rows[0]!.flags).toContain('loop');
    expect(rows[0]!.flattenTo).toBeNull();
  });

  it('3’lü loop A→B→C→A', () => {
    const rows = [
      rec({ sourceRaw: '/a', destinationRaw: '/b' }),
      rec({ sourceRaw: '/b', destinationRaw: '/c', index: 1 }),
      rec({ sourceRaw: '/c', destinationRaw: '/a', index: 2 }),
    ];
    runAudits(rows);
    expect(rows.every((r) => r.flags.includes('loop'))).toBe(true);
    expect(rows.every((r) => r.flattenTo === null)).toBe(true);
  });

  it('self-redirect', () => {
    const rows = [rec({ sourceRaw: '/same/', destinationRaw: '/same' })];
    runAudits(rows);
    expect(rows[0]!.flags).toContain('self');
  });

  it('regex/unsupported denetime girmez (chain üretmez)', () => {
    const rows = [
      rec({
        sourceRaw: '/re.*',
        destinationRaw: '/b',
        isUnsupported: true,
        flags: ['unsupported'],
      }),
      rec({ sourceRaw: '/b', destinationRaw: '/c', index: 1 }),
    ];
    runAudits(rows);
    expect(rows[0]!.flags).toEqual(['unsupported']);
    // /b→/c tek hop, chain yok
    expect(rows[1]!.flags).not.toContain('chain');
  });
});

describe('flatten', () => {
  it('onaylı satırda destination flattenTo olur; döngüde yok', () => {
    const rows = [
      rec({ sourceRaw: '/a', destinationRaw: '/b' }),
      rec({ sourceRaw: '/b', destinationRaw: '/c', index: 1 }),
    ];
    runAudits(rows);
    rows[0]!.applyFlatten = true;
    const out = applyFlattenSuggestions(rows);
    expect(out[0]!.destinationRaw).toBe('/c');

    const loop = [
      rec({ sourceRaw: '/a', destinationRaw: '/b' }),
      rec({ sourceRaw: '/b', destinationRaw: '/a', index: 1 }),
    ];
    runAudits(loop);
    loop[0]!.applyFlatten = true;
    loop[0]!.flattenTo = '/hack'; // zorla
    const out2 = applyFlattenSuggestions(loop);
    // loop flag varken uygulanmaz
    expect(out2[0]!.destinationRaw).toBe('/b');
  });
});

import { describe, expect, it } from 'vitest';
import { runAudits } from '../src/lib/audit';
import { joinGsc, sortByPriority } from '../src/lib/gsc';
import { normalizeUrl } from '../src/lib/normalize';
import type { GscRecord, RedirectRecord } from '../src/lib/types';

function rec(src: string, dest: string, index = 0): RedirectRecord {
  return {
    index,
    sourceRaw: src,
    destinationRaw: dest,
    sourceNorm: normalizeUrl(src),
    destinationNorm: normalizeUrl(dest),
    type: '301',
    matching: '',
    isUnsupported: false,
    fileName: 'r.csv',
    lineNo: index + 1,
    kind: 'plain',
    flags: [],
    chainLength: 0,
    flattenTo: null,
    applyFlatten: false,
    gscClicks: null,
    gscImpressions: null,
  };
}

describe('GSC join', () => {
  it('source ↔ page URL join + öncelik sıralama', () => {
    const rows = [
      rec('/ok', '/x', 0),
      rec('/hot', '/y', 1),
      rec('/a', '/b', 2),
      rec('/b', '/c', 3),
    ];
    const gsc: GscRecord[] = [
      {
        pageRaw: 'https://example.com/hot',
        pageNorm: normalizeUrl('https://example.com/hot'),
        clicks: 500,
        impressions: 9000,
        fileName: 'g.csv',
        lineNo: 1,
      },
      {
        pageRaw: 'https://example.com/a',
        pageNorm: normalizeUrl('https://example.com/a'),
        clicks: 10,
        impressions: 100,
        fileName: 'g.csv',
        lineNo: 2,
      },
    ];
    // host'siz path eşlemesi için GSC path-only
    gsc[0]!.pageNorm = normalizeUrl('/hot');
    gsc[1]!.pageNorm = normalizeUrl('/a');

    joinGsc(rows, gsc);
    runAudits(rows);
    const sorted = sortByPriority(rows);

    expect(rows[1]!.gscClicks).toBe(500);
    // chain (/a) sorunlu, hot yüksek click ama bayraksız → chain önce
    expect(sorted[0]!.sourceRaw).toBe('/a');
    expect(sorted[0]!.flags).toContain('chain');
  });
});

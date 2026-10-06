import { describe, expect, it } from 'vitest';
import { runAudits } from '../src/lib/audit';
import { joinGsc, sortByPriority } from '../src/lib/gsc';
import { normalizeUrl, type NormalizeOptions } from '../src/lib/normalize';
import type { GscRecord, RedirectRecord } from '../src/lib/types';

function rec(
  src: string,
  dest: string,
  index = 0,
  options?: NormalizeOptions,
): RedirectRecord {
  return {
    index,
    sourceRaw: src,
    destinationRaw: dest,
    sourceNorm: normalizeUrl(src, options),
    destinationNorm: normalizeUrl(dest, options),
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

function gscPage(
  page: string,
  clicks: number,
  impressions: number,
  options?: NormalizeOptions,
): GscRecord {
  return {
    pageRaw: page,
    pageNorm: normalizeUrl(page, options),
    clicks,
    impressions,
    fileName: 'g.csv',
    lineNo: 1,
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

  it('mutlak GSC sayfası göreli source ile eşleşir', () => {
    const rows = [rec('/old-a', '/new')];
    joinGsc(rows, [gscPage('https://example.com/old-a', 20, 400)]);
    expect(rows[0]!.gscClicks).toBe(20);
    expect(rows[0]!.gscImpressions).toBe(400);
  });

  it('mutlak source da path ile eşleşir', () => {
    const rows = [rec('https://www.example.com/old-a', '/new')];
    joinGsc(rows, [gscPage('https://example.com/old-a', 7, 70)]);
    expect(rows[0]!.gscClicks).toBe(7);
    expect(rows[0]!.gscImpressions).toBe(70);
  });

  it('farklı path eşleşmez', () => {
    const rows = [rec('/old-a', '/new')];
    joinGsc(rows, [gscPage('https://example.com/other', 5, 50)]);
    expect(rows[0]!.gscClicks).toBeNull();
    expect(rows[0]!.gscImpressions).toBeNull();
  });

  it('query ve trailing slash normalizeUrl ile aynıdır', () => {
    const slashed = [rec('/foo/', '/x')];
    joinGsc(slashed, [gscPage('https://example.com/foo', 3, 30)]);
    expect(slashed[0]!.gscClicks).toBe(3);

    const keptSlash = [
      rec('/foo/', '/x', 0, { ignoreTrailingSlash: false }),
    ];
    joinGsc(keptSlash, [
      gscPage('https://example.com/foo', 3, 30, { ignoreTrailingSlash: false }),
    ]);
    expect(keptSlash[0]!.gscClicks).toBeNull();

    const bothSlash = [
      rec('/foo/', '/x', 0, { ignoreTrailingSlash: false }),
    ];
    joinGsc(bothSlash, [
      gscPage('https://example.com/foo/', 8, 80, { ignoreTrailingSlash: false }),
    ]);
    expect(bothSlash[0]!.gscClicks).toBe(8);

    const queryDiff = [rec('/foo?x=1', '/x')];
    joinGsc(queryDiff, [gscPage('https://example.com/foo', 1, 1)]);
    expect(queryDiff[0]!.gscClicks).toBeNull();

    const querySame = [rec('/foo?x=1', '/x')];
    joinGsc(querySame, [gscPage('https://example.com/foo?x=1', 4, 40)]);
    expect(querySame[0]!.gscClicks).toBe(4);

    const queryIgnored = [
      rec('/foo?x=1', '/x', 0, { ignoreQuery: true }),
    ];
    joinGsc(queryIgnored, [
      gscPage('https://example.com/foo', 6, 60, { ignoreQuery: true }),
    ]);
    expect(queryIgnored[0]!.gscClicks).toBe(6);

    const caseSensitive = [rec('/Foo', '/x')];
    joinGsc(caseSensitive, [gscPage('https://example.com/foo', 2, 20)]);
    expect(caseSensitive[0]!.gscClicks).toBeNull();

    const caseFolded = [
      rec('/Foo', '/x', 0, { pathCaseInsensitive: true }),
    ];
    joinGsc(caseFolded, [
      gscPage('https://example.com/foo', 9, 90, { pathCaseInsensitive: true }),
    ]);
    expect(caseFolded[0]!.gscClicks).toBe(9);
  });
});

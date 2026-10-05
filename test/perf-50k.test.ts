import { describe, expect, it } from 'vitest';
import { runAudits } from '../src/lib/audit';
import { normalizeUrl } from '../src/lib/normalize';
import type { RedirectRecord } from '../src/lib/types';

describe('50k+ sentetik performans', () => {
  it('55_000 satır denetimi makul sürede biter', () => {
    const N = 55_000;
    const rows: RedirectRecord[] = [];
    for (let i = 0; i < N; i++) {
      const src = `/p/${i}`;
      // her 10. satırda kısa zincir: i → i+1 (i%10===0 && i+1 < N)
      let dest = `/t/${i}`;
      if (i % 10 === 0 && i + 1 < N) dest = `/p/${i + 1}`;
      if (i === 100) dest = `/p/100`; // self
      if (i === 200) dest = `/p/201`;
      if (i === 201) dest = `/p/200`; // loop
      rows.push({
        index: i,
        sourceRaw: src,
        destinationRaw: dest,
        sourceNorm: normalizeUrl(src),
        destinationNorm: normalizeUrl(dest),
        type: '301',
        matching: '',
        isUnsupported: false,
        fileName: 'SENTETIK-perf.csv',
        lineNo: i + 1,
        kind: 'plain',
        flags: [],
        chainLength: 0,
        flattenTo: null,
        applyFlatten: false,
        gscClicks: null,
        gscImpressions: null,
      });
    }

    const t0 = Date.now();
    const summary = runAudits(rows);
    const ms = Date.now() - t0;

    expect(summary.total).toBe(N);
    expect(summary.self).toBeGreaterThan(0);
    expect(summary.loop).toBeGreaterThan(0);
    expect(summary.chain).toBeGreaterThan(0);
    // Makul: 30s altı (tipik çok daha hızlı)
    expect(ms).toBeLessThan(30_000);
  }, 60_000);
});

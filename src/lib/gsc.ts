/**
 * Opsiyonel GSC Pages join: path anahtarı (şema ve host yok).
 * GSC mutlak URL, yönlendirme çoğu zaman göreli path verir.
 */

import { pathKeyFromNormalized } from './normalize';
import type { GscRecord, RedirectRecord } from './types';

export function joinGsc(
  records: RedirectRecord[],
  gsc: GscRecord[],
): void {
  const map = new Map<string, GscRecord>();
  for (const g of gsc) {
    const key = pathKeyFromNormalized(g.pageNorm);
    if (!key) continue;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, { ...g });
    } else {
      // Topla (aynı path birden fazla satır)
      prev.clicks += g.clicks;
      prev.impressions += g.impressions;
    }
  }

  for (const r of records) {
    const hit = map.get(pathKeyFromNormalized(r.sourceNorm));
    if (hit) {
      r.gscClicks = hit.clicks;
      r.gscImpressions = hit.impressions;
    } else {
      r.gscClicks = null;
      r.gscImpressions = null;
    }
  }
}

/** Sorunlu + yüksek click önce. */
export function sortByPriority(records: RedirectRecord[]): RedirectRecord[] {
  const severity = (r: RedirectRecord): number => {
    if (r.flags.includes('loop')) return 100;
    if (r.flags.includes('conflict')) return 90;
    if (r.flags.includes('self')) return 80;
    if (r.flags.includes('chain')) return 70;
    if (r.flags.includes('duplicate')) return 50;
    if (r.flags.includes('unsupported')) return 20;
    return 0;
  };

  return [...records].sort((a, b) => {
    const ds = severity(b) - severity(a);
    if (ds !== 0) return ds;
    const ca = a.gscClicks ?? -1;
    const cb = b.gscClicks ?? -1;
    if (cb !== ca) return cb - ca;
    return a.index - b.index;
  });
}

/**
 * Yapısal yönlendirme denetimleri (canlı HTTP yok).
 * duplicate, conflict, chain, loop, self; regex/wildcard → unsupported (denetime girmez).
 */

import type { AuditFlag, AuditOptions, AuditSummary, RedirectRecord } from './types';

function addFlag(rec: RedirectRecord, flag: AuditFlag): void {
  if (!rec.flags.includes(flag)) rec.flags.push(flag);
}

/**
 * Denetimleri çalıştırır; records üzerinde flags/chainLength/flattenTo günceller.
 * Unsupported satırlar graph'a eklenmez.
 */
export function runAudits(
  records: RedirectRecord[],
  _options: AuditOptions = { normalize: {} },
): AuditSummary {
  // Reset flags except we keep unsupported as marked at parse time
  for (const r of records) {
    const keepUnsupported = r.isUnsupported;
    r.flags = keepUnsupported ? ['unsupported'] : [];
    r.chainLength = 0;
    r.flattenTo = null;
  }

  const active = records.filter((r) => !r.isUnsupported && r.sourceNorm);

  // Group by sourceNorm
  const bySource = new Map<string, RedirectRecord[]>();
  for (const r of active) {
    const list = bySource.get(r.sourceNorm) ?? [];
    list.push(r);
    bySource.set(r.sourceNorm, list);
  }

  // duplicate + conflict
  for (const [, list] of bySource) {
    if (list.length < 2) continue;
    const dests = new Set(list.map((r) => r.destinationNorm));
    if (dests.size === 1) {
      for (const r of list) addFlag(r, 'duplicate');
    } else {
      for (const r of list) addFlag(r, 'conflict');
    }
  }

  // Build graph: sourceNorm → preferred destinationNorm
  // For conflicts, skip chain analysis from that source (ambiguous)
  const graph = new Map<string, string>();
  for (const [src, list] of bySource) {
    const dests = new Set(list.map((r) => r.destinationNorm));
    if (dests.size === 1) {
      const dest = list[0]!.destinationNorm;
      // Self-edge grafik dışı (self bayrağı ayrı); yoksa loop gibi görünür
      if (dest && dest !== src) graph.set(src, dest);
    }
  }

  // self-redirect
  for (const r of active) {
    if (r.sourceNorm && r.sourceNorm === r.destinationNorm) {
      addFlag(r, 'self');
    }
  }

  // chain + loop via following graph
  const memo = new Map<
    string,
    { terminal: string | null; length: number; loop: boolean; path: string[] }
  >();

  function follow(start: string): {
    terminal: string | null;
    length: number;
    loop: boolean;
    path: string[];
  } {
    const cached = memo.get(start);
    if (cached) return cached;

    const seen = new Map<string, number>();
    const path: string[] = [];
    let cur: string | undefined = start;
    let steps = 0;

    while (cur && graph.has(cur)) {
      if (seen.has(cur)) {
        // loop
        const result = {
          terminal: null as string | null,
          length: steps,
          loop: true,
          path: [...path, cur],
        };
        memo.set(start, result);
        return result;
      }
      seen.set(cur, steps);
      path.push(cur);
      const next: string = graph.get(cur)!;
      steps += 1;
      // self edge
      if (next === cur) {
        const result = {
          terminal: next,
          length: steps,
          loop: true,
          path: [...path, next],
        };
        memo.set(start, result);
        return result;
      }
      cur = next;
      if (steps > graph.size + 2) {
        const result = {
          terminal: null as string | null,
          length: steps,
          loop: true,
          path,
        };
        memo.set(start, result);
        return result;
      }
    }

    const terminal = cur ?? path[path.length - 1] ?? null;
    const result = {
      terminal,
      length: steps,
      loop: false,
      path: terminal && !path.includes(terminal) ? [...path, terminal] : path,
    };
    memo.set(start, result);
    return result;
  }

  for (const r of active) {
    if (!graph.has(r.sourceNorm)) continue;
    if (r.flags.includes('conflict')) continue;

    const result = follow(r.sourceNorm);
    if (result.loop) {
      addFlag(r, 'loop');
      r.chainLength = result.length;
      r.flattenTo = null;
    } else if (result.length >= 2) {
      // A→B→C means length 2 hops from A
      addFlag(r, 'chain');
      r.chainLength = result.length;
      // Flatten to terminal if terminal !== immediate dest
      if (result.terminal && result.terminal !== r.destinationNorm) {
        r.flattenTo = result.terminal;
      } else if (result.terminal && result.length >= 2) {
        r.flattenTo = result.terminal;
      }
    }
  }

  return summarize(records);
}

export function summarize(records: RedirectRecord[]): AuditSummary {
  const s: AuditSummary = {
    total: records.length,
    duplicate: 0,
    conflict: 0,
    chain: 0,
    loop: 0,
    self: 0,
    unsupported: 0,
    ok: 0,
    withGsc: 0,
  };
  for (const r of records) {
    if (r.flags.includes('duplicate')) s.duplicate += 1;
    if (r.flags.includes('conflict')) s.conflict += 1;
    if (r.flags.includes('chain')) s.chain += 1;
    if (r.flags.includes('loop')) s.loop += 1;
    if (r.flags.includes('self')) s.self += 1;
    if (r.flags.includes('unsupported')) s.unsupported += 1;
    if (r.flags.length === 0) s.ok += 1;
    if (r.gscClicks !== null || r.gscImpressions !== null) s.withGsc += 1;
  }
  return s;
}

/**
 * Flatten önerisini uygula: onaylı satırlarda destination → flattenTo.
 * Döngülerde öneri yok.
 */
export function applyFlattenSuggestions(
  records: RedirectRecord[],
): RedirectRecord[] {
  return records.map((r) => {
    if (r.applyFlatten && r.flattenTo && !r.flags.includes('loop')) {
      return {
        ...r,
        destinationRaw: r.flattenTo,
        destinationNorm: r.flattenTo,
      };
    }
    return r;
  });
}

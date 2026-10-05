/**
 * Bilinen export şemaları — sütun adları belgelenmiş kaynaklardan.
 *
 * Rank Math: https://rankmath.com/kb/how-to-manage-redirects-via-csv/
 *   id, source, matching, destination, type, category, status, ignore
 *   matching: exact | contains | start | end | regex
 *
 * Redirection (John Godley) CSV export (kaynak kod fileio/csv.php @ 5.5.2 jsDelivr;
 *   doküman: https://redirection.me/support/import-export/ ):
 *   source, target, regex, code, type, hits, title, status
 *   (PR #4201 ile yeni sürümlerde opsiyonel `group` sütunu olabilir)
 *   Dokümandaki import örneği başlıksız da olabilir: source URL, target URL [, regex, http code, type]
 *
 * Düz CSV: source, destination (veya Türkçe kaynak/hedef)
 *
 * GSC Pages/Performance: sayfa URL + clicks + impressions
 *   EN: Top pages / Page / Landing page / URL ; Clicks ; Impressions
 *   TR: En çok ziyaret edilen sayfalar / Üst sayfalar / Sayfa ; Tıklamalar ; Gösterimler
 */

import { normalizeHeader } from './columns';

/** Takma adlar başlıkla aynı anahtardan geçer (İ/I/ı → i). */
function aliasSet(names: readonly string[]): Set<string> {
  return new Set(names.map((name) => normalizeHeader(name)));
}

export type FileKind =
  | 'rankmath'
  | 'redirection'
  | 'plain'
  | 'gsc'
  | 'unknown';

export interface ColumnRoles {
  source?: number;
  destination?: number;
  type?: number;
  matching?: number;
  regex?: number;
  page?: number;
  clicks?: number;
  impressions?: number;
}

export interface SchemaDetection {
  kind: FileKind;
  confidence: 'high' | 'medium' | 'low';
  roles: ColumnRoles;
  notes: string[];
}

const RM_SOURCE = aliasSet(['source']);
const RM_DEST = aliasSet(['destination']);
const RM_MATCH = aliasSet(['matching']);
const RM_TYPE = aliasSet(['type']);

const RD_SOURCE = aliasSet(['source', 'sourceurl']);
const RD_TARGET = aliasSet(['target', 'targeturl']);
const RD_REGEX = aliasSet(['regex']);
const RD_CODE = aliasSet(['code', 'httpcode']);

const PLAIN_SOURCE = aliasSet(['source', 'kaynak', 'from', 'eskiurl', 'oldurl']);
const PLAIN_DEST = aliasSet([
  'destination',
  'target',
  'hedef',
  'to',
  'yeniurl',
  'newurl',
]);

const GSC_PAGE = aliasSet([
  'toppages',
  'page',
  'landingpage',
  'url',
  'ençokziyaretedilensayfalar',
  'encokziyaretedilensayfalar',
  'üstsayfalar',
  'ustsayfalar',
  'sayfa',
  'sayfalar',
]);
const GSC_CLICKS = aliasSet(['clicks', 'tıklamalar', 'tiklamalar']);
const GSC_IMPR = aliasSet(['impressions', 'gösterimler', 'gosterimler']);

function idx(headers: string[], aliases: Set<string>): number {
  for (let i = 0; i < headers.length; i++) {
    const n = normalizeHeader(headers[i] ?? '');
    if (aliases.has(n)) return i;
  }
  return -1;
}

function hasAll(headers: string[], names: string[]): boolean {
  const set = new Set(headers.map(normalizeHeader));
  return names.every((n) => set.has(normalizeHeader(n)));
}

/**
 * Başlıklardan dosya türünü tahmin et.
 */
export function detectSchema(headers: string[]): SchemaDetection {
  const notes: string[] = [];
  const norm = headers.map((h) => normalizeHeader(h));

  // Rank Math: source + destination + matching (güçlü sinyal)
  const rmSource = idx(headers, RM_SOURCE);
  const rmDest = idx(headers, RM_DEST);
  const rmMatch = idx(headers, RM_MATCH);
  if (rmSource >= 0 && rmDest >= 0 && rmMatch >= 0) {
    return {
      kind: 'rankmath',
      confidence: 'high',
      roles: {
        source: rmSource,
        destination: rmDest,
        matching: rmMatch,
        type: idx(headers, RM_TYPE) >= 0 ? idx(headers, RM_TYPE) : undefined,
      },
      notes: [
        'Rank Math CSV: id, source, matching, destination, type, category, status, ignore',
      ],
    };
  }
  // Rank Math zayıf: source+destination ve 'category' veya 'ignore' var, target yok
  if (
    rmSource >= 0 &&
    rmDest >= 0 &&
    (norm.includes('category') || norm.includes('ignore') || norm.includes('id'))
  ) {
    if (!norm.includes('target') && !norm.includes('regex')) {
      return {
        kind: 'rankmath',
        confidence: 'medium',
        roles: {
          source: rmSource,
          destination: rmDest,
          matching: rmMatch >= 0 ? rmMatch : undefined,
          type: idx(headers, RM_TYPE) >= 0 ? idx(headers, RM_TYPE) : undefined,
        },
        notes: ['Rank Math benzeri (matching yok veya eksik)'],
      };
    }
  }

  // Redirection: source + target (+ regex/code)
  const rdSource = idx(headers, RD_SOURCE);
  const rdTarget = idx(headers, RD_TARGET);
  const rdRegex = idx(headers, RD_REGEX);
  const rdCode = idx(headers, RD_CODE);
  if (rdSource >= 0 && rdTarget >= 0) {
    const conf =
      rdRegex >= 0 || rdCode >= 0 || norm.includes('hits') || norm.includes('status')
        ? 'high'
        : 'medium';
    return {
      kind: 'redirection',
      confidence: conf,
      roles: {
        source: rdSource,
        destination: rdTarget,
        regex: rdRegex >= 0 ? rdRegex : undefined,
        type: rdCode >= 0 ? rdCode : idx(headers, RM_TYPE) >= 0 ? idx(headers, RM_TYPE) : undefined,
      },
      notes: [
        'Redirection CSV: source, target, regex, code, type, hits, title, status (+opsiyonel group)',
      ],
    };
  }

  // GSC
  const gscPage = idx(headers, GSC_PAGE);
  const gscClicks = idx(headers, GSC_CLICKS);
  const gscImpr = idx(headers, GSC_IMPR);
  if (gscPage >= 0 && (gscClicks >= 0 || gscImpr >= 0)) {
    return {
      kind: 'gsc',
      confidence: gscClicks >= 0 && gscImpr >= 0 ? 'high' : 'medium',
      roles: {
        page: gscPage,
        clicks: gscClicks >= 0 ? gscClicks : undefined,
        impressions: gscImpr >= 0 ? gscImpr : undefined,
      },
      notes: ['GSC Pages/Performance CSV'],
    };
  }

  // Plain source,destination
  const pSrc = idx(headers, PLAIN_SOURCE);
  const pDst = idx(headers, PLAIN_DEST);
  if (pSrc >= 0 && pDst >= 0 && pSrc !== pDst) {
    return {
      kind: 'plain',
      confidence: 'medium',
      roles: {
        source: pSrc,
        destination: pDst,
        type: idx(headers, RM_TYPE) >= 0 ? idx(headers, RM_TYPE) : undefined,
      },
      notes: ['Düz source,destination CSV'],
    };
  }

  notes.push('Bilinmeyen şema: sütun seçici gerekli');
  return { kind: 'unknown', confidence: 'low', roles: {}, notes };
}

export function cell(row: unknown[], index: number | undefined): string {
  if (index === undefined || index < 0) return '';
  const v = row[index];
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

/** Rank Math matching veya Redirection regex / wildcard mı? */
export function isUnsupportedRule(opts: {
  kind: FileKind;
  matching?: string;
  regex?: string;
  source: string;
}): boolean {
  const matching = (opts.matching ?? '').toLowerCase().trim();
  if (matching === 'regex' || matching === 'contains' || matching === 'start' || matching === 'end') {
    // contains/start/end are pattern-like — mark unsupported for structural QA
    return true;
  }
  const rx = (opts.regex ?? '').toString().trim().toLowerCase();
  if (rx === '1' || rx === 'true' || rx === 'yes') return true;

  // Wildcard *
  if (opts.source.includes('*')) return true;
  // Obvious regex metacharacters as sole pattern signal when matching empty
  if (/[\^$()[\]+?|\\]/.test(opts.source) && matching === 'regex') return true;

  return false;
}

export { hasAll };

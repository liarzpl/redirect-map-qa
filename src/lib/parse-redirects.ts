/**
 * Yüklenen satırları RedirectRecord / GscRecord'a çevirir.
 */

import { normalizeUrl, type NormalizeOptions } from './normalize';
import {
  cell,
  detectSchema,
  isUnsupportedRule,
  type ColumnRoles,
  type FileKind,
} from './schemas';
import type { GscRecord, ParsedUpload, RedirectRecord } from './types';

export function buildParsedUpload(
  fileName: string,
  headers: string[],
  rows: unknown[][],
  overrideKind?: FileKind,
  overrideRoles?: ColumnRoles,
): ParsedUpload {
  const detected = detectSchema(headers);
  const kind = overrideKind ?? detected.kind;
  const roles = overrideRoles ?? detected.roles;
  return {
    fileName,
    headers,
    rows,
    kind,
    roles,
    confidence: overrideKind ? 'medium' : detected.confidence,
    notes: detected.notes,
  };
}

export function parseRedirectUpload(
  upload: ParsedUpload,
  startIndex: number,
  normOpts: NormalizeOptions,
): RedirectRecord[] {
  if (upload.kind === 'gsc') return [];

  const { roles, fileName, kind } = upload;
  const out: RedirectRecord[] = [];

  upload.rows.forEach((row, i) => {
    const sourceRaw = cell(row, roles.source);
    const destinationRaw = cell(row, roles.destination);
    if (!sourceRaw && !destinationRaw) return;

    const matching = cell(row, roles.matching);
    const regex = cell(row, roles.regex);
    const type = cell(row, roles.type) || '301';

    const unsupported = isUnsupportedRule({
      kind,
      matching,
      regex,
      source: sourceRaw,
    });

    const sourceNorm = normalizeUrl(sourceRaw, normOpts);
    const destinationNorm = normalizeUrl(destinationRaw, normOpts);

    const rec: RedirectRecord = {
      index: startIndex + out.length,
      sourceRaw,
      destinationRaw,
      sourceNorm,
      destinationNorm,
      type,
      matching: matching || (regex ? `regex=${regex}` : ''),
      isUnsupported: unsupported,
      fileName,
      lineNo: i + 1,
      kind,
      flags: unsupported ? ['unsupported'] : [],
      chainLength: 0,
      flattenTo: null,
      applyFlatten: false,
      gscClicks: null,
      gscImpressions: null,
    };
    out.push(rec);
  });

  return out;
}

export function parseGscUpload(
  upload: ParsedUpload,
  normOpts: NormalizeOptions,
): GscRecord[] {
  if (upload.kind !== 'gsc') return [];
  const { roles, fileName } = upload;
  const out: GscRecord[] = [];

  upload.rows.forEach((row, i) => {
    const pageRaw = cell(row, roles.page);
    if (!pageRaw) return;
    const clicks = parseNum(cell(row, roles.clicks));
    const impressions = parseNum(cell(row, roles.impressions));
    out.push({
      pageRaw,
      pageNorm: normalizeUrl(pageRaw, normOpts),
      clicks,
      impressions,
      fileName,
      lineNo: i + 1,
    });
  });

  return out;
}

function parseNum(s: string): number {
  if (!s) return 0;
  const cleaned = s.replace(/[^\d.-]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

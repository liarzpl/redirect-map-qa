/**
 * Düzeltilmiş map + sorun raporu CSV (formula-guard zorunlu).
 */

import { downloadEscapedWorkbook } from './excel';
import { applyFlattenSuggestions } from './audit';
import type { RedirectRecord } from './types';

export function downloadFixedMapCsv(records: RedirectRecord[]): void {
  const applied = applyFlattenSuggestions(records).filter(
    (r) => !r.isUnsupported && r.sourceRaw,
  );
  const headers = ['source', 'destination', 'type'];
  const rows = applied.map((r) => [r.sourceRaw, r.destinationRaw, r.type || '301']);
  downloadEscapedWorkbook(headers, rows, 'redirect-map-fixed.csv', 'csv');
}

export function downloadIssuesCsv(records: RedirectRecord[]): void {
  const headers = [
    'source',
    'destination',
    'type',
    'flags',
    'chain_length',
    'flatten_to',
    'file',
    'line',
    'gsc_clicks',
    'gsc_impressions',
  ];
  const rows = records
    .filter((r) => r.flags.length > 0)
    .map((r) => [
      r.sourceRaw,
      r.destinationRaw,
      r.type,
      r.flags.join('|'),
      r.chainLength || '',
      r.flattenTo ?? '',
      r.fileName,
      r.lineNo,
      r.gscClicks ?? '',
      r.gscImpressions ?? '',
    ]);
  downloadEscapedWorkbook(headers, rows, 'redirect-map-issues.csv', 'csv');
}

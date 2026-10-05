import type { FileKind } from './schemas';
import type { NormalizeOptions } from './normalize';

export type AuditFlag =
  | 'duplicate'
  | 'conflict'
  | 'chain'
  | 'loop'
  | 'self'
  | 'unsupported';

export interface RedirectRecord {
  /** Birleşik liste indeksi (0-based). */
  index: number;
  sourceRaw: string;
  destinationRaw: string;
  sourceNorm: string;
  destinationNorm: string;
  type: string;
  matching: string;
  isUnsupported: boolean;
  fileName: string;
  /** Dosyadaki veri satır no (başlık sonrası 1-based). */
  lineNo: number;
  kind: FileKind;
  flags: AuditFlag[];
  /** Zincir uzunluğu (hop sayısı); yalnız chain/loop. */
  chainLength: number;
  /** Flatten önerisi (son hedef); döngüde null. */
  flattenTo: string | null;
  /** Kullanıcı flatten'ı onayladı mı? */
  applyFlatten: boolean;
  gscClicks: number | null;
  gscImpressions: number | null;
}

export interface GscRecord {
  pageRaw: string;
  pageNorm: string;
  clicks: number;
  impressions: number;
  fileName: string;
  lineNo: number;
}

export interface AuditSummary {
  total: number;
  duplicate: number;
  conflict: number;
  chain: number;
  loop: number;
  self: number;
  unsupported: number;
  ok: number;
  withGsc: number;
}

export interface AuditOptions {
  normalize: NormalizeOptions;
}

export interface ParsedUpload {
  fileName: string;
  headers: string[];
  rows: unknown[][];
  kind: FileKind;
  roles: import('./schemas').ColumnRoles;
  confidence: 'high' | 'medium' | 'low';
  notes: string[];
}

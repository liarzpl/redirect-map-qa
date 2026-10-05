/**
 * Excel/CSV okuma ve yazma — SheetJS (xlsx) 0.20.3 gömülü.
 * Çalışma anında CDN yok; paket build'e vendor edilir.
 */

import * as XLSX from 'xlsx';
import { MAX_FILE_BYTES, MAX_ROWS } from '../config';
import { escapeFormulaCell } from './formula-guard';
import { logger } from './logger';

export type SheetRow = unknown[];

export interface ParsedSheet {
  headers: string[];
  rows: SheetRow[];
  sheetName: string;
}

export class FileParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FileParseError';
  }
}

/** Desteklenen uzantılar. */
const ALLOWED_EXT = new Set(['.xlsx', '.xls', '.csv']);

/** XLSX/XLS için ZIP veya OLE magic doğrulaması. */
function assertWorkbookMagic(buffer: ArrayBuffer, ext: string): void {
  const bytes = new Uint8Array(buffer);
  if (ext === '.csv') return;
  if (bytes.length < 4) {
    throw new FileParseError(
      'Dosya açılamadı. Bozuk veya geçersiz bir Excel/CSV olabilir.',
    );
  }
  // ZIP (xlsx/ods): PK
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  // OLE compound (xls): D0 CF 11 E0
  const isOle =
    bytes[0] === 0xd0 &&
    bytes[1] === 0xcf &&
    bytes[2] === 0x11 &&
    bytes[3] === 0xe0;
  if (ext === '.xlsx' && !isZip) {
    throw new FileParseError(
      'Dosya geçerli bir Excel (.xlsx) değil. Bozuk veya yanlış biçimli olabilir.',
    );
  }
  if (ext === '.xls' && !isOle && !isZip) {
    throw new FileParseError(
      'Dosya geçerli bir Excel (.xls) değil. Bozuk veya yanlış biçimli olabilir.',
    );
  }
}

export function getExtension(filename: string): string {
  const i = filename.lastIndexOf('.');
  if (i < 0) return '';
  return filename.slice(i).toLowerCase();
}

export function assertAllowedFile(file: File): void {
  if (!file || file.size === 0) {
    throw new FileParseError('Dosya boş veya seçilmedi.');
  }
  if (file.size > MAX_FILE_BYTES) {
    const mb = (MAX_FILE_BYTES / (1024 * 1024)).toFixed(0);
    throw new FileParseError(
      `Dosya çok büyük (${formatBytes(file.size)}). En fazla ${mb} MB yükleyebilirsiniz.`,
    );
  }
  const ext = getExtension(file.name);
  if (!ALLOWED_EXT.has(ext)) {
    throw new FileParseError(
      `Desteklenmeyen dosya uzantısı: «${ext || '(yok)'}». Yalnız .xlsx, .xls veya .csv kabul edilir.`,
    );
  }
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Dosyayı ArrayBuffer olarak okuyup ilk sayfayı ayrıştırır.
 * Kullanıcı verisi loglanmaz.
 */
export async function parseWorkbookFile(file: File): Promise<ParsedSheet> {
  assertAllowedFile(file);
  logger.info('Dosya okunuyor');

  let buffer: ArrayBuffer;
  try {
    buffer = await file.arrayBuffer();
  } catch {
    throw new FileParseError('Dosya okunamadı. Yeniden seçip deneyin.');
  }

  const ext = getExtension(file.name);
  assertWorkbookMagic(buffer, ext);

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, {
      type: 'array',
      cellDates: true,
      dense: false,
      codepage: 65001, // UTF-8 (CSV Türkçe başlıklar)
    });
  } catch {
    throw new FileParseError(
      'Dosya açılamadı. Bozuk veya geçersiz bir Excel/CSV olabilir.',
    );
  }

  if (!workbook.SheetNames.length) {
    throw new FileParseError('Dosyada sayfa bulunamadı.');
  }

  const sheetName = workbook.SheetNames[0]!;
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new FileParseError('İlk sayfa okunamadı.');
  }

  const data = XLSX.utils.sheet_to_json<SheetRow>(sheet, {
    header: 1,
    defval: '',
    blankrows: false,
    raw: true,
  });

  if (!data.length) {
    throw new FileParseError('Dosya boş görünüyor; başlık satırı yok.');
  }

  const headers = (data[0] as unknown[]).map((h) => String(h ?? '').trim());
  if (!headers.some((h) => h.length > 0)) {
    throw new FileParseError('Başlık satırı boş veya okunamadı.');
  }

  const rows = data.slice(1) as SheetRow[];
  if (rows.length > MAX_ROWS) {
    throw new FileParseError(
      `Satır sınırı aşıldı: ${rows.length.toLocaleString('tr-TR')} satır var, en fazla ${MAX_ROWS.toLocaleString('tr-TR')} kabul edilir.`,
    );
  }

  logger.info('Dosya ayrıştırıldı');
  return { headers, rows, sheetName };
}

/**
 * Kaçırılmış hücrelerle XLSX veya CSV indirir.
 * bookType: 'xlsx' | 'csv'
 */
export function downloadEscapedWorkbook(
  headers: string[],
  rows: SheetRow[],
  filename: string,
  bookType: 'xlsx' | 'csv' = 'xlsx',
): void {
  const safeHeaders = headers.map((h) => escapeFormulaCell(h));
  const safeRows = rows.map((row) =>
    row.map((cell) => escapeFormulaCell(cell)),
  );

  const aoa = [safeHeaders, ...safeRows];
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, 'Sonuc');

  const outName =
    bookType === 'csv'
      ? filename.replace(/\.xlsx?$/i, '') + '.csv'
      : filename.replace(/\.csv$/i, '') + '.xlsx';

  XLSX.writeFile(wb, outName, { bookType, compression: true });
  logger.info('Dosya indirildi');
}

/** SheetJS sürümünü doğrulamak için (test / README). */
export function getXlsxVersion(): string {
  // xlsx paketi version alanını export eder
  const v = (XLSX as unknown as { version?: string }).version;
  return v ?? 'bilinmiyor';
}

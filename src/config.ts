/**
 * redirect-map-qa ayarları.
 * Güvenlik kilitleri: SheetJS kaynağı, formula-guard, CSP, PWA/LOCAL varsayılan kapalı.
 */

/** Dosya başı maksimum yükleme boyutu (bayt). 10 MB. */
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

/** Tek dosyada kabul edilen maksimum veri satırı. */
export const MAX_ROWS_PER_FILE = 100_000;

/** Birleşik (tüm redirect dosyaları) satır üst sınırı. */
export const MAX_COMBINED_ROWS = 100_000;

/** Geriye uyumluluk — excel.ts şablon API'si. */
export const MAX_ROWS = MAX_ROWS_PER_FILE;

export const LOCAL_STORAGE_ENABLED = false;
export const PWA_ENABLED = false;
export const BACKUP_REMIND_DAYS = 7;

export const APP_NAME = 'Redirect Map QA';
export const APP_SHORT_NAME = 'Redirect QA';

export const APP_VERSION =
  typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';

/** Demo şablonundan kalan — redirect-map-qa zorunlu kolon kullanmaz. */
export const REQUIRED_COLUMNS = [] as const;

/** Tablo sayfa boyutu (sanal sayfalama). */
export const TABLE_PAGE_SIZE = 100;

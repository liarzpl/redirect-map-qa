export type Lang = 'tr' | 'en';

const TR = {
  title: 'Redirect Map QA',
  lead:
    'Rank Math, Redirection ve düz CSV dışa aktarımlarını tarayıcıda birleştirir; yinelenen kaynak, çakışma, zincir, döngü ve self-redirect bulur. Veri cihazınızda kalır.',
  privacy: 'Veri cihazınızda kalır — sunucu yok, ağ isteği yok, analytics yok.',
  upload: 'Dosya yükle (CSV / XLSX, çoklu)',
  run: 'Denetimi çalıştır',
  downloadMap: 'Düzeltilmiş map CSV',
  downloadIssues: 'Sorun raporu CSV',
  filters: 'Filtre',
  all: 'Tümü',
  options: 'Normalizasyon seçenekleri',
  pathCase: 'Path büyük/küçük harf duyarsız',
  trailSlash: 'Sondaki / farkını yok say',
  ignoreQuery: 'Query string’i yok say',
  flattenHint: 'Flatten önerisini uygula (onaylı satırlar)',
  mapping: 'Sütun eşleme (bilinmeyen export)',
  kind: 'Dosya türü',
  statusReady: 'Dosya seçin veya denetimi çalıştırın.',
  processing: 'İşleniyor…',
  done: 'Denetim tamam.',
} as const;

const EN: Record<keyof typeof TR, string> = {
  title: 'Redirect Map QA',
  lead:
    'Merge Rank Math, Redirection and plain CSV exports in the browser; find duplicate sources, conflicts, chains, loops and self-redirects. Data stays on your device.',
  privacy: 'Data stays on your device — no server, no network requests, no analytics.',
  upload: 'Upload files (CSV / XLSX, multiple)',
  run: 'Run audit',
  downloadMap: 'Download fixed map CSV',
  downloadIssues: 'Download issues CSV',
  filters: 'Filter',
  all: 'All',
  options: 'Normalization options',
  pathCase: 'Path case-insensitive',
  trailSlash: 'Ignore trailing slash',
  ignoreQuery: 'Ignore query string',
  flattenHint: 'Apply flatten suggestions (checked rows)',
  mapping: 'Column mapping (unknown export)',
  kind: 'File kind',
  statusReady: 'Select files or run the audit.',
  processing: 'Processing…',
  done: 'Audit complete.',
};

export function t(lang: Lang, key: keyof typeof TR): string {
  return (lang === 'en' ? EN : TR)[key];
}

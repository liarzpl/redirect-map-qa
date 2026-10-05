export type Lang = 'tr' | 'en';

const TR = {
  title: 'Redirect Map QA',
  lead: 'Redirect CSV yükle → döngü, çakışma ve zinciri bul → düzeltilmiş haritayı indir.',
  privacy: 'Veri cihazınızda kalır — sunucu yok, ağ isteği yok, analytics yok.',
  uploadHeading: 'Dosya yükle',
  uploadButton: 'Dosya seç',
  dropHint: 'Rank Math, Redirection veya düz CSV (source, destination). İsterseniz GSC.',
  emptyHint: 'CSV veya XLSX bırakın, sonra Denetle.',
  previewTitle: 'Önizleme',
  previewIntro:
    'Dosya başına ilk satırlar. Eşleşmeyen kolon ve boş satır burada uyarılır.',
  resultsTitle: 'Sonuç',
  run: 'Denetle',
  downloadMap: 'CSV indir — düzeltilmiş harita',
  downloadIssues: 'CSV indir — bulgular',
  filters: 'Bayrak',
  filterPanel: 'Filtreler',
  all: 'Tümü',
  options: 'Normalizasyon',
  pathCase: 'Path büyük/küçük harf duyarsız',
  trailSlash: 'Sondaki / farkını yok say',
  ignoreQuery: 'Query string’i yok say',
  flattenHint: 'Flatten önerilerini seç',
  flattenHelp: 'Zincirleri son hedefe bağlar; loop içeren satırlara uygulanmaz.',
  mapping: 'Sütun eşleme',
  kind: 'Dosya türü',
  statusReady: 'Dosya seçin.',
  processing: 'İşleniyor…',
  done: 'Denetim tamam.',
  filesLoaded: 'dosya yüklendi. Denetle.',
  advanced: 'Gelişmiş',
  dupLegend: 'Duplicate politikası',
  dupCheck: 'Kontrol etme',
  dupIgnore: 'Yok say',
  dupUpdate: 'Güncelle',
  dupNote: 'Yalnız sunum. Denetim ve dışa aktarma aynı kalır.',
  helpSummary: 'Status kodları ve bayraklar',
  severityLabel: 'Şiddet',
  typeLabel: 'type',
  searchLabel: 'Ara',
  searchPlaceholder: 'source / destination',
  prev: 'Önceki',
  next: 'Sonraki',
  rowsShown: 'satır gösteriliyor',
  noRows: 'Bu filtrede satır yok.',
  includeFlatten: 'Flatten uygulanan satırı düzeltilmiş haritaya dahil et',
  noSource: '`source` kolonu bulunamadı',
  noPage: '`page` kolonu bulunamadı',
  badDelim: 'Ayraç virgül değil (noktalı virgül/tab algılandı)',
  badCode: 'Redirection yalnız 301–307 kabul eder; satırda farklı kod var',
  emptyRows: 'Okunamayan satır (source ve destination boş)',
  unmatched: 'Eşleşmeyen kolon',
  firstRows: 'İlk',
  rowsWord: 'satır',
  kindRank: 'Rank Math',
  kindRedir: 'Redirection',
  kindPlain: 'Düz CSV',
  kindGsc: 'GSC',
  kindUnknown: 'Bilinmiyor',
  colInclude: 'Dahil',
  colStatus: 'durum',
  glossaryCodes: 'type',
  glossaryFlags: 'bayraklar',
  glossarySeverity: 'şiddet',
  metricTotal: 'Toplam',
  metricIssues: 'sorun',
  metricGsc: 'GSC eşleşen',
  metricTotalHelp: 'Tüm filtreleri temizler.',
  noRedirects: 'Yönlendirme satırı bulunamadı.',
  auditFailed: 'Denetim başarısız.',
  unexpected: 'Beklenmeyen bir hata oluştu.',
  mapSaved: 'redirect-map-fixed.csv indirildi (formül kaçırması uygulandı).',
  issuesSaved: 'redirect-map-issues.csv indirildi (formül kaçırması uygulandı).',
  filterFlatten: 'flatten',
  helpTypes:
    '301 kalıcı, 302 ve 307 geçici, 308 kalıcı (yöntem korunur), 410 Gone, 451 hukuki neden.',
  helpFlags: 'loop, conflict ve self error sayılır. Ayrıntı alttaki panelde.',
  codeUnknown: 'Bu status kodu için kısa açıklama yok.',
} as const;

const EN: Record<keyof typeof TR, string> = {
  title: 'Redirect Map QA',
  lead: 'Upload a redirect CSV → find loops, conflicts, and chains → download the fixed map.',
  privacy:
    'Data stays on your device — no server, no network requests, no analytics.',
  uploadHeading: 'Upload a file',
  uploadButton: 'Choose files',
  dropHint: 'Rank Math, Redirection, or a plain CSV (source, destination). GSC optional.',
  emptyHint: 'Drop a CSV or XLSX, then Audit.',
  previewTitle: 'Preview',
  previewIntro: 'First rows of each file. Unmatched columns and blank rows are flagged here.',
  resultsTitle: 'Results',
  run: 'Audit',
  downloadMap: 'Download CSV — fixed map',
  downloadIssues: 'Download CSV — findings',
  filters: 'Flag',
  filterPanel: 'Filters',
  all: 'All',
  options: 'Normalization',
  pathCase: 'Path case-insensitive',
  trailSlash: 'Ignore trailing slash',
  ignoreQuery: 'Ignore query string',
  flattenHint: 'Select flatten suggestions',
  flattenHelp: 'Points chains at the final target. Rows in a loop are skipped.',
  mapping: 'Column mapping',
  kind: 'File kind',
  statusReady: 'Choose a file.',
  processing: 'Processing…',
  done: 'Audit complete.',
  filesLoaded: 'files loaded. Audit.',
  advanced: 'Advanced',
  dupLegend: 'Duplicate policy',
  dupCheck: 'Check',
  dupIgnore: 'Ignore',
  dupUpdate: 'Update',
  dupNote: 'Presentation only. Audit and export stay the same.',
  helpSummary: 'Status codes and flags',
  severityLabel: 'Severity',
  typeLabel: 'type',
  searchLabel: 'Search',
  searchPlaceholder: 'source / destination',
  prev: 'Previous',
  next: 'Next',
  rowsShown: 'rows shown',
  noRows: 'No rows match this filter.',
  includeFlatten: 'Include this flattened row in the fixed map',
  noSource: '`source` column not found',
  noPage: '`page` column not found',
  badDelim: 'Delimiter is not a comma (semicolon or tab detected)',
  badCode: 'Redirection only accepts 301–307; a row has a different code',
  emptyRows: 'Unreadable row (source and destination empty)',
  unmatched: 'Unmatched column',
  firstRows: 'First',
  rowsWord: 'rows',
  kindRank: 'Rank Math',
  kindRedir: 'Redirection',
  kindPlain: 'Plain CSV',
  kindGsc: 'GSC',
  kindUnknown: 'Unknown',
  colInclude: 'Include',
  colStatus: 'status',
  glossaryCodes: 'type',
  glossaryFlags: 'flags',
  glossarySeverity: 'severity',
  metricTotal: 'Total',
  metricIssues: 'issues',
  metricGsc: 'GSC matched',
  metricTotalHelp: 'Clears every filter.',
  noRedirects: 'No redirect rows found.',
  auditFailed: 'Audit failed.',
  unexpected: 'Unexpected error.',
  mapSaved: 'redirect-map-fixed.csv downloaded (formula escaping applied).',
  issuesSaved: 'redirect-map-issues.csv downloaded (formula escaping applied).',
  filterFlatten: 'flatten',
  helpTypes:
    '301 permanent, 302 and 307 temporary, 308 permanent (method kept), 410 Gone, 451 legal.',
  helpFlags: 'loop, conflict, and self count as error. Details are in the panel below.',
  codeUnknown: 'No short description for this status code.',
};

export type MessageKey = keyof typeof TR;

export function t(lang: Lang, key: MessageKey): string {
  return (lang === 'en' ? EN : TR)[key];
}

export interface HelpEntry {
  id: string;
  text: string;
}

const CODES_TR: HelpEntry[] = [
  { id: '301', text: 'Kalıcı yönlendirme. Arama motorları yeni URL’yi esas alır.' },
  { id: '302', text: 'Geçici yönlendirme (Found). Eski URL esas kalır.' },
  { id: '307', text: 'Geçici yönlendirme; istek yöntemi (POST vb.) korunur.' },
  { id: '308', text: 'Kalıcı yönlendirme; istek yöntemi korunur.' },
  { id: '410', text: 'Gone — içerik kalıcı olarak kaldırıldı, hedef yok.' },
  { id: '451', text: 'Hukuki nedenle erişilemez, hedef yok.' },
];

const CODES_EN: HelpEntry[] = [
  { id: '301', text: 'Permanent redirect. Crawlers treat the new URL as canonical.' },
  { id: '302', text: 'Temporary redirect (Found). The old URL stays canonical.' },
  { id: '307', text: 'Temporary redirect; the request method (POST and others) is kept.' },
  { id: '308', text: 'Permanent redirect; the request method is kept.' },
  { id: '410', text: 'Gone — the content was removed permanently. No target.' },
  { id: '451', text: 'Unavailable for legal reasons. No target.' },
];

const FLAGS_TR: HelpEntry[] = [
  { id: 'loop', text: 'Kural zinciri başladığı URL’ye geri dönüyor.' },
  { id: 'chain', text: 'Hedefe birden fazla hop ile varılıyor.' },
  { id: 'conflict', text: 'Aynı source farklı hedeflere gidiyor.' },
  { id: 'duplicate', text: 'Aynı kural birden fazla kez tanımlı.' },
  { id: 'self', text: 'source ve destination aynı.' },
  { id: 'unsupported', text: 'Regex/wildcard; bu araç denetlemez.' },
  { id: 'ok', text: 'Sorun bulunmadı.' },
];

const FLAGS_EN: HelpEntry[] = [
  { id: 'loop', text: 'The rule chain returns to the URL it started from.' },
  { id: 'chain', text: 'The target is reached in more than one hop.' },
  { id: 'conflict', text: 'The same source points at different targets.' },
  { id: 'duplicate', text: 'The same rule is defined more than once.' },
  { id: 'self', text: 'source and destination are the same.' },
  { id: 'unsupported', text: 'Regex or wildcard. This tool does not audit it.' },
  { id: 'ok', text: 'No issue found.' },
];

const SEV_TR: HelpEntry[] = [
  {
    id: 'error',
    text: 'Yayına alınırsa yönlendirme kırılır veya belirsizleşir. Önce bunları düzelt.',
  },
  {
    id: 'warning',
    text: 'Çalışır ama fazladan hop veya tekrar var; düzeltilmesi önerilir.',
  },
  {
    id: 'notice',
    text: 'Bu araç denetleyemedi (regex/wildcard); elle kontrol et.',
  },
  { id: 'ok', text: 'Sorun bulunmadı.' },
];

const SEV_EN: HelpEntry[] = [
  {
    id: 'error',
    text: 'Publishing these breaks or muddies the redirect. Fix them first.',
  },
  {
    id: 'warning',
    text: 'They work, but an extra hop or a repeat is present. Fixing them is recommended.',
  },
  {
    id: 'notice',
    text: 'This tool could not audit the row (regex/wildcard). Check it by hand.',
  },
  { id: 'ok', text: 'No issue found.' },
];

export function helpCodes(lang: Lang): HelpEntry[] {
  return lang === 'en' ? CODES_EN : CODES_TR;
}

export function helpFlags(lang: Lang): HelpEntry[] {
  return lang === 'en' ? FLAGS_EN : FLAGS_TR;
}

export function helpSeverities(lang: Lang): HelpEntry[] {
  return lang === 'en' ? SEV_EN : SEV_TR;
}

export function statusHelp(lang: Lang, code: string): string | undefined {
  return helpCodes(lang).find((e) => e.id === code)?.text;
}

export function flagHelp(lang: Lang, flag: string): string {
  return helpFlags(lang).find((e) => e.id === flag)?.text ?? flag;
}

export function severityHelp(lang: Lang, severity: string): string {
  return helpSeverities(lang).find((e) => e.id === severity)?.text ?? severity;
}

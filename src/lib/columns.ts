/**
 * Kolon eşleme: sıra değil, başlık adına göre.
 * Türkçe karakter, büyük/küçük harf ve boşluk normalizasyonu.
 */

/** Türkçe İ/ı ve diğer harfler için locale-aware küçük harf. */
export function toLocaleLowerTr(text: string): string {
  // Önce İ→i, I→ı dönüşümü (toLocaleLowerCase('tr') bunu yapar)
  return text.toLocaleLowerCase('tr-TR');
}

/**
 * Başlık normalizasyonu:
 * - trim
 * - birden fazla boşluk → tek boşluk
 * - Türkçe küçük harf
 * - yaygın ayırıcıları kaldır/eşitle (alt çizgi, tire → boşluk sonra kaldır)
 */
export function normalizeHeader(header: string): string {
  return toLocaleLowerTr(header)
    .trim()
    .replace(/[_\-./\\]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s/g, ''); // karşılaştırma için boşluksuz
}

/**
 * Dosyadaki başlıklar ile beklenen kolonları eşleştirir.
 * @returns matched: beklenen → dosya başlık indeksi (veya -1)
 */
export function matchColumns(
  fileHeaders: string[],
  required: readonly string[],
): {
  matched: Map<string, number>;
  missing: string[];
  mapping: Record<string, string | null>;
} {
  const normalizedIndex = new Map<string, number>();
  fileHeaders.forEach((h, i) => {
    const key = normalizeHeader(h);
    // İlk eşleşmeyi koru (yinelenen başlıkta ilk kolon)
    if (!normalizedIndex.has(key)) {
      normalizedIndex.set(key, i);
    }
  });

  const matched = new Map<string, number>();
  const missing: string[] = [];
  const mapping: Record<string, string | null> = {};

  for (const req of required) {
    const idx = normalizedIndex.get(normalizeHeader(req));
    if (idx === undefined) {
      matched.set(req, -1);
      missing.push(req);
      mapping[req] = null;
    } else {
      matched.set(req, idx);
      mapping[req] = fileHeaders[idx] ?? null;
    }
  }

  return { matched, missing, mapping };
}

/**
 * Eksik zorunlu kolonları Türkçe hata metni olarak listeler.
 */
export function formatMissingColumnsError(missing: string[]): string {
  if (missing.length === 0) return '';
  if (missing.length === 1) {
    return `Zorunlu kolon bulunamadı: «${missing[0]}». Dosya başlık satırını kontrol edin.`;
  }
  const list = missing.map((m) => `«${m}»`).join(', ');
  return `Zorunlu kolonlar bulunamadı: ${list}. Dosya başlık satırını kontrol edin.`;
}

/**
 * Eşlenmiş kolon indekslerine göre satırdan değerleri çeker.
 */
export function pickMatchedValues(
  row: unknown[],
  matched: Map<string, number>,
  required: readonly string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const name of required) {
    const idx = matched.get(name) ?? -1;
    out[name] = idx >= 0 ? (row[idx] ?? '') : '';
  }
  return out;
}

/**
 * Formül enjeksiyonu koruması (CSV/Excel çıktı).
 *
 * Baştaki boşluk / NBSP / Unicode boşluklar atlanır; ilk anlamlı karaktere bakılır.
 * Tehlikeli: = + - @ | TAB CR ve fullwidth ＝ ＋ － ＠
 * Metin hücrelerinin başına tek tırnak (') eklenir.
 * Saf number hücreler (ör. -12.5) sayı tipinde kalır.
 * Metin "-5" gibi negatif görünen string'ler kaçırılır.
 *
 * Kaynak: OWASP CSV Injection / formula injection rehberi.
 */

/** Başta atlanacak boşluklar: \s, NBSP, \u2000-\u200b, ideographic space, BOM */
const LEADING_SPACE_RE = /^[\s\u00a0\u2000-\u200b\u3000\ufeff]+/;

/** İlk anlamlı karakter tehlikeli mi? */
const DANGEROUS_FIRST_RE = /^[=+\-@|\t\r＝＋－＠]/;

/**
 * Baştaki Unicode boşlukları atar; ilk anlamlı öneki döner.
 */
export function stripLeadingSpaces(text: string): string {
  return text.replace(LEADING_SPACE_RE, '');
}

/**
 * Bir hücre değerini çıktı için güvenli hale getirir.
 */
export function escapeFormulaCell(value: unknown): string | number | boolean {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return escapeString(String(value));
    }
    return value;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  return escapeString(String(value));
}

function escapeString(text: string): string {
  if (text.length === 0) return text;
  const significant = stripLeadingSpaces(text);
  if (significant.length === 0) return text;
  if (DANGEROUS_FIRST_RE.test(significant)) {
    return `'${text}`;
  }
  return text;
}

/**
 * Satır (dizi) içindeki tüm hücreleri kaçırır.
 */
export function escapeFormulaRow(
  row: unknown[],
): Array<string | number | boolean> {
  return row.map(escapeFormulaCell);
}

/**
 * Nesne satırındaki tüm değerleri kaçırır (anahtarlar korunur).
 */
export function escapeFormulaRecord<T extends Record<string, unknown>>(
  record: T,
): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [key, val] of Object.entries(record)) {
    out[key] = escapeFormulaCell(val);
  }
  return out;
}

/**
 * Değerin formül kaçırması gerekip gerekmediğini test eder.
 */
export function needsFormulaEscape(value: unknown): boolean {
  if (typeof value === 'number' && Number.isFinite(value)) return false;
  if (typeof value === 'boolean') return false;
  if (value === null || value === undefined) return false;
  const significant = stripLeadingSpaces(String(value));
  if (significant.length === 0) return false;
  return DANGEROUS_FIRST_RE.test(significant);
}

/**
 * Dil seçimi.
 * Kayıtlı tercih varsa o kullanılır.
 * Yoksa tarayıcı dili Türkçe ise Türkçe, diğer her durumda İngilizce.
 * localStorage'a yalnız "tr" veya "en" yazılır.
 */

import type { Lang } from './i18n';

export const LANG_STORAGE_KEY = 'redirect-map-qa.lang';

export interface LangStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

export function isLang(value: string): value is Lang {
  return value === 'tr' || value === 'en';
}

export function normalizeLang(value: string | null | undefined): Lang | null {
  if (value == null) return null;
  const tag = value.trim().toLowerCase();
  return isLang(tag) ? tag : null;
}

/** İlk dolu dil etiketinin birincil alt etiketi `tr` ise Türkçe. */
export function browserLang(languages: readonly string[]): Lang {
  const primary = languages.map((tag) => tag.trim()).find((tag) => tag.length > 0);
  if (!primary) return 'en';
  const code = primary.toLowerCase().split(/[-_]/)[0];
  return code === 'tr' ? 'tr' : 'en';
}

export function resolveInitialLang(
  stored: string | null | undefined,
  languages: readonly string[],
): Lang {
  return normalizeLang(stored) ?? browserLang(languages);
}

export function readStoredLang(store: LangStore): string | null {
  try {
    return store.get(LANG_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function writeStoredLang(store: LangStore, lang: Lang): void {
  try {
    store.set(LANG_STORAGE_KEY, lang);
  } catch {
    // Gizli pencere veya engellenmiş depolama. Seçim bu oturumda kalır.
  }
}

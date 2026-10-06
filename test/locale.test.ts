import { describe, expect, it } from 'vitest';
import {
  LANG_STORAGE_KEY,
  browserLang,
  readStoredLang,
  resolveInitialLang,
  writeStoredLang,
  type LangStore,
} from '../src/lib/locale';

function memoryStore(initial?: string | null): LangStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  if (initial != null) data.set(LANG_STORAGE_KEY, initial);
  return {
    data,
    get: (key) => data.get(key) ?? null,
    set: (key, value) => {
      data.set(key, value);
    },
  };
}

describe('browserLang', () => {
  it('Türkçe ve tr-TR için tr döner', () => {
    expect(browserLang(['tr'])).toBe('tr');
    expect(browserLang(['tr-TR'])).toBe('tr');
    expect(browserLang(['TR'])).toBe('tr');
    expect(browserLang(['tr_TR'])).toBe('tr');
  });

  it('Türkçe olmayan dillerde en döner', () => {
    expect(browserLang(['en'])).toBe('en');
    expect(browserLang(['en-US'])).toBe('en');
    expect(browserLang(['de-DE'])).toBe('en');
    expect(browserLang(['fr'])).toBe('en');
    expect(browserLang([])).toBe('en');
    expect(browserLang([''])).toBe('en');
  });

  it('ilk dolu etiketi kullanır', () => {
    expect(browserLang(['en-GB', 'tr'])).toBe('en');
    expect(browserLang(['tr-TR', 'en-US'])).toBe('tr');
    expect(browserLang(['', 'tr'])).toBe('tr');
  });

  it('bölge kodu TR olan başka dilleri Türkçe saymaz', () => {
    expect(browserLang(['az-TR'])).toBe('en');
  });
});

describe('resolveInitialLang', () => {
  it('kayıtlı tercihi tarayıcı dilinin önüne koyar', () => {
    expect(resolveInitialLang('en', ['tr-TR'])).toBe('en');
    expect(resolveInitialLang('tr', ['en-US'])).toBe('tr');
    expect(resolveInitialLang(' EN ', ['tr'])).toBe('en');
    expect(resolveInitialLang('TR', ['de'])).toBe('tr');
  });

  it('geçersiz veya boş kayıtta tarayıcı diline düşer', () => {
    expect(resolveInitialLang(null, ['tr-TR'])).toBe('tr');
    expect(resolveInitialLang(undefined, ['en-US'])).toBe('en');
    expect(resolveInitialLang('', ['tr'])).toBe('tr');
    expect(resolveInitialLang('fr', ['en-US'])).toBe('en');
    expect(resolveInitialLang('turkish', ['tr'])).toBe('tr');
    expect(resolveInitialLang(null, [])).toBe('en');
  });
});

describe('lang storage', () => {
  it('yalnız dil anahtarına yazar ve okur', () => {
    const store = memoryStore();
    writeStoredLang(store, 'en');
    expect(readStoredLang(store)).toBe('en');
    expect(store.data.get(LANG_STORAGE_KEY)).toBe('en');
    writeStoredLang(store, 'tr');
    expect(readStoredLang(store)).toBe('tr');
  });

  it('depolama hata verirse sessiz kalır', () => {
    const store: LangStore = {
      get: () => {
        throw new Error('blocked');
      },
      set: () => {
        throw new Error('blocked');
      },
    };
    expect(readStoredLang(store)).toBeNull();
    expect(() => writeStoredLang(store, 'en')).not.toThrow();
  });
});

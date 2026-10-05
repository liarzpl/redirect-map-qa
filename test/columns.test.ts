import { describe, expect, it } from 'vitest';
import {
  formatMissingColumnsError,
  matchColumns,
  normalizeHeader,
  pickMatchedValues,
  toLocaleLowerTr,
} from '../src/lib/columns';

describe('normalizeHeader / Türkçe', () => {
  it('İ/ı ve Ş/ş normalizasyonu', () => {
    expect(toLocaleLowerTr('İSTANBUL')).toBe('istanbul');
    expect(toLocaleLowerTr('IŞIK')).toBe('ışık');
    expect(normalizeHeader('Ürün Adı')).toBe(normalizeHeader('ürün adı'));
    expect(normalizeHeader('Şirket')).toBe(normalizeHeader('şirket'));
    expect(normalizeHeader('FİYAT')).toBe(normalizeHeader('fiyat'));
  });

  it('boşluk / ayırıcı / büyük-küçük harf eşitlemesi', () => {
    expect(normalizeHeader('  Ürün  Adı ')).toBe(normalizeHeader('ürün adı'));
    expect(normalizeHeader('urun_adi')).toBe(normalizeHeader('urun adi'));
    expect(normalizeHeader('Adet-Sayısı')).toBe(normalizeHeader('adet sayısı'));
  });
});

describe('matchColumns', () => {
  it('başlık adına göre eşler (sıra önemli değil)', () => {
    const headers = ['Fiyat', 'Not', 'Ürün Adı', 'Adet'];
    const required = ['Ürün Adı', 'Adet', 'Fiyat'] as const;
    const { matched, missing, mapping } = matchColumns(headers, required);
    expect(missing).toEqual([]);
    expect(matched.get('Ürün Adı')).toBe(2);
    expect(matched.get('Adet')).toBe(3);
    expect(matched.get('Fiyat')).toBe(0);
    expect(mapping['Ürün Adı']).toBe('Ürün Adı');
  });

  it('normalize edilmiş başlıkları eşler', () => {
    const headers = ['ürün_adı', 'ADET', 'fiyat'];
    const required = ['Ürün Adı', 'Adet', 'Fiyat'] as const;
    const { missing, matched } = matchColumns(headers, required);
    expect(missing).toEqual([]);
    expect(matched.get('Ürün Adı')).toBe(0);
  });

  it('eksik kolonları listeler', () => {
    const headers = ['Ürün Adı', 'Stok'];
    const required = ['Ürün Adı', 'Adet', 'Fiyat'] as const;
    const { missing } = matchColumns(headers, required);
    expect(missing).toEqual(['Adet', 'Fiyat']);
    const msg = formatMissingColumnsError(missing);
    expect(msg).toContain('Adet');
    expect(msg).toContain('Fiyat');
  });

  it('pickMatchedValues doğru değerleri çeker', () => {
    const headers = ['x', 'Ürün Adı', 'Adet', 'Fiyat'];
    const required = ['Ürün Adı', 'Adet', 'Fiyat'] as const;
    const { matched } = matchColumns(headers, required);
    const row = ['ignore', 'Kalem', 3, 12.5];
    expect(pickMatchedValues(row, matched, required)).toEqual({
      'Ürün Adı': 'Kalem',
      Adet: 3,
      Fiyat: 12.5,
    });
  });
});

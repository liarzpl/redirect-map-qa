import { describe, expect, it, vi } from 'vitest';
import { detectSchema, isUnsupportedRule } from '../src/lib/schemas';

describe('detectSchema', () => {
  it('Rank Math başlıklarını tanır', () => {
    const d = detectSchema([
      'id',
      'source',
      'matching',
      'destination',
      'type',
      'category',
      'status',
      'ignore',
    ]);
    expect(d.kind).toBe('rankmath');
    expect(d.confidence).toBe('high');
    expect(d.roles.source).toBe(1);
    expect(d.roles.destination).toBe(3);
    expect(d.roles.matching).toBe(2);
  });

  it('Redirection başlıklarını tanır', () => {
    const d = detectSchema([
      'source',
      'target',
      'regex',
      'code',
      'type',
      'hits',
      'title',
      'status',
    ]);
    expect(d.kind).toBe('redirection');
    expect(d.confidence).toBe('high');
    expect(d.roles.destination).toBe(1);
    expect(d.roles.regex).toBe(2);
    expect(d.roles.type).toBe(3);
  });

  it('düz source,destination', () => {
    const d = detectSchema(['source', 'destination']);
    expect(d.kind).toBe('plain');
  });

  it('GSC Türkçe başlıklar', () => {
    const d = detectSchema([
      'En çok ziyaret edilen sayfalar',
      'Tıklamalar',
      'Gösterimler',
    ]);
    expect(d.kind).toBe('gsc');
    expect(d.roles.page).toBe(0);
    expect(d.roles.clicks).toBe(1);
  });

  it('GSC İngilizce başlıklar', () => {
    const d = detectSchema(['Top pages', 'Clicks', 'Impressions']);
    expect(d.kind).toBe('gsc');
  });

  it('English GSC export binds clicks and impressions', () => {
    const d = detectSchema([
      'Top pages',
      'Clicks',
      'Impressions',
      'CTR',
      'Position',
    ]);
    expect(d.kind).toBe('gsc');
    expect(d.roles.page).toBe(0);
    expect(d.roles.clicks).toBe(1);
    expect(d.roles.impressions).toBe(2);
  });

  it('Turkish GSC export still binds clicks and impressions', () => {
    const d = detectSchema([
      'En çok ziyaret edilen sayfalar',
      'Tıklamalar',
      'Gösterimler',
      'TO',
      'Pozisyon',
    ]);
    expect(d.kind).toBe('gsc');
    expect(d.roles.page).toBe(0);
    expect(d.roles.clicks).toBe(1);
    expect(d.roles.impressions).toBe(2);
  });

  it('English and Turkish GSC headers map Impressions under tr-TR with no Unmatched column warning', async () => {
    const original = String.prototype.toLocaleLowerCase;
    String.prototype.toLocaleLowerCase = function (
      this: string,
      locales?: Intl.LocalesArgument,
    ): string {
      return original.call(this, locales ?? 'tr-TR');
    };
    vi.resetModules();
    try {
      // Runtime default locale is Turkish: bare toLocaleLowerCase("I") → "ı".
      expect('Impressions'.toLocaleLowerCase()).toBe('ımpressions');

      const { detectSchema: detect } = await import('../src/lib/schemas');
      const { listUnmatchedColumns } = await import('../src/lib/columns');
      const { t } = await import('../src/lib/i18n');
      const unmatchedLabel = t('en', 'unmatched');
      expect(unmatchedLabel).toBe('Unmatched column');

      const rows = [
        'Top pages,Clicks,Impressions,CTR,Position',
        'En çok ziyaret edilen sayfalar,Tıklamalar,Gösterimler,TO,Pozisyon',
      ];
      for (const line of rows) {
        const headers = line.split(',');
        const detected = detect(headers);
        expect(detected.kind).toBe('gsc');
        expect(detected.roles.impressions).toBe(2);
        const impressionHeader = headers[2];
        const unmatched = listUnmatchedColumns(headers);
        expect(unmatched).not.toContain(impressionHeader);
        const warning = unmatched.length
          ? `${unmatchedLabel}: ${unmatched.join(', ')}`
          : '';
        expect(warning).not.toContain(impressionHeader ?? '');
        expect(warning).not.toMatch(/Unmatched column:[^\n]*(Impressions|Gösterimler)/);
      }
    } finally {
      String.prototype.toLocaleLowerCase = original;
      vi.resetModules();
    }
  });

  it('dotted capital İ still matches impressions', () => {
    const d = detectSchema(['Sayfa', 'Tıklamalar', 'GÖSTERİMLER']);
    expect(d.kind).toBe('gsc');
    expect(d.roles.clicks).toBe(1);
    expect(d.roles.impressions).toBe(2);

    const dottedEnglish = detectSchema(['Top pages', 'Clicks', 'İmpressions']);
    expect(dottedEnglish.roles.impressions).toBe(2);
  });

  it('bilinmeyen → unknown', () => {
    const d = detectSchema(['eski_yol', 'yeni_yol', 'kod']);
    expect(d.kind).toBe('unknown');
  });
});

describe('isUnsupportedRule', () => {
  it('Rank Math regex matching', () => {
    expect(
      isUnsupportedRule({
        kind: 'rankmath',
        matching: 'regex',
        source: '/a.*',
      }),
    ).toBe(true);
  });

  it('contains/start/end desteklenmiyor', () => {
    expect(
      isUnsupportedRule({ kind: 'rankmath', matching: 'contains', source: '/a' }),
    ).toBe(true);
  });

  it('Redirection regex=1', () => {
    expect(
      isUnsupportedRule({ kind: 'redirection', regex: '1', source: '/a' }),
    ).toBe(true);
  });

  it('wildcard *', () => {
    expect(
      isUnsupportedRule({ kind: 'plain', source: '/wild-*/x' }),
    ).toBe(true);
  });

  it('exact desteklenir', () => {
    expect(
      isUnsupportedRule({
        kind: 'rankmath',
        matching: 'exact',
        source: '/a',
      }),
    ).toBe(false);
  });
});

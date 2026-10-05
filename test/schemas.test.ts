import { describe, expect, it } from 'vitest';
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

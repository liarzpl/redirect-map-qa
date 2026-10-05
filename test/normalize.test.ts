import { describe, expect, it } from 'vitest';
import { isSelfRedirect, normalizeUrl } from '../src/lib/normalize';

describe('normalizeUrl', () => {
  it('fragment atar', () => {
    expect(normalizeUrl('/a/b#section')).toBe('/a/b');
  });

  it('tam URL → host+path (host case-insensitive)', () => {
    expect(normalizeUrl('https://Example.COM/Path')).toBe('example.com/Path');
  });

  it('göreli path başına / ekler', () => {
    expect(normalizeUrl('foo/bar')).toBe('/foo/bar');
  });

  it('trailing slash yok sayılır (varsayılan)', () => {
    expect(normalizeUrl('/foo/')).toBe('/foo');
    expect(normalizeUrl('/')).toBe('/');
  });

  it('trailing slash korunabilir', () => {
    expect(normalizeUrl('/foo/', { ignoreTrailingSlash: false })).toBe('/foo/');
  });

  it('path case-sensitive varsayılan', () => {
    expect(normalizeUrl('/Foo')).not.toBe(normalizeUrl('/foo'));
  });

  it('path case-insensitive seçeneği', () => {
    expect(normalizeUrl('/Foo', { pathCaseInsensitive: true })).toBe(
      normalizeUrl('/foo', { pathCaseInsensitive: true }),
    );
  });

  it('query korunur; yok sayılabilir', () => {
    expect(normalizeUrl('/a?x=1')).toContain('x=');
    expect(normalizeUrl('/a?x=1', { ignoreQuery: true })).toBe('/a');
  });

  it('yüzde kodlama normalize', () => {
    expect(normalizeUrl('/a%20b')).toBe(normalizeUrl('/a b'));
  });

  it('self-redirect', () => {
    expect(isSelfRedirect('/A/', '/A')).toBe(true);
    expect(isSelfRedirect('/a', '/b')).toBe(false);
  });
});

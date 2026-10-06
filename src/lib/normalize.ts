/**
 * URL normalizasyonu — karşılaştırma anahtarı üretir.
 *
 * Uygulanan kurallar (README ile uyumlu):
 * 1. trim; fragment (#…) atılır
 * 2. Tam URL ise host + path (+ query); host küçük harfe alınır
 * 3. Göreli path ise başa '/' eklenir (yoksa)
 * 4. Path: varsayılan case-sensitive; seçenekle case-insensitive
 * 5. Trailing slash: seçenekle yok sayılır (kök '/' hariç; varsayılan açık)
 * 6. Query: varsayılan korunur; seçenekle yok sayılır
 * 7. Yüzde kodlama: decodeURIComponent güvenli deneme + yeniden encode path segment
 */

export interface NormalizeOptions {
  /** Path büyük/küçük harf duyarsız (varsayılan false = case-sensitive). */
  pathCaseInsensitive?: boolean;
  /** Sondaki '/' farkını yok say (kök hariç). Varsayılan true. */
  ignoreTrailingSlash?: boolean;
  /** Query string'i yok say. Varsayılan false (korunur). */
  ignoreQuery?: boolean;
}

const DEFAULTS: Required<NormalizeOptions> = {
  pathCaseInsensitive: false,
  ignoreTrailingSlash: true,
  ignoreQuery: false,
};

export function normalizeUrl(
  raw: string,
  options: NormalizeOptions = {},
): string {
  const opts = { ...DEFAULTS, ...options };
  let input = String(raw ?? '').trim();
  if (!input) return '';

  // Fragment at
  const hashIdx = input.indexOf('#');
  if (hashIdx >= 0) input = input.slice(0, hashIdx);

  let host = '';
  let path = '';
  let query = '';

  // Absolute URL?
  const abs = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.exec(input);
  if (abs) {
    try {
      const u = new URL(input);
      host = u.hostname.toLowerCase();
      // port varsa ekle (standart portlar hariç URL constructor zaten temizler)
      if (u.port) host += `:${u.port}`;
      path = u.pathname || '/';
      query = u.search || '';
    } catch {
      // Bozuk absolute — göreli gibi işle
      path = input.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, '');
    }
  } else if (input.startsWith('//')) {
    // Protocol-relative
    try {
      const u = new URL(`https:${input}`);
      host = u.hostname.toLowerCase();
      if (u.port) host += `:${u.port}`;
      path = u.pathname || '/';
      query = u.search || '';
    } catch {
      path = input;
    }
  } else {
    // Relative — split query
    const qIdx = input.indexOf('?');
    if (qIdx >= 0) {
      path = input.slice(0, qIdx);
      query = input.slice(qIdx);
    } else {
      path = input;
    }
  }

  if (!path.startsWith('/')) path = `/${path}`;

  path = normalizePercentEncoding(path);

  if (opts.pathCaseInsensitive) {
    path = path.toLowerCase();
  }

  if (opts.ignoreTrailingSlash && path.length > 1 && path.endsWith('/')) {
    path = path.slice(0, -1);
  }

  if (opts.ignoreQuery) {
    query = '';
  } else if (query) {
    query = normalizeQuery(query);
  }

  if (host) {
    return `${host}${path}${query}`;
  }
  return `${path}${query}`;
}

/**
 * Join anahtarı: normalizeUrl çıktısından host atılmış path (+ query).
 * Kurallar (slash, harf, query) zaten normalizeUrl'de uygulanmıştır.
 * Göreli anahtar `/path` olarak kalır; mutlak `host/path` → `/path`.
 */
export function pathKeyFromNormalized(normalized: string): string {
  if (!normalized) return '';
  const qIdx = normalized.indexOf('?');
  const pathPart = qIdx >= 0 ? normalized.slice(0, qIdx) : normalized;
  const query = qIdx >= 0 ? normalized.slice(qIdx) : '';
  if (pathPart.startsWith('/')) return `${pathPart}${query}`;
  const slash = pathPart.indexOf('/');
  if (slash < 0) return `/${query}`;
  return `${pathPart.slice(slash)}${query}`;
}

/** Path segment yüzde kodlamasını tutarlı hale getirir. */
function normalizePercentEncoding(path: string): string {
  return path
    .split('/')
    .map((seg) => {
      if (!seg) return seg;
      try {
        const decoded = decodeURIComponent(seg.replace(/\+/g, '%20'));
        return encodeURIComponent(decoded).replace(/%2F/gi, '/');
      } catch {
        return seg;
      }
    })
    .join('/');
}

function normalizeQuery(search: string): string {
  if (!search || search === '?') return '';
  const q = search.startsWith('?') ? search.slice(1) : search;
  try {
    const params = new URLSearchParams(q);
    // Sıra korunur; yalnız encoding normalize
    const parts: string[] = [];
    params.forEach((v, k) => {
      parts.push(
        `${encodeURIComponent(k)}=${encodeURIComponent(v)}`.replace(/%20/g, '+'),
      );
    });
    return parts.length ? `?${parts.join('&')}` : '';
  } catch {
    return search.startsWith('?') ? search : `?${search}`;
  }
}

/** source == destination (normalize sonrası). */
export function isSelfRedirect(
  source: string,
  destination: string,
  options?: NormalizeOptions,
): boolean {
  const s = normalizeUrl(source, options);
  const d = normalizeUrl(destination, options);
  return s.length > 0 && s === d;
}

# Redirect Map QA

Rank Math Redirects, Redirection (John Godley) ve düz `source,destination` CSV/XLSX dışa aktarımlarını **tarayıcıda** birleştirir; yinelenen kaynak, çakışan hedef, zincir, döngü ve self-redirect bulur. Opsiyonel Google Search Console (GSC) Pages/Performance CSV ile tıklama önceliği ekler. Düzeltilmiş map CSV ve sorun raporu indirir.

**Veri cihazınızda kalır.** Sunucu yok, OAuth yok, analytics yok, canlı HTTP/crawl yok.

Lisans: MIT · Telif: liarzpl

## Hızlı başlangıç

**Node.js:** `^22.12` (`.nvmrc` = 22.20.0)

```bash
cd app   # veya repo kökü
npm ci
npm test
npm run build
npm run preview
```

Geliştirme: `npm run dev`

## Desteklenen girdiler

Çoklu dosya yükleme (CSV / XLSX). Dosya türü başlıklardan tahmin edilir; kullanıcı değiştirebilir. Bilinmeyen export için sütun seçici (source / destination / type / regex / matching / GSC alanları).

### Rank Math Redirects CSV

Kaynak: [How to Create & Edit Redirects Using CSV (Rank Math KB)](https://rankmath.com/kb/how-to-manage-redirects-via-csv/)

Doğrulanmış sütunlar (başlıklar küçük harf, sırasız):

| Sütun | Not |
|-------|-----|
| `id` | Düzenleme için |
| `source` | Kaynak URL(ler) |
| `matching` | `exact`, `contains`, `start`, `end`, `regex` |
| `destination` | Hedef |
| `type` | `301`, `302`, `307`, `410`, `451` |
| `category` | Opsiyonel |
| `status` | `active` / `inactive` |
| `ignore` | boş veya `case` |

`matching` ∈ {`regex`,`contains`,`start`,`end`} → satır **unsupported** (denetime girmez).

### Redirection (John Godley) CSV

Doküman (import biçimi): [Import and export – Redirection](https://redirection.me/support/import-export/)

Export sütunları (kaynak kod `fileio/csv.php`, jsDelivr `johngodley/redirection@5.5.2`):

| Sütun | Not |
|-------|-----|
| `source` | Kaynak |
| `target` | Hedef (bizde destination rolü) |
| `regex` | `0` / `1` |
| `code` | HTTP kodu (301…) |
| `type` | `url` / `error` |
| `hits` | İstatistik |
| `title` | Başlık |
| `status` | `active` / `disabled` |

Opsiyonel `group` sütunu: [PR #4201](https://github.com/johngodley/redirection/pull/4201) ile yeni sürümlerde görülebilir; tanıma için zorunlu değil.

Dokümandaki import örneği başlıksız da olabilir (`source URL,target URL[,regex,http code,type]`). Başlıksız dosyalar **bilinmeyen** sayılır → sütun seçici.

`regex=1` veya kaynakta `*` → **unsupported**.

### Düz CSV

`source,destination` (veya `kaynak`/`hedef`, `from`/`to`). Opsiyonel `type`.

### GSC Pages / Performance (opsiyonel)

| Rol | EN | TR |
|-----|----|----|
| Sayfa | `Top pages`, `Page`, `Landing page`, `URL` | `En çok ziyaret edilen sayfalar`, `Üst sayfalar`, `Sayfa` |
| Tıklama | `Clicks` | `Tıklamalar` |
| Gösterim | `Impressions` | `Gösterimler` |

GSC sütun adları ürün diline göre değişebilir; tanınmazsa sütun seçici kullanın.

### Doğrulanamayanlar

- Redirection’ın **tüm** sürümlerinde export başlıklarının birebirliği (örnek canlı site export’u yok; 5.5.2 kaynak + PR #4201 ile doğrulandı).
- Rank Math’in export’ta her zaman `matching` yazıp yazmadığı (KB import şeması doğrulandı; export’un aynı başlıkları ürettiği KB’de belirtiliyor).
- GSC CSV’nin tüm dil/yerel başlık varyantları.

## Normalizasyon kuralları

Karşılaştırmadan önce:

1. `trim`; **fragment** (`#…`) atılır  
2. Tam URL → `host` (küçük harf) + `path` (+ query)  
3. Göreli path → başına `/`  
4. **Path** varsayılan **case-sensitive**; seçenekle duyarsız  
5. **Host** her zaman case-insensitive  
6. Sondaki `/` farkı varsayılan yok sayılır (kök `/` hariç); kapatılabilir  
7. **Query** varsayılan korunur; yok sayılabilir  
8. Yüzde kodlama path segment’lerinde normalize edilir  

## Denetimler

| Bayrak | Anlam |
|--------|--------|
| `duplicate` | Aynı source + aynı destination (dosyalar arası dahil) |
| `conflict` | Aynı source, farklı destination |
| `chain` | A→B ve B→C (uzunluk ≥ 2 hop); flatten önerisi |
| `loop` | Döngü (2+); flatten **yok** |
| `self` | source == destination (normalize sonrası) |
| `unsupported` | Regex / wildcard / contains|start|end — denetime girmez |

Her satırda kaynak **dosya adı** ve **satır no** korunur.

**Flatten:** Zinciri son hedefe tek hop indiren öneri; kullanıcı onay kutusuyla seçmeden çıktıya yazılmaz. Döngülerde öneri yok.

**GSC join:** `sourceNorm` ↔ `pageNorm`; sıralama: sorunlu + yüksek click önce.

## Çıktı

- Filtrelenebilir birleşik tablo (bayrak filtresi, özet sayaçlar, sayfalama)  
- `redirect-map-fixed.csv` → `source,destination,type` (onaylı flatten uygulanır)  
- `redirect-map-issues.csv` → sorunlu satırlar  
- İndirmede **formula-guard** zorunlu (`= + - @ |` ve fullwidth)

## Sınırlar

- Dosya başı **10 MB**  
- Dosya başı / birleşik **100.000** satır  
- Ağır denetim **Web Worker** (`worker-src 'self'`)

## Desteklenmeyenler

- Canlı destination HTTP kontrolü / crawl  
- Regex / wildcard kurallarının çözümü  
- WordPress eklentisi / wp-admin  
- Sunucu, OAuth, analytics  

## Güvenlik

- SheetJS **0.20.3** (cdn.sheetjs.com tgz); npm `xlsx@0.18.5` yok  
- CSP tek kaynak `shared/csp.mjs` (`unsafe-inline` yok)  
- `innerHTML` ile kullanıcı verisi yok  
- PWA / yerel saklama varsayılan **kapalı**  
- `fetch` / XHR / `sendBeacon` yok  

## Teknoloji

Vite 6 + vanilla TypeScript + Vitest. Şablon: `fikir-fabrikasi/sablon/tarayici-arac` @ `cfb3815`.

## Gizlilik

Tüm işlem tarayıcıda; dosyalar cihazdan çıkmaz.

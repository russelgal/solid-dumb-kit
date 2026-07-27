# Utils

Framework-free helpers that ship with the kit — no SolidJS, no DOM (except `extractImagesFromZip`, which needs `File`/`DataTransfer`).

```tsx
import { fmtPrice, timeAgo, genSlug, extractImagesFromZip, imgproxyUrl } from 'solid-dumb-kit'
```

## `fmt` — numbers, dates, sizes

> **Locale note.** These are hard-wired to **`ru-RU`** and the ruble sign — they came from a Russian-facing admin panel and are kept byte-compatible with it. Group separator is a non-breaking space (`U+00A0`). If you need another locale, wrap `Intl` yourself rather than bending these.

### Numbers

`null`, `undefined`, `''` and unparseable strings return `''` (or an em dash `—` where noted). Numeric strings are parsed (`'2500.50'` works).

| Function | `1234.5` → | Empty input → |
| --- | --- | --- |
| `Rub0(v)` | `1 235` | `''` |
| `Rub2(v)` | `1 234,50` | `''` |
| `Rub4(v)` | `1 234,5` (up to 4 decimals) | `''` |
| `Rub0R(v)` | `1 235 ₽` | `''` |
| `RubR2(v)` | `1 234,50 ₽` | `''` |
| `fmtNum(v)` | `1 235` | `—` |
| `fmtPrice(v)` | `1 234,50 ₽` | `—` |

### Dates

Accept `string | number | Date | null | undefined`; invalid dates return `''`.

| Function | Output |
| --- | --- |
| `fmtDate(v)` | `23.02.2026` |
| `fmtDateTime(v)` | `23.02.2026, 16:40:22` |
| `fmtDateTimeShort(v)` | `23.02.2026, 16:40` |
| `fmtTime(v)` | `16:40:22` |
| `fmtDateMonth(v)` | `23 февр. 2026 г.` |
| `timeAgo(v)` | `только что` / `5 мин. назад` / `3 ч. назад` / `28 дн. назад`, `—` when empty |

`timeAgo` clamps future dates to `только что`.

### File size

`fmtSize(bytes)` → `512 Б` · `24 КБ` · `1.3 МБ`. Switches at 1024 and 1024², KB with no decimals, MB with one.

## `genSlug` — URL slugs

```ts
genSlug('Пляжный отдых и бассейны') // → 'plyazhnyj-otdyh-i-bassejny'
genSlug('Café Ürün')                // → 'cafe-urun'
```

A thin wrapper over the [`slug`](https://www.npmjs.com/package/slug) package: transliterates Cyrillic, strips diacritics, lowercases, collapses separators to `-`. Cyrillic mapping worth knowing: `ё→yo  ж→zh  й→j  х→h  ц→c  ч→ch  ш/щ→sh  ь→∅  ю→yu  я→ya`.

## `extractImagesFromZip` — images out of a ZIP

```ts
const files = await extractImagesFromZip(zipFile) // → FileList
input.files = files
```

Takes a `File` containing a ZIP, returns a `FileList` you can assign straight to an `<input type="file">` or feed to an upload routine.

- Keeps `jpg jpeg png gif webp svg`, with the correct MIME type on each `File`.
- Skips `__MACOSX/…`, dot-files, and everything that isn't an image.
- Flattens paths — `photos/2026/sunset.jpg` comes out as `sunset.jpg`.

`fflate` is loaded through a **dynamic `import()`**, so it only hits the network when someone actually unpacks an archive.

## `imgproxyUrl` — imgproxy URL builder

```ts
imgproxyUrl('/media/rooms/42/p.jpg', { w: 800, h: 600, fit: 'fill', q: 85, format: 'webp' })
// → https://img.example.com/insecure/rs:fill:800:600:0:0/q:85/{base64url(source)}.webp
```

Builds `/insecure/{processing}/{base64url(source)}.{ext}`. **Signing is not implemented** — either enable `/insecure/` in imgproxy, or sign on the server and pass a ready URL.

### Configuration

```ts
import { configureImgproxy } from 'solid-dumb-kit'

configureImgproxy({
  baseUrl: 'https://img.example.com',
  bucket: 'my-bucket',                     // enables /media/… → s3://my-bucket/…
  webEndpoint: 'https://cdn.example.com',  // that URL prefix also folds into s3://
})
```

Call it once at startup. Without it the same three values are read from the environment — `VITE_IMGPROXY_URL`, `VITE_S3_BUCKET`, `VITE_S3_WEB_ENDPOINT` (`process.env` first, then `import.meta.env`).

Graceful degradation:

- no `baseUrl` (and no env) → `imgproxyUrl` returns the original `src` untouched;
- no `bucket` → no `s3://` rewriting, the source path is passed through as-is.

### Options (`ImgproxyOps`)

| Option | Type | Emits |
| --- | --- | --- |
| `w` / `h` | `number` | `rs:{fit}:{w}:{h}:{enlarge}:{extend}` (defaults to `fit: 'fill'`) |
| `fit` | `'fit' \| 'fill' \| 'fill-down' \| 'force' \| 'auto'` | resize type |
| `enlarge` / `extend` | `boolean` | flags inside `rs:` |
| `dpr` | `number` | `dpr:2` (skipped when `1`) |
| `gravity` | `'no' \| 'so' \| 'ea' \| 'we' \| 'noea' \| 'nowe' \| 'soea' \| 'sowe' \| 'ce' \| 'sm' \| 'fp'` | `g:sm` |
| `q` | `number` | `q:85` |
| `bg` | `string` | `bg:ff0000` (leading `#` stripped) |
| `blur` | `number` | `bl:3` |
| `sharpen` | `number` | `sh:1` |
| `padding` | `number \| [t, r, b, l]` | `pd:10` / `pd:1:2:3:4` |
| `preset` | `string \| string[]` | `pr:thumb` / `pr:a:b` |
| `format` | `'jpg' \| 'png' \| 'webp' \| 'avif' \| 'gif' \| 'ico' \| 'svg' \| 'tiff'` | file extension |

## Tests

All four helpers are covered by `vitest` — `pnpm test` (130 assertions, `happy-dom` environment for the ZIP part).

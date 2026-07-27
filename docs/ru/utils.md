[English](../utils.md) · **Русский**

# Утилиты

Хелперы без привязки к фреймворку, идущие в комплекте — ни SolidJS, ни DOM (кроме `extractImagesFromZip`, которому нужны `File`/`DataTransfer`).

```tsx
import { fmtPrice, timeAgo, genSlug, extractImagesFromZip, imgproxyUrl } from 'solid-dumb-kit'
```

## `fmt` — числа, даты, размеры

> **Про локаль.** Всё жёстко завязано на **`ru-RU`** и знак рубля — код приехал из русской админки и сохранён совместимым с ней байт в байт. Разделитель разрядов — неразрывный пробел (`U+00A0`). Нужна другая локаль — оборачивай `Intl` сам, а не гни эти функции.

### Числа

`null`, `undefined`, `''` и непарсящиеся строки дают `''` (или длинное тире `—`, где отмечено). Числовые строки парсятся (`'2500.50'` работает).

| Функция | `1234.5` → | Пустой ввод → |
| --- | --- | --- |
| `Rub0(v)` | `1 235` | `''` |
| `Rub2(v)` | `1 234,50` | `''` |
| `Rub4(v)` | `1 234,5` (до 4 знаков) | `''` |
| `Rub0R(v)` | `1 235 ₽` | `''` |
| `RubR2(v)` | `1 234,50 ₽` | `''` |
| `fmtNum(v)` | `1 235` | `—` |
| `fmtPrice(v)` | `1 234,50 ₽` | `—` |

### Даты

Принимают `string | number | Date | null | undefined`; невалидная дата даёт `''`.

| Функция | Результат |
| --- | --- |
| `fmtDate(v)` | `23.02.2026` |
| `fmtDateTime(v)` | `23.02.2026, 16:40:22` |
| `fmtDateTimeShort(v)` | `23.02.2026, 16:40` |
| `fmtTime(v)` | `16:40:22` |
| `fmtDateMonth(v)` | `23 февр. 2026 г.` |
| `timeAgo(v)` | `только что` / `5 мин. назад` / `3 ч. назад` / `28 дн. назад`, `—` для пустого |

`timeAgo` схлопывает будущие даты в `только что`.

### Размер файла

`fmtSize(bytes)` → `512 Б` · `24 КБ` · `1.3 МБ`. Переключается на 1024 и 1024², КБ без знаков после запятой, МБ — с одним.

## `genSlug` — слаги для URL

```ts
genSlug('Пляжный отдых и бассейны') // → 'plyazhnyj-otdyh-i-bassejny'
genSlug('Café Ürün')                // → 'cafe-urun'
```

Тонкая обёртка над пакетом [`slug`](https://www.npmjs.com/package/slug): транслитерирует кириллицу, снимает диакритику, приводит к нижнему регистру, схлопывает разделители в `-`. Полезно знать таблицу: `ё→yo  ж→zh  й→j  х→h  ц→c  ч→ch  ш/щ→sh  ь→∅  ю→yu  я→ya`.

## `extractImagesFromZip` — картинки из ZIP

```ts
const files = await extractImagesFromZip(zipFile) // → FileList
input.files = files
```

Принимает `File` с ZIP-архивом, возвращает `FileList`, который можно сразу присвоить `<input type="file">` или скормить своей загрузке.

- Оставляет `jpg jpeg png gif webp svg`, каждому `File` проставляет правильный MIME-тип.
- Пропускает `__MACOSX/…`, точечные файлы и всё, что не картинка.
- Схлопывает пути — `photos/2026/sunset.jpg` выходит как `sunset.jpg`.

`fflate` подключается **динамическим `import()`**, поэтому грузится только тогда, когда кто-то реально распаковывает архив.

## `imgproxyUrl` — сборка URL для imgproxy

```ts
imgproxyUrl('/media/rooms/42/p.jpg', { w: 800, h: 600, fit: 'fill', q: 85, format: 'webp' })
// → https://img.example.com/insecure/rs:fill:800:600:0:0/q:85/{base64url(source)}.webp
```

Собирает `/insecure/{processing}/{base64url(source)}.{ext}`. **Подпись не реализована** — либо включай `/insecure/` в imgproxy, либо подписывай на сервере и передавай готовый URL.

### Настройка

```ts
import { configureImgproxy } from 'solid-dumb-kit'

configureImgproxy({
  baseUrl: 'https://img.example.com',
  bucket: 'my-bucket',                     // включает /media/… → s3://my-bucket/…
  webEndpoint: 'https://cdn.example.com',  // этот префикс тоже сворачивается в s3://
})
```

Вызывается один раз на старте приложения. Без него те же три значения читаются из окружения — `VITE_IMGPROXY_URL`, `VITE_S3_BUCKET`, `VITE_S3_WEB_ENDPOINT` (сначала `process.env`, потом `import.meta.env`).

Мягкая деградация:

- нет `baseUrl` (и в env тоже) → `imgproxyUrl` возвращает исходный `src` нетронутым;
- нет `bucket` → никакой подстановки `s3://`, путь уходит как есть.

### Опции (`ImgproxyOps`)

| Опция | Тип | Во что превращается |
| --- | --- | --- |
| `w` / `h` | `number` | `rs:{fit}:{w}:{h}:{enlarge}:{extend}` (по умолчанию `fit: 'fill'`) |
| `fit` | `'fit' \| 'fill' \| 'fill-down' \| 'force' \| 'auto'` | тип ресайза |
| `enlarge` / `extend` | `boolean` | флаги внутри `rs:` |
| `dpr` | `number` | `dpr:2` (пропускается при `1`) |
| `gravity` | `'no' \| 'so' \| 'ea' \| 'we' \| 'noea' \| 'nowe' \| 'soea' \| 'sowe' \| 'ce' \| 'sm' \| 'fp'` | `g:sm` |
| `q` | `number` | `q:85` |
| `bg` | `string` | `bg:ff0000` (ведущий `#` срезается) |
| `blur` | `number` | `bl:3` |
| `sharpen` | `number` | `sh:1` |
| `padding` | `number \| [t, r, b, l]` | `pd:10` / `pd:1:2:3:4` |
| `preset` | `string \| string[]` | `pr:thumb` / `pr:a:b` |
| `format` | `'jpg' \| 'png' \| 'webp' \| 'avif' \| 'gif' \| 'ico' \| 'svg' \| 'tiff'` | расширение файла |

## Тесты

Все четыре хелпера покрыты `vitest` — `pnpm test` (130 проверок, окружение `happy-dom` ради ZIP-части).

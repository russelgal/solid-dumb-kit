type Numeric = number | string | null | undefined;
/** 1 234,56 ₽ */
declare function RubR2(v: Numeric): string;
/** 1 234,56 */
declare function Rub2(v: Numeric): string;
/** 1 235 */
declare function Rub0(v: Numeric): string;
/** 1 235 ₽ */
declare function Rub0R(v: Numeric): string;
/** 1 234,5678 */
declare function Rub4(v: Numeric): string;
/** 1 234 или — */
declare function fmtNum(v: Numeric): string;
/** 1 234,56 ₽ или — */
declare function fmtPrice(v: Numeric): string;
type DateInput = string | number | Date | null | undefined;
/** 23.02.2026, 16:40:22 */
declare function fmtDateTime(v: DateInput): string;
/** 23.02.2026, 16:40 */
declare function fmtDateTimeShort(v: DateInput): string;
/** 23.02.2026 */
declare function fmtDate(v: DateInput): string;
/** 16:40:22 */
declare function fmtTime(v: DateInput): string;
/** 23 февр. 2026 г. */
declare function fmtDateMonth(v: DateInput): string;
/** 512 Б / 24 КБ / 1.3 МБ */
declare function fmtSize(bytes: number): string;
/** "2 ч. назад", "3 дн. назад" или — */
declare function timeAgo(v: DateInput): string;

/**
 * Слаг из названия.
 *
 * ОСТОРОЖНО при переезде со своей реализации: у `slug` своя таблица кириллицы, и
 * с популярной связкой «сначала транслит, потом slug» она расходится —
 * `й` → `j` против `i`, `ы` → `y` против `i`:
 *
 *     Клей-карандаш 15г   → klej-karandash-15g   (здесь)
 *                         → klei-karandash-15g   (транслит + slug)
 *
 * Для нового справочника разницы нет, но если слаги уже лежат в базе и на них
 * стоят живые URL, подмена функции меняет адреса и отдаёт 404. Так что менять —
 * только вместе с миграцией данных либо с редиректами.
 */
declare const genSlug: (name: string) => string;

/** Извлечь изображения из ZIP-архива, вернуть как FileList */
declare function extractImagesFromZip(zipFile: File): Promise<FileList>;

/**
 * imgproxy URL builder — чистая функция без зависимостей от SolidJS/DOM.
 *
 * URL: /insecure/{processing_options}/{base64url(source)}.{ext}
 * Подпись здесь не реализована — для прода либо включайте /insecure/
 * в imgproxy, либо подписывайте на сервере и передавайте готовый URL.
 */
type ImgFit = 'fit' | 'fill' | 'fill-down' | 'force' | 'auto';
type ImgGravity = 'no' | 'so' | 'ea' | 'we' | 'noea' | 'nowe' | 'soea' | 'sowe' | 'ce' | 'sm' | 'fp';
type ImgFormat = 'jpg' | 'png' | 'webp' | 'avif' | 'gif' | 'ico' | 'svg' | 'tiff';
type ImgproxyOps = {
    w?: number;
    h?: number;
    fit?: ImgFit;
    q?: number;
    format?: ImgFormat;
    gravity?: ImgGravity;
    enlarge?: boolean;
    extend?: boolean;
    dpr?: number;
    blur?: number;
    sharpen?: number;
    bg?: string;
    padding?: number | [number, number, number, number];
    preset?: string | string[];
};
type ImgproxyConfig = {
    /** База imgproxy, напр. https://img.example.com. Не задана → imgproxyUrl вернёт src как есть */
    baseUrl?: string;
    /** S3-бакет для конвертации /media/... → s3://bucket/... Не задан → конвертации нет */
    bucket?: string;
    /** Публичный http-эндпоинт того же бакета — тоже конвертируется в s3:// */
    webEndpoint?: string;
};
/**
 * Явно задать настройки imgproxy (перебивают переменные окружения).
 * Вызывать один раз на старте приложения.
 */
declare function configureImgproxy(c: ImgproxyConfig): void;
/**
 * Строит imgproxy URL из src.
 *
 * Конвертация source (только если задан бакет):
 *   /media/sites/1/...              → s3://{bucket}/sites/1/...
 *   http://{webEndpoint}/path       → s3://{bucket}/path
 *   http://...                      → как есть
 *
 * Настройки берутся из configureImgproxy(), иначе из переменных окружения
 * VITE_IMGPROXY_URL / VITE_S3_BUCKET / VITE_S3_WEB_ENDPOINT.
 * Если база не задана — возвращает оригинальный src (graceful fallback).
 */
declare function imgproxyUrl(src: string, opts?: ImgproxyOps): string;

export { type ImgFit, type ImgFormat, type ImgGravity, type ImgproxyConfig, type ImgproxyOps, Rub0, Rub0R, Rub2, Rub4, RubR2, configureImgproxy, extractImagesFromZip, fmtDate, fmtDateMonth, fmtDateTime, fmtDateTimeShort, fmtNum, fmtPrice, fmtSize, fmtTime, genSlug, imgproxyUrl, timeAgo };

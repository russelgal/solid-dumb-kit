/**
 * imgproxy URL builder — чистая функция без зависимостей от SolidJS/DOM.
 *
 * URL: /insecure/{processing_options}/{base64url(source)}.{ext}
 * Подпись здесь не реализована — для прода либо включайте /insecure/
 * в imgproxy, либо подписывайте на сервере и передавайте готовый URL.
 */
export type ImgFit = 'fit' | 'fill' | 'fill-down' | 'force' | 'auto';
export type ImgGravity = 'no' | 'so' | 'ea' | 'we' | 'noea' | 'nowe' | 'soea' | 'sowe' | 'ce' | 'sm' | 'fp';
export type ImgFormat = 'jpg' | 'png' | 'webp' | 'avif' | 'gif' | 'ico' | 'svg' | 'tiff';
export type ImgproxyOps = {
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
export type ImgproxyConfig = {
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
export declare function configureImgproxy(c: ImgproxyConfig): void;
/**
 * Читает переменную из process.env (SSR) или import.meta.env (браузер).
 * Оба источника читаются через globalThis/каст — чтобы не тянуть @types/node в либу.
 */
export declare function env(key: string): string | undefined;
/** base64url для строки (UTF-8 safe), браузер + Node */
export declare function base64url(input: string): string;
/** Конвертация локальных URL в s3:// для imgproxy */
export declare function resolveSource(src: string): string;
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
export declare function imgproxyUrl(src: string, opts?: ImgproxyOps): string;

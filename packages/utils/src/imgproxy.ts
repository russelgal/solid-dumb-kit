/**
 * imgproxy URL builder — чистая функция без зависимостей от SolidJS/DOM.
 *
 * URL: /insecure/{processing_options}/{base64url(source)}.{ext}
 * Подпись здесь не реализована — для прода либо включайте /insecure/
 * в imgproxy, либо подписывайте на сервере и передавайте готовый URL.
 */

export type ImgFit = 'fit' | 'fill' | 'fill-down' | 'force' | 'auto'

export type ImgGravity =
  | 'no' | 'so' | 'ea' | 'we'
  | 'noea' | 'nowe' | 'soea' | 'sowe'
  | 'ce' | 'sm' | 'fp'

export type ImgFormat = 'jpg' | 'png' | 'webp' | 'avif' | 'gif' | 'ico' | 'svg' | 'tiff'

export type ImgproxyOps = {
  w?: number
  h?: number
  fit?: ImgFit
  q?: number
  format?: ImgFormat
  gravity?: ImgGravity
  enlarge?: boolean
  extend?: boolean
  dpr?: number
  blur?: number
  sharpen?: number
  bg?: string
  padding?: number | [number, number, number, number]
  preset?: string | string[]
}

export type ImgproxyConfig = {
  /** База imgproxy, напр. https://img.example.com. Не задана → imgproxyUrl вернёт src как есть */
  baseUrl?: string
  /** S3-бакет для конвертации /media/... → s3://bucket/... Не задан → конвертации нет */
  bucket?: string
  /** Публичный http-эндпоинт того же бакета — тоже конвертируется в s3:// */
  webEndpoint?: string
}

let config: ImgproxyConfig = {}

/**
 * Явно задать настройки imgproxy (перебивают переменные окружения).
 * Вызывать один раз на старте приложения.
 */
export function configureImgproxy(c: ImgproxyConfig): void {
  config = { ...config, ...c }
}

/**
 * Читает переменную из process.env (SSR) или import.meta.env (браузер).
 * Оба источника читаются через globalThis/каст — чтобы не тянуть @types/node в либу.
 */
export function env(key: string): string | undefined {
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
  const fromProc = proc?.env?.[key]
  if (fromProc) return fromProc
  const meta = import.meta as unknown as { env?: Record<string, string | undefined> }
  return meta.env?.[key]
}

/** base64url для строки (UTF-8 safe), браузер + Node */
export function base64url(input: string): string {
  const Buf: any = (globalThis as any).Buffer
  if (Buf) {
    return Buf.from(input, 'utf8').toString('base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  }
  const bytes = new TextEncoder().encode(input)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Конвертация локальных URL в s3:// для imgproxy */
export function resolveSource(src: string): string {
  const bucket = config.bucket ?? env('VITE_S3_BUCKET')
  if (!bucket) return src
  if (src.startsWith('/media/')) return `s3://${bucket}/${src.slice(7)}`
  const s3Web = (config.webEndpoint ?? env('VITE_S3_WEB_ENDPOINT'))?.replace(/\/$/, '')
  if (s3Web && src.startsWith(s3Web + '/')) return `s3://${bucket}/${src.slice(s3Web.length + 1)}`
  return src
}

function buildProcessing(ops: ImgproxyOps): string {
  const parts: string[] = []
  if (ops.w || ops.h || ops.fit) {
    const t = ops.fit ?? 'fit'
    parts.push(`rs:${t}:${ops.w ?? 0}:${ops.h ?? 0}:${ops.enlarge ? 1 : 0}:${ops.extend ? 1 : 0}`)
  }
  if (ops.dpr && ops.dpr !== 1) parts.push(`dpr:${ops.dpr}`)
  if (ops.gravity) parts.push(`g:${ops.gravity}`)
  if (ops.q) parts.push(`q:${ops.q}`)
  if (ops.bg) parts.push(`bg:${ops.bg.replace(/^#/, '')}`)
  if (ops.blur) parts.push(`bl:${ops.blur}`)
  if (ops.sharpen) parts.push(`sh:${ops.sharpen}`)
  if (ops.padding != null) {
    parts.push(Array.isArray(ops.padding) ? `pd:${ops.padding.join(':')}` : `pd:${ops.padding}`)
  }
  if (ops.preset) {
    parts.push(`pr:${Array.isArray(ops.preset) ? ops.preset.join(':') : ops.preset}`)
  }
  return parts.join('/')
}

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
export function imgproxyUrl(src: string, opts: ImgproxyOps = {}): string {
  const base = (config.baseUrl ?? env('VITE_IMGPROXY_URL'))?.replace(/\/$/, '')
  if (!base || !src) return src

  const processing = buildProcessing({ fit: 'fill', ...opts })
  const ext = opts.format ? `.${opts.format}` : ''
  return `${base}/insecure/${processing}/${base64url(resolveSource(src))}${ext}`
}

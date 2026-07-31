import { describe, it, expect, beforeEach } from 'vitest'
import { base64url, imgproxyUrl, configureImgproxy } from '../src/imgproxy'

const BASE = 'https://img.example.com'

beforeEach(() => {
  // модульный конфиг живёт между тестами — сбрасываем явно
  configureImgproxy({ baseUrl: undefined, bucket: undefined, webEndpoint: undefined })
  ;(process as any).env.VITE_IMGPROXY_URL = BASE
  ;(process as any).env.VITE_S3_BUCKET = 'pioneer'
  delete (process as any).env.VITE_S3_WEB_ENDPOINT
})

describe('base64url', () => {
  it('кодирует ASCII без padding', () => {
    expect(base64url('hello')).toBe('aGVsbG8')
  })
  it('UTF-8 safe (кириллица)', () => {
    expect(base64url('тест')).toBe('0YLQtdGB0YI')
  })
  it('заменяет +/ и обрезает =', () => {
    const enc = base64url('???>')
    expect(enc).not.toMatch(/[+/=]/)
  })
})

describe('imgproxyUrl', () => {
  it('строит /insecure/rs:fill:.../base64', () => {
    const url = imgproxyUrl('https://s3.example.com/p.jpg', { w: 800 })
    expect(url).toBe(
      `${BASE}/insecure/rs:fill:800:0:0:0/${base64url('https://s3.example.com/p.jpg')}`,
    )
  })

  it('конвертирует /media/... в s3://bucket/...', () => {
    const url = imgproxyUrl('/media/sites/1/rooms/42/p.jpg', { w: 400, h: 300 })
    expect(url).toContain(`/${base64url('s3://pioneer/sites/1/rooms/42/p.jpg')}`)
    expect(url).toContain('rs:fill:400:300:0:0')
  })

  it('конвертирует http://s3-web-endpoint в s3://', () => {
    ;(process as any).env.VITE_S3_WEB_ENDPOINT = 'http://pioneer.example.com'
    const url = imgproxyUrl('http://pioneer.example.com/sites/1/foo.jpg')
    expect(url).toContain(`/${base64url('s3://pioneer/sites/1/foo.jpg')}`)
  })

  it('кодирует все processing-options', () => {
    const url = imgproxyUrl('https://s.io/p.jpg', {
      w: 400, h: 300, fit: 'fill', gravity: 'sm', enlarge: true,
      q: 85, format: 'webp', dpr: 2, blur: 3, sharpen: 1,
      bg: '#ff0000', padding: 10, preset: 'thumb',
    })
    expect(url).toBe(
      `${BASE}/insecure/rs:fill:400:300:1:0/dpr:2/g:sm/q:85/bg:ff0000/bl:3/sh:1/pd:10/pr:thumb/${base64url('https://s.io/p.jpg')}.webp`,
    )
  })

  it('padding массивом → top:right:bottom:left', () => {
    expect(imgproxyUrl('https://s.io/p.jpg', { padding: [1, 2, 3, 4] })).toContain('/pd:1:2:3:4/')
  })

  it('preset массивом', () => {
    expect(imgproxyUrl('https://s.io/p.jpg', { preset: ['a', 'b'] })).toContain('/pr:a:b/')
  })

  it('dpr=1 пропускается', () => {
    expect(imgproxyUrl('https://s.io/p.jpg', { dpr: 1 })).not.toContain('dpr:')
  })

  it('пустой src возвращает как есть', () => {
    expect(imgproxyUrl('')).toBe('')
  })

  it('graceful fallback без VITE_IMGPROXY_URL', () => {
    delete (process as any).env.VITE_IMGPROXY_URL
    expect(imgproxyUrl('https://s.io/p.jpg', { w: 100 })).toBe('https://s.io/p.jpg')
  })

  it('убирает trailing slash в baseUrl', () => {
    ;(process as any).env.VITE_IMGPROXY_URL = `${BASE}/`
    expect(imgproxyUrl('https://s.io/p.jpg').startsWith(`${BASE}/insecure/`)).toBe(true)
  })
})

describe('configureImgproxy — явные настройки вместо env', () => {
  it('baseUrl из конфига перебивает переменную окружения', () => {
    configureImgproxy({ baseUrl: 'https://cfg.example.com/' })
    expect(imgproxyUrl('https://s.io/p.jpg').startsWith('https://cfg.example.com/insecure/')).toBe(true)
  })

  it('bucket из конфига перебивает переменную окружения', () => {
    configureImgproxy({ bucket: 'shop' })
    expect(imgproxyUrl('/media/a/p.jpg')).toContain(`/${base64url('s3://shop/a/p.jpg')}`)
  })

  it('webEndpoint из конфига конвертируется в s3://', () => {
    configureImgproxy({ bucket: 'shop', webEndpoint: 'http://cdn.example.com/' })
    expect(imgproxyUrl('http://cdn.example.com/a/p.jpg')).toContain(`/${base64url('s3://shop/a/p.jpg')}`)
  })

  it('без бакета /media/... остаётся как есть (нет хардкода бакета)', () => {
    delete (process as any).env.VITE_S3_BUCKET
    expect(imgproxyUrl('/media/a/p.jpg')).toContain(`/${base64url('/media/a/p.jpg')}`)
  })
})

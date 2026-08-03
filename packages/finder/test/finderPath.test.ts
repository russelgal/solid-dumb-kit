import { describe, it, expect } from 'vitest'
import {
  canMove, crumbs, joinPrefix, kindOf, nameOf, parentOf, sortEntries,
} from '../src/finderPath'
import type { FinderEntry } from '../src/finderTypes'

const file = (key: string, extra: Partial<FinderEntry> = {}): FinderEntry => ({
  key,
  name: nameOf(key),
  ...extra,
})
const dir = (key: string): FinderEntry => ({ key, name: nameOf(key), dir: true })

describe('имена и пути', () => {
  it('имя берётся из хвоста, у папки — без слэша', () => {
    expect(nameOf('a/b/c.jpg')).toBe('c.jpg')
    expect(nameOf('a/b/')).toBe('b')
    expect(nameOf('readme.txt')).toBe('readme.txt')
  })

  it('родитель у корневого ключа — корень, а не он сам', () => {
    expect(parentOf('a/b/c.jpg')).toBe('a/b/')
    expect(parentOf('a/')).toBe('')
    expect(parentOf('readme.txt')).toBe('')
  })

  it('склейка не плодит двойных слэшей', () => {
    expect(joinPrefix('', 'фото')).toBe('фото')
    expect(joinPrefix('a/', 'b')).toBe('a/b')
    // префикс без слэша на конце — тоже папка: слэш дописываем
    expect(joinPrefix('a', 'b')).toBe('a/b')
  })

  it('крошки начинаются с корня и накапливают путь', () => {
    expect(crumbs('a/b/')).toEqual([
      { name: 'Всё', prefix: '' },
      { name: 'a', prefix: 'a/' },
      { name: 'b', prefix: 'a/b/' },
    ])
    expect(crumbs('')).toEqual([{ name: 'Всё', prefix: '' }])
  })
})

describe('куда переносить нельзя', () => {
  it('на место, где уже лежит', () => {
    expect(canMove('a/b/c.jpg', 'a/b/')).toBe(false)
    expect(canMove('c.jpg', '')).toBe(false)
    expect(canMove('a/b/c.jpg', '')).toBe(true)
  })

  it('папку — в себя и в своего потомка', () => {
    expect(canMove('a/b/', 'a/b/')).toBe(false)
    expect(canMove('a/b/', 'a/b/c/')).toBe(false)
    expect(canMove('a/b/', 'x/')).toBe(true)
    // соседняя папка с похожим началом — не потомок
    expect(canMove('a/b/', 'a/bb/')).toBe(true)
  })
})

describe('порядок показа', () => {
  it('папки всегда сверху, даже при сортировке по размеру', () => {
    const got = sortEntries([file('z.txt', { size: 10 }), dir('a/')], 'size')
    expect(got.map((e) => e.key)).toEqual(['a/', 'z.txt'])
  })

  it('имена сравниваются по-человечески: файл2 раньше файл10', () => {
    const got = sortEntries([file('файл10'), file('файл2')])
    expect(got.map((e) => e.name)).toEqual(['файл2', 'файл10'])
  })

  it('обратный порядок переворачивает только файлы между собой', () => {
    const got = sortEntries([file('a'), file('b'), dir('d/')], 'name', true)
    expect(got.map((e) => e.name)).toEqual(['d', 'b', 'a'])
  })

  it('дата принимается и числом, и строкой', () => {
    const got = sortEntries(
      [file('старый', { modified: '2020-01-01T00:00:00Z' }), file('новый', { modified: Date.now() })],
      'modified',
      true,
    )
    expect(got[0].name).toBe('новый')
  })

  it('исходный массив не трогается', () => {
    const src = [file('b'), file('a')]
    sortEntries(src)
    expect(src.map((e) => e.name)).toEqual(['b', 'a'])
  })
})

describe('вид файла по имени', () => {
  it('узнаёт картинки, видео и архивы', () => {
    expect(kindOf('a.JPG')).toBe('image')
    expect(kindOf('a.webm')).toBe('video')
    expect(kindOf('a.tar.gz')).toBe('archive')
    expect(kindOf('a.pdf')).toBe('pdf')
    expect(kindOf('LICENSE')).toBe('file')
  })
})

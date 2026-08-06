import { describe as suite, expect, it } from 'vitest'
import { describe, dumpProps } from '../src/propsDump'

suite('describe', () => {
  it('показывает функции, которые JSON молча выбрасывает', () => {
    expect(describe(function onOpen(a: unknown, b: unknown) { return [a, b] })).toBe('ƒ onOpen(2)')
    expect(describe(() => {})).toBe('ƒ anonymous(0)')
  })

  it('различает пустое: null, undefined и пустую строку', () => {
    expect(describe(null)).toBe('null')
    expect(describe(undefined)).toBe('undefined')
    expect(describe('')).toBe('""')
  })

  it('массив показывает длиной, объект — ключами', () => {
    expect(describe([1, 2, 3])).toBe('Array(3)')
    expect(describe({ first: 1, days: 2 })).toBe('{first, days}')
  })

  it('длинный объект обрезает ключи многоточием', () => {
    const wide = Object.fromEntries('abcdefgh'.split('').map((k) => [k, 1]))
    expect(describe(wide)).toBe('{a, b, c, d, e, f, …}')
  })
})

suite('dumpProps', () => {
  it('порядок: вложенное, потом функции, потом скаляры', () => {
    const rows = dumpProps({ zz: 1, onClick: () => {}, scale: { a: 1 }, list: [1] }, { depth: 0 })
    expect(rows.map((r) => r.key)).toEqual(['scale', 'list', 'onClick', 'zz'])
  })

  it('разворачивает вложенное на заданную глубину и хранит путь', () => {
    const rows = dumpProps({ scale: { stepMin: 1440, win: { from: 0 } } }, { depth: 2 })
    const paths = rows.map((r) => r.path)
    expect(paths).toContain('scale.stepMin')
    expect(paths).toContain('scale.win.from')
    // глубина 1 — внуков уже не показываем
    const shallow = dumpProps({ scale: { win: { from: 0 } } }, { depth: 1 })
    expect(shallow.map((r) => r.path)).not.toContain('scale.win.from')
  })

  it('массив режется по maxItems, а хвост считается', () => {
    const rows = dumpProps({ spans: [1, 2, 3, 4, 5] }, { depth: 1, maxItems: 2 })
    const keys = rows.map((r) => r.key)
    expect(keys).toEqual(['spans', '[0]', '[1]', '…ещё 3'])
  })

  it('skip не разворачивает названный ключ, но саму строку оставляет', () => {
    const rows = dumpProps({ rows: [1, 2], spans: [3] }, { depth: 1, skip: ['rows'] })
    const keys = rows.map((r) => r.key)
    expect(keys).toContain('rows')
    expect(keys.filter((k) => k === '[0]')).toHaveLength(1) // развернулся только spans
  })

  it('цикл не роняет разбор', () => {
    const a: Record<string, unknown> = { name: 'a' }
    a.self = a
    expect(() => dumpProps(a, { depth: 5 })).not.toThrow()
  })

  it('геттер, который бросает, попадает в строку, а не наружу', () => {
    const source = {}
    Object.defineProperty(source, 'boom', {
      enumerable: true,
      get() {
        throw new Error('вне провайдера')
      },
    })
    const rows = dumpProps(source)
    expect(rows[0].value).toContain('вне провайдера')
  })

  it('функции и undefined остаются в дампе — ради этого он и нужен', () => {
    const props = { onOpen: () => {}, missing: undefined, title: 'номер' }
    const rows = dumpProps(props)
    const keys = rows.map((r) => r.key)
    expect(keys).toContain('onOpen')
    expect(keys).toContain('missing')
    // а JSON.stringify обе строки выбрасывает молча — вот с чем сравниваем
    expect(JSON.stringify(props)).toBe('{"title":"номер"}')
  })
})

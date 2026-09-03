import { describe, it, expect } from 'vitest'
import { locator, markLocations } from '../src/vite'

const plugin = (options = {}) => {
  const made = locator(options) as any
  made.configResolved({ root: '/project' })
  return made
}

describe('markLocations — атрибут с местом в исходнике', () => {
  it('ставит атрибут элементу разметки', () => {
    const out = markLocations('const a = <div class="x" />', 'src/a.tsx')
    expect(out).toBe('const a = <div data-loc="src/a.tsx:1:11" class="x" />')
  })

  it('не трогает компоненты — в DOM их нет', () => {
    const out = markLocations('const a = <DumbTable rows={r} />', 'src/a.tsx')
    expect(out).not.toContain('data-loc')
  })

  it('считает строку и колонку от начала тега', () => {
    const out = markLocations('const a = (\n  <p>\n    <b>x</b>\n  </p>\n)', 'src/a.tsx')
    expect(out).toContain('data-loc="src/a.tsx:2:3"')
    expect(out).toContain('data-loc="src/a.tsx:3:5"')
  })

  it('НЕ СДВИГАЕТ СТРОКИ: вставка идёт в ту же строку, что и тег', () => {
    const code = 'const a = (\n  <p>\n    <b>x</b>\n  </p>\n)'
    expect(markLocations(code, 'src/a.tsx').split('\n')).toHaveLength(code.split('\n').length)
  })

  it('размечает вложенные элементы по одному разу', () => {
    const out = markLocations('const a = <ul><li>1</li><li>2</li></ul>', 'src/a.tsx')
    expect(out.split('data-loc=')).toHaveLength(4)
  })

  it('переваривает типы и обобщения TSX', () => {
    const out = markLocations(
      'const a = (p: { x: number }) => <span>{p.x as unknown as string}</span>',
      'src/a.tsx',
    )
    expect(out).toContain('<span data-loc="src/a.tsx:1:33">')
  })

  it('берёт имя атрибута из настроек', () => {
    expect(markLocations('const a = <i />', 'src/a.tsx', 'data-src')).toContain('data-src=')
  })
})

describe('плагин', () => {
  it('размечает свои .tsx и молчит про чужие', () => {
    const made = plugin()
    expect(made.transform('const a = <i />', '/project/src/a.tsx')).toContain('src/a.tsx:1:11')
    expect(made.transform('const a = <i />', '/project/node_modules/x/a.tsx')).toBeNull()
    expect(made.transform('const a = <i />', '/project/src/a.test.tsx')).toBeNull()
    expect(made.transform('const a = 1', '/project/src/a.ts')).toBeNull()
  })

  it('вставляет браузерную половину в названную точку входа', () => {
    const made = plugin({ entry: 'src/App.tsx' })
    const out = made.transform('const a = <i />', '/project/src/App.tsx')
    expect(out.split('\n')[0]).toContain("from '@solid-dumb-kit/locator'")
    expect(made.transform('const a = <i />', '/project/src/other.tsx')).not.toContain('__locator')
  })

  it('в серверный граф половину не вставляет — там нет ни документа, ни мыши', () => {
    const made = plugin({ entry: 'src/App.tsx' })
    expect(made.transform('const a = <i />', '/project/src/App.tsx', { ssr: true })).not.toContain(
      '__locator',
    )
  })

  it('без точки входа в чужой код не лезет', () => {
    expect(plugin().transform('const a = <i />', '/project/src/App.tsx')).not.toContain('__locator')
  })
})

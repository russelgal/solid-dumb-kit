import { describe, expect, it } from 'vitest'
import { createRowIndex, type RowIndexResult } from '../src/rowIndex'

const values = (n: number) => {
  const v = new Float64Array(n)
  for (let i = 0; i < n; i++) v[i] = (i * 37) % 997
  return v
}

function once(n: number, query: Parameters<ReturnType<typeof createRowIndex>['query']>[0]) {
  return new Promise<RowIndexResult>((resolve) => {
    const v = values(n)
    const idx = createRowIndex({
      inline: true,
      chunk: 64,
      onResult: (r) => {
        if (!r.partial) resolve({ ...r, order: r.order.slice() })
      },
    })
    idx.setData({ count: n, columns: { value: { kind: 'number', values: v } } })
    idx.query(query)
  })
}

describe('rowIndex', () => {
  it('сортирует по возрастанию, как эталон', async () => {
    const n = 5000
    const v = values(n)
    const r = await once(n, { sort: { column: 'value', dir: 'asc' } })
    const want = Array.from({ length: n }, (_, i) => i).sort((a, b) => v[a] - v[b] || a - b)
    expect(Array.from(r.order)).toEqual(want)
  })

  it('сортирует по убыванию', async () => {
    const n = 3000
    const v = values(n)
    const r = await once(n, { sort: { column: 'value', dir: 'desc' } })
    const want = Array.from({ length: n }, (_, i) => i).sort((a, b) => v[b] - v[a] || a - b)
    expect(Array.from(r.order)).toEqual(want)
  })

  it('фильтрует по подстроке записи числа', async () => {
    const n = 2000
    const v = values(n)
    const r = await once(n, { filter: { column: 'value', contains: '7' } })
    const want = Array.from({ length: n }, (_, i) => i).filter((i) => String(v[i]).includes('7'))
    expect(Array.from(r.order)).toEqual(want)
    expect(r.matched).toBe(want.length)
  })

  it('фильтр и сортировка вместе', async () => {
    const n = 4000
    const v = values(n)
    const r = await once(n, {
      filter: { column: 'value', min: 100, max: 300 },
      sort: { column: 'value', dir: 'asc' },
    })
    const want = Array.from({ length: n }, (_, i) => i)
      .filter((i) => v[i] >= 100 && v[i] <= 300)
      .sort((a, b) => v[a] - v[b] || a - b)
    expect(Array.from(r.order)).toEqual(want)
  })

  it('отменяет устаревший запрос: ответ приходит один и на последний', async () => {
    const n = 20000
    const v = values(n)
    const seen: RowIndexResult[] = []
    await new Promise<void>((resolve) => {
      const idx = createRowIndex({
        inline: true,
        chunk: 32,
        onResult: (r) => {
          if (r.partial) return
          seen.push({ ...r, order: r.order.slice() })
          resolve()
        },
      })
      idx.setData({ count: n, columns: { value: { kind: 'number', values: v } } })
      idx.query({ sort: { column: 'value', dir: 'asc' } })
      idx.query({ filter: { column: 'value', contains: '13' } })
    })
    await new Promise((r) => setTimeout(r, 50))
    expect(seen.length).toBe(1)
    expect(seen[0].query.filter?.contains).toBe('13')
  })

  it('пустой запрос отдаёт исходный порядок', async () => {
    const r = await once(500, {})
    expect(Array.from(r.order)).toEqual(Array.from({ length: 500 }, (_, i) => i))
  })
})

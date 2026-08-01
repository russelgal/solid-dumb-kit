// Арифметика доски: живой жест тестами не проверить, а вот «как лягут секции
// разной ширины» проверяется без DOM вообще.
//
// Блоки ВНУТРИ секции считает `packFlow` из сетки — он и покрыт тестами там,
// вместе с ужиманием по `minW`.

import { describe, it, expect } from 'vitest'
import { moveAt, panelFlow } from '../src/boardMath'

describe('panelFlow — поток секций разной ширины', () => {
  const opts = { cols: 12, colW: 100, gap: 10, origin: { left: 0, top: 0 } }

  it('две половины встают в одну строку', () => {
    const out = panelFlow([
      { id: 'a', span: 6, height: 300 },
      { id: 'b', span: 6, height: 200 },
    ], opts)
    expect(out.a).toEqual({ left: 0, top: 0 })
    expect(out.b).toEqual({ left: 660, top: 0 })   // 6 колонок по (100 + 10)
  })

  it('не влезающая секция переносится на следующую строку', () => {
    const out = panelFlow([
      { id: 'a', span: 8, height: 300 },
      { id: 'b', span: 6, height: 200 },
    ], opts)
    expect(out.b.top).toBe(310)                     // высота первой строки + зазор
    expect(out.b.left).toBe(0)
  })

  it('высота строки — максимум высот тех, кто в ней стоит', () => {
    const out = panelFlow([
      { id: 'a', span: 6, height: 100 },
      { id: 'b', span: 6, height: 500 },
      { id: 'c', span: 12, height: 100 },
    ], opts)
    expect(out.c.top).toBe(510)                     // 500, а не 100
  })

  it('перестановка меняет позиции — ради этого поток и считается, а не снимается', () => {
    const boxes = [
      { id: 'a', span: 6, height: 100 },
      { id: 'b', span: 12, height: 100 },
    ]
    const before = panelFlow(boxes, opts)
    const after = panelFlow([boxes[1], boxes[0]], opts)
    // «во всю ширину» ушла наверх, «половина» — под неё
    expect(before.a.top).toBe(0)
    expect(after.a.top).toBe(110)
    expect(after.b.top).toBe(0)
  })

  it('секция шире доски зажимается, а не ломает раскладку', () => {
    const out = panelFlow([{ id: 'a', span: 99, height: 10 }, { id: 'b', span: 1, height: 10 }], opts)
    expect(out.b.top).toBe(20)                      // перенеслась, а не легла рядом
  })

  it('считает от угла обёртки, а не от нуля экрана', () => {
    const out = panelFlow([{ id: 'a', span: 6, height: 10 }], { ...opts, origin: { left: 40, top: 70 } })
    expect(out.a).toEqual({ left: 40, top: 70 })
  })
})

describe('moveAt — перестановка', () => {
  const list = ['a', 'b', 'c', 'd']

  it('двигает вперёд', () => expect(moveAt(list, 0, 2)).toEqual(['b', 'c', 'a', 'd']))
  it('двигает назад', () => expect(moveAt(list, 3, 1)).toEqual(['a', 'd', 'b', 'c']))

  it('на своё же место не трогает массив вовсе', () => {
    expect(moveAt(list, 1, 1)).toBe(list)   // тот же объект, не копия
  })

  it('не мутирует исходный — источник истины у потребителя', () => {
    const copy = list.slice()
    moveAt(list, 0, 3)
    expect(list).toEqual(copy)
  })

  it('индекс за пределами зажимается', () => {
    expect(moveAt(list, 0, 99)).toEqual(['b', 'c', 'd', 'a'])
  })
})

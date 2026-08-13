/*
  Фазы двухфазного эффекта Solid 2 — не деталь стиля, а то, обо что кит уже
  трижды разбивался: шим `effect(fn)` клал тело в фазу вычисления, а она идёт
  ДО монтирования и запрещает запись в сигналы. Отсюда белый экран у DumbModal
  («Cannot read properties of undefined») и не обновлявшийся DumbTree.

  Тесты закрепляют ровно то, ради чего шим выкинули: у `watch` и `onMounted`
  работа идёт во ВТОРОЙ фазе — DOM уже есть, писать в сигналы можно.

  Сами сигналы ставятся ИЗВНЕ владельца (сеттер вынесен из `createRoot`):
  запись внутри компонента или вычисления Solid 2 запрещает
  (REACTIVE_WRITE_IN_OWNED_SCOPE), и тест падал бы на собственной строчке, а не
  на проверяемом коде.
*/
import { describe, it, expect } from 'vitest'
import { createRoot, createSignal, flush, type Setter } from 'solid-js'
import { render } from '@solidjs/web'
import { onMounted, watch } from '../src/effects'

/** дать Solid применить накопленные обновления */
const settle = () => flush()

describe('onMounted — работа после монтирования', () => {
  it('видит ref: в фазе вычисления его ещё нет', () => {
    const host = document.createElement('div')
    document.body.append(host)
    let seen: HTMLElement | undefined

    const dispose = render(() => {
      let box!: HTMLDivElement
      onMounted(() => { seen = box })
      return <div ref={box}>панель</div>
    }, host)
    settle()

    expect(seen).toBeInstanceOf(HTMLElement)
    expect(seen?.textContent).toBe('панель')
    dispose()
    host.remove()
  })

  it('запись в сигнал разрешена — это вторая фаза', () => {
    let read!: () => number
    const dispose = createRoot((d) => {
      const [n, setN] = createSignal(0)
      read = n
      onMounted(() => setN(42))
      return d
    })
    settle()
    expect(read()).toBe(42)
    dispose()
  })

  it('зовётся один раз, дальше не повторяется', () => {
    let runs = 0
    let bump!: Setter<number>
    const dispose = createRoot((d) => {
      const [, setTick] = createSignal(0)
      bump = setTick
      onMounted(() => { runs += 1 })
      return d
    })
    settle()
    bump(1)
    settle()
    expect(runs).toBe(1)
    dispose()
  })
})

describe('watch — следим первой функцией, работаем второй', () => {
  it('первый прогон идёт сразу, дальше — на смену значения', () => {
    const seen: Array<number> = []
    let set!: Setter<number>
    const dispose = createRoot((d) => {
      const [n, setN] = createSignal(1)
      set = setN
      watch(n, (v) => seen.push(v))
      return d
    })
    settle()
    set(2)
    settle()
    set(2)                                     // то же значение — прогона нет
    settle()
    expect(seen).toEqual([1, 2])
    dispose()
  })

  it('defer пропускает первый прогон', () => {
    const seen: Array<number> = []
    let set!: Setter<number>
    const dispose = createRoot((d) => {
      const [n, setN] = createSignal(1)
      set = setN
      watch(n, (v) => seen.push(v), { defer: true })
      return d
    })
    settle()
    set(2)
    settle()
    expect(seen).toEqual([2])
    dispose()
  })

  it('отдаёт предыдущее значение', () => {
    const pairs: Array<[number, number | undefined]> = []
    let set!: Setter<number>
    const dispose = createRoot((d) => {
      const [n, setN] = createSignal(1)
      set = setN
      watch(n, (v, prev) => pairs.push([v, prev]))
      return d
    })
    settle()
    set(5)
    settle()
    expect(pairs).toEqual([[1, undefined], [5, 1]])
    dispose()
  })

  it('тело не трекается: чтение сигнала внутри не подписывает', () => {
    let runs = 0
    let setDep!: Setter<number>
    let setOther!: Setter<number>
    const dispose = createRoot((d) => {
      const [dep, sd] = createSignal(0)
      const [other, so] = createSignal(0)
      setDep = sd
      setOther = so
      watch(dep, () => { runs += 1; other() })
      return d
    })
    settle()
    setOther(10)                               // чужой сигнал — прогона быть не должно
    settle()
    expect(runs).toBe(1)
    setDep(1)
    settle()
    expect(runs).toBe(2)
    dispose()
  })

  it('в теле можно писать в сигналы — вторая фаза это разрешает', () => {
    let read!: () => number
    let set!: Setter<number>
    const dispose = createRoot((d) => {
      const [from, setFrom] = createSignal(1)
      const [to, setTo] = createSignal(0)
      read = to
      set = setFrom
      watch(from, (v) => setTo(v * 2))
      return d
    })
    settle()
    set(4)
    settle()
    expect(read()).toBe(8)
    dispose()
  })
})

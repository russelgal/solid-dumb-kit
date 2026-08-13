/*
  Регрессия на утечку, найденную зондом по витрине: в Solid 2 колбэк-ref
  вызывается без owner'а, и onCleanup внутри него не срабатывает никогда
  (NO_OWNER_CLEANUP). Ref-обёртки solid.ts вешали отписки движков ровно так —
  при размонтировании не отписывалось ничего.
*/
import { describe, it, expect } from 'vitest'
import { flush, onCleanup } from 'solid-js'
import { render } from '@solidjs/web'
import { ownedRef } from '../src/ownedRef'

const mount = (ui: () => unknown) => {
  const host = document.createElement('div')
  document.body.append(host)
  const dispose = render(ui as () => Element, host)
  flush()
  return () => { dispose(); flush(); host.remove() }
}

describe('ownedRef — onCleanup внутри колбэк-ref', () => {
  it('голый колбэк-ref владельца не имеет — отписка теряется (фиксируем платформу)', () => {
    let cleaned = false
    const un = mount(() => <div ref={(_el: HTMLElement) => { onCleanup(() => { cleaned = true }) }} />)
    un()
    // если однажды Solid начнёт давать owner сам — helper станет не нужен,
    // и этот тест скажет об этом первым
    expect(cleaned).toBe(false)
  })

  it('через ownedRef отписка приходит при размонтировании', () => {
    let cleaned = false
    const un = mount(() => {
      const hold = ownedRef((_el: HTMLElement) => { onCleanup(() => { cleaned = true }) })
      return <div ref={hold} />
    })
    expect(cleaned).toBe(false)
    un()
    expect(cleaned).toBe(true)
  })

  it('owner берётся в точке создания: колбэк строки умирает вместе со строкой', () => {
    // имитация bind(id): фабрика зовётся в скоупе строки
    let cleanups = 0
    const un = mount(() => {
      const bind = () => ownedRef((_el: HTMLElement) => { onCleanup(() => { cleanups += 1 }) })
      return <ul><li ref={bind()} /><li ref={bind()} /></ul>
    })
    un()
    expect(cleanups).toBe(2)
  })
})

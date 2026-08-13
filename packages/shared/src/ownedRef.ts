// Колбэк-ref с владельцем.
//
// В Solid 2 колбэк-ref (`ref={fn}`) вызывается БЕЗ owner'а: `onCleanup` внутри
// него молча никогда не сработает (NO_OWNER_CLEANUP), а `createEffect` не
// привяжется к жизни компонента (NO_OWNER_EFFECT). На этом весь кит тихо тёк:
// ref-обёртки `solid.ts` вешали отписки движков через onCleanup — и при
// размонтировании не отписывалось НИЧЕГО.
//
// `ownedRef(fn)` снимает owner в момент СОЗДАНИЯ колбэка — то есть там, где его
// объявили: у `bind(id)` это скоуп строки списка (отписка придёт при удалении
// строки), у колбэка в теле компонента — сам компонент. Вызов пробрасывается
// через `runWithOwner`, и onCleanup/createEffect внутри работают как положено.

import { getOwner, runWithOwner } from 'solid-js'

export function ownedRef<T>(fn: (el: T) => void): (el: T) => void {
  const owner = getOwner()
  return (el) => runWithOwner(owner, () => fn(el))
}

// happy-dom 20 отдаёт globalThis.localStorage без методов getItem/setItem,
// на чём падает makePersisted (ResizableGrid, DumbTree). Подкладываем
// минимальную in-memory реализацию — только для тестов.
if (typeof (globalThis as any).localStorage?.getItem !== 'function') {
  const store = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: unknown) => { store.set(k, String(v)) },
      removeItem: (k: string) => { store.delete(k) },
      clear: () => store.clear(),
      key: (i: number) => [...store.keys()][i] ?? null,
      get length() { return store.size },
    },
  })
}

/*
  Solid 2 копит обновления и флашит их МИКРОТАСКОМ — детерминированный
  батчинг, ради которого вторая линия и затевалась. Для приложения это
  незаметно (всё успевает до кадра), а вот тест, который читает DOM сразу
  после клика, видит пустоту.

  Чтобы не расставлять `await` по трём сотням мест, флашим сами: после каждого
  события и каждого клика зовём `flush()`. Так тесты остаются синхронными и
  одинаково работают на обеих линиях — на Solid 1 функции просто нет.
*/
const solidRuntime = await import('solid-js')
const flush = (solidRuntime as { flush?: () => void }).flush

if (flush) {
  const dispatch = EventTarget.prototype.dispatchEvent
  EventTarget.prototype.dispatchEvent = function (ev: Event) {
    const out = dispatch.call(this, ev)
    flush()
    return out
  }

  const click = HTMLElement.prototype.click
  HTMLElement.prototype.click = function () {
    click.call(this)
    flush()
  }
}

/** явное ожидание для мест, где обновление приходит не из события */
Object.defineProperty(globalThis, 'settle', {
  configurable: true,
  value: async () => {
    flush?.()
    await Promise.resolve()
  },
})

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

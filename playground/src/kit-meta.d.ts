// Виртуальный модуль от плагина `kitMeta` (playground/kitMeta.ts): версия и
// дата последней правки каждого пакета, посчитанные на сборке.
declare module 'virtual:kit-meta' {
  const meta: Record<string, { version: string; updated: string | null }>
  export default meta
}

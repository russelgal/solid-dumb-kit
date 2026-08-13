// Сигнал, переживающий перезагрузку.
//
// Заменил `makePersisted` из `@solid-primitives/storage`: в версии под Solid 2
// (5.0.0-next.3) он молча НЕ восстанавливает сохранённое — сигнал остаётся с
// начальным значением и с явным `storage`, и без него. Проверено зондом,
// поэтому и написано своё: тут пятнадцать строк и никакой зависимости.
//
// Читается СИНХРОННО при создании — раскладка не должна прыгать через кадр
// после загрузки. Пишется при каждом изменении, через `watch`: в Solid 2
// запись живёт во второй фазе эффекта, где ей и место.

import { createSignal, type Accessor, type Setter } from 'solid-js'
import { watch } from './effects'

export type PersistedOptions<T> = {
  /** во что превращать значение; по умолчанию JSON */
  stringify?: (value: T) => string
  /** как читать сохранённое; вернул undefined — берём начальное */
  parse?: (raw: string) => T | undefined
  /** куда складывать; по умолчанию localStorage, а без него — никуда */
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
}

export function createPersisted<T>(
  key: string,
  initial: T,
  opts: PersistedOptions<T> = {},
): [Accessor<T>, Setter<T>] {
  const store = opts.storage ?? safeStorage()
  const stringify = opts.stringify ?? ((v: T) => JSON.stringify(v))
  const parse = opts.parse ?? ((raw: string) => JSON.parse(raw) as T)

  let start = initial
  const raw = store?.getItem(key)
  if (raw != null) {
    try {
      const parsed = parse(raw)
      if (parsed !== undefined) start = parsed
    } catch {
      /* мусор в хранилище — молча берём начальное: падать тут не за что */
    }
  }

  // Каст нужен из-за перегрузок Solid 2: там `createSignal(value)` объявлен
  // как `Exclude<T, Function>`, чтобы отличать значение от вычисляющей
  // функции. Наш `T` — дженерик, компилятор его в это условие не укладывает,
  // хотя хранить функцию в персисте никто и не собирался.
  const [value, setValue] = createSignal(start as Exclude<T, Function>) as unknown as [
    Accessor<T>,
    Setter<T>,
  ]

  watch(value, (v) => {
    try {
      store?.setItem(key, stringify(v))
    } catch {
      /* приватный режим или переполнение — персист это удобство, не данные */
    }
  }, { defer: true })

  return [value, setValue as Setter<T>]
}

/** localStorage бывает недоступен: SSR, приватный режим, выключённые куки */
function safeStorage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}

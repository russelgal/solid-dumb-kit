// Всплывающие сообщения.
//
// Очередь живёт в модуле, а не в компоненте: звать `toast.error(...)` надо из
// любого места — из адаптера хранилища, из обработчика ошибки, из кода, который
// про разметку не знает вовсе. Компонент только рисует то, что в очереди.
//
// Три вещи, из-за которых это не десять строк:
//
// 1. ОДИНАКОВЫЕ СООБЩЕНИЯ СХЛОПЫВАЮТСЯ. Двадцать файлов не залились — это одно
//    сообщение со счётчиком, а не двадцать плашек до потолка.
// 2. ТАЙМЕР ЖИВЁТ СНАРУЖИ. Наведение мышью его останавливает: читать текст,
//    который уезжает из-под курсора, невозможно.
// 3. ДЕЙСТВИЕ. «Отменить» рядом с сообщением — то, ради чего тосты и заводят;
//    нажали — сообщение уходит само.
//
// Ни DOM, ни фреймворка.

export type ToastKind = 'info' | 'success' | 'error'

/** кнопка в плашке */
export type ToastAction = {
  label: string
  run?: () => void
  /** выделить: главное действие или опасное */
  kind?: 'primary' | 'danger'
  /** не закрывать плашку после нажатия; по умолчанию закрывает */
  keepOpen?: boolean
}

/**
 * Где показать плашку. `pointer` — там, где сейчас указатель: вопрос про
 * конкретную строку удобнее читать рядом с ней, а не в углу экрана, куда ещё
 * надо перевести взгляд.
 */
export type ToastAt = { x: number; y: number } | 'pointer'

export type Toast = {
  id: number
  kind: ToastKind
  text: string
  /** сколько раз это же сообщение повторилось */
  count: number
  /** кнопки рядом с текстом */
  actions?: Array<ToastAction>
  /** у курсора или в своей точке; не задано — в общей стопке */
  at?: ToastAt
  /** сколько держать, мс; 0 — до закрытия руками */
  ttl: number
  /**
   * Показывать ли крестик. У ВОПРОСА его нет: закрыть плашку, не ответив, —
   * это неявный ответ, а какой именно, никто не знает. Отвечают кнопками.
   */
  closable: boolean
}

export type ToastOptions = {
  ttl?: number
  at?: ToastAt
  /** одна кнопка — частый случай, поэтому и короткая запись, и общая */
  action?: ToastAction
  actions?: Array<ToastAction>
  closable?: boolean
}

export type ToastBus = {
  list: () => Array<Toast>
  info: (text: string, opts?: ToastOptions) => number
  success: (text: string, opts?: ToastOptions) => number
  error: (text: string, opts?: ToastOptions) => number
  /**
   * Плашка-ВОПРОС: не гаснет сама, крестика нет, закрывается только ответом.
   * Неблокирующая замена `confirm()`: тот останавливает вкладку целиком —
   * вместе с идущей заливкой, — и написать в нём, что именно случится, нельзя.
   */
  ask: (text: string, actions: Array<ToastAction>, opts?: ToastOptions) => number
  /** самый ходовой вопрос: да или нет. `true` — нажали подтверждение */
  confirm: (
    text: string,
    opts?: { yes?: string; no?: string; danger?: boolean; at?: ToastAt },
  ) => Promise<boolean>
  dismiss: (id: number) => void
  clear: () => void
  /** остановить и возобновить таймеры: под курсором сообщение не уезжает */
  pause: () => void
  resume: () => void
  subscribe: (fn: () => void) => () => void
}

export function createToastBus(defaults: { ttl?: number } = {}): ToastBus {
  const DEFAULT_TTL = defaults.ttl ?? 5000
  let items: Array<Toast> = []
  let seq = 0
  let paused = false
  const timers = new Map<number, ReturnType<typeof setTimeout>>()
  const rest = new Map<number, number>()      // сколько осталось у поставленного на паузу
  const started = new Map<number, number>()
  const subs = new Set<() => void>()

  const emit = () => subs.forEach((f) => f())

  function arm(t: Toast) {
    if (!t.ttl || paused) return
    started.set(t.id, Date.now())
    timers.set(
      t.id,
      setTimeout(() => bus.dismiss(t.id), rest.get(t.id) ?? t.ttl),
    )
  }

  function disarm(id: number) {
    const timer = timers.get(id)
    if (timer) clearTimeout(timer)
    timers.delete(id)
  }

  function push(kind: ToastKind, text: string, opts?: ToastOptions): number {
    const actions = opts?.actions ?? (opts?.action ? [opts.action] : undefined)
    // то же самое сообщение — не новая плашка, а счётчик у старой. Плашки с
    // кнопками не схлопываем: у каждой свой обработчик, и «×3» на вопросе
    // означало бы, что два ответа потерялись
    const same = items.find((t) => t.kind === kind && t.text === text && !t.actions)
    if (same && !actions) {
      // ЗАМЕНЯЕМ объект, а не правим на месте: перебор в компоненте сравнивает
      // элементы по ссылке, и мутация счётчика просто не доедет до разметки
      const next = { ...same, count: same.count + 1 }
      items = items.map((t) => (t.id === same.id ? next : t))
      disarm(next.id)
      rest.delete(next.id)
      arm(next)
      emit()
      return next.id
    }

    const t: Toast = {
      id: ++seq,
      kind,
      text,
      count: 1,
      actions,
      // с кнопкой держим дольше: успеть прочитать и нажать
      at: opts?.at,
      ttl: opts?.ttl ?? (actions ? DEFAULT_TTL * 2 : DEFAULT_TTL),
      closable: opts?.closable ?? true,
    }
    items = [...items, t]
    arm(t)
    emit()
    return t.id
  }

  const bus: ToastBus = {
    list: () => items,
    info: (text, o) => push('info', text, o),
    success: (text, o) => push('success', text, o),
    // ошибку сама не прячем: её читают и на неё реагируют
    error: (text, o) => push('error', text, { ttl: 0, ...o }),

    ask: (text, actions, opts) =>
      // ttl 0 и без крестика: вопрос ждёт ответа столько, сколько нужно
      push('info', text, { ...opts, actions, ttl: 0, closable: false }),

    confirm(text, opts) {
      return new Promise<boolean>((done) => {
        bus.ask(
          text,
          [
            {
              label: opts?.yes ?? 'Да',
              kind: opts?.danger ? 'danger' : 'primary',
              run: () => done(true),
            },
            { label: opts?.no ?? 'Отмена', run: () => done(false) },
          ],
          { at: opts?.at },
        )
      })
    },

    dismiss(id) {
      disarm(id)
      rest.delete(id)
      started.delete(id)
      items = items.filter((t) => t.id !== id)
      emit()
    },

    clear() {
      for (const id of timers.keys()) disarm(id)
      items = []
      rest.clear()
      started.clear()
      emit()
    },

    pause() {
      if (paused) return
      paused = true
      const now = Date.now()
      for (const t of items) {
        if (!t.ttl) continue
        const left = (rest.get(t.id) ?? t.ttl) - (now - (started.get(t.id) ?? now))
        rest.set(t.id, Math.max(300, left))
        disarm(t.id)
      }
    },

    resume() {
      if (!paused) return
      paused = false
      for (const t of items) arm(t)
    },

    subscribe(fn) {
      subs.add(fn)
      return () => subs.delete(fn)
    },
  }

  return bus
}

/**
 * Общая шина на приложение. Отдельный экземпляр нужен редко (тесты, две
 * независимые области), поэтому по умолчанию — одна на всех.
 */
export const toast = createToastBus()

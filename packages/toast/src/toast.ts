// Всплывающие сообщения.
//
// Очередь живёт в модуле, а не в компоненте: звать `toast.error(...)` надо из
// любого места — из адаптера хранилища, из обработчика ошибки, из кода, который
// про разметку не знает вовсе. Компонент только рисует то, что в очереди.
//
// Четыре вещи, из-за которых это не десять строк:
//
// 1. СООБЩЕНИЕ НЕ ПРОПАДАЕТ НАСОВСЕМ. Погасшая плашка уезжает в историю — тот
//    же приём, что у центра уведомлений в macOS: пропустил всплывшее — открыл
//    список и прочитал. Поэтому у каждой плашки есть время (`time`), а у шины
//    история и счётчик непрочитанных.
// 2. ТАЙМЕР ЖИВЁТ СНАРУЖИ. Наведение мышью его останавливает: читать текст,
//    который уезжает из-под курсора, невозможно.
// 3. ДЕЙСТВИЕ. «Отменить» рядом с сообщением — то, ради чего тосты и заводят;
//    нажали — сообщение уходит само.
// 4. УХОД — НЕ МГНОВЕННЫЙ. Закрытая плашка на пару кадров остаётся в отдельном
//    списке `leaving`, чтобы компонент успел проводить её улётом в историю. В
//    `list()` её уже нет: очередь и анимация — разные вещи.
//
// Одинаковые сообщения НЕ схлопываются: пять неудачных файлов — пять строк в
// истории, каждую видно и каждую можно прочитать отдельно.
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
  /**
   * Жирная первая строка — как в системных уведомлениях: «что случилось» видно
   * раньше подробностей. Не задан — плашка в одну строку, как раньше.
   */
  title?: string
  /**
   * Класс значка (iconify и любой другой): своих иконок кит не несёт. Не задан
   * — рисуется знак по виду сообщения.
   */
  icon?: string
  /** когда появилось; по нему история пишет «5 мин назад» */
  time: number
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
  /**
   * Уезжает ли плашка в историю, когда погаснет. У вопроса — нет: на него уже
   * ответили, и в списке прочитанного ему делать нечего.
   */
  archive: boolean
  /**
   * Плашку закрыли — крестиком, кликом мимо, `clear()` или таймером. Зовётся и
   * после ответа кнопкой: у вопроса это удобно — обещание уже разрешено, и
   * второй вызов ничего не меняет, а вот отказ иначе было бы не поймать.
   */
  onDismiss?: () => void
}

export type ToastOptions = {
  /** жирная первая строка */
  title?: string
  /** класс значка; не задан — знак по виду сообщения */
  icon?: string
  ttl?: number
  at?: ToastAt
  /** одна кнопка — частый случай, поэтому и короткая запись, и общая */
  action?: ToastAction
  actions?: Array<ToastAction>
  closable?: boolean
  /** класть ли в историю; по умолчанию да */
  archive?: boolean
  /** плашку закрыли, не нажав кнопку действия */
  onDismiss?: () => void
}

export type ToastBus = {
  list: () => Array<Toast>
  /**
   * Плашки, которые уже ушли из очереди, но ещё летят в историю. Держатся
   * ровно `leaveMs`, дальше исчезают сами. Нужны только тому, кто рисует:
   * убрать элемент из DOM мгновенно — значит не показать сам полёт.
   */
  leaving: () => Array<Toast>
  /** прочитанное, свежее первым */
  history: () => Array<Toast>
  /** сколько прилетело с тех пор, как историю открывали в последний раз */
  unread: () => number
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
  /** убрать одну запись из истории */
  forget: (id: number) => void
  /** очистить историю целиком */
  clearHistory: () => void
  /** открыта ли панель истории — состояние общее, открыть её могут откуда угодно */
  historyOpen: () => boolean
  showHistory: () => void
  hideHistory: () => void
  toggleHistory: () => void
  /** остановить и возобновить таймеры: под курсором сообщение не уезжает */
  pause: () => void
  resume: () => void
  subscribe: (fn: () => void) => () => void
}

export function createToastBus(
  defaults: {
    ttl?: number
    /** сколько записей держать в истории; дальше вытесняются старые */
    historyLimit?: number
    /** сколько плашка летит в историю, мс; 0 — исчезает сразу */
    leaveMs?: number
  } = {},
): ToastBus {
  const DEFAULT_TTL = defaults.ttl ?? 5000
  const HISTORY_LIMIT = defaults.historyLimit ?? 50
  const LEAVE_MS = defaults.leaveMs ?? 260
  let items: Array<Toast> = []
  let gone: Array<Toast> = []
  let past: Array<Toast> = []
  let fresh = 0
  let open = false
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
    // Повторы НЕ схлопываются: пять неудачных файлов — пять сообщений. Счётчик
    // «×5» на одной плашке экономил место на экране, но в истории от него
    // оставалась одна строка вместо пяти, и понять, что именно не залилось,
    // было уже нельзя. Стопку на экране ограничивает `max` у тостера.
    const t: Toast = {
      id: ++seq,
      kind,
      text,
      title: opts?.title,
      icon: opts?.icon,
      time: Date.now(),
      actions,
      // с кнопкой держим дольше: успеть прочитать и нажать
      at: opts?.at,
      ttl: opts?.ttl ?? (actions ? DEFAULT_TTL * 2 : DEFAULT_TTL),
      closable: opts?.closable ?? true,
      archive: opts?.archive ?? true,
      onDismiss: opts?.onDismiss,
    }
    // У КУРСОРА ЖИВЁТ РОВНО ОДНА ПЛАШКА. Второй вопрос про другую строку рядом
    // с первым читается как один длинный, и непонятно, к чему относится ответ.
    // Прежняя закрывается — а вопрос через onDismiss получает отказ.
    if (t.at) for (const old of items.filter((x) => x.at)) bus.dismiss(old.id)
    items = [...items, t]
    arm(t)
    emit()
    return t.id
  }

  /**
   * Проводы плашки: в историю (если ей туда) и на пару кадров в `leaving` —
   * это время компонент рисует полёт. Дальше она исчезает совсем.
   */
  function retire(t: Toast) {
    if (t.archive) {
      past = [t, ...past].slice(0, HISTORY_LIMIT)
      // непрочитанное считаем только при закрытой панели: открытая история и
      // есть чтение
      if (!open) fresh++
    }
    if (!LEAVE_MS) return
    gone = [...gone, t]
    setTimeout(() => {
      gone = gone.filter((x) => x.id !== t.id)
      emit()
    }, LEAVE_MS)
  }

  const bus: ToastBus = {
    list: () => items,
    leaving: () => gone,
    history: () => past,
    unread: () => fresh,
    info: (text, o) => push('info', text, o),
    success: (text, o) => push('success', text, o),
    // ошибку сама не прячем: её читают и на неё реагируют
    error: (text, o) => push('error', text, { ttl: 0, ...o }),

    ask: (text, actions, opts) =>
      // ttl 0 и без крестика: вопрос ждёт ответа столько, сколько нужно.
      // В историю не идёт: ответ уже дан, читать его там нечего
      push('info', text, { ...opts, actions, ttl: 0, closable: false, archive: false }),

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
          // закрыли, не ответив (клик мимо, Esc, чужой вопрос вытеснил) — это
          // отказ. Без этого обещание не разрешилось бы никогда, и `await`
          // висел бы до перезагрузки страницы
          { at: opts?.at, onDismiss: () => done(false) },
        )
      })
    },

    dismiss(id) {
      disarm(id)
      rest.delete(id)
      started.delete(id)
      const t = items.find((x) => x.id === id)
      items = items.filter((x) => x.id !== id)
      if (t) {
        t.onDismiss?.()
        retire(t)
      }
      emit()
    },

    clear() {
      for (const id of timers.keys()) disarm(id)
      const outgoing = items
      items = []
      rest.clear()
      started.clear()
      for (const t of outgoing) {
        t.onDismiss?.()
        retire(t)
      }
      emit()
    },

    forget(id) {
      past = past.filter((t) => t.id !== id)
      emit()
    },

    clearHistory() {
      past = []
      fresh = 0
      emit()
    },

    historyOpen: () => open,

    showHistory() {
      if (open) return
      open = true
      fresh = 0                                // открыли — значит прочитали
      emit()
    },

    hideHistory() {
      if (!open) return
      open = false
      emit()
    },

    toggleHistory() {
      if (open) bus.hideHistory()
      else bus.showHistory()
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

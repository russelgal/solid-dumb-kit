// Вопрос, заданный ОКНОМ, а не плашкой.
//
// Разница с `toast.confirm` не в разметке, а в том, что происходит с работой.
// Плашка в углу — уведомление: прочитал и пошёл дальше, никто ничего не ждёт.
// Здесь работа встала: пока не ответили, дальше нельзя, и ответ относится к
// тому, что сейчас на экране. Значит и спрашивать надо поверх — модально.
//
// Отсюда правило, по которому выбирают:
//   удалить ЭТУ строку в списке, где ничего не открыто → toast.confirm;
//   закрыть окно с несохранённым, уйти со страницы, стереть данные → modal.confirm.
//
// Очередь, а не замена: два вопроса подряд — это два окна по очереди, второй
// дождётся ответа на первый. Перебивать вопрос вопросом нельзя, иначе первый
// молча исчезнет вместе со своим обещанием.
//
// Ни DOM, ни фреймворка — рисует это `DumbModalHost`.

/** кнопка окна: что написано и что вернётся в обещание */
export type ModalAction<T = unknown> = {
  label: string
  value: T
  /** выделить: главное действие или опасное */
  kind?: 'primary' | 'danger'
}

export type ModalAskOptions = {
  /** заголовок окна; не задан — окно без шапки */
  title?: string
  /** ширина, css */
  width?: string
  /**
   * Можно ли закрыть, не ответив (Esc, клик мимо, крестик). По умолчанию да, и
   * тогда обещание получает `dismiss`. Вопрос, у которого нет безопасного
   * умолчания, ставит `false` — и ответ придётся нажать.
   */
  dismissible?: boolean
}

export type ModalQuestion = {
  id: number
  title?: string
  text: string
  actions: Array<ModalAction>
  width?: string
  dismissible: boolean
  /** что вернуть, если закрыли не ответив */
  dismiss: unknown
  /** разрешить обещание — зовёт только шина */
  done: (value: unknown) => void
}

export type ModalBus = {
  /** вопрос, который сейчас на экране; null — окон нет */
  current: () => ModalQuestion | null
  /** сколько ещё ждёт своей очереди */
  pending: () => number
  /**
   * Вопрос с произвольными кнопками. Возвращает `value` нажатой; закрыли не
   * ответив — `dismiss` (по умолчанию `undefined`).
   */
  ask: <T>(
    text: string,
    actions: Array<ModalAction<T>>,
    opts?: ModalAskOptions & { dismiss?: T },
  ) => Promise<T | undefined>
  /** самый ходовой вопрос: да или нет. Закрыли не ответив — `false` */
  confirm: (
    text: string,
    opts?: ModalAskOptions & { yes?: string; no?: string; danger?: boolean },
  ) => Promise<boolean>
  /** сообщение с одной кнопкой: прочитали и закрыли */
  alert: (text: string, opts?: ModalAskOptions & { ok?: string }) => Promise<void>
  /** ответить за текущее окно — зовёт компонент */
  answer: (id: number, value: unknown) => void
  /** закрыть текущее окно ответом по умолчанию */
  dismiss: (id: number) => void
  subscribe: (fn: () => void) => () => void
}

export function createModalBus(): ModalBus {
  let queue: Array<ModalQuestion> = []
  let seq = 0
  const subs = new Set<() => void>()
  const emit = () => subs.forEach((f) => f())

  function push(q: Omit<ModalQuestion, 'id'>): number {
    const id = ++seq
    queue = [...queue, { ...q, id }]
    emit()
    return id
  }

  function finish(id: number, value: unknown) {
    const q = queue.find((x) => x.id === id)
    if (!q) return
    queue = queue.filter((x) => x.id !== id)
    q.done(value)
    emit()
  }

  const bus: ModalBus = {
    current: () => queue[0] ?? null,
    pending: () => Math.max(0, queue.length - 1),

    ask(text, actions, opts) {
      return new Promise((done) => {
        push({
          title: opts?.title,
          text,
          actions: actions as Array<ModalAction>,
          width: opts?.width,
          dismissible: opts?.dismissible ?? true,
          dismiss: opts?.dismiss,
          done: done as (v: unknown) => void,
        })
      })
    },

    confirm(text, opts) {
      // Отказ слева, действие справа — как в системных окнах: рука идёт к
      // правому нижнему углу за подтверждением, и промахнуться мимо «отмены»
      // там сложнее.
      return bus.ask<boolean>(
        text,
        [
          { label: opts?.no ?? 'Отмена', value: false },
          {
            label: opts?.yes ?? 'Да',
            value: true,
            kind: opts?.danger ? 'danger' : 'primary',
          },
        ],
        { ...opts, dismiss: false },
      ) as Promise<boolean>
    },

    alert(text, opts) {
      return bus
        .ask<void>(text, [{ label: opts?.ok ?? 'Понятно', value: undefined, kind: 'primary' }], opts)
        .then(() => undefined)
    },

    answer: (id, value) => finish(id, value),
    dismiss(id) {
      const q = queue.find((x) => x.id === id)
      if (q) finish(id, q.dismiss)
    },

    subscribe(fn) {
      subs.add(fn)
      return () => subs.delete(fn)
    },
  }

  return bus
}

/**
 * Общая шина на приложение: `modal.confirm(...)` зовётся откуда угодно, в том
 * числе из кода, который про разметку не знает. Отдельный экземпляр нужен редко
 * (тесты, две независимые области).
 */
export const modal = createModalBus()

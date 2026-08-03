// Отмена действия.
//
// Стек не хранит «состояние до» — он хранит ПАРУ функций: как сделать и как
// отменить. Копировать состояние целиком заманчиво, но в файловом менеджере
// это означало бы держать в памяти список на десять тысяч ключей ради того,
// чтобы отменить переименование одной папки.
//
// Отсюда честное следствие: **отменяется не всё**. Перенос откатывается
// обратным переносом, создание папки — её удалением, а удаление файла из
// хранилища — ничем. Такой шаг кладётся в стек с `undo: null`, и потребитель
// показывает это до, а не после.
//
// Без DOM и без фреймворка.

export type UndoStep = {
  /** что писать в кнопке и в подсказке: «перенос 3 шт.» */
  label: string
  /**
   * Как вернуть как было. `null` — вернуть нельзя: удаление без корзины,
   * перезапись файла. Такой шаг обрывает всю цепочку отмены за собой.
   */
  undo: (() => Promise<void>) | null
  /** как повторить после отмены; не задан — повтор недоступен */
  redo?: () => Promise<void>
}

export type UndoStack = {
  /** запомнить сделанное */
  push: (step: UndoStep) => void
  undo: () => Promise<void>
  redo: () => Promise<void>
  /** что отменится следующим; `null` — нечего или нельзя */
  peekUndo: () => UndoStep | null
  peekRedo: () => UndoStep | null
  canUndo: () => boolean
  canRedo: () => boolean
  clear: () => void
}

export type UndoOptions = {
  /** сколько шагов помнить; по умолчанию 50 */
  limit?: number
  /** стек изменился — перерисовать кнопки */
  onChange?: () => void
  /** отмена сорвалась */
  onError?: (err: unknown, step: UndoStep) => void
}

export function createUndoStack(opts: UndoOptions = {}): UndoStack {
  const limit = opts.limit ?? 50
  let done: Array<UndoStep> = []
  let undone: Array<UndoStep> = []
  let busy = false

  const changed = () => opts.onChange?.()

  return {
    push(step) {
      done.push(step)
      if (done.length > limit) done = done.slice(-limit)
      // новое действие обесценивает всё, что было отменено: возвращать уже
      // некуда, ветка истории разошлась
      undone = []
      changed()
    },

    async undo() {
      // дважды подряд по кнопке — обычное дело; второй заход не пускаем,
      // иначе один и тот же шаг откатится дважды
      if (busy) return
      const step = done[done.length - 1]
      if (!step?.undo) return
      busy = true
      try {
        await step.undo()
        done.pop()
        undone.push(step)
      } catch (err) {
        // не откатилось — шаг остаётся в стеке: соврать, что вернули, хуже
        opts.onError?.(err, step)
      } finally {
        busy = false
        changed()
      }
    },

    async redo() {
      if (busy) return
      const step = undone[undone.length - 1]
      if (!step?.redo) return
      busy = true
      try {
        await step.redo()
        undone.pop()
        done.push(step)
      } catch (err) {
        opts.onError?.(err, step)
      } finally {
        busy = false
        changed()
      }
    },

    peekUndo: () => {
      const step = done[done.length - 1]
      return step?.undo ? step : null
    },
    peekRedo: () => {
      const step = undone[undone.length - 1]
      return step?.redo ? step : null
    },
    canUndo: () => !!done[done.length - 1]?.undo && !busy,
    canRedo: () => !!undone[undone.length - 1]?.redo && !busy,
    clear: () => {
      done = []
      undone = []
      changed()
    },
  }
}

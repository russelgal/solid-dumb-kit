// Правка подписи на месте: двойной клик — поле, Enter — сохранить, Esc — забыть.
//
// Казалось бы, три строки состояния. Но каждая из трёх писалась в ките уже по
// второму разу и каждый раз с одной и той же забытой мелочью:
//
// - сохранять надо и по потере фокуса, а не только по Enter;
// - пустое имя и имя без изменений — это НЕ сохранение, а отмена;
// - пока сохранение идёт, поле не закрываем и второй Enter не принимаем,
//   иначе прилетают два запроса подряд;
// - сорвалось — поле остаётся открытым с введённым текстом, потому что
//   выбросить набранное из-за чужой ошибки хуже всего.
//
// Без DOM и без фреймворка: наружу отдаётся состояние и три метода.

export type InlineEdit = {
  /** что правим сейчас; `null` — ничего */
  editing: () => string | null
  /** текущее содержимое поля */
  value: () => string
  /** идёт сохранение */
  busy: () => boolean
  /** ошибка последнего сохранения */
  error: () => string | null

  start: (id: string, initial: string) => void
  input: (next: string) => void
  /** сохранить; вернёт `true`, если действительно сохраняли */
  commit: () => Promise<boolean>
  cancel: () => void
}

export type InlineEditOptions = {
  /** собственно сохранение */
  save: (id: string, value: string) => Promise<void>
  /** привести введённое к виду хранилища: обрезать пробелы, убрать слэши */
  clean?: (value: string) => string
  /** состояние изменилось — перерисовать */
  onChange?: () => void
}

export function createInlineEdit(opts: InlineEditOptions): InlineEdit {
  const clean = opts.clean ?? ((v: string) => v.trim())
  let id: string | null = null
  let initial = ''
  let value = ''
  let busy = false
  let error: string | null = null

  const changed = () => opts.onChange?.()

  return {
    editing: () => id,
    value: () => value,
    busy: () => busy,
    error: () => error,

    start(next, text) {
      if (busy) return
      id = next
      initial = text
      value = text
      error = null
      changed()
    },

    input(next) {
      value = next
      changed()
    },

    async commit() {
      if (!id || busy) return false
      const next = clean(value)
      // пусто или не изменилось — это отмена, а не сохранение: незачем гонять
      // сеть и незачем показывать «сохранено» там, где ничего не произошло
      if (!next || next === clean(initial)) {
        this.cancel()
        return false
      }
      busy = true
      error = null
      changed()
      try {
        await opts.save(id, next)
        id = null
        value = ''
        return true
      } catch (err) {
        // поле НЕ закрываем: набранное — единственная копия того, что человек
        // хотел, и терять его из-за ответа сервера нельзя
        error = err instanceof Error ? err.message : String(err)
        return false
      } finally {
        busy = false
        changed()
      }
    },

    cancel() {
      if (busy) return
      id = null
      value = ''
      error = null
      changed()
    },
  }
}

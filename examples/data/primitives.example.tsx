// Примитивы из `shared`, которые не видно глазами: отмена, клавиатура, правка
// на месте, бросок папки.
//
// У каждого из них своя ловушка, и все четыре ловятся прямо здесь:
//
// - отмена честно говорит, что удаление НЕ откатывается;
// - Shift-диапазон растягивается от якоря, и якорь не уползает за курсором;
// - ошибка сохранения не съедает набранное;
// - брошенная папка приезжает деревом, а не одним «файлом» нулевого размера.
import { For, Show, createSignal } from 'solid-js'
import {
  createInlineEdit,
  createUndoStack,
  isMoveKey,
  moveIndex,
  moveSelection,
  readDropEntries,
  type DroppedFile,
} from '@solid-dumb-kit/shared'
import { fmtSize } from '@solid-dumb-kit/utils'
import { Bar, Btn, Note } from '../_controls'

const START = ['Отчёт', 'Договор', 'Смета', 'Акт', 'Приказ', 'Заявка', 'Счёт', 'Накладная']

export default function PrimitivesExample() {
  /* ── отмена ─────────────────────────────────────────────────────────────── */
  const [rows, setRows] = createSignal(START)
  /**
   * Примитивы держат состояние в замыкании и о переменах сообщают колбэком —
   * они же не про Solid. Мост в реактивность — сигнал-«будильник»: колбэк его
   * дёргает, а геттеры ниже его читают, иначе `Show` не узнает, что состояние
   * изменилось.
   */
  const [tick, bump] = createSignal(0, { equals: false })
  const undoStack = createUndoStack({ onChange: () => bump(0) })
  const canUndo = () => (tick(), undoStack.canUndo())
  const canRedo = () => (tick(), undoStack.canRedo())
  const undoWhat = () => (tick(), undoStack.peekUndo()?.label ?? '')

  const rename = (i: number, next: string) => {
    const was = rows()[i]
    setRows((r) => r.map((x, k) => (k === i ? next : x)))
    undoStack.push({
      label: `имя «${was}»`,
      undo: async () => setRows((r) => r.map((x, k) => (k === i ? was : x))),
      redo: async () => setRows((r) => r.map((x, k) => (k === i ? next : x))),
    })
  }

  const drop = () => {
    const keys = [...picked()]
    if (!keys.length) return
    setRows((r) => r.filter((x) => !keys.includes(x)))
    setPicked(new Set())
    // ВАЖНО: без отмены. Так и надо помечать необратимое — кнопка «вернуть»
    // при этом гаснет, а не врёт
    undoStack.push({ label: `удаление ${keys.length} шт.`, undo: null })
  }

  /* ── клавиатура ─────────────────────────────────────────────────────────── */
  const [picked, setPicked] = createSignal<Set<string>>(new Set())
  const [cursor, setCursor] = createSignal(-1)
  const [anchor, setAnchor] = createSignal(-1)

  function onKey(ev: KeyboardEvent) {
    if (!isMoveKey(ev.key)) return
    const next = moveIndex(ev.key, { from: cursor(), count: rows().length, columns: 4 })
    if (next === null) return
    ev.preventDefault()
    const res = moveSelection({
      keys: rows(),
      anchor: anchor(),
      next,
      current: picked(),
      shift: ev.shiftKey,
      ctrl: ev.metaKey || ev.ctrlKey,
    })
    setCursor(next)
    setAnchor(res.anchor)
    setPicked(res.selected)
  }

  /* ── правка на месте ────────────────────────────────────────────────────── */
  const [failNext, setFailNext] = createSignal(false)
  const editingId = () => (tick(), edit.editing())
  const editValue = () => (tick(), edit.value())
  const editBusy = () => (tick(), edit.busy())
  const editError = () => (tick(), edit.error())
  const edit = createInlineEdit({
    onChange: () => bump(0),
    clean: (v) => v.trim().replace(/\//g, ''),
    save: async (id, value) => {
      await new Promise((ok) => setTimeout(ok, 400))
      if (failNext()) throw new Error('сервер отказал — набранное осталось на месте')
      rename(Number(id), value)
    },
  })

  /* ── бросок папки ───────────────────────────────────────────────────────── */
  const [dropped, setDropped] = createSignal<Array<DroppedFile>>([])
  const [over, setOver] = createSignal(false)

  return (
    <div class="p-5 text-base-content">
      <h3 class="mb-1 text-lg font-semibold">Примитивы: отмена, клавиатура, правка, бросок папки</h3>
      <p class="mb-3 max-w-[92ch] text-sm text-base-content">
        Это не компоненты, а функции из <code>@solid-dumb-kit/shared</code> — на них стоят
        файндер и галерея. Все четыре без DOM и без Solid, поэтому проверяются обычными тестами.
      </p>

      <Bar>
        <Btn onClick={() => void undoStack.undo()}>
          {canUndo() ? `Отменить: ${undoWhat()}` : 'Отменить нечего'}
        </Btn>
        <Btn onClick={() => void undoStack.redo()}>
          {canRedo() ? 'Вернуть' : 'Вернуть нечего'}
        </Btn>
        <Btn onClick={drop}>Удалить выделенное</Btn>
        <label class="label cursor-pointer gap-2 text-sm">
          <input
            type="checkbox"
            class="checkbox checkbox-sm"
            checked={failNext()}
            onChange={(e) => setFailNext(e.currentTarget.checked)}
          />
          ронять сохранение
        </label>
        <Note>
          {picked().size ? `выделено: ${picked().size}` : 'кликни и води стрелками'}
        </Note>
      </Bar>

      <p class="mb-2 max-w-[92ch] text-sm text-base-content">
        Стрелки водят курсор (сетка на 4 колонки), <b>Shift</b> растягивает диапазон от якоря,{' '}
        <b>Ctrl/Cmd</b> двигает курсор, не трогая выделение. Двойной клик — правка имени; удаление
        необратимо и кнопка отмены на нём гаснет.
      </p>

      <div
        class="grid max-w-[92ch] grid-cols-2 gap-2 rounded-box border border-base-300 p-2 sm:grid-cols-4"
        tabindex={0}
        onKeyDown={onKey}
      >
        <For each={rows()}>
          {(name, i) => (
            <div
              class={`rounded-box border p-3 text-sm ${
                picked().has(name) ? 'border-primary bg-primary/10' : 'border-base-300'
              } ${cursor() === i() ? 'ring-2 ring-primary/40' : ''}`}
              onClick={() => {
                setPicked(new Set([name]))
                setCursor(i())
                setAnchor(i())
              }}
              onDblClick={() => edit.start(String(i()), name)}
            >
              <Show when={editingId() === String(i())} fallback={<span>{name}</span>}>
                <input
                  class="input input-xs w-full"
                  autofocus
                  disabled={editBusy()}
                  value={editValue()}
                  onInput={(e) => edit.input(e.currentTarget.value)}
                  onBlur={() => void edit.commit()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void edit.commit()
                    if (e.key === 'Escape') edit.cancel()
                  }}
                />
                <Show when={editError()}>
                  <div class="mt-1 text-xs text-error">{editError()}</div>
                </Show>
              </Show>
            </div>
          )}
        </For>
      </div>

      <h4 class="mt-5 mb-1 text-sm font-semibold">Бросок папки</h4>
      <p class="mb-2 max-w-[92ch] text-sm text-base-content">
        <code>dataTransfer.files</code> плоский: брошенная папка в нём теряется. Дерево лежит в{' '}
        <code>webkitGetAsEntry()</code>, и забрать его надо <b>синхронно</b>, до первого{' '}
        <code>await</code> — иначе коллекция уже пуста.
      </p>
      <div
        class={`max-w-[92ch] rounded-box border-2 border-dashed p-6 text-center text-sm ${
          over() ? 'border-primary bg-primary/5' : 'border-base-300'
        }`}
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          void readDropEntries(e.dataTransfer).then(setDropped)
        }}
      >
        Брось сюда папку с файлами
      </div>

      <Show when={dropped().length}>
        <div class="mt-2 max-w-[92ch] text-sm">
          <b>{dropped().length}</b> файл(ов), путь сохранён:
          <ul class="mt-1 max-h-40 overflow-y-auto font-mono text-xs">
            <For each={dropped().slice(0, 50)}>
              {(d) => (
                <li>
                  {d.path} <span class="opacity-60">· {fmtSize(d.file.size)}</span>
                </li>
              )}
            </For>
          </ul>
        </div>
      </Show>
    </div>
  )
}

// Проба: нативный drag-and-drop с нуля. Ни библиотек, ни снимков координат, ни
// расчёта позиций — только события браузера.
//
// Весь алгоритм: `dragstart` запомнил, кого тащат; `dragover` пришёл на соседа —
// значит его место и занимаем, переставляя данные прямо сейчас; `dragend`
// прибрал за собой. Куда попал курсор, решает браузер: событие приходит ровно на
// тот элемент, над которым он находится. Считать нечего.
//
// Что важно знать, иначе не работает:
//
//   • `dragover` ОБЯЗАН звать `preventDefault()` — иначе элемент не считается
//     зоной приёма и `drop` не случится вовсе;
//   • `dataTransfer.setData()` нужен для Firefox: без него жест там не начнётся;
//   • прятать оригинал через `visibility`/`display` нельзя — он перестаёт быть
//     источником событий, и жест обрывается. Только прозрачность;
//   • картинку переноса браузер снимает СИНХРОННО в `dragstart`, поэтому менять
//     вид строки в этом же обработчике нельзя — снимется уже изменённый. Красим
//     на следующий тик.
//
// Чего тут нет и почему это заметно: анимаций. Порядок меняется мгновенно —
// карточки телепортируются. Ровно ради этого в ките есть FLIP: соседние вкладки
// (CSS order + FLIP, DumbSortableDnd) делают то же самое, но с движением.
import { createSignal, For } from 'solid-js'

type Card = { id: string; n: number }
const CARDS: Array<Card> = Array.from({ length: 12 }, (_, i) => ({ id: `c${i}`, n: i + 1 }))
const HUE = (n: number) => `oklch(0.75 0.12 ${(n * 41) % 360})`

export default function RawDndExample() {
  const [cards, setCards] = createSignal(CARDS)
  const [held, setHeld] = createSignal<string | null>(null)
  const [log, setLog] = createSignal('перетащи карточку')

  /** переставить: взять from и вставить на место to */
  const move = (from: number, to: number) => {
    const next = cards().slice()
    next.splice(to, 0, next.splice(from, 1)[0])
    setCards(next)
  }

  /** кого касается событие: слушатели висят на контейнере, а не на карточках */
  const idOf = (ev: Event) => {
    const el = (ev.target as HTMLElement | null)?.closest?.('[data-id]') as HTMLElement | null
    return el?.dataset.id ?? null
  }

  /**
   * Синхронный признак «жест идёт». Подсветку источника мы ставим отложенно —
   * иначе полупрозрачность попадёт в картинку переноса, — и если жест успевает
   * закончиться раньше этого тика, отложенный вызов включает её уже ПОСЛЕ
   * уборки. Элемент так и остаётся приглушённым. Флаг это отсекает.
   */
  let gesture: string | null = null

  const onDragStart = (ev: DragEvent) => {
    const id = idOf(ev)
    if (!id) return
    ev.dataTransfer?.setData('text/plain', id)     // без этого Firefox не начнёт
    if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'move'
    // красим не сейчас, а следующим тиком: иначе в картинку переноса попадёт
    // уже полупрозрачная карточка
    gesture = id
    setTimeout(() => { if (gesture === id) setHeld(id) })
    setLog(`тащим ${id}`)
  }

  const onDragOver = (ev: DragEvent) => {
    ev.preventDefault()                            // без этого drop не случится
    if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move'
    const id = idOf(ev)
    const dragId = held()
    if (!id || !dragId || dragId === id) return    // над собой — место уже наше

    const list = cards()
    const from = list.findIndex((c) => c.id === dragId)
    const to = list.findIndex((c) => c.id === id)
    if (from < 0 || to < 0 || from === to) return
    move(from, to)
    setLog(`${dragId}: место ${from} → ${to}`)
  }

  const onDragEnd = () => {
    gesture = null
    setHeld(null)
    setLog(`порядок: ${cards().slice(0, 6).map((c) => c.n).join(', ')}…`)
  }

  return (
    <div class="p-5 text-base-content">
      <h3 class="mb-1 text-lg font-semibold">Нативный DnD с нуля — три обработчика, ноль расчётов</h3>
      <p class="mb-2 max-w-[90ch] text-[13px] text-base-content">
        Ни библиотек, ни снимков координат. <code>dragstart</code> запомнил, кого тащат,{' '}
        <code>dragover</code> пришёл на соседа — значит его место и занимаем, <code>dragend</code>{' '}
        прибрал. Хиттест делает браузер: событие приходит ровно на тот элемент, над которым
        курсор. Дребезга нет даром — после перестановки под курсором оказывается сама
        перетаскиваемая карточка, а над собой мы ничего не пересчитываем.
      </p>
      <p class="mb-2 max-w-[90ch] text-[13px] text-warning">
        Анимаций здесь <b>нет</b> — карточки телепортируются. Ровно за этим в ките и появился
        FLIP: сравни с вкладками <b>CSS order + FLIP</b> и <b>DumbSortableDnd</b>.
      </p>
      <div class="mb-3 min-h-[18px] text-[13px] text-base-content">{log()}</div>

      {/* Четыре слушателя на всю сетку, а не по четыре на карточку: события
          drag-and-drop всплывают, и `ev.target.closest` скажет, кто под курсором. */}
      <div
        class="grid max-w-[620px] grid-cols-6 gap-2.5"
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDrop={(ev) => ev.preventDefault()}
      >
        <For each={cards()}>
          {(card) => (
            <div
              class="grid h-23 cursor-grab place-items-center rounded-xl border-t-5 bg-base-100 text-lg font-semibold text-base-content ring-1 ring-base-300 active:cursor-grabbing"
              // только прозрачность: спрятать оригинал совсем — оборвать жест
              classList={{ 'opacity-35': held() === card.id }}
              data-id={card.id}
              draggable="true"
              style={{ 'border-top-color': HUE(card.n) }}
            >
              {card.n}
            </div>
          )}
        </For>
      </div>

      <pre class="mt-3.5 max-w-[620px] rounded-box bg-base-200 px-3 py-2.5 text-xs/normal text-base-content ring-1 ring-base-300">{`// четыре слушателя на весь контейнер — события всплывают
onDragStart: запомнить id (ev.target.closest)
onDragOver:  ev.preventDefault(); переставить на место цели
onDragEnd:   забыть id`}</pre>

    </div>
  )
}

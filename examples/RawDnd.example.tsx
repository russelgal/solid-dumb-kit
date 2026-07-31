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
    <div class="raw-example">
      <h3>Нативный DnD с нуля — три обработчика, ноль расчётов</h3>
      <p class="note">
        Ни библиотек, ни снимков координат. <code>dragstart</code> запомнил, кого тащат,{' '}
        <code>dragover</code> пришёл на соседа — значит его место и занимаем, <code>dragend</code>{' '}
        прибрал. Хиттест делает браузер: событие приходит ровно на тот элемент, над которым
        курсор. Дребезга нет даром — после перестановки под курсором оказывается сама
        перетаскиваемая карточка, а над собой мы ничего не пересчитываем.
      </p>
      <p class="note warn">
        Анимаций здесь <b>нет</b> — карточки телепортируются. Ровно за этим в ките и появился
        FLIP: сравни с вкладками <b>CSS order + FLIP</b> и <b>DumbSortableDnd</b>.
      </p>
      <div class="bar">{log()}</div>

      {/* Четыре слушателя на всю сетку, а не по четыре на карточку: события
          drag-and-drop всплывают, и `ev.target.closest` скажет, кто под курсором. */}
      <div
        class="grid"
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDrop={(ev) => ev.preventDefault()}
      >
        <For each={cards()}>
          {(card) => (
            <div
              class="card"
              classList={{ held: held() === card.id }}
              data-id={card.id}
              draggable="true"
              style={{ '--hue': HUE(card.n) }}
            >
              {card.n}
            </div>
          )}
        </For>
      </div>

      <pre class="src">{`// четыре слушателя на весь контейнер — события всплывают
onDragStart: запомнить id (ev.target.closest)
onDragOver:  ev.preventDefault(); переставить на место цели
onDragEnd:   забыть id`}</pre>

      <style>{`
        .raw-example { padding: 16px 20px; color: #0f172a }
        .raw-example h3 { margin: 0 0 4px }
        .raw-example .note { margin: 0 0 8px; font-size: 13px; color: #64748b; max-width: 90ch }
        .raw-example .note.warn { color: #b45309 }
        .raw-example .bar { margin: 0 0 12px; font-size: 13px; color: #64748b; min-height: 18px }

        .raw-example .grid { display: grid; gap: 10px; max-width: 620px;
                             grid-template-columns: repeat(6, 1fr) }
        .raw-example .card { display: grid; place-items: center; height: 92px; border-radius: 12px;
                             cursor: grab; font-weight: 600; font-size: 18px; color: #1e293b;
                             background: #fff; box-shadow: inset 0 0 0 1px #e2e8f0;
                             border-top: 5px solid var(--hue) }
        .raw-example .card:active { cursor: grabbing }
        /* только прозрачность: спрятать оригинал совсем — оборвать жест */
        .raw-example .card.held { opacity: .35 }

        .raw-example .src { margin: 14px 0 0; padding: 10px 12px; max-width: 620px;
                            font-size: 12px; line-height: 1.5; color: #475569;
                            background: #f8fafc; border-radius: 10px;
                            box-shadow: inset 0 0 0 1px #e2e8f0 }
      `}</style>
    </div>
  )
}

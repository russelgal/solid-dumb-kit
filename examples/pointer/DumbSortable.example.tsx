// DumbSortable — drag-reorder at scale: a 100-row list (drag by handle, auto-scrolls)
// and a 100-tile grid (drag the whole tile). The kit needs no CSS of its own —
// every class here is this example's looks, nothing the kit asks for.
import { createSignal, For } from 'solid-js'
import { DumbSortable } from '@solid-dumb-kit/sortable'

type Row = { id: string; label: string }
const rows = (n: number): Row[] =>
  Array.from({ length: n }, (_, i) => ({ id: `r${i}`, label: `Track ${String(i + 1).padStart(3, '0')}` }))

// перемешивание Фишера–Йетса: копия, не мутируем исходный массив
function shuffle<T>(list: Array<T>): Array<T> {
  const out = list.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

// цвет — единственное, что остаётся инлайном: он вычисляется из данных
const HUE = (i: number) => `oklch(0.75 0.13 ${(i * 37) % 360})`
// текст на цветной плитке привязан к ЗАЛИВКЕ, а не к теме: заливка светлая
// всегда, поэтому и надпись всегда тёмная — иначе в тёмной теме она пропадала
const INK = (i: number) => `oklch(0.28 0.07 ${(i * 37) % 360})`

const PILLS = [
  '⚡ 60fps @ 100s of items',
  '🛰️ IntersectionObserver bounds',
  '🧵 off-main-thread · 0 reflow',
  '🎮 GPU transforms',
  '🪶 zero deps',
  '📜 list + 🔲 grid',
  '🟰 variable row heights',
  '✋ drag-handle',
  '📱 touch long-press',
  '🧲 edge auto-scroll',
]

function Promo() {
  return (
    <aside class="sticky top-16 w-65 shrink-0 rounded-2xl bg-linear-160 from-primary via-secondary via-55% to-secondary p-4.5 text-primary-content shadow-xl">
      <div class="mb-1.5 text-lg font-bold">DumbSortable ✨</div>
      <p class="mb-3 text-[13px]/normal opacity-95">
        Blazing-fast, zero-dep FLIP reorder for SolidJS. Cell bounds read <b>once</b> via
        <b> IntersectionObserver</b> (off the main thread, <b>zero reflow</b>), then only GPU
        <code> transform</code>s — stays at 60fps with hundreds of rows. No per-frame
        <code> getBoundingClientRect</code> like dnd-kit.
      </p>
      <div class="mb-3.5 flex flex-wrap gap-1.5">
        <For each={PILLS}>{(t) => <span class="rounded-full bg-base-content/20 px-2 py-1 text-xs">{t}</span>}</For>
      </div>
      <code class="block rounded-lg bg-base-content/25 px-2.5 py-2 text-center text-[11px] [overflow-wrap:anywhere]">pnpm add github:russelgal/solid-dumb-kit</code>
    </aside>
  )
}

export default function DumbSortableExample() {
  const [list, setList] = createSignal<Row[]>(rows(100))
  const [tiles, setTiles] = createSignal<Row[]>(rows(100))
  // анимации отключаются пропом; по умолчанию кит ещё и сам уважает
  // системное prefers-reduced-motion
  const [animate, setAnimate] = createSignal(true)

  return (
    <div class="flex flex-wrap items-start gap-5 p-5 text-base-content">
      <div class="grid min-w-80 flex-1 gap-7">
        {/* Vertical list: drag by the ⠿ handle; container scrolls while dragging */}
        <section>
          <header class="flex items-center gap-2.5 [&_h3]:mb-1 [&_h3]:text-base [&_h3]:font-semibold">
            <h3>List — drag by the handle</h3>
            <button class="btn btn-xs" onClick={() => setList(shuffle(list()))}>перемешать</button>
            <label class="flex items-center gap-1 text-xs text-base-content">
              <input type="checkbox" checked={animate()} onChange={(e) => setAnimate(e.currentTarget.checked)} />
              анимации
            </label>
          </header>
          <p class="mb-2.5 text-[13px] text-base-content">100 rows, fixed-height scroll area — drag near an edge and it auto-scrolls.</p>

          <div class="grid max-h-[52vh] gap-1.5 overflow-x-hidden overflow-y-auto rounded-xl border border-base-300 bg-base-200 p-2.5">
            <DumbSortable items={list()} setItems={setList} id={(x) => x.id} animate={animate()}>
              {(item, i) => (
                <div class="flex items-center gap-2.5 rounded-box bg-base-100 px-3 py-2.5 ring-1 ring-base-300">
                  <button class="cursor-grab border-none bg-none px-0.5 text-lg text-base-content [touch-action:none]" data-drag-handle title="drag">⠿</button>
                  <span class="w-8.5 text-[13px] text-base-content tabular-nums">{i() + 1}</span>
                  <span class="size-3.5 rounded" style={{ background: HUE(Number(item.id.slice(1))) }} />
                  <span>{item.label}</span>
                </div>
              )}
            </DumbSortable>
          </div>
        </section>

        {/* Grid: axis="grid", drag the whole tile (no handle) */}
        <section>
          <header class="flex items-center gap-2.5 [&_h3]:mb-1 [&_h3]:text-base [&_h3]:font-semibold">
            <h3>Grid — drag the tile</h3>
            <button class="btn btn-xs" onClick={() => setTiles(shuffle(tiles()))}>перемешать</button>
          </header>
          <p class="mb-2.5 text-[13px] text-base-content">100 tiles, <code>axis="grid"</code> — items reflow in 2D and jump across rows.</p>

          <div class="grid max-h-[52vh] grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-2 overflow-x-hidden overflow-y-auto rounded-xl border border-base-300 bg-base-200 p-2.5">
            <DumbSortable items={tiles()} setItems={setTiles} id={(x) => x.id} axis="grid" animate={animate()}>
              {(item, i) => (
                <div class="grid aspect-square cursor-grab place-items-center rounded-box font-semibold select-none" style={{ background: HUE(Number(item.id.slice(1))), color: INK(Number(item.id.slice(1))) }}>
                  {i() + 1}
                </div>
              )}
            </DumbSortable>
          </div>
        </section>
      </div>

      <Promo />

    </div>
  )
}

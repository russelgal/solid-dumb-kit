// DumbSortable — drag-reorder at scale: a 100-row list (drag by handle, auto-scrolls)
// and a 100-tile grid (drag the whole tile). The kit needs no CSS — everything
// in the <style> block below is just this example's looks.
import { createSignal, For } from 'solid-js'
import { DumbSortable } from 'solid-dumb-kit'

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
    <aside class="promo">
      <div class="promo-title">DumbSortable ✨</div>
      <p class="promo-text">
        Blazing-fast, zero-dep FLIP reorder for SolidJS. Cell bounds read <b>once</b> via
        <b> IntersectionObserver</b> (off the main thread, <b>zero reflow</b>), then only GPU
        <code> transform</code>s — stays at 60fps with hundreds of rows. No per-frame
        <code> getBoundingClientRect</code> like dnd-kit.
      </p>
      <div class="pills">
        <For each={PILLS}>{(t) => <span class="pill">{t}</span>}</For>
      </div>
      <code class="promo-install">npm i solid-dumb-kit</code>
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
    <div class="ds-example">
      <div class="demos">
        {/* Vertical list: drag by the ⠿ handle; container scrolls while dragging */}
        <section>
          <header class="section-head">
            <h3>List — drag by the handle</h3>
            <button class="btn" onClick={() => setList(shuffle(list()))}>перемешать</button>
            <label class="toggle">
              <input type="checkbox" checked={animate()} onChange={(e) => setAnimate(e.currentTarget.checked)} />
              анимации
            </label>
          </header>
          <p class="note">100 rows, fixed-height scroll area — drag near an edge and it auto-scrolls.</p>

          <div class="scroller list">
            <DumbSortable items={list()} setItems={setList} id={(x) => x.id} animate={animate()}>
              {(item, i) => (
                <div class="row">
                  <button class="handle" data-drag-handle title="drag">⠿</button>
                  <span class="num">{i() + 1}</span>
                  <span class="swatch" style={{ background: HUE(Number(item.id.slice(1))) }} />
                  <span>{item.label}</span>
                </div>
              )}
            </DumbSortable>
          </div>
        </section>

        {/* Grid: axis="grid", drag the whole tile (no handle) */}
        <section>
          <header class="section-head">
            <h3>Grid — drag the tile</h3>
            <button class="btn" onClick={() => setTiles(shuffle(tiles()))}>перемешать</button>
          </header>
          <p class="note">100 tiles, <code>axis="grid"</code> — items reflow in 2D and jump across rows.</p>

          <div class="scroller tiles">
            <DumbSortable items={tiles()} setItems={setTiles} id={(x) => x.id} axis="grid" animate={animate()}>
              {(item, i) => (
                <div class="tile" style={{ background: HUE(Number(item.id.slice(1))) }}>
                  {i() + 1}
                </div>
              )}
            </DumbSortable>
          </div>
        </section>
      </div>

      <Promo />

      <style>{`
        .ds-example { padding: 16px; max-width: 1040px; margin: 0 auto; color: #0f172a;
                      display: flex; gap: 20px; align-items: flex-start; flex-wrap: wrap }
        .ds-example .demos { flex: 1; min-width: 320px; display: grid; gap: 28px }

        .section-head { display: flex; align-items: center; gap: 10px }
        .section-head h3 { margin: 0 0 4px }
        .note { margin: 0 0 10px; font-size: 13px; color: #64748b }

        .toggle { display: flex; align-items: center; gap: 4px; font-size: 12px; color: #64748b }
        .toggle input { margin: 0 }
        .btn { padding: 3px 10px; border-radius: 6px; border: 1px solid #cbd5e1;
               background: #fff; color: inherit; font: inherit; font-size: 12px; cursor: pointer }

        .scroller { max-height: 52vh; overflow-y: auto; overflow-x: hidden; padding: 10px;
                    border: 1px solid #e2e8f0; border-radius: 12px; background: #f8fafc }
        .list { display: grid; gap: 6px }
        .tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(64px, 1fr)); gap: 8px }

        .row { display: flex; align-items: center; gap: 10px; padding: 10px 12px;
               border-radius: 10px; background: #fff; box-shadow: inset 0 0 0 1px #e2e8f0 }
        .handle { cursor: grab; border: none; background: none; padding: 0 2px;
                  font-size: 18px; color: #94a3b8; touch-action: none }
        .num { width: 34px; font-size: 13px; color: #94a3b8; font-variant-numeric: tabular-nums }
        .swatch { width: 14px; height: 14px; border-radius: 4px }

        .tile { aspect-ratio: 1; display: grid; place-items: center; border-radius: 10px;
                cursor: grab; user-select: none; font-weight: 600; color: #1e293b }

        .promo { width: 260px; flex-shrink: 0; position: sticky; top: 64px; padding: 18px;
                 border-radius: 14px; color: #fff;
                 background: linear-gradient(160deg, #4f46e5, #7c3aed 55%, #db2777);
                 box-shadow: 0 12px 28px -10px rgba(79,70,229,.55) }
        .promo-title { font-size: 18px; font-weight: 700; margin-bottom: 6px }
        .promo-text { font-size: 13px; opacity: .92; margin: 0 0 12px; line-height: 1.5 }
        .pills { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px }
        .pill { font-size: 12px; padding: 4px 9px; border-radius: 999px; background: rgba(255,255,255,.18) }
        .promo-install { display: block; font-size: 13px; background: rgba(0,0,0,.25);
                         padding: 8px 10px; border-radius: 8px; text-align: center }
      `}</style>
    </div>
  )
}

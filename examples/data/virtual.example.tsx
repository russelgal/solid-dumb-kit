// createVirtualizer — десять тысяч строк, в разметке десятки.
//
// Смысл примера — не «список едет плавно», а счётчик под ним: сколько узлов
// РЕАЛЬНО живёт в DOM. Переключи виртуализацию — увидишь разницу между
// десятками и десятью тысячами, и заодно как на этом умирает вкладка.
//
// Виртуализатор кита не меряет элементы вовсе: высота строки заявлена, окно
// считается арифметикой. Отсюда его ограничение — строки одной высоты.
import { For, Show, createMemo, createSignal, onCleanup, onMount } from 'solid-js'
import { createVirtualizer, type VirtualRange } from '@solid-dumb-kit/shared'
import { fmtNum } from '@solid-dumb-kit/utils'
import { Bar, Switch, Pick, Note } from '../_controls'

const ROW = 28

/** данные выдумываются на лету: держать десять тысяч объектов незачем */
const label = (i: number) => `Строка ${i + 1} · ${(i * 37) % 997} у.е.`

export default function VirtualExample() {
  const [on, setOn] = createSignal(true)
  const [count, setCount] = createSignal(10_000)
  const [range, setRange] = createSignal<VirtualRange>({ start: 0, end: 0, offset: 0, total: 0 })
  const [nodes, setNodes] = createSignal(0)

  let scroller!: HTMLDivElement
  let list!: HTMLDivElement

  onMount(() => {
    const v = createVirtualizer({
      count,
      itemSize: () => ROW,
      scroller: () => scroller,
      onChange: setRange,
    })
    // число элементов меняется переключателем — пересчитать окно
    const stop = setInterval(() => v.refresh(), 400)
    // счётчик узлов: считаем то, что действительно в документе
    const tick = setInterval(() => setNodes(list?.childElementCount ?? 0), 300)
    onCleanup(() => {
      v.destroy()
      clearInterval(stop)
      clearInterval(tick)
    })
  })

  /** какие индексы рисуем: с виртуализацией — окно, без неё — все подряд */
  const shown = createMemo(() => {
    const n = count()
    if (!on()) return Array.from({ length: n }, (_, i) => i)
    const { start, end } = range()
    return Array.from({ length: Math.max(0, end - start) }, (_, i) => start + i)
  })

  return (
    <div class="p-5 text-base-content">
      <h3 class="mb-1 text-lg font-semibold">createVirtualizer — длинный список без замеров</h3>
      <p class="mb-3 max-w-[92ch] text-sm text-base-content">
        Высота строки <b>заявлена</b> ({ROW}px), поэтому окно считается арифметикой, а элементы не
        измеряются ни разу: ходовые виртуализаторы зовут <code>getBoundingClientRect</code> по
        строке, и на тысяче строк это тысяча forced layout. Из DOM берётся только{' '}
        <code>scrollTop</code> и высота скроллера через <code>ResizeObserver</code>.
      </p>

      <Bar>
        <Switch checked={on()} onChange={setOn}>виртуализация</Switch>
        <Pick
          label="строк"
          value={count()}
          options={[1_000, 10_000, 100_000].map((n) => ({ value: n, label: fmtNum(n) }))}
          onChange={(v) => setCount(Number(v))}
        />
        <Note>
          узлов в разметке: <b>{fmtNum(nodes())}</b> из {fmtNum(count())}
          {on() ? ` · окно ${range().start}…${range().end}` : ' · без виртуализации'}
        </Note>
      </Bar>

      <Show when={!on() && count() >= 100_000}>
        <p class="mb-2 max-w-[92ch] text-sm text-error">
          Сто тысяч узлов без виртуализации подвесят вкладку на несколько секунд. Это и есть
          показание прибора.
        </p>
      </Show>

      <div
        ref={scroller}
        class="max-w-[92ch] overflow-y-auto rounded-box border border-base-300"
        style={{ height: '60vh' }}
      >
        {/* распорка держит полосу прокрутки: её высота — весь список целиком */}
        <div style={{ height: on() ? `${range().total}px` : 'auto', position: 'relative' }}>
          <div
            ref={list}
            style={{
              // окно сдвигается трансформом, а не отступом: layout не трогаем
              transform: on() ? `translateY(${range().offset}px)` : undefined,
            }}
          >
            <For each={shown()}>
              {(i) => (
                <div
                  class="flex items-center gap-3 border-b border-base-200 px-3 text-sm"
                  style={{ height: `${ROW}px` }}
                >
                  <span class="w-16 shrink-0 tabular-nums opacity-70">{i + 1}</span>
                  <span class="truncate">{label(i)}</span>
                </div>
              )}
            </For>
          </div>
        </div>
      </div>
    </div>
  )
}

import { createSignal, type JSX, For, Show } from 'solid-js'
import { makePersisted } from '@solid-primitives/storage'
import * as v from 'valibot'

/* ────────── Типы ────────── */

export type GridPanel = {
  /** Уникальный id панели */
  id: string
  /** Содержимое — render prop */
  content: () => JSX.Element
  /** Минимальный размер в px */
  min?: number
  /** Начальный размер в fr (по умолчанию 1) */
  initial?: number
}

export type ResizableGridProps = {
  /** Колонки (2-3) */
  cols: GridPanel[]
  /** Второй ряд (опционально, 1-3 панелей) */
  rows?: GridPanel[]
  /** Высота первого ряда в fr (по умолчанию 1) */
  rowInitial?: number
  /** Высота второго ряда в fr (по умолчанию 1) */
  row2Initial?: number
  /** Мин. высота ряда в px */
  rowMin?: number
  /** Ключ localStorage для сохранения размеров */
  storageKey: string
  /** Доп. класс */
  class?: string
}

type PersistedSizes = {
  cols: number[]
  rows?: number[]
  rowSplit?: number[]
}

const HANDLE_SIZE = 6
const DEFAULT_MIN = 100

const SizesSchema = v.object({
  cols: v.array(v.number()),
  rows: v.optional(v.array(v.number())),
  rowSplit: v.optional(v.array(v.number())),
})

/** Валидация localStorage — если данные битые или длина не совпадает, сброс на дефолт */
function validateSizes(raw: unknown, defaults: PersistedSizes): PersistedSizes {
  const result = v.safeParse(SizesSchema, raw)
  if (!result.success) return defaults
  const s = result.output
  if (!s.cols.length || s.cols.some(n => n <= 0 || !isFinite(n))) return defaults
  // Длина cols должна совпадать с дефолтом
  if (s.cols.length !== defaults.cols.length) return defaults
  return s as PersistedSizes
}

/* ────────── Компонент ────────── */

export function ResizableGrid(props: ResizableGridProps) {
  // Кеш метаданных (min, initial) — НЕ обращаемся к props.cols/rows в event handlers
  // props.cols содержит JSX content, обращение к нему создаёт компоненты
  const meta = {
    colMins: props.cols.map(c => c.min ?? DEFAULT_MIN),
    colInitials: props.cols.map(c => c.initial ?? 1),
    rowMins: props.rows?.map(r => r.min ?? DEFAULT_MIN) ?? [] as number[],
    rowInitials: props.rows?.map(r => r.initial ?? 1) ?? [] as number[],
  }

  const defaults: PersistedSizes = {
    cols: [...meta.colInitials],
    rows: meta.rowInitials.length ? [...meta.rowInitials] : undefined,
    rowSplit: props.rows ? [props.rowInitial ?? 1, props.row2Initial ?? 1] : undefined,
  }

  const [sizes, setSizes] = makePersisted(
    createSignal<PersistedSizes>(defaults),
    {
      name: props.storageKey,
      deserialize: (raw) => validateSizes(JSON.parse(raw), defaults),
    },
  )

  const colSizes = () => {
    const s = sizes()
    if (!s || !s.cols || s.cols.length !== meta.colInitials.length) return meta.colInitials
    return s.cols
  }

  const rowSizes = () => {
    const s = sizes()
    if (!meta.rowInitials.length) return undefined
    if (!s || !s.rows || s.rows.length !== meta.rowInitials.length) return meta.rowInitials
    return s.rows
  }

  const rowSplit = () => {
    const s = sizes()
    if (!meta.rowInitials.length) return undefined
    return s?.rowSplit ?? [props.rowInitial ?? 1, props.row2Initial ?? 1]
  }

  let containerRef!: HTMLDivElement

  // ─── Горизонтальный ресайз колонок ───
  function startColResize(index: number, e: MouseEvent) {
    e.preventDefault()
    const rect = containerRef.getBoundingClientRect()
    const totalWidth = rect.width - HANDLE_SIZE * (meta.colMins.length - 1)
    const currentSizes = [...colSizes()]
    const totalFr = currentSizes.reduce((a, b) => a + b, 0)

    const startX = e.clientX
    const leftFr = currentSizes[index]
    const rightFr = currentSizes[index + 1]
    const leftMin = meta.colMins[index] / totalWidth * totalFr
    const rightMin = meta.colMins[index + 1] / totalWidth * totalFr

    function onMove(ev: MouseEvent) {
      const dx = ev.clientX - startX
      const dFr = (dx / totalWidth) * totalFr
      const newLeft = Math.max(leftMin, leftFr + dFr)
      const newRight = Math.max(rightMin, rightFr - dFr)

      // Если один из них упёрся в минимум — не двигаем
      if (newLeft <= leftMin && dFr < 0) return
      if (newRight <= rightMin && dFr > 0) return

      currentSizes[index] = newLeft
      currentSizes[index + 1] = newRight
      setSizes(prev => ({ ...prev, cols: [...currentSizes] }))
    }

    function onUp() {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  // ─── Горизонтальный ресайз нижних колонок ───
  function startRow2ColResize(index: number, e: MouseEvent) {
    e.preventDefault()
    if (!meta.rowMins.length) return

    const rect = containerRef.getBoundingClientRect()
    const totalWidth = rect.width - HANDLE_SIZE * (meta.rowMins.length - 1)
    const currentSizes = [...(rowSizes() || [...meta.rowInitials])]
    const totalFr = currentSizes.reduce((a, b) => a + b, 0)

    const startX = e.clientX
    const leftFr = currentSizes[index]
    const rightFr = currentSizes[index + 1]
    const leftMin = meta.rowMins[index] / totalWidth * totalFr
    const rightMin = meta.rowMins[index + 1] / totalWidth * totalFr

    function onMove(ev: MouseEvent) {
      const dx = ev.clientX - startX
      const dFr = (dx / totalWidth) * totalFr
      const newLeft = Math.max(leftMin, leftFr + dFr)
      const newRight = Math.max(rightMin, rightFr - dFr)
      if (newLeft <= leftMin && dFr < 0) return
      if (newRight <= rightMin && dFr > 0) return

      currentSizes[index] = newLeft
      currentSizes[index + 1] = newRight
      setSizes(prev => ({ ...prev, rows: [...currentSizes] }))
    }

    function onUp() {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  // ─── Вертикальный ресайз рядов ───
  function startRowResize(e: MouseEvent) {
    e.preventDefault()
    if (!props.rows) return

    const rect = containerRef.getBoundingClientRect()
    const totalHeight = rect.height - HANDLE_SIZE
    const currentSplit = [...(rowSplit() || [1, 1])]
    const totalFr = currentSplit[0] + currentSplit[1]

    const startY = e.clientY
    const topFr = currentSplit[0]
    const bottomFr = currentSplit[1]
    const rowMinPx = props.rowMin ?? DEFAULT_MIN
    const topMin = rowMinPx / totalHeight * totalFr
    const bottomMin = rowMinPx / totalHeight * totalFr

    function onMove(ev: MouseEvent) {
      const dy = ev.clientY - startY
      const dFr = (dy / totalHeight) * totalFr
      const newTop = Math.max(topMin, topFr + dFr)
      const newBottom = Math.max(bottomMin, bottomFr - dFr)
      if (newTop <= topMin && dFr < 0) return
      if (newBottom <= bottomMin && dFr > 0) return

      setSizes(prev => ({ ...prev, rowSplit: [newTop, newBottom] }))
    }

    function onUp() {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  // ─── CSS Grid template ───
  const colTemplate = () => {
    const s = colSizes()
    return s.map((v: number) => `${v}fr`).join(` ${HANDLE_SIZE}px `)
  }

  const row2Template = () => {
    const s = rowSizes()
    if (!s) return ''
    return s.map((v: number) => `${v}fr`).join(` ${HANDLE_SIZE}px `)
  }

  const rowTemplate = () => {
    const split = rowSplit()
    if (!split) return '1fr'
    return `${split[0]}fr ${HANDLE_SIZE}px ${split[1]}fr`
  }

  const hasRows = () => !!props.rows && props.rows.length > 0

  return (
    <div
      ref={containerRef}
      class={`grid h-full w-full ${props.class ?? ''}`}
      style={{
        'grid-template-rows': rowTemplate(),
        overflow: 'hidden',
      }}
    >
      {/* ─── Первый ряд ─── */}
      <div
        class="grid min-h-0"
        style={{ 'grid-template-columns': colTemplate() }}
      >
        <For each={props.cols}>
          {(col, i) => (
            <>
              <Show when={i() > 0}>
                <div
                  class="resizable-grid-handle-col"
                  onMouseDown={(e) => startColResize(i() - 1, e)}
                />
              </Show>
              <div class="min-w-0 min-h-0 overflow-auto">{col.content()}</div>
            </>
          )}
        </For>
      </div>

      {/* ─── Горизонтальный разделитель рядов ─── */}
      <Show when={hasRows()}>
        <div
          class="resizable-grid-handle-row"
          onMouseDown={startRowResize}
        />
      </Show>

      {/* ─── Второй ряд ─── */}
      <Show when={hasRows()}>
        <div
          class="grid min-h-0"
          style={{ 'grid-template-columns': row2Template() }}
        >
          <For each={props.rows}>
            {(panel, i) => (
              <>
                <Show when={i() > 0}>
                  <div
                    class="resizable-grid-handle-col"
                    onMouseDown={(e) => startRow2ColResize(i() - 1, e)}
                  />
                </Show>
                <div class="min-w-0 min-h-0 overflow-auto">{panel.content()}</div>
              </>
            )}
          </For>
        </div>
      </Show>
    </div>
  )
}

/* ────────── Стили (инжектятся один раз) ────────── */

let stylesInjected = false

if (typeof document !== 'undefined' && !stylesInjected) {
  stylesInjected = true
  const style = document.createElement('style')
  style.textContent = `
.resizable-grid-handle-col {
  cursor: col-resize;
  background: transparent;
  transition: background 0.15s;
  z-index: 1;
}
.resizable-grid-handle-col:hover,
.resizable-grid-handle-col:active {
  background: oklch(from currentColor l c h / 0.15);
}
.resizable-grid-handle-row {
  cursor: row-resize;
  background: transparent;
  transition: background 0.15s;
  z-index: 1;
}
.resizable-grid-handle-row:hover,
.resizable-grid-handle-row:active {
  background: oklch(from currentColor l c h / 0.15);
}`
  document.head.appendChild(style)
}

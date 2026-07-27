import { For, Show } from 'solid-js'

// Пагинация для DumbTable (или чего угодно): номера страниц со схлопыванием
// в «…» и опциональный переключатель размера страницы.

export type DumbPaginationProps = {
  page: number
  total: number
  pageSize: number
  onPageChange: (page: number) => void
  /** показывает переключатель размера страницы */
  pageSizes?: Array<number>
  onPageSizeChange?: (size: number) => void
  /** подпись слева; по умолчанию «total · page/pages» */
  summary?: (info: { page: number; pages: number; total: number }) => string
  class?: string
  buttonClass?: string
  activeClass?: string
}

// 1 … 5 6 [7] 8 9 … 42 — первая и последняя всегда, вокруг текущей окно.
export function buildPageNumbers(current: number, total: number): Array<number | '…'> {
  if (total <= 10) return Array.from({ length: total }, (_, i) => i + 1)

  const pages: Array<number | '…'> = [1]
  let start = Math.max(2, current - 4)
  let end = Math.min(total - 1, current + 4)

  // держим минимум 8 номеров между первой и последней
  if (end - start < 7) {
    if (start === 2) end = Math.min(total - 1, start + 7)
    else start = Math.max(2, end - 7)
  }

  if (start > 2) pages.push('…')
  for (let i = start; i <= end; i++) pages.push(i)
  if (end < total - 1) pages.push('…')

  pages.push(total)
  return pages
}

export function DumbPagination(props: DumbPaginationProps) {
  const pages = () => Math.max(1, Math.ceil(props.total / props.pageSize))
  const summary = () =>
    props.summary
      ? props.summary({ page: props.page, pages: pages(), total: props.total })
      : `${props.total} · ${props.page}/${pages()}`

  const btn = (active: boolean, disabled: boolean) => ({
    padding: '3px 9px',
    'min-width': '32px',
    border: '1px solid currentColor',
    'border-radius': '6px',
    background: 'transparent',
    color: 'inherit',
    font: 'inherit',
    opacity: disabled ? '.35' : active ? '1' : '.7',
    cursor: disabled ? 'default' : 'pointer',
    'font-weight': active ? '700' : '400',
  })

  return (
    <div
      class={props.class}
      style={{ display: 'flex', 'align-items': 'center', 'justify-content': 'space-between',
               gap: '12px', 'flex-wrap': 'wrap' }}
    >
      <div style={{ display: 'flex', 'align-items': 'center', gap: '8px' }}>
        <span style={{ opacity: '.7', 'font-size': '13px' }}>{summary()}</span>
        <Show when={props.pageSizes?.length && props.onPageSizeChange}>
          <div style={{ display: 'flex', gap: '4px' }}>
            <For each={props.pageSizes}>
              {(size) => (
                <button
                  class={`${props.buttonClass ?? ''} ${props.pageSize === size ? props.activeClass ?? '' : ''}`.trim() || undefined}
                  style={btn(props.pageSize === size, false)}
                  onClick={() => props.onPageSizeChange!(size)}
                >
                  {size}
                </button>
              )}
            </For>
          </div>
        </Show>
      </div>

      <Show when={pages() > 1}>
        <div style={{ display: 'flex', gap: '4px', 'flex-wrap': 'wrap' }}>
          <button
            class={props.buttonClass} style={btn(false, props.page <= 1)}
            disabled={props.page <= 1}
            onClick={() => props.onPageChange(props.page - 1)}
          >
            «
          </button>
          <For each={buildPageNumbers(props.page, pages())}>
            {(p) => (
              <Show when={p !== '…'} fallback={<span style={{ padding: '3px 4px', opacity: '.4' }}>…</span>}>
                <button
                  class={`${props.buttonClass ?? ''} ${props.page === p ? props.activeClass ?? '' : ''}`.trim() || undefined}
                  style={btn(props.page === p, false)}
                  onClick={() => props.onPageChange(p as number)}
                >
                  {p}
                </button>
              </Show>
            )}
          </For>
          <button
            class={props.buttonClass} style={btn(false, props.page >= pages())}
            disabled={props.page >= pages()}
            onClick={() => props.onPageChange(props.page + 1)}
          >
            »
          </button>
        </div>
      </Show>
    </div>
  )
}

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

  /**
   * Классы кнопки — daisyUI: `join-item btn btn-sm`, текущая страница помечена
   * `btn-active`. Приглушать неактивные прозрачностью нельзя (правило
   * контраста), поэтому «неактивная» отличается не блёклостью, а тем, что она
   * просто `btn-ghost`.
   */
  const btn = (active: boolean) =>
    `join-item btn btn-sm ${active ? 'btn-active' : 'btn-ghost'}`

  return (
    <div class={`flex flex-wrap items-center justify-between gap-3 ${props.class ?? ''}`}>
      <div class="flex items-center gap-2">
        <span class="text-sm">{summary()}</span>
        <Show when={props.pageSizes?.length && props.onPageSizeChange}>
          <div class="join">
            <For each={props.pageSizes}>
              {(size) => (
                <button
                  class={`${btn(props.pageSize === size)} ${props.buttonClass ?? ''} ${
                    props.pageSize === size ? (props.activeClass ?? '') : ''
                  }`}
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
        <div class="join">
          <button
            class={`${btn(false)} ${props.buttonClass ?? ''}`}
            disabled={props.page <= 1}
            onClick={() => props.onPageChange(props.page - 1)}
          >
            «
          </button>
          <For each={buildPageNumbers(props.page, pages())}>
            {(p) => (
              <Show when={p !== '…'} fallback={<span class="join-item btn btn-sm btn-ghost btn-disabled">…</span>}>
                <button
                  class={`${btn(props.page === p)} ${props.buttonClass ?? ''} ${
                    props.page === p ? (props.activeClass ?? '') : ''
                  }`}
                  onClick={() => props.onPageChange(p as number)}
                >
                  {p}
                </button>
              </Show>
            )}
          </For>
          <button
            class={`${btn(false)} ${props.buttonClass ?? ''}`}
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

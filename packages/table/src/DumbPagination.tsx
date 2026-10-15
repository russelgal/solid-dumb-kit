import { For, Show } from 'solid-js'
import type { JSX } from '@solidjs/web'

// Пагинация для DumbTable (или чего угодно): номера страниц со схлопыванием
// в «…» и опциональный переключатель размера страницы.

export type DumbPaginationProps = {
  page: number
  total: number
  pageSize: number
  onPageChange: (page: number) => void
  /**
   * Адрес страницы. Задан — номера и стрелки рисуются ссылками `<a href>`, а
   * не кнопками: по ним проходит поисковик, их открывают в новой вкладке и
   * копируют. Обычный клик всё равно идёт в `onPageChange` (без перезагрузки —
   * роутер приложения переходит сам), клик с Ctrl/Cmd/Shift или средней
   * кнопкой браузер обрабатывает как обычную ссылку.
   */
  href?: (page: number) => string
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

/** Клик, который браузер должен обработать сам: новая вкладка, окно, скачивание. */
const isModified = (event: MouseEvent) =>
  event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey

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

  /**
   * Одна кнопка пагинатора: `<button>` или, с `href`, ссылка. Выключенная
   * ссылка — `<span>`: у `<a>` нет `disabled`, а ссылка «в никуда» на краю
   * (стрелка «назад» на первой странице) поисковику ни к чему.
   */
  const PageButton = (p: { page: number; active?: boolean; disabled?: boolean; children: JSX.Element }) => {
    const cls = () =>
      `${btn(!!p.active)} ${props.buttonClass ?? ''} ${p.active ? (props.activeClass ?? '') : ''}`
    return (
      <Show
        when={props.href}
        fallback={
          <button class={cls()} disabled={p.disabled} onClick={() => props.onPageChange(p.page)}>
            {p.children}
          </button>
        }
      >
        {(href) => (
          <Show when={!p.disabled} fallback={<span class={`${cls()} btn-disabled`}>{p.children}</span>}>
            <a
              class={cls()}
              href={href()(p.page)}
              aria-current={p.active ? 'page' : undefined}
              onClick={(event) => {
                if (isModified(event)) return
                event.preventDefault()
                props.onPageChange(p.page)
              }}
            >
              {p.children}
            </a>
          </Show>
        )}
      </Show>
    )
  }

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
          <PageButton page={props.page - 1} disabled={props.page <= 1}>
            «
          </PageButton>
          <For each={buildPageNumbers(props.page, pages())}>
            {(p) => (
              <Show when={p !== '…'} fallback={<span class="join-item btn btn-sm btn-ghost btn-disabled">…</span>}>
                <PageButton page={p as number} active={props.page === p}>
                  {p}
                </PageButton>
              </Show>
            )}
          </For>
          <PageButton page={props.page + 1} disabled={props.page >= pages()}>
            »
          </PageButton>
        </div>
      </Show>
    </div>
  )
}

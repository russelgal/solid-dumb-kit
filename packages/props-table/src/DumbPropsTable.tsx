import { For, Show, createMemo } from 'solid-js'
import { dumpProps, type DumpOptions, type DumpRow } from './propsDump'

/**
 * Таблица пропсов для отладки: имя, тип, значение — ВСЁ, включая функции.
 *
 * Вложенные объекты (`scale`, `style`) разворачиваются и идут ПЕРВЫМИ: в них
 * обычно и кроется причина «почему не работает», а функции и скаляры видны и
 * так. Массивы (`rows`, `spans`) показываются первыми элементами и счётчиком —
 * дамп двух тысяч броней никому не нужен.
 *
 * Разметка нарочно голая — `table > thead/tbody`, без единого класса кита:
 * это отладочный инструмент, и оформление на нём должно быть потребителя.
 * Готовый класс (`table table-xs` у daisyUI) ложится на неё без обёрток.
 */
export interface DumbPropsTableProps extends DumpOptions {
  /** объект пропсов (или любой другой) */
  value: object
  /** заголовок над таблицей */
  title?: string
  class?: string
  /** отступ на уровень вложенности, px */
  indent?: number
  /** не рисовать шапку: в узкой панели она только занимает строку */
  headless?: boolean
}

/**
 * Цвет по виду значения — глазами быстрее, чем читать колонку типа.
 *
 * Цвета тёмные не случайно: отладочную панель читают, а не украшают, и
 * блёклый серый по белому в ней — брак (правило контраста репы). Каждый
 * вынесен в переменную, чтобы тёмная тема перекрасила их своими.
 */
const KIND_COLOR: Record<DumpRow['kind'], string> = {
  object: 'var(--dumb-props-object, #6d28d9)',
  array: 'var(--dumb-props-array, #0e7490)',
  function: 'var(--dumb-props-function, #9a3412)',
  primitive: 'inherit',
}

export function DumbPropsTable(props: DumbPropsTableProps) {
  const rows = createMemo(() =>
    dumpProps(props.value, { depth: props.depth, maxItems: props.maxItems, skip: props.skip }),
  )

  return (
    <div class={props.class}>
      <Show when={props.title}>
        <div style={{ 'font-weight': 700, 'margin-bottom': '4px' }}>{props.title}</div>
      </Show>
      <table
        style={{
          'font-size': '12px',
          'font-family': 'ui-monospace, monospace',
          'border-collapse': 'collapse',
        }}
      >
        <Show when={!props.headless}>
          <thead>
            <tr>
              <th style={{ 'text-align': 'left', 'padding-right': '12px' }}>проп</th>
              <th style={{ 'text-align': 'left', 'padding-right': '12px' }}>тип</th>
              <th style={{ 'text-align': 'left' }}>значение</th>
            </tr>
          </thead>
        </Show>
        <tbody>
          <For each={rows()}>
            {(r) => (
              <tr>
                <td
                  style={{
                    'padding-right': '12px',
                    'padding-left': `${r.depth * (props.indent ?? 14)}px`,
                    'font-weight': r.depth === 0 ? 700 : 400,
                    'white-space': 'nowrap',
                    color: KIND_COLOR[r.kind],
                  }}
                  title={r.path}
                >
                  {r.key}
                </td>
                {/* тип — подсказка, а не главное; вторичность даётся ЦВЕТОМ,
                    а не прозрачностью: полупрозрачный текст не читается */}
                <td
                  style={{
                    'padding-right': '12px',
                    color: 'var(--dumb-props-dim, #475569)',
                    'white-space': 'nowrap',
                  }}
                >
                  {r.type}
                </td>
                <td style={{ 'white-space': 'pre-wrap', 'word-break': 'break-all' }}>{r.value}</td>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </div>
  )
}

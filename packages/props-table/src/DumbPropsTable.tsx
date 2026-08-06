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
        <div class="mb-1 font-bold">{props.title}</div>
      </Show>
      {/* table table-xs из daisyUI: отладочная таблица должна быть плотной */}
      <table class="table table-xs font-mono">
        <Show when={!props.headless}>
          <thead>
            <tr>
              <th>проп</th>
              <th>тип</th>
              <th>значение</th>
            </tr>
          </thead>
        </Show>
        <tbody>
          <For each={rows()}>
            {(r) => (
              <tr>
                <td
                  class={`whitespace-nowrap ${r.depth === 0 ? 'font-bold' : ''}`}
                  style={{
                    'padding-left': `${r.depth * (props.indent ?? 14)}px`,
                    color: KIND_COLOR[r.kind],
                  }}
                  title={r.path}
                >
                  {r.key}
                </td>
                {/* тип — подсказка, а не главное; вторичность даётся ЦВЕТОМ,
                    а не прозрачностью: полупрозрачный текст не читается */}
                <td class="whitespace-nowrap" style={{ color: 'var(--dumb-props-dim, #475569)' }}>
                  {r.type}
                </td>
                <td class="break-all whitespace-pre-wrap">{r.value}</td>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </div>
  )
}

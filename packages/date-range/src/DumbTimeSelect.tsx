// Время двумя списками: часы и минуты.
//
// Второй способ выбрать время рядом со слотами (`DumbDateTimeRange`), и нужен
// он там, где слоты не годятся:
//
// - шаг мелкий (5 минут) — слотов на сутки выходит под три сотни, и это стена
//   кнопок, а не выбор;
// - места мало: модалка на телефоне, ячейка таблицы, строка формы;
// - на телефоне `<select>` даёт РОДНОЕ колесо, а его никакая сетка кнопок не
//   переиграет.
//
// Занятость показывается прямо в списке: занятый час помечен и не выбирается.
// Это хуже слотов (свободное окно глазами не окинуть), поэтому если места
// хватает — берите слоты.

import { For, Show, createMemo, type JSX } from 'solid-js'
import type { Day } from './dateMath'
import { slotBusy, toMin, toTime, type BusyMoment, type Time } from './timeMath'

export type DumbTimeSelectProps = {
  value: () => Time | null
  onChange: (next: Time) => void

  /** шаг минут; по умолчанию 30 */
  step?: number
  /** рабочее окно, минуты от полуночи */
  openMin?: number
  closeMin?: number

  /** день, для которого проверяется занятость; без него занятость не смотрим */
  day?: Day
  busy?: () => Array<BusyMoment>

  /** подпись слева; не задана — списки идут голыми */
  label?: JSX.Element
  disabled?: boolean
  class?: string
}

export function DumbTimeSelect(props: DumbTimeSelectProps): JSX.Element {
  const step = () => props.step ?? 30
  const open = () => Math.max(0, props.openMin ?? 0)
  const close = () => Math.min(1440, props.closeMin ?? 1440)
  const busy = () => props.busy?.() ?? []

  const cur = () => props.value() ?? toTime(open())
  const curH = () => Math.floor(toMin(cur()) / 60)
  const curM = () => toMin(cur()) % 60

  const hours = createMemo(() => {
    const out: Array<number> = []
    for (let h = Math.floor(open() / 60); h * 60 < close(); h++) out.push(h)
    return out
  })

  /** минуты внутри часа — кратно шагу; при шаге ≥ 60 список схлопывается в один пункт */
  const minutes = createMemo(() => {
    const s = step()
    if (s >= 60) return [0]
    const out: Array<number> = []
    for (let m = 0; m < 60; m += s) out.push(m)
    return out
  })

  /**
   * Занят ли ЦЕЛИКОМ этот час: помечаем только полностью занятые, иначе список
   * начнёт врать — внутри часа может оставаться свободные полчаса.
   */
  const hourBusy = (h: number) => {
    if (!props.day) return null
    const s = Math.min(step(), 60)
    for (let m = 0; m < 60; m += s) {
      if (!slotBusy(props.day, toTime(h * 60 + m), s, busy())) return null
    }
    return slotBusy(props.day, toTime(h * 60), s, busy())
  }

  const minuteBusy = (m: number) =>
    props.day ? slotBusy(props.day, toTime(curH() * 60 + m), Math.min(step(), 60), busy()) : null

  const pick = (h: number, m: number) => props.onChange(toTime(h * 60 + m))

  return (
    <label class={`dumb-time-select inline-flex items-center gap-2 text-sm ${props.class ?? ''}`}>
      <Show when={props.label}>{props.label}</Show>
      <span class="join">
        <select
          class="join-item select select-sm w-auto"
          disabled={props.disabled}
          value={String(curH())}
          onChange={(e) => pick(Number(e.currentTarget.value), curM())}
        >
          <For each={hours()}>
            {(h) => {
              const hit = () => hourBusy(h)
              return (
                <option value={h} disabled={!!hit()}>
                  {String(h).padStart(2, '0')}
                  {hit() ? ` · ${hit()!.title ?? 'занято'}` : ''}
                </option>
              )
            }}
          </For>
        </select>
        <Show when={minutes().length > 1}>
          <select
            class="join-item select select-sm w-auto"
            disabled={props.disabled}
            value={String(curM())}
            onChange={(e) => pick(curH(), Number(e.currentTarget.value))}
          >
            <For each={minutes()}>
              {(m) => {
                const hit = () => minuteBusy(m)
                return (
                  <option value={m} disabled={!!hit()}>
                    {String(m).padStart(2, '0')}
                    {hit() ? ' · занято' : ''}
                  </option>
                )
              }}
            </For>
          </select>
        </Show>
      </span>
    </label>
  )
}

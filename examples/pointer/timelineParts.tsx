// Обвязка витрины шахматки: панель контролов и окно «во сколько».
//
// Вынесено из примера, потому что это не про компонент, а про демо-стенд
// вокруг него: ползунки масштаба, переключатель режима, кнопка отмены. В
// самом примере от них оставался шум на сотню строк, за которым не видно
// главного — как устроен `DumbTimeline`.

import { For, Show, type JSX } from 'solid-js'
import { DumbModal } from '@solid-dumb-kit/modal'
import { DumbTimeSelect, type Time } from '@solid-dumb-kit/date-range'
import { Bar, Btn, Note, Pick } from '../_controls'

export type Mode = 'all' | 'hotel' | 'venues'

/** всё, чем панель управляет; сигналы остаются у примера */
export type ControlsApi = {
  mode: () => Mode
  setMode: (m: Mode) => void
  days: () => number
  setDays: (n: number) => void
  checkIn: () => number
  setCheckIn: (h: number) => void
  checkOut: () => number
  setCheckOut: (h: number) => void
  /** ширина колонки: суточной и часовой сетке — своя */
  colW: () => number
  setColW: (n: number) => void
  rowH: () => number
  setRowH: (n: number) => void
  canUndo: () => boolean
  onUndo: () => void
  onReset: () => void
  count: () => number
}

const MODES = [
  ['all', 'всё вместе'],
  ['hotel', 'номера · сутки'],
  ['venues', 'площадки · по часам'],
] as const

export function TimelineControls(p: ControlsApi): JSX.Element {
  return (
    <Bar>
      {/* радио-группа daisyUI: `join` + `btn` — переключатель, а не список */}
      <div class="join">
        <For each={MODES}>
          {([value, label]) => (
            <input
              type="radio"
              name="tl-mode"
              class="btn btn-sm join-item"
              aria-label={label}
              checked={p.mode() === value}
              onChange={() => p.setMode(value)}
            />
          )}
        </For>
      </div>

      <Pick
        label="дней"
        value={p.days()}
        options={[3, 7, 14, 30].map((n) => ({ value: n }))}
        onChange={(v) => p.setDays(Number(v))}
      />

      {/* заезд и выезд есть у проживания — а его нет только на площадках */}
      <Show when={p.mode() !== 'venues'}>
        <Pick
          label="заезд"
          value={p.checkIn()}
          options={[12, 14, 15, 16, 18].map((h) => ({ value: h, label: `${h}:00` }))}
          onChange={(v) => p.setCheckIn(Number(v))}
        />
        <Pick
          label="выезд"
          value={p.checkOut()}
          options={[8, 10, 11, 12, 14].map((h) => ({ value: h, label: `${h}:00` }))}
          onChange={(v) => p.setCheckOut(Number(v))}
        />
      </Show>

      {/* масштаб: у суточной и часовой сетки свои ползунки */}
      <Slider
        label={p.mode() === 'hotel' ? 'день' : 'час'}
        min={16}
        max={90}
        width="w-24"
        value={p.colW()}
        onChange={p.setColW}
      />
      <Slider label="строка" min={22} max={72} width="w-20" value={p.rowH()} onChange={p.setRowH} />

      <Btn onClick={p.onUndo}>{p.canUndo() ? 'Отменить перенос' : 'Отменять нечего'}</Btn>
      <Btn onClick={p.onReset}>Сбросить</Btn>
      <Note>броней: {p.count()}</Note>
    </Bar>
  )
}

function Slider(p: {
  label: string
  min: number
  max: number
  width: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <label class="flex items-center gap-1 text-sm">
      {p.label}
      <input
        type="range"
        class={`range range-xs ${p.width}`}
        min={p.min}
        max={p.max}
        value={p.value}
        onInput={(e) => p.onChange(Number(e.currentTarget.value))}
      />
      <span class="w-8 tabular-nums opacity-90">{p.value}</span>
    </label>
  )
}

/**
 * Во сколько создавать почасовую бронь. Выделение по СУТОЧНОЙ сетке даёт
 * только дату: попасть мышью в нужный час в колонке шириной в сутки нельзя,
 * поэтому время спрашивается отдельно — списком из кита, а не своим селектом.
 */
export function HourCreateModal(p: {
  open: () => boolean
  onClose: () => void
  hour: () => number
  setHour: (h: number) => void
  dur: () => number
  setDur: (h: number) => void
  onCreate: () => void
}): JSX.Element {
  return (
    <DumbModal
      open={p.open}
      onClose={p.onClose}
      title={<b>Новая бронь</b>}
      footer={
        <>
          <button class="btn btn-sm" onClick={p.onClose}>
            Отмена
          </button>
          <button class="btn btn-sm btn-primary" onClick={p.onCreate}>
            Создать
          </button>
        </>
      }
    >
      <p class="mb-3 text-sm">
        Выделение по суточной сетке даёт только дату: попасть мышью в нужный час в колонке шириной
        в сутки невозможно. Поэтому время — здесь, а не наугад.
      </p>
      <div class="flex flex-wrap gap-4">
        <DumbTimeSelect
          label="начало"
          value={() => `${String(p.hour()).padStart(2, '0')}:00` as Time}
          onChange={(t) => p.setHour(Number(t.slice(0, 2)))}
          step={60}
          openMin={8 * 60}
          closeMin={22 * 60}
        />
        <label class="text-sm">
          длительность
          <select
            class="select select-sm ml-2"
            value={p.dur()}
            onChange={(e) => p.setDur(Number(e.currentTarget.value))}
          >
            <For each={[1, 2, 3, 4, 6, 8]}>{(h) => <option value={h}>{h} ч</option>}</For>
          </select>
        </label>
      </div>
    </DumbModal>
  )
}

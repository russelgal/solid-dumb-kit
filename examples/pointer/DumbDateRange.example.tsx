// DumbDateRange — период двумя кликами, занятость видна ДО выбора.
//
// Главное здесь не календарь, а то, чего в календарях обычно нет: занятые дни
// перечёркнуты и не выбираются, а дни за ближайшей бронью гаснут — дотянуть
// туда всё равно нельзя, и человек узнаёт об этом до клика, а не после отказа.
//
// Дата — строка `YYYY-MM-DD`. Внутри UTC, поэтому часовой пояс не сдвигает
// сутки: в Владивостоке и Лиссабоне «12 августа» — один и тот же день.
import { createSignal } from 'solid-js'
import { DumbDateRange, addDays, daysBetween, today, type BusySpan, type Day } from '@solid-dumb-kit/date-range'
import { DumbToaster, toast } from '@solid-dumb-kit/toast'
import { Bar, Check, Note, Pick } from '../_controls'

const T = today()

/** Чужие брони: показываются всегда, выбрать их нельзя. */
const BUSY: Array<BusySpan> = [
  { from: addDays(T, 4), to: addDays(T, 7), title: 'Иванов · сайт' },
  { from: addDays(T, 15), to: addDays(T, 17), title: 'Ремонт' },
]

/** Цена дня — в углу ячейки; выходные дороже. */
const priceOf = (day: Day) => {
  const wd = new Date(day + 'T00:00:00Z').getUTCDay()
  return wd === 5 || wd === 6 ? 4900 : 3200
}

export default function DumbDateRangeExample() {
  const [range, setRange] = createSignal<{ from: Day; to: Day } | null>(null)
  const [single, setSingle] = createSignal(false)
  const [withBusy, setWithBusy] = createSignal(true)
  const [withPrice, setWithPrice] = createSignal(true)
  const [months, setMonths] = createSignal(2)
  const [minNights, setMinNights] = createSignal(1)

  const nights = () => {
    const r = range()
    return r ? daysBetween(r.from, r.to) : 0
  }

  const total = () => {
    const r = range()
    if (!r) return 0
    let sum = 0
    for (let d = r.from; d < r.to; d = addDays(d, 1)) sum += priceOf(d)
    return sum
  }

  return (
    <div class="p-5">
      <h3 class="mb-1 text-lg font-semibold">DumbDateRange — период с занятостью</h3>
      <p class="mb-3 max-w-[92ch] text-sm">
        Первый клик ставит начало, второй — конец. Клик по уже выбранному началу сбрасывает выбор.
        Перечёркнутые дни заняты; дни за ближайшей бронью приглушены — до них не дотянуться, и это
        видно заранее.
      </p>

      <Bar>
        <Check checked={single()} onChange={setSingle}>
          одна дата
        </Check>
        <Check checked={withBusy()} onChange={setWithBusy}>
          показывать занятость
        </Check>
        <Check checked={withPrice()} onChange={setWithPrice}>
          цены в ячейках
        </Check>
        <Pick
          label="месяцев"
          value={months()}
          options={[{ value: 1 }, { value: 2 }, { value: 3 }]}
          onChange={(v) => setMonths(Number(v))}
        />
        <Pick
          label="минимум ночей"
          value={minNights()}
          options={[{ value: 1 }, { value: 2 }, { value: 3 }, { value: 7 }]}
          onChange={(v) => setMinNights(Number(v))}
        />
      </Bar>

      <div class="mb-3 max-w-[70ch] rounded-box border border-base-300 p-4">
        <DumbDateRange
          value={range}
          onChange={setRange}
          single={single()}
          months={months()}
          minNights={single() ? undefined : minNights()}
          min={T}
          busy={() => (withBusy() ? BUSY : [])}
          dayExtra={withPrice() ? (day) => <>{Math.round(priceOf(day) / 100) / 10}к</> : undefined}
          // отказ объясняется словами: «нельзя» без причины бесит сильнее всего
          onReject={(why) => toast.error(why)}
        />
      </div>

      <p class="mb-3 text-sm">
        Выбрано:{' '}
        <b>
          {range() ? (single() ? range()!.from : `${range()!.from} → ${range()!.to}`) : '—'}
        </b>
        {!single() && range() ? (
          <>
            {' · '}
            {nights()} ноч. · {total().toLocaleString('ru-RU')} ₽
          </>
        ) : null}
      </p>

      <Note>
        Попробуй начать период до брони и дотянуть за неё: календарь не даст и скажет почему.
        Обратный порядок кликов тоже работает — концы меняются местами сами.
      </Note>

      <DumbToaster />
    </div>
  )
}

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
import { Bar, Check, Code, Doc, Note, Pick, Props } from '../_controls'
// Сниппеты доки живут отдельным файлом: их подсвечивает Shiki на сборке, и
// сюда приезжает уже готовая разметка (playground/snippets.ts).
import SNIP from './DumbDateRange.snippets'

const RANGE_PROPS = [
  {
    name: 'value',
    type: '() => { from: Day; to: Day } | null',
    about: 'Выбранный период. Day — строка YYYY-MM-DD, для одиночной даты to === from.',
  },
  { name: 'onChange', type: '(next) => void', about: 'Период выбран или сброшен.' },
  { name: 'single', type: 'boolean', def: 'false', about: 'Одна дата вместо периода.' },
  { name: 'busy', type: '() => BusySpan[]', about: 'Занятые отрезки: перечёркнуты и не дают через себя перепрыгнуть.' },
  {
    name: 'marks',
    type: '() => Record<Day, { title?, class? }>',
    about: 'Праздники и выходные: подсветить, но выбирать можно.',
  },
  { name: 'months', type: 'number', def: '1', about: 'Сколько месяцев показывать разом.' },
  { name: 'min / max', type: 'Day', about: 'Границы, за которые нельзя.' },
  { name: 'minNights / maxNights', type: 'number', about: 'Ограничение длины периода.' },
  { name: 'dayExtra', type: '(day: Day) => JSX.Element', about: 'Что дописать в углу дня — обычно цену за сутки.' },
  { name: 'onReject', type: '(why: string) => void', about: 'Выбрать не вышло: сюда приходит причина, готовая к показу.' },
]

const MATH_API = [
  { name: 'today / toDay', type: '() => Day / (d: Date) => Day', about: 'Сегодня и перевод даты в строку YYYY-MM-DD.' },
  { name: 'addDays / addMonths', type: '(day, n) => Day', about: 'Сдвиг без часовых поясов и мутаций.' },
  { name: 'daysBetween / diffDays', type: '(from, to) => number', about: 'Сколько суток между днями.' },
  { name: 'overlaps', type: '(a, b) => boolean', about: 'Пересекаются ли два отрезка — та же проверка, что у занятости.' },
  { name: 'checkRange', type: '(args) => { ok } | { ok: false, why }', about: 'Полная проверка периода: границы, длина, занятость. Ею же пользуется календарь.' },
  { name: 'monthGrid / weekIndex', type: '(day) => Day[][] / (day) => number', about: 'Сетка месяца и номер недели — для своей разметки календаря.' },
]

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


      <hr class="my-6 border-base-300" />

      <h4 class="text-lg font-semibold">Как это подключить</h4>
      <p class="mt-1 max-w-[92ch] text-sm">
        Пакет ставится отдельно от остального кита — потребитель берёт только то, что взял.
      </p>
      <Code title="Установка" code={SNIP.install} />

      <Doc title="День — это строка">
        <p>
          Никакого <code>Date</code> в API: день — <code>YYYY-MM-DD</code>, ровно то, что уезжает в
          базу и приходит с сервера. Часовые пояса и переходы на летнее время не участвуют вовсе, а
          сравнение дат превращается в сравнение строк.
        </p>
      </Doc>
      <Code title="Период" code={SNIP.basic} />

      <Doc title="Занятость и ограничения">
        <p>
          Занятые отрезки не только красятся, но и держат выбор: период, перепрыгивающий через
          занятое, не соберётся. Отказ приходит в <code>onReject</code> уже человеческой фразой —
          её можно сразу показать плашкой, а не переводить коды в текст.
        </p>
      </Doc>
      <Code title="Занято, праздники, пределы" code={SNIP.busy} />

      <Doc title="Цена в углу дня">
        <p>
          <code>dayExtra</code> дописывает в ячейку что угодно — тариф, остаток мест, значок. Для
          одной даты вместо периода есть <code>single</code>: тогда <code>to</code> совпадает с{' '}
          <code>from</code>, и форма работает с тем же типом.
        </p>
      </Doc>
      <Code title="Тариф и одиночная дата" code={SNIP.extra} />

      <Doc title="Арифметика отдельно от календаря">
        <p>
          Проверять занятость и считать ночи приходится и там, где календаря нет: на сервере, перед
          записью в базу, в отчёте. Поэтому вся математика выложена наружу тем же пакетом — и{' '}
          <code>checkRange</code> в приложении даёт тот же ответ, что и в интерфейсе.
        </p>
      </Doc>
      <Code title="Даты без разметки" code={SNIP.math} />

      <h4 class="mt-6 text-lg font-semibold">DumbDateRange</h4>
      <Props rows={RANGE_PROPS} />

      <h4 class="mt-6 text-lg font-semibold">Арифметика дат</h4>
      <Props rows={MATH_API} />

      <DumbToaster />
    </div>
  )
}

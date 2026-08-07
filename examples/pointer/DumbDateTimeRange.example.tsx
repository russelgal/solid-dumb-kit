// DumbDateTimeRange — период с временем: заезд 16:00, выезд 12:00.
//
// Два сценария: домик на несколько суток (время типовое, цена в углу дня) и
// переговорная внутри одних суток (период обводится протяжкой по слотам).
// Цены и брони — в `dateTimeData.ts`: они со стенда, обезличенные.
import { createSignal } from "solid-js";
import {
  DumbDateTimeRange,
  fmtLength,
  minutesBetween,
  type Moment,
} from "@solid-dumb-kit/date-range";
import { DumbToaster, toast } from "@solid-dumb-kit/toast";
import { Bar, Code, Doc, Note, Pick, Props } from "../_controls";
// Сниппеты доки живут отдельным файлом: их подсвечивает Shiki на сборке, и
// сюда приезжает уже готовая разметка (playground/snippets.ts).
import SNIP from "./DumbDateTimeRange.snippets";

const DT_PROPS = [
  {
    name: "value",
    type: "() => { from: Moment; to: Moment } | null",
    about: "Выбранный период. Moment — это { day: 'YYYY-MM-DD', time: 'HH:mm' }, обе части строками.",
  },
  { name: "onChange", type: "(next) => void", about: "Период выбран или сброшен." },
  { name: "busy", type: "() => BusyMoment[]", about: "Занятые отрезки с точностью до минуты. Конец НЕ включается." },
  {
    name: "mode",
    type: "'slots' | 'select'",
    def: "'slots'",
    about: "Лента слотов с протяжкой либо часы и минуты списками — для мелкого шага и телефона.",
  },
  { name: "step", type: "number", def: "30", about: "Шаг слотов в минутах." },
  {
    name: "openMin / closeMin",
    type: "number",
    about: "Рабочее окно, минуты от полуночи. Ночь вырезается: показывать слот в 03:00 — только мешать.",
  },
  { name: "defaultFromTime / defaultToTime", type: "Time", about: "Что предложить, когда день выбран, а слот ещё нет." },
  { name: "minMinutes / maxMinutes", type: "number", about: "Ограничение длительности." },
  { name: "months", type: "number", def: "1", about: "Сколько месяцев показывать разом." },
  { name: "min / max", type: "Day", def: "с сегодняшнего", about: "Границы выбора по дням." },
  {
    name: "dayExtra",
    type: "(day: Day) => JSX.Element",
    about: "Своё в углу дня — цена, остаток. На краях периода компонент рисует там время заезда и выезда.",
  },
  { name: "fromLabel / toLabel", type: "string", def: "«Заезд» / «Выезд»", about: "Подписи над лентами слотов." },
  { name: "onReject", type: "(why: string) => void", about: "Выбрать не вышло: причина готова к показу." },
];

const TIME_API = [
  { name: "toMin / toTime", type: "(t: Time) => number / (min) => Time", about: "Время в минуты от полуночи и обратно." },
  { name: "minutesBetween", type: "(from, to) => number", about: "Длительность периода в минутах." },
  { name: "fmtLength", type: "(min) => string", about: "Человеческая длительность: «1 ч 30 мин»." },
  { name: "overlapsMoment", type: "(a, b) => boolean", about: "Пересекаются ли отрезки времени." },
  { name: "checkMomentRange", type: "(args) => { ok } | { ok: false, why }", about: "Полная проверка периода — ею же пользуется виджет." },
  { name: "slotsOfDay / slotBusy", type: "(args) => Time[] / (...) => boolean", about: "Нарезать сутки на слоты и узнать, занят ли слот, — для своей разметки." },
  { name: "snapTime", type: "(t, step) => Time", about: "Подтянуть время к шагу сетки." },
];
import { HOTEL_BUSY, ROOM_BUSY, priceOf } from "./dateTimeData";

export default function DumbDateTimeRangeExample() {
  const [hotel, setHotel] = createSignal<{ from: Moment; to: Moment } | null>(
    null,
  );
  const [room, setRoom] = createSignal<{ from: Moment; to: Moment } | null>(
    null,
  );
  const [room2, setRoom2] = createSignal<{ from: Moment; to: Moment } | null>(
    null,
  );
  const [step, setStep] = createSignal(30);

  const summary = (v: { from: Moment; to: Moment } | null) =>
    v ? `${fmtLength(minutesBetween(v.from, v.to))}` : "—";

  return (
    <div class="p-5">
      <h3 class="mb-1 text-lg font-semibold">
        DumbDateTimeRange — период с временем
      </h3>
      <p class="mb-4 max-w-[92ch] text-sm">
        Сутки берутся календарём, время — слотами. Занятый слот заштрихован и не
        нажимается, а касание концами занятостью не считается: гость выезжает в
        12:00, следующий заезжает в 16:00 — день общий, и это нормально.
      </p>

      <div class="mb-6 rounded-box border border-base-300 p-4">
        <h4 class="mb-2 font-semibold">Домик · заезд 16:00, выезд 12:00</h4>
        <p class="mb-2 max-w-[92ch] text-sm">
          Цены и брони — со стенда, обезличенные. Обведи период мышью: цена ночи стоит в углу дня,
          а на краях периода её сменяет время заезда и выезда. Панель снизу правит часы, не сходя
          с календаря.
        </p>
        <DumbDateTimeRange
          value={hotel}
          onChange={setHotel}
          busy={() => HOTEL_BUSY}
          step={60}
          openMin={8 * 60}
          closeMin={22 * 60}
          defaultFromTime="16:00"
          defaultToTime="12:00"
          months={2}
          minMinutes={12 * 60}
          dayExtra={(day) => <>{Math.round(priceOf(day) / 1000)}к</>}
          onReject={(why) => toast.error(why)}
        />
        <p class="mt-3 text-sm">
          Выбрано: <b>{summary(hotel())}</b>
        </p>
      </div>

      <div class="mb-6 rounded-box border border-base-300 p-4">
        <h4 class="mb-2 font-semibold">
          Переговорная · период тянется по слотам
        </h4>
        <p class="mb-2 max-w-[92ch] text-sm">
          Выбери <b>один</b> день в календаре — слоты станут одной лентой, и
          период обводится нажатием и протяжкой, как в календаре. Протяжка
          упирается в занятое, а не идёт сквозь: дотянуть сквозь планёрку не
          выйдет.
        </p>
        <Bar>
          <Pick
            label="шаг"
            value={step()}
            options={[{ value: 15 }, { value: 30 }, { value: 60 }]}
            onChange={(v) => setStep(Number(v))}
          />
        </Bar>
        <DumbDateTimeRange
          value={room}
          onChange={setRoom}
          busy={() => ROOM_BUSY}
          step={step()}
          openMin={9 * 60}
          closeMin={20 * 60}
          minMinutes={step()}
          maxMinutes={4 * 60}
          fromLabel="С"
          toLabel="До"
          onReject={(why) => toast.error(why)}
        />
        <p class="mt-3 text-sm">
          Выбрано: <b>{summary(room())}</b>
        </p>
      </div>

      <div class="rounded-box border border-base-300 p-4">
        <h4 class="mb-2 font-semibold">То же самое списками</h4>
        <p class="mb-2 max-w-[92ch] text-sm">
          <code>mode="select"</code> — часы и минуты выпадающими списками (
          <code>DumbTimeSelect</code>). Так удобнее при мелком шаге и в тесной
          форме, а на телефоне это родное колесо. Занятый час в списке помечен и
          не выбирается.
        </p>
        <DumbDateTimeRange
          value={room2}
          onChange={setRoom2}
          busy={() => ROOM_BUSY}
          mode="select"
          step={15}
          openMin={9 * 60}
          closeMin={20 * 60}
          fromLabel="С"
          toLabel="До"
          onReject={(why) => toast.error(why)}
        />
        <p class="mt-3 text-sm">
          Выбрано: <b>{summary(room2())}</b>
        </p>
      </div>

      <Note>
        Попробуй занять переговорную с 11:00 на два часа: слоты внутри планёрки
        заштрихованы, и дотянуть сквозь них не выйдет — компонент скажет, кто
        занял. Максимум здесь 4 часа, минимум — один шаг сетки.
      </Note>


      <hr class="my-6 border-base-300" />

      <h4 class="text-lg font-semibold">Как это подключить</h4>
      <p class="mt-1 max-w-[92ch] text-sm">
        Живёт в том же пакете, что и календарь дат.
      </p>
      <Code title="Установка" code={SNIP.install} />

      <Doc title="День и время — строками">
        <p>
          Момент — это <code>{"{ day: '2026-06-14', time: '14:00' }"}</code>: обе части строки, ровно
          в том виде, в каком уезжают в базу. <code>Date</code> с часовыми поясами в API не
          участвует, а сравнение сводится к минутам от полуночи.
        </p>
      </Doc>
      <Code title="Период с временем" code={SNIP.basic} />

      <Doc title="Занятость до минуты">
        <p>
          Конец отрезка НЕ включается: запись 14:00–15:00 не мешает следующей начаться ровно в
          15:00 — иначе в расписании появлялись бы мёртвые щели. Занятые слоты заштрихованы, а не
          просто перекрашены: это видно и в чёрно-белой печати, и дальтонику.
        </p>
      </Doc>
      <Code title="Занято, минимум и максимум" code={SNIP.busy} />

      <Doc title="Два способа выбрать время">
        <p>
          Лента слотов хороша, когда важно ВИДЕТЬ занятость: свободное окно охватываешь глазами, а
          период тянется протяжкой, как в календаре. Списки часов и минут выигрывают на мелком шаге
          и на телефоне, где <code>&lt;select&gt;</code> даёт родное колесо. Это же поле доступно
          отдельно — <code>DumbTimeSelect</code>.
        </p>
      </Doc>
      <Code title="slots, select и отдельное поле" code={SNIP.modes} />

      <Doc title="Арифметика времени отдельно">
        <p>
          Те же проверки нужны на сервере и перед записью в базу, поэтому математика выложена
          наружу: <code>checkMomentRange</code> в приложении даёт тот же ответ, что и виджет, а{' '}
          <code>slotsOfDay</code> нарежет сутки для своей разметки.
        </p>
      </Doc>
      <Code title="Время без разметки" code={SNIP.math} />

      <h4 class="mt-6 text-lg font-semibold">DumbDateTimeRange</h4>
      <Props rows={DT_PROPS} />

      <h4 class="mt-6 text-lg font-semibold">Арифметика времени</h4>
      <Props rows={TIME_API} />

      <DumbToaster />
    </div>
  );
}

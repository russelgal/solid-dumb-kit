// DumbTimeline — шахматка: номера × дни, брони полосами.
//
// Полосы двигаются и растягиваются по суткам. Место каждой считается ИЗ ДАТ
// (`сутки × ширина колонки`), а не измеряется, поэтому за жест не происходит ни
// одного forced layout — на сетке в три месяца это разница между «едет» и
// «дёргается».
//
// Занято — значит занято: полоса краснеет ещё в полёте, а на отпускании
// прыгает в ближайшее свободное место, а не отменяется. Отказ без вариантов
// злит сильнее всего.
import { createSignal, For, Show, onCleanup, onMount } from "solid-js";
import { DumbTimeline, SCALES, type Span } from "@solid-dumb-kit/timeline";
import { DumbDateRange, DumbTimeSelect, today, type Day, type Time } from "@solid-dumb-kit/date-range";
import { DumbModal } from "@solid-dumb-kit/modal";
import { DumbToaster, toast } from "@solid-dumb-kit/toast";
import { DumbContextMenu, DumbPopover } from "@solid-dumb-kit/context-menu";
import { createUndoStack } from "@solid-dumb-kit/shared";
import { Code, Doc, Note, Props } from "../_controls";
// Сниппеты доки живут отдельным файлом: их подсвечивает Shiki на сборке, и
// сюда приезжает уже готовая разметка (playground/snippets.ts).
import SNIP from "./DumbTimeline.snippets";

const TIMELINE_PROPS = [
  { name: "rows", type: "TimelineRow[]", about: "Строки-ресурсы: номера, залы, мастера." },
  { name: "spans", type: "Span[]", about: "Полосы. Момент — строка 'YYYY-MM-DD' или 'YYYY-MM-DDTHH:mm'." },
  {
    name: "scale",
    type: "Partial<Scale>",
    about: "Шкала целиком, обычно из SCALES: hotel, sauna, gazebo. Плоские пропсы ниже работают поверх неё как оверрайды.",
  },
  { name: "from / days", type: "string / number", about: "Первый день сетки и сколько дней показывать." },
  {
    name: "stepMin",
    type: "number",
    about: "Единица сетки в минутах. 1440 — сутки, 60 — час: отдельного «режима суток» нет.",
  },
  { name: "dayStart / dayEnd", type: "number", about: "Рабочее окно дня, минуты от полуночи. Вне окна сетки нет вовсе." },
  { name: "snapMin", type: "number", def: "= колонка", about: "Шаг перемещения. Сетка почасовая, а сеанс по два часа — это snapMin: 120 при stepMin: 60." },
  { name: "gapMin", type: "number", about: "Зазор между соседями: полчаса на уборку, когда время формально свободно, а ставить нельзя." },
  { name: "minMin", type: "number", about: "Самая короткая полоса на всей сетке; у строки бывает своя." },
  {
    name: "onChange",
    type: "(next, prev, kind) => void | boolean | Promise",
    about: "Перенесли или растянули. Вернули false — полоса встанет обратно. kind: move, resize-from, resize-to.",
  },
  { name: "onOpen", type: "(span, at) => void", about: "Клик по полосе. Точка приходит вторым аргументом — карточку ставят рядом с бронью." },
  { name: "onEmptyClick", type: "(at, row) => void", about: "Клик по пустой клетке — обычно «создать»." },
  {
    name: "onRangeSelect",
    type: "({ row, from, to, needsTime }) => void",
    about: "Протянули по пустому. needsTime — время из жеста не вытащить (сетка суточная), его надо спросить.",
  },
  { name: "checkIn / checkOut", type: "number", about: "Во что превращать дату без времени: 16:00 и 12:00 в гостинице — тогда в день пересменки видно обе брони." },
  { name: "summary / summaryTitle", type: "(at) => JSX.Element", about: "Строка сводки над сеткой: свободно, выручка. На неё смотрят чаще, чем на брони." },
  { name: "now", type: "Moment", about: "Момент «сейчас» для вертикальной линии. Не задан — линии нет." },
  { name: "dayClass / dayLabel / groupLabel", type: "(at) => …", about: "Пометить и подписать колонку: выходной, праздник, нерабочий час." },
  { name: "colW / rowH / headW", type: "number", def: "34 / 34 / 200", about: "Ширина суток, высота строки и колонка с названиями, px." },
];
import { HourCreateModal, TimelineControls, type Mode } from "./timelineParts";
import {
  ALL, ALL_ROWS, ROOMS, SEED, TONE, VENUES, VENUE_ROWS, shiftDay, start, unitOf,
  type Booking,
} from "./timelineData";

export default function DumbTimelineExample() {
  /**
   * Режим живёт В АДРЕСЕ (`?tl=venues`), а не только в памяти вкладки: ссылкой
   * на конкретную сетку можно поделиться, обновление страницы её не теряет, а
   * «назад» возвращает предыдущую.
   *
   * Именно в `search`, а не в хеше: хеш витрина разбирает как имя вкладки.
   */
  // сам список режимов живёт в панели (`timelineParts`), здесь нужен только
  // разбор адреса
  const MODES = ["all", "hotel", "venues"] as const;
  const fromUrl = (): Mode => {
    const v = new URLSearchParams(location.search).get("tl") ?? "";
    return (MODES as readonly string[]).includes(v) ? (v as Mode) : "all";
  };

  const [mode, setModeRaw] = createSignal<Mode>(fromUrl());
  const setMode = (next: Mode) => {
    setModeRaw(next);
    const url = new URL(location.href);
    // «всё вместе» — состояние по умолчанию, и в адресе ему делать нечего
    if (next === "all") url.searchParams.delete("tl");
    else url.searchParams.set("tl", next);
    history.pushState(null, "", url);
  };

  // «назад» и «вперёд» должны переключать режим, а не только вкладку витрины
  onMount(() => {
    const onPop = () => setModeRaw(fromUrl());
    window.addEventListener("popstate", onPop);
    onCleanup(() => window.removeEventListener("popstate", onPop));
  });
  /**
   * Масштаб сетки — настройка ПОЛЬЗОВАТЕЛЯ, а не константа примера: на большом
   * мониторе хочется видеть месяц целиком, на ноутбуке — читаемые подписи.
   * Ширина колонки у суточной и часовой сетки своя: сутки и час — разные вещи,
   * и один ползунок на обе давал бы либо кашу, либо простыню.
   */
  const num = (key: string, def: number) => {
    const v = Number(localStorage.getItem(`tl:${key}`));
    return Number.isFinite(v) && v > 0 ? v : def;
  };
  const [dayW, setDayW] = createSignal(num("dayW", 34));
  const [hourW, setHourW] = createSignal(num("hourW", 34));
  const [rowH, setRowH] = createSignal(num("rowH", 36));
  const keep = (key: string, v: number) => {
    try {
      localStorage.setItem(`tl:${key}`, String(v));
    } catch {
      /* приватный режим — не беда, это удобство, а не данные */
    }
  };

  // часы заезда и выезда: от них зависит, где начинается и кончается полоса
  const [checkIn, setCheckIn] = createSignal(16);
  const [checkOut, setCheckOut] = createSignal(12);
  // каждый режим держит СВОИ брони: правится всё, а не только номера
  const [spans, setSpans] = createSignal<Array<Booking>>(SEED);
  const [venues, setVenues] = createSignal<Array<Booking>>(VENUES);
  const [all, setAll] = createSignal<Array<Booking>>(ALL);
  /** что создаём почасово: строка и сутки, время спросим отдельно */
  const [askTime, setAskTime] = createSignal<{ row: string; day: Day } | null>(
    null,
  );
  const [hour, setHour] = createSignal(12);
  const [dur, setDur] = createSignal(2);
  // Дней на экране. Дефолт недельный: на почасовой сетке день — это 24 колонки,
  // и месяц целиком превращается в семьсот колонок, по которым только скроллить
  const [days, setDays] = createSignal(7);

  /**
   * Сетка, строки и данные меняются вместе: это три разных бизнеса на ОДНОМ
   * компоненте, и отличаются они только шкалой.
   */
  const view = () => {
    if (mode() === "all") {
      /*
        Сетка ПОЧАСОВАЯ — та же, что у площадок, и по той же причине: час
        нельзя нарисовать в колонке шириной в сутки. Раньше здесь были сутки,
        и все брони площадок сжимались в засечки шириной в пиксель — видно, что
        занято, и больше ничего.

        Проживанию часовая шкала не мешает: строка помечена `unit: 'day'`,
        заезд и выезд подставляет шкала (`checkIn`/`checkOut`), поэтому полоса
        по-прежнему начинается в 16:00 и кончается в 12:00 — только теперь это
        видно по часам, а не подразумевается.
      */
      return {
        rows: ALL_ROWS,
        data: all(),
        set: setAll,
        scale: {
          ...SCALES.venues(start, days(), hourW()),
          checkIn: checkIn() * 60,
          checkOut: checkOut() * 60,
        },
        gap: 0,
        days: days(),
      };
    }
    if (mode() === "venues") {
      // правила НЕ здесь: минимум, зазор и окно каждая строка несёт сама.
      // Колонка-час узкая — неделя круглосуточной сетки влезает в экран
      return {
        rows: VENUE_ROWS,
        data: venues(),
        set: setVenues,
        scale: SCALES.venues(start, days(), hourW()),
        gap: 0,
        days: days(),
      };
    }
    return {
      rows: ROOMS,
      data: spans(),
      set: setSpans,
      // часы берём из контролов, а не из пресета: на них и видно, как
      // сдвигаются края полос и щель на пересменку
      scale: {
        ...SCALES.hotel(start, days(), dayW()),
        checkIn: checkIn() * 60,
        checkOut: checkOut() * 60,
      },
      gap: 0,
      days: days(),
    };
  };
  const [picked, setPicked] = createSignal<Booking | null>(null);
  /** где нажали — карточка встаёт там же, а не по центру экрана */
  const [cardAt, setCardAt] = createSignal<{ x: number; y: number } | null>(null);
  const [newFor, setNewFor] = createSignal<{ day: Day; row: string } | null>(
    null,
  );
  const [range, setRange] = createSignal<{ from: Day; to: Day } | null>(null);
  const [, bump] = createSignal(0, { equals: false });
  const undo = createUndoStack({ onChange: () => bump(0) });

  /** занятость выбранного номера — календарю, чтобы не дать выбрать занятое */
  const busyOf = (room: string) =>
    spans()
      .filter((s) => s.row === room)
      .map((s) => ({ from: s.from, to: s.to, title: s.guest }));

  /** перенос и растяжение — одинаково для всех трёх режимов */
  const move = (
    next: Booking,
    prev: Booking,
    kind: "move" | "resize-from" | "resize-to" = "move",
  ) => {
    const set = view().set;
    const put = (b: Booking) =>
      set((all) => all.map((s) => (s.id === b.id ? b : s)));
    put(next);
    undo.push({
      label: `${prev.guest}: ${prev.row} ${prev.from.slice(5)}`,
      // тело в скобках: колбэк обязан отдавать void, а `put` возвращает массив
      undo: async () => { put(prev); },
      redo: async () => { put(next); },
    });
    // время показываем только там, где оно есть: в сутках оно шум
    const when = (m: string) =>
      m.length > 10 ? m.slice(5).replace("T", " ") : m.slice(5);
    // перенос и растяжение — разные события, `kind` их и различает
    const verb = kind === "move" ? "перенос" : "продление";
    toast.info(
      `${verb} · ${next.guest}: ${next.row}, ${when(next.from)} → ${when(next.to)}`,
      {
        action: { label: "Отменить", run: () => void undo.undo() },
      },
    );
  };

  return (
    <div class="p-5 text-base-content">
      <h3 class="mb-1 text-lg font-semibold">DumbTimeline — шахматка</h3>
      <p class="mb-2 max-w-[92ch] text-sm text-base-content">
        Тащи бронь за середину — переедет по суткам и строкам; за край —
        растянется. Занятое место видно <b>в полёте</b>: полоса краснеет.
        Отпустил на занятом — прыгнет в ближайшее свободное. Правый клик по
        брони — меню, клик по пустой клетке — создать.
      </p>
      <p class="mb-2 max-w-[92ch] text-sm text-base-content">
        <b>Всё вместе</b> — проживание и площадки в одной шахматке, и сетка тут
        <b> почасовая</b>: строка знает, чем торгует (
        <code>unit: 'day' | 'hour'</code>), а вот час нарисовать в колонке
        шириной в сутки нельзя. Правила площадок работают ровно те же, что на
        отдельной вкладке — окна, минимумы, уборка. Номеру часовая шкала не
        мешает: полоса начинается в 16:00 и кончается в 12:00, только теперь это
        видно по часам. Протянешь по номеру — спросим даты, по бане — создадим
        сразу.
      </p>
      <p class="mb-2 max-w-[92ch] text-sm text-base-content">
        <b>Площадки</b> — сетка круглосуточная и одна, а правила у каждой
        строки <b>свои</b>: баню топят и ночью (окна нет вовсе), пейнтбол — с
        10:00 до 22:00, беседки с 12:00 до 23:00, банкетный зал и веранда с
        14:00 — закрытые часы заштрихованы, туда не поставить и не перетащить.
        Баня продаётся от двух часов и после каждого сеанса полчаса уборки
        (штрихованный хвост за полосой), пейнтбол — от часа и с часом
        перезарядки. Выделил бане один час — получишь два: короче минимума не
        продаём.
      </p>
      <p class="mb-2 max-w-[92ch] text-sm text-base-content">
        Сутки тут <b>не календарные</b>: заезд с 16:00, выезд до 12:00. Полоса
        начинается в двух третях дня заезда и кончается в половине дня выезда,
        поэтому в день пересменки видно
        <b> обе</b> брони и щель между ними — ту самую, в которую укладывается
        уборка. Нарисуй сутки целиком, и день выезда выглядел бы занятым, хотя
        номер уже свободен.
      </p>
      <p class="mb-3 max-w-[92ch] text-sm text-base-content">
        Место полосы считается из дат, а не измеряется: за жест —{" "}
        <b>ни одного</b> <code>getBoundingClientRect</code> по элементам.
        Единственное чтение DOM — координаты сетки, один раз на старте, через{" "}
        <code>IntersectionObserver</code>.
      </p>

      <TimelineControls
        mode={mode}
        setMode={setMode}
        days={days}
        setDays={setDays}
        checkIn={checkIn}
        setCheckIn={setCheckIn}
        checkOut={checkOut}
        setCheckOut={setCheckOut}
        colW={() => (mode() === "hotel" ? dayW() : hourW())}
        setColW={(v) => {
          // у суточной и часовой сетки свой масштаб, и помним мы их порознь
          if (mode() === "hotel") { setDayW(v); keep("dayW", v); }
          else { setHourW(v); keep("hourW", v); }
        }}
        rowH={rowH}
        setRowH={(v) => { setRowH(v); keep("rowH", v); }}
        canUndo={undo.canUndo}
        onUndo={() => void undo.undo()}
        onReset={() => { setSpans(SEED); setVenues(VENUES); setAll(ALL); }}
        count={() => spans().length}
      />

      <DumbTimeline<Booking>
        rows={view().rows}
        spans={view().data}
        // шкала — пресетом ЦЕЛИКОМ: first/days/colW уже внутри, раскладывать
        // её на восемь плоских пропсов больше не нужно
        scale={view().scale}
        rowH={rowH()}
        gapMin={view().gap}
        showRoom={mode() !== "hotel"}
        class="rounded-box border border-base-300"
        style={{ "max-height": "54vh" }}
        dayClass={(at) => {
          const wd = new Date(`${at.slice(0, 10)}T00:00:00Z`).getUTCDay();
          // в часовых сетках красим стык суток — на круглосуточной это полночь
          if (mode() !== "hotel")
            return at.slice(11, 16) === "00:00"
              ? "border-l-2 border-base-content/30"
              : "";
          return wd === 0 || wd === 6 ? "bg-base-200" : "";
        }}
        now={`${today()}T14:00`}
        summaryTitle="Свободно"
        // на часовой линейке строка сводки не нужна: колонка-час узкая, и
        // одно и то же число повторялось бы 24 раза на день
        summary={mode() !== "hotel" ? undefined : (at) => {
          // сколько номеров свободно в эти сутки — та самая строка, на которую
          // в системах бронирования смотрят чаще, чем на сами брони
          const day = at.slice(0, 10);
          const busy = new Set(
            view()
              .data.filter(
                (s) => s.from.slice(0, 10) <= day && day < s.to.slice(0, 10),
              )
              .map((s) => s.row),
          );
          return view().rows.length - busy.size;
        }}
        onChange={move}
        onRangeSelect={({ row, from, to, needsTime }) => {
          // Почасовой ресурс на суточной сетке: в колонку шириной в сутки не
          // прицелиться в 14:00, поэтому не угадываем, а спрашиваем.
          if (needsTime) {
            setAskTime({ row, day: from.slice(0, 10) });
            return;
          }
          // Почасовая сетка отдаёт точное время — создаём сразу. Минимум уже
          // подтянут компонентом: выделил бане час — пришло два.
          //
          // Решает ЕДИНИЦА СТРОКИ, а не режим: в «всё вместе» на одной и той же
          // часовой сетке живут и баня (создаём сразу), и номер (спросим даты).
          if (unitOf(view().rows, row) === "hour") {
            view().set((was) => [
              ...was,
              { id: `v${Date.now()}`, row, from, to, guest: "новая", kind: "сайт" },
            ]);
            toast.success(`создано: ${from.slice(11)} → ${to.slice(11)}`);
            return;
          }
          // суточная строка: открываем форму с уже выбранным периодом —
          // молча создавать бронь протяжкой слишком лихо.
          // На часовой сетке выделение может уложиться внутрь одних суток —
          // тогда это ноль ночей, и календарю нужен хотя бы завтрашний день
          const day = from.slice(0, 10);
          const till = to.slice(0, 10);
          setRange({ from: day, to: till > day ? till : shiftDay(day, 1) });
          setNewFor({ row, day });
        }}
        onOpen={(b, at) => {
          setPicked(b);
          setCardAt(at);
        }}
      >
        {(s) => (
          <span
            class="truncate"
            style={{
              // цвет по типу брони: своя раскраска — дело потребителя
              "--dumb-tl-span-bg": TONE[s.kind],
              background: TONE[s.kind],
              position: "absolute",
              inset: "0",
              "border-radius": "6px",
              padding: "0 6px",
              display: "flex",
              "align-items": "center",
            }}
          >
            {s.guest}
          </span>
        )}
      </DumbTimeline>

      {/* создание брони: календарь показывает занятость выбранного номера */}
      <DumbModal
        open={() => newFor() !== null}
        onClose={() => setNewFor(null)}
        title={`Новая бронь · номер ${newFor()?.row ?? ""}`}
        width="min(680px, 94vw)"
        footer={
          <>
            <button class="btn btn-sm" onClick={() => setNewFor(null)}>
              Отмена
            </button>
            <button
              class="btn btn-sm btn-primary"
              disabled={!range()}
              onClick={() => {
                const r = range();
                const at = newFor();
                if (!r || !at) return;
                view().set((all) => [
                  ...all,
                  {
                    id: `n${Date.now()}`,
                    row: at.row,
                    from: r.from,
                    to: r.to,
                    guest: "новая",
                    kind: "сайт",
                  },
                ]);
                toast.success("бронь создана");
                setRange(null);
                setNewFor(null);
              }}
            >
              Создать
            </button>
          </>
        }
      >
        <DumbDateRange
          value={range}
          onChange={setRange}
          months={2}
          minNights={1}
          busy={() => (newFor() ? busyOf(newFor()!.row) : [])}
          onReject={(why) => toast.error(why)}
        />
        <p class="mt-2 text-sm">
          Занятые дни перечёркнуты и не выбираются, а дни за ближайшей бронью
          гаснут — дотянуть туда всё равно нельзя.
        </p>
      </DumbModal>

      {/* Карточка брони — ПОПОВЕР у самой брони, а не модалка по центру:
          та закрывала бы ровно то, о чём рассказывает. */}
      <DumbPopover
        at={cardAt}
        onClose={() => {
          setPicked(null);
          setCardAt(null);
        }}
        title={picked()?.guest}
        footer={
          <button
            class="btn btn-xs"
            onClick={() => {
              setPicked(null);
              setCardAt(null);
            }}
          >
            Закрыть
          </button>
        }
      >
        <dl class="text-sm">
          <For
            each={
              [
                ["Ресурс", picked()?.row],
                ["Начало", picked()?.from.replace("T", " ")],
                ["Конец", picked()?.to.replace("T", " ")],
                ["Источник", picked()?.kind],
              ] as const
            }
          >
            {([k, v]) => (
              <div class="flex gap-2 py-0.5">
                <dt class="w-20 opacity-70">{k}</dt>
                <dd class="font-medium">{v}</dd>
              </div>
            )}
          </For>
        </dl>
      </DumbPopover>

      <DumbContextMenu
        items={() => [
          {
            label: "Открыть карточку",
            run: () => picked() ?? toast.info("сначала выбери бронь"),
          },
          { label: "Сдвинуть на день", run: () => toast.info("сдвинули") },
          { kind: "separator" as const },
          {
            label: "Отменить бронь",
            danger: true,
            run: async () => {
              const ok = await toast.confirm("Отменить бронь?", {
                yes: "Отменить",
                danger: true,
                at: "pointer",
              });
              if (ok) toast.success("бронь отменена");
            },
          },
        ]}
      />
      {/* Выбор времени для почасового ресурса, выделенного на СУТОЧНОЙ сетке:
          в колонку шириной в сутки не прицелиться в 14:00, поэтому спрашиваем,
          а не угадываем. */}
      <HourCreateModal
        open={() => askTime() !== null}
        onClose={() => setAskTime(null)}
        hour={hour}
        setHour={setHour}
        dur={dur}
        setDur={setDur}
        onCreate={() => {
          const at = askTime();
          if (!at) return;
          const hh = String(hour()).padStart(2, "0");
          const end = String(hour() + dur()).padStart(2, "0");
          view().set((was) => [
            ...was,
            { id: `h${Date.now()}`, row: at.row, from: `${at.day}T${hh}:00`,
              to: `${at.day}T${end}:00`, guest: "новая", kind: "сайт" },
          ]);
          toast.success(`создано: ${hh}:00 → ${end}:00`);
          setAskTime(null);
        }}
      />


      <hr class="my-6 border-base-300" />

      <h4 class="text-lg font-semibold">Как это подключить</h4>
      <p class="mt-1 max-w-[92ch] text-sm">
        Пакет ставится отдельно от остального кита — потребитель берёт только то, что взял.
      </p>
      <Code title="Установка" code={SNIP.install} />

      <Doc title="Строки, полосы и шкала">
        <p>
          Шахматка — это ресурсы по вертикали и время по горизонтали. Шкала передаётся ОДНИМ
          пропом, обычно готовым пресетом: раньше её приходилось раскладывать на восемь плоских
          значений, и рассинхрон между ними был вопросом времени.
        </p>
      </Doc>
      <Code title="Гостиница на 30 суток" code={SNIP.basic} />

      <Doc title="Сутки — частный случай">
        <p>
          Отдельного «режима суток» нет: всё задаётся шагом сетки и рабочим окном дня. Ночь можно
          вырезать — тогда после <code>dayEnd</code> сразу идёт утро следующего дня, и одиннадцать
          пустых часов не занимают половину экрана.
        </p>
      </Doc>
      <Code title="Гостиница, баня, беседка" code={SNIP.scales} />

      <Doc title="Своего состояния у кита нет">
        <p>
          Позиция полосы ВСЕГДА считается из <code>spans</code>. Поэтому отказ сервера не требует
          отката: не записал новые даты — полоса вернулась сама. А <code>kind</code> отличает
          перенос от растяжения: для бизнеса «перенесено» и «продлено» — разные события.
        </p>
      </Doc>
      <Code title="Сохранить или отменить" code={SNIP.change} />

      <Doc title="Создание и карточка">
        <p>
          Клик по пустому месту и протяжка по нему — это «создать». Если строка почасовая, а сетка
          суточная, точное время из жеста не вытащить: в колонку шириной в сутки не прицелиться в
          14:00. Кит честно говорит об этом флагом <code>needsTime</code>, вместо того чтобы
          угадать и ошибиться.
        </p>
      </Doc>
      <Code title="Клики по сетке" code={SNIP.create} />

      <Doc title="Сводка и разметка колонок">
        <p>
          Над сеткой можно вывести строку итогов — в системах бронирования смотрят на неё чаще, чем
          на сами брони. Колонки помечаются своим классом (выходной, праздник), а вертикальная
          линия «сейчас» появляется, если передать момент.
        </p>
      </Doc>
      <Code title="Итоги и оформление" code={SNIP.look} />

      <h4 class="mt-6 text-lg font-semibold">DumbTimeline</h4>
      <Props rows={TIMELINE_PROPS} />

      <DumbToaster />
    </div>
  );
}

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
import { DumbDateRange, today, type Day } from "@solid-dumb-kit/date-range";
import { DumbModal } from "@solid-dumb-kit/modal";
import { DumbToaster, toast } from "@solid-dumb-kit/toast";
import { DumbContextMenu, DumbPopover } from "@solid-dumb-kit/context-menu";
import { createUndoStack } from "@solid-dumb-kit/shared";
import { Bar, Note, Btn, Pick } from "../_controls";

type Booking = Span & { guest: string; kind: "сайт" | "телефон" | "блок" };

const ROOMS = [
  { id: "101", title: "101 · стандарт", group: "Стандарт" },
  { id: "102", title: "102 · стандарт", group: "Стандарт" },
  { id: "103", title: "103 · твин", group: "Стандарт" },
  { id: "201", title: "201 · полулюкс", group: "Полулюкс" },
  { id: "202", title: "202 · люкс", group: "Люкс" },
  { id: "203", title: "203 · люкс", group: "Люкс" },
];

const start = today();
const shiftDay = (d: string, n: number) =>
  new Date(new Date(`${d}T00:00:00Z`).getTime() + n * 86_400_000)
    .toISOString()
    .slice(0, 10);

const B = (
  id: string,
  row: string,
  from: number,
  nights: number,
  guest: string,
  kind: Booking["kind"] = "сайт",
): Booking => ({
  id,
  row,
  from: shiftDay(start, from),
  to: shiftDay(start, from + nights),
  guest,
  kind,
});

/* ── площадки: сетка одна, ПРАВИЛА у каждой строки свои ────────────────── */

/**
 * Площадки — ОДИН список на обе вкладки: и на почасовую, и на универсальную.
 * Дублировать его было бы верным способом развести два набора правил, которые
 * потом разойдутся молча.
 *
 * У каждой строки свои правила, и они не выдуманы: баня топится круглосуточно,
 * пейнтбол в темноте не играет, у зала своё окно, а между сеансами нужна
 * уборка. Компонент читает их из строки — `minMin`, `gapMin`, `openMin`,
 * `closeMin`.
 */
const VENUE_ROWS = [
  // ── бани: сеанс от двух часов, после каждого полчаса уборки, окна нет ──
  { id: "ban1", title: "Баня русская · от 2 ч", group: "Бани",
    unit: "hour" as const, minMin: 120, gapMin: 30 },
  { id: "ban2", title: "Баня финская · от 2 ч", group: "Бани",
    unit: "hour" as const, minMin: 120, gapMin: 30 },
  { id: "ban3", title: "Хамам · от 2 ч", group: "Бани",
    unit: "hour" as const, minMin: 120, gapMin: 30 },
  { id: "ban4", title: "Баня на дровах · от 3 ч", group: "Бани",
    unit: "hour" as const, minMin: 180, gapMin: 60 },
  { id: "cha", title: "Купель · от 1 ч", group: "Бани",
    unit: "hour" as const, minMin: 60, gapMin: 30 },

  // ── активности: у каждой своё окно и свой перерыв ──
  { id: "pb", title: "Пейнтбол · от 1 ч · 10–22", group: "Активности",
    unit: "hour" as const, minMin: 60, gapMin: 60,
    openMin: 10 * 60, closeMin: 22 * 60 },
  { id: "las", title: "Лазертаг · от 1 ч · 10–22", group: "Активности",
    unit: "hour" as const, minMin: 60, gapMin: 30,
    openMin: 10 * 60, closeMin: 22 * 60 },
  { id: "kar", title: "Картинг · от 30 мин · 10–21", group: "Активности",
    unit: "hour" as const, minMin: 30, gapMin: 15,
    openMin: 10 * 60, closeMin: 21 * 60 },
  { id: "kvest", title: "Квест-комната · 1 ч · 11–23", group: "Активности",
    unit: "hour" as const, minMin: 60, gapMin: 30,
    openMin: 11 * 60, closeMin: 23 * 60 },
  { id: "tir", title: "Тир · от 30 мин · 11–21", group: "Активности",
    unit: "hour" as const, minMin: 30, gapMin: 15,
    openMin: 11 * 60, closeMin: 21 * 60 },

  // ── спорт: длинные окна, зазор не нужен ──
  { id: "ten1", title: "Корт теннисный №1 · 8–22", group: "Спорт",
    unit: "hour" as const, minMin: 60, openMin: 8 * 60, closeMin: 22 * 60 },
  { id: "ten2", title: "Корт теннисный №2 · 8–22", group: "Спорт",
    unit: "hour" as const, minMin: 60, openMin: 8 * 60, closeMin: 22 * 60 },
  { id: "vol", title: "Волейбол пляжный · 9–21", group: "Спорт",
    unit: "hour" as const, minMin: 60, openMin: 9 * 60, closeMin: 21 * 60 },
  { id: "gym", title: "Спортзал · 7–23", group: "Спорт",
    unit: "hour" as const, minMin: 60, openMin: 7 * 60, closeMin: 23 * 60 },
  { id: "pool", title: "Бассейн · дорожка · 7–22", group: "Спорт",
    unit: "hour" as const, minMin: 60, gapMin: 15,
    openMin: 7 * 60, closeMin: 22 * 60 },

  // ── площадки под события: окно вечернее, уборка после каждого ──
  { id: "gz1", title: "Беседка у пруда · 12–23", group: "Площадки",
    unit: "hour" as const, openMin: 12 * 60, closeMin: 23 * 60 },
  { id: "gz2", title: "Беседка большая · 12–23", group: "Площадки",
    unit: "hour" as const, openMin: 12 * 60, closeMin: 23 * 60 },
  { id: "man", title: "Мангальная зона · 12–23", group: "Площадки",
    unit: "hour" as const, gapMin: 30, openMin: 12 * 60, closeMin: 23 * 60 },
  { id: "hall", title: "Банкетный зал · 14–23", group: "Площадки",
    unit: "hour" as const, minMin: 180, gapMin: 60,
    openMin: 14 * 60, closeMin: 23 * 60 },
  { id: "ver", title: "Веранда · 14–23", group: "Площадки",
    unit: "hour" as const, openMin: 14 * 60, closeMin: 23 * 60 },
];

/** брони площадок; `H` — короткая запись «строка, день, с, по, кто» */
const H = (
  id: string, row: string, day: number, from: string, to: string,
  guest: string, kind: Booking["kind"] = "сайт",
): Booking => ({
  id, row,
  from: `${shiftDay(start, day)}T${from}`,
  to: `${shiftDay(start, day)}T${to}`,
  guest, kind,
});

const VENUES: Array<Booking> = [
  // бани: между сеансами видно штрихованный хвост уборки
  H("v1", "ban1", 0, "12:00", "14:00", "Иванов"),
  H("v2", "ban1", 0, "14:30", "16:30", "Петров", "телефон"),
  H("v3", "ban1", 0, "19:00", "22:00", "Сидоровы"),
  H("v4", "ban2", 0, "18:00", "22:00", "корпоратив"),
  // у бани окна нет — полночь ей не граница
  H("v5", "ban2", 1, "00:00", "03:00", "ночная", "телефон"),
  H("v6", "ban3", 0, "10:00", "12:00", "Орлова"),
  H("v7", "ban4", 0, "15:00", "19:00", "баня на дровах"),
  H("v8", "cha", 0, "13:00", "14:00", "Кузнецов"),

  // активности
  H("v9", "pb", 0, "11:00", "13:00", "день рождения"),
  H("v10", "pb", 0, "15:00", "17:00", "школа №4", "телефон"),
  H("v11", "las", 0, "12:00", "14:00", "тимбилдинг"),
  H("v12", "kar", 0, "14:00", "14:30", "заезд 12"),
  H("v13", "kar", 0, "15:00", "16:00", "заезд 13"),
  H("v14", "kvest", 0, "18:00", "19:00", "Морозовы"),
  H("v15", "tir", 1, "12:00", "13:00", "Волков"),

  // спорт
  H("v16", "ten1", 0, "08:00", "10:00", "абонемент"),
  H("v17", "ten1", 0, "18:00", "20:00", "Титов", "телефон"),
  H("v18", "ten2", 0, "19:00", "21:00", "парная игра"),
  H("v19", "vol", 0, "16:00", "18:00", "турнир"),
  H("v20", "gym", 0, "07:00", "09:00", "секция"),
  H("v21", "pool", 0, "07:00", "08:00", "дорожка 1"),
  H("v22", "pool", 1, "19:00", "20:00", "дорожка 1", "телефон"),

  // площадки под события
  H("v23", "gz1", 0, "12:00", "23:00", "весь день"),
  H("v24", "gz2", 0, "15:00", "20:00", "шашлык"),
  H("v25", "man", 0, "17:00", "21:00", "мангал"),
  H("v26", "hall", 0, "15:00", "20:00", "банкет", "телефон"),
  H("v27", "hall", 1, "16:00", "23:00", "свадьба"),
  H("v28", "ver", 1, "14:00", "17:00", "Кузнецовы"),
];

/**
 * Универсальная шахматка: проживание и площадки в одной сетке.
 *
 * Площадки берутся ТЕМ ЖЕ списком, что и на почасовой вкладке, — правила у
 * строки одни и те же, где бы её ни показывали. Скопируй их сюда руками, и
 * через месяц окажется, что на одной вкладке зазор полчаса, а на другой уже нет.
 */
const ALL_ROWS = [
  { id: "101", title: "101 · стандарт", group: "Проживание", unit: "day" as const },
  { id: "102", title: "102 · стандарт", group: "Проживание", unit: "day" as const },
  { id: "103", title: "103 · твин", group: "Проживание", unit: "day" as const },
  { id: "201", title: "201 · полулюкс", group: "Проживание", unit: "day" as const },
  { id: "202", title: "202 · люкс", group: "Проживание", unit: "day" as const },
  ...VENUE_ROWS,
];

/** брони номеров — вкладка «номера · сутки» */
const SEED: Array<Booking> = [
  B("b1", "101", 0, 3, "Иванов"),
  // выезд b1 и заезд b2 в ОДИН день — на графике это две полосы со щелью
  B("b2", "101", 3, 4, "Петрова", "телефон"),
  B("b3", "102", 2, 6, "Сидоров"),
  B("b4", "103", 1, 2, "ремонт", "блок"),
  B("b5", "201", 4, 7, "Кузнецовы"),
  B("b6", "202", 0, 5, "Смирнов", "телефон"),
  B("b7", "203", 8, 3, "Орлова"),
];

const ALL: Array<Booking> = [
  B("m1", "101", 0, 3, "Иванов"),
  B("m2", "102", 2, 5, "Сидоров", "телефон"),
  B("m3", "103", 1, 2, "Кузнецовы"),
  B("m4", "201", 0, 4, "Смирнов"),
  B("m5", "202", 3, 6, "Орлова", "телефон"),
  // и те же брони площадок: на суточной сетке они выглядят засечками, и это
  // честно — часовой отрезок в колонке шириной в сутки столько и занимает
  ...VENUES,
];

const TONE: Record<Booking["kind"], string> = {
  сайт: "#2563eb",
  телефон: "#7c3aed",
  блок: "#475569",
};

export default function DumbTimelineExample() {
  /**
   * Режим живёт В АДРЕСЕ (`?tl=venues`), а не только в памяти вкладки: ссылкой
   * на конкретную сетку можно поделиться, обновление страницы её не теряет, а
   * «назад» возвращает предыдущую.
   *
   * Именно в `search`, а не в хеше: хеш витрина разбирает как имя вкладки.
   */
  const MODES = ["all", "hotel", "venues"] as const;
  type Mode = (typeof MODES)[number];
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
  const [days, setDays] = createSignal(30);

  /**
   * Сетка, строки и данные меняются вместе: это три разных бизнеса на ОДНОМ
   * компоненте, и отличаются они только шкалой.
   */
  const view = () => {
    if (mode() === "all") {
      // одна сетка на всё: сутки, потому что проживание тут главное
      return {
        rows: ALL_ROWS,
        data: all(),
        set: setAll,
        scale: {
          ...SCALES.hotel(start, days(), dayW()),
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
        scale: SCALES.venues(start, 7, hourW()),
        gap: 0,
        days: 7,
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
        <b>Всё вместе</b> — проживание и почасовые активности в одной шахматке:
        строка знает, чем торгует (<code>unit: 'day' | 'hour'</code>). Протяни
        по пустому месту: на суточной строке получится бронь с 16:00 до 12:00, а
        на почасовой компонент честно скажет, что время из такого жеста не
        вытащить, — и его спросят отдельно.
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

      <Bar>
        {/* радио-группа daisyUI: `join` + `btn` — переключатель, а не список */}
        <div class="join">
          <For
            each={
              [
                ["all", "всё вместе"],
                ["hotel", "номера · сутки"],
                ["venues", "площадки · по часам"],
              ] as const
            }
          >
            {([value, label]) => (
              <input
                type="radio"
                name="tl-mode"
                class="btn btn-sm join-item"
                aria-label={label}
                checked={mode() === value}
                onChange={() => setMode(value)}
              />
            )}
          </For>
        </div>
        <Pick
          label="дней"
          value={days()}
          options={[14, 30, 60, 90].map((n) => ({ value: n }))}
          onChange={(v) => setDays(Number(v))}
        />
        <Show when={mode() === "hotel"}>
          <Pick
            label="заезд"
            value={checkIn()}
            options={[12, 14, 15, 16, 18].map((h) => ({
              value: h,
              label: `${h}:00`,
            }))}
            onChange={(v) => setCheckIn(Number(v))}
          />
          <Pick
            label="выезд"
            value={checkOut()}
            options={[8, 10, 11, 12, 14].map((h) => ({
              value: h,
              label: `${h}:00`,
            }))}
            onChange={(v) => setCheckOut(Number(v))}
          />
        </Show>
        {/* масштаб: у суточной и часовой сетки свои ползунки */}
        <label class="flex items-center gap-1 text-sm">
          {mode() === "venues" ? "час" : "день"}
          <input
            type="range"
            class="range range-xs w-24"
            min="16"
            max="90"
            value={mode() === "venues" ? hourW() : dayW()}
            onInput={(e) => {
              const v = Number(e.currentTarget.value);
              if (mode() === "venues") {
                setHourW(v);
                keep("hourW", v);
              } else {
                setDayW(v);
                keep("dayW", v);
              }
            }}
          />
          <span class="w-8 tabular-nums opacity-70">
            {mode() === "venues" ? hourW() : dayW()}
          </span>
        </label>
        <label class="flex items-center gap-1 text-sm">
          строка
          <input
            type="range"
            class="range range-xs w-20"
            min="22"
            max="72"
            value={rowH()}
            onInput={(e) => {
              const v = Number(e.currentTarget.value);
              setRowH(v);
              keep("rowH", v);
            }}
          />
          <span class="w-8 tabular-nums opacity-70">{rowH()}</span>
        </label>
        <Btn onClick={() => void undo.undo()}>
          {undo.canUndo() ? "Отменить перенос" : "Отменять нечего"}
        </Btn>
        <Btn
          onClick={() => {
            setSpans(SEED);
            setVenues(VENUES);
            setAll(ALL);
          }}
        >
          Сбросить
        </Btn>
        <Note>броней: {spans().length}</Note>
      </Bar>

      <DumbTimeline<Booking>
        rows={view().rows}
        spans={view().data}
        // шкала — пресетом ЦЕЛИКОМ: first/days/colW уже внутри, раскладывать
        // её на восемь плоских пропсов больше не нужно
        scale={view().scale}
        rowH={rowH()}
        gapMin={view().gap}
        showRoom={mode() === "venues"}
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
        summary={mode() === "venues" ? undefined : (at) => {
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
          if (mode() === "venues") {
            view().set((was) => [
              ...was,
              { id: `v${Date.now()}`, row, from, to, guest: "новая", kind: "сайт" },
            ]);
            toast.success(`создано: ${from.slice(11)} → ${to.slice(11)}`);
            return;
          }
          // суточная строка: открываем форму с уже выбранным периодом —
          // молча создавать бронь протяжкой слишком лихо
          setRange({ from: from.slice(0, 10), to: to.slice(0, 10) });
          setNewFor({ row, day: from.slice(0, 10) });
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
      <DumbModal
        open={() => askTime() !== null}
        onClose={() => setAskTime(null)}
        title={`Во сколько? · ${askTime()?.row ?? ""} · ${askTime()?.day.slice(5) ?? ""}`}
        footer={
          <>
            <button class="btn btn-sm" onClick={() => setAskTime(null)}>
              Отмена
            </button>
            <button
              class="btn btn-sm btn-primary"
              onClick={() => {
                const at = askTime();
                if (!at) return;
                const hh = String(hour()).padStart(2, "0");
                const end = String(hour() + dur()).padStart(2, "0");
                view().set((was) => [
                  ...was,
                  {
                    id: `h${Date.now()}`,
                    row: at.row,
                    from: `${at.day}T${hh}:00`,
                    to: `${at.day}T${end}:00`,
                    guest: "новая",
                    kind: "сайт",
                  },
                ]);
                toast.success(`создано: ${hh}:00 → ${end}:00`);
                setAskTime(null);
              }}
            >
              Создать
            </button>
          </>
        }
      >
        <p class="mb-3 text-sm">
          Выделение по суточной сетке даёт только дату: попасть мышью в нужный час в колонке
          шириной в сутки невозможно. Поэтому время — здесь, а не наугад.
        </p>
        <div class="flex flex-wrap gap-4">
          <label class="text-sm">
            начало
            <select
              class="select select-sm ml-2"
              value={hour()}
              onChange={(e) => setHour(Number(e.currentTarget.value))}
            >
              <For each={Array.from({ length: 14 }, (_, i) => i + 8)}>
                {(h) => <option value={h}>{h}:00</option>}
              </For>
            </select>
          </label>
          <label class="text-sm">
            длительность
            <select
              class="select select-sm ml-2"
              value={dur()}
              onChange={(e) => setDur(Number(e.currentTarget.value))}
            >
              <For each={[1, 2, 3, 4, 6, 8]}>{(h) => <option value={h}>{h} ч</option>}</For>
            </select>
          </label>
        </div>
      </DumbModal>

      <DumbToaster />
    </div>
  );
}

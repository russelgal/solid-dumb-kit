// Данные витрины шахматки: номера, площадки и брони.
//
// Лежат отдельно от примера — тот про КОМПОНЕНТ, а двести строк выдуманных
// Ивановых только мешают его читать. Здесь же и палитра видов брони.

import { type Span } from "@solid-dumb-kit/timeline";
import { today } from "@solid-dumb-kit/date-range";

export type Booking = Span & { guest: string; kind: "сайт" | "телефон" | "блок" };

export const ROOMS = [
  { id: "101", title: "101 · стандарт", group: "Стандарт" },
  { id: "102", title: "102 · стандарт", group: "Стандарт" },
  { id: "103", title: "103 · твин", group: "Стандарт" },
  { id: "201", title: "201 · полулюкс", group: "Полулюкс" },
  { id: "202", title: "202 · люкс", group: "Люкс" },
  { id: "203", title: "203 · люкс", group: "Люкс" },
];

export const start = today();
export const shiftDay = (d: string, n: number) =>
  new Date(new Date(`${d}T00:00:00Z`).getTime() + n * 86_400_000)
    .toISOString()
    .slice(0, 10);

export const B = (
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
export const VENUE_ROWS = [
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
export const H = (
  id: string, row: string, day: number, from: string, to: string,
  guest: string, kind: Booking["kind"] = "сайт",
): Booking => ({
  id, row,
  from: `${shiftDay(start, day)}T${from}`,
  to: `${shiftDay(start, day)}T${to}`,
  guest, kind,
});

export const VENUES: Array<Booking> = [
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
export const ALL_ROWS = [
  { id: "101", title: "101 · стандарт", group: "Проживание", unit: "day" as const },
  { id: "102", title: "102 · стандарт", group: "Проживание", unit: "day" as const },
  { id: "103", title: "103 · твин", group: "Проживание", unit: "day" as const },
  { id: "201", title: "201 · полулюкс", group: "Проживание", unit: "day" as const },
  { id: "202", title: "202 · люкс", group: "Проживание", unit: "day" as const },
  ...VENUE_ROWS,
];

/** чем торгует строка — по ней решаем, спрашивать ли время при создании */
export const unitOf = (rows: typeof ALL_ROWS | typeof ROOMS, row: string) =>
  (rows.find((r) => r.id === row) as { unit?: "day" | "hour" } | undefined)
    ?.unit ?? "day";

/** брони номеров — вкладка «номера · сутки» */
export const SEED: Array<Booking> = [
  B("b1", "101", 0, 3, "Иванов"),
  // выезд b1 и заезд b2 в ОДИН день — на графике это две полосы со щелью
  B("b2", "101", 3, 4, "Петрова", "телефон"),
  B("b3", "102", 2, 6, "Сидоров"),
  B("b4", "103", 1, 2, "ремонт", "блок"),
  B("b5", "201", 4, 7, "Кузнецовы"),
  B("b6", "202", 0, 5, "Смирнов", "телефон"),
  B("b7", "203", 8, 3, "Орлова"),
];

export const ALL: Array<Booking> = [
  B("m1", "101", 0, 3, "Иванов"),
  B("m2", "102", 2, 5, "Сидоров", "телефон"),
  B("m3", "103", 1, 2, "Кузнецовы"),
  B("m4", "201", 0, 4, "Смирнов"),
  B("m5", "202", 3, 6, "Орлова", "телефон"),
  // и те же брони площадок: на суточной сетке они выглядят засечками, и это
  // честно — часовой отрезок в колонке шириной в сутки столько и занимает
  ...VENUES,
];

export const TONE: Record<Booking["kind"], string> = {
  сайт: "#2563eb",
  телефон: "#7c3aed",
  блок: "#475569",
};

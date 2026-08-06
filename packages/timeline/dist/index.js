import { delegateEvents, use, insert, createComponent, effect, className, setStyleProperty, setAttribute, memo, style, template } from 'solid-js/web';
import { createMemo, createSignal, onCleanup, createEffect, Show, For, untrack } from 'solid-js';
import { Temporal as Temporal$1 } from 'temporal-polyfill';

// src/DumbTimeline.tsx
function onMounted(fn) {
  createEffect(() => untrack(fn));
}
var done = /* @__PURE__ */ new Set();
function injectStyle(id, css) {
  if (typeof document === "undefined") return;
  if (done.has(id)) return;
  done.add(id);
  const was = document.querySelector(`style[data-dumb-kit="${id}"]`);
  if (was) {
    if (was.textContent !== css) was.textContent = css;
    return;
  }
  const el = document.createElement("style");
  el.setAttribute("data-dumb-kit", id);
  el.textContent = css;
  document.head.appendChild(el);
}
function suppressTextSelection() {
  if (typeof document === "undefined") return;
  const s = document.body.style;
  s.userSelect = "none";
  s.webkitUserSelect = "none";
  const sel = window.getSelection?.();
  if (sel && !sel.isCollapsed) sel.removeAllRanges();
}
function restoreTextSelection() {
  if (typeof document === "undefined") return;
  const s = document.body.style;
  s.userSelect = "";
  s.webkitUserSelect = "";
}
var Temporal = globalThis.Temporal ?? Temporal$1;

// src/scale.ts
var DAY = 1440;
var dayOf = (m) => m.slice(0, 10);
function minutesOf(m) {
  if (m.length < 16) return null;
  const h = Number(m.slice(11, 13));
  const min = Number(m.slice(14, 16));
  return h * 60 + min;
}
var CACHE_CAP = 1e4;
var idxCache = /* @__PURE__ */ new Map();
function dayIndex(first, day) {
  const key = `${first}|${day}`;
  let idx = idxCache.get(key);
  if (idx === void 0) {
    idx = Temporal.PlainDate.from(first).until(Temporal.PlainDate.from(day), { largestUnit: "day" }).days;
    if (idxCache.size >= CACHE_CAP) idxCache.clear();
    idxCache.set(key, idx);
  }
  return idx;
}
var nameCache = /* @__PURE__ */ new Map();
function dayName(first, index) {
  const key = `${first}#${index}`;
  let name = nameCache.get(key);
  if (name === void 0) {
    name = Temporal.PlainDate.from(first).add({ days: index }).toString();
    if (nameCache.size >= CACHE_CAP) nameCache.clear();
    nameCache.set(key, name);
  }
  return name;
}
function toMinutes(m, s, edge = "from") {
  const win = Math.max(1, s.dayEnd - s.dayStart);
  const inDay = minutesOf(m) ?? (edge === "from" ? s.checkIn ?? s.dayStart : s.checkOut ?? s.dayEnd);
  const clamped = Math.min(Math.max(inDay, s.dayStart), s.dayEnd);
  return dayIndex(s.first, dayOf(m)) * win + (clamped - s.dayStart);
}
var toX = (min, s) => min / s.stepMin * s.colW;
var momentX = (m, s, edge = "from") => toX(toMinutes(m, s, edge), s);
var snapOf = (s) => s.snapMin ?? s.stepMin;
function minLength(s, rules) {
  if (rules?.minMin) return rules.minMin;
  if (s.minMin) return s.minMin;
  const win = Math.max(1, s.dayEnd - s.dayStart);
  if (s.stepMin < win) return snapOf(s);
  const inH = s.checkIn ?? s.dayStart;
  const outH = s.checkOut ?? s.dayStart;
  if (outH > inH) return outH - inH;
  return Math.max(1, win + outH - inH);
}
function fromX(x, s, snap = true) {
  const raw = x / s.colW * s.stepMin;
  const step = snapOf(s);
  return snap ? Math.round(raw / step) * step : raw;
}
function snapEdge(x, s, edge) {
  const raw = x / s.colW * s.stepMin;
  const win = Math.max(1, s.dayEnd - s.dayStart);
  const mark = (edge === "from" ? s.checkIn ?? s.dayStart : s.checkOut ?? s.dayEnd) - s.dayStart;
  if (s.stepMin >= win) {
    const dayIdx = Math.max(0, Math.round((raw - mark) / win));
    return toMoment(dayIdx * win + mark, s);
  }
  const step = snapOf(s);
  return toMoment(Math.max(0, Math.round(raw / step) * step), s);
}
function toMoment(min, s, asEnd = false) {
  const win = Math.max(1, s.dayEnd - s.dayStart);
  let day = Math.floor(min / win);
  let rest = min - day * win + s.dayStart;
  if (asEnd && min > 0 && min % win === 0) {
    day -= 1;
    rest = s.dayEnd;
  }
  const hh = String(Math.floor(rest / 60)).padStart(2, "0");
  const mm = String(Math.round(rest % 60)).padStart(2, "0");
  return `${dayName(s.first, day)}T${hh}:${mm}`;
}
var totalCols = (s) => Math.ceil(s.days * Math.max(1, s.dayEnd - s.dayStart) / s.stepMin);
function headGroups(s) {
  const out = [];
  const win = Math.max(1, s.dayEnd - s.dayStart);
  const byMonth = s.stepMin >= win;
  for (let i = 0; i < totalCols(s); i++) {
    const at = toMoment(i * s.stepMin, s);
    const key = byMonth ? at.slice(0, 7) : at.slice(0, 10);
    const last = out[out.length - 1];
    if (last && (byMonth ? last.at.slice(0, 7) : last.at.slice(0, 10)) === key) last.span++;
    else out.push({ label: key, span: 1, at });
  }
  return out;
}
function columns(s) {
  return Array.from({ length: totalCols(s) }, (_, i) => toMoment(i * s.stepMin, s));
}
function conflicts(a, b, s, gapMin = 0) {
  const a1 = toMinutes(a.from, s, "from");
  const a2 = toMinutes(a.to, s, "to");
  const b1 = toMinutes(b.from, s, "from");
  const b2 = toMinutes(b.to, s, "to");
  return a1 < b2 + gapMin && b1 < a2 + gapMin;
}
function dayBounds(min, s) {
  const win = Math.max(1, s.dayEnd - s.dayStart);
  const day = Math.floor(min / win);
  return { start: day * win, end: (day + 1) * win };
}
function rowBounds(min, s, rules) {
  const win = Math.max(1, s.dayEnd - s.dayStart);
  const day = Math.floor(min / win);
  const open = Math.min(Math.max((rules?.openMin ?? s.dayStart) - s.dayStart, 0), win);
  const close = Math.min(Math.max((rules?.closeMin ?? s.dayEnd) - s.dayStart, 0), win);
  return { start: day * win + open, end: day * win + Math.max(open, close) };
}
var closesAtNight = (s) => s.dayEnd - s.dayStart < 1440;
var confined = (s, rules) => closesAtNight(s) || (rules?.closeMin ?? s.dayEnd) - (rules?.openMin ?? s.dayStart) < 1440;
var lengthOf = (span, s) => toMinutes(span.to, s, "to") - toMinutes(span.from, s, "from");
function clampEdge(span, edge, wantMin, others, s, gapMin = 0, rules) {
  const begin = toMinutes(span.from, s, "from");
  const end = toMinutes(span.to, s, "to");
  const mates = others.filter((o) => o.id !== span.id && o.row === span.row);
  if (edge === "to") {
    const nightWall = confined(s, rules) ? rowBounds(begin, s, rules).end : Infinity;
    let ceiling = Infinity;
    for (const o of mates) {
      const oStart = toMinutes(o.from, s, "from");
      if (oStart >= begin) ceiling = Math.min(ceiling, oStart - gapMin);
    }
    const at2 = Math.min(wantMin, ceiling, nightWall);
    return at2 - begin >= minLength(s, rules) ? at2 : null;
  }
  let floor = confined(s, rules) ? rowBounds(end - 1, s, rules).start : -Infinity;
  for (const o of mates) {
    const oEnd = toMinutes(o.to, s, "to");
    if (oEnd <= end) floor = Math.max(floor, oEnd + gapMin);
  }
  const at = Math.max(wantMin, floor, 0);
  return end - at >= minLength(s, rules) ? at : null;
}
function moveTo(span, startMin, s, rules) {
  const len = lengthOf(span, s);
  let at = startMin;
  if (confined(s, rules)) {
    const { start, end } = rowBounds(at, s, rules);
    at = Math.max(start, Math.min(at, end - len));
  }
  return { from: toMoment(at, s), to: toMoment(at + len, s, true) };
}
function stackFloors(spans, s, gapMin = 0) {
  const floors = /* @__PURE__ */ new Map();
  const byRow = /* @__PURE__ */ new Map();
  const gapOf = typeof gapMin === "function" ? gapMin : () => gapMin;
  for (const sp of spans) {
    const list = byRow.get(sp.row) ?? [];
    list.push({ id: sp.id, from: toMinutes(sp.from, s, "from"), to: toMinutes(sp.to, s, "to") });
    byRow.set(sp.row, list);
  }
  for (const [row, list] of byRow) {
    const gap = gapOf(row);
    list.sort((a, b) => a.from - b.from);
    const busyUntil = [];
    for (const sp of list) {
      let floor = busyUntil.findIndex((end) => end + gap <= sp.from);
      if (floor < 0) floor = busyUntil.length;
      busyUntil[floor] = sp.to;
      floors.set(sp.id, floor);
    }
  }
  return floors;
}
function floorsPerRow(spans, floors) {
  const out = /* @__PURE__ */ new Map();
  for (const sp of spans) {
    out.set(sp.row, Math.max(out.get(sp.row) ?? 1, (floors.get(sp.id) ?? 0) + 1));
  }
  return out;
}
var SCALES = {
  /** сутки; заезд 16:00, выезд 12:00 */
  hotel: (first, days, colW = 34) => ({
    first,
    days,
    colW,
    dayStart: 0,
    dayEnd: DAY,
    stepMin: DAY,
    checkIn: 16 * 60,
    checkOut: 12 * 60
  }),
  /** почасовая, работа с 10:00 до полуночи */
  sauna: (first, days, colW = 34) => ({
    first,
    days,
    colW,
    dayStart: 10 * 60,
    dayEnd: DAY,
    stepMin: 60
  }),
  /** час; дневная аренда с 12:00 до 23:00 */
  gazebo: (first, days, colW = 34) => ({
    first,
    days,
    colW,
    dayStart: 12 * 60,
    dayEnd: 23 * 60,
    stepMin: 60
  }),
  /**
   * Час; сетка на ВСЕ площадки базы разом — КРУГЛОСУТОЧНАЯ: баню арендуют и
   * ночью, поэтому резать ночь на уровне сетки нельзя. У кого ночи нет —
   * беседка до 23:00, банкетный зал с 14:00 — тот закрывает её СВОИМ окном
   * (`RowRules` на строке), и закрытые часы видны штриховкой. Минимум и зазор
   * тоже у строк: баня — от двух часов и полчаса уборки, пейнтбол — от часа
   * и час перезарядки.
   */
  venues: (first, days, colW = 13) => ({
    // колонка-час УЗКАЯ: сутки шириной ~310px, неделя влезает в экран.
    // Двигается всё полушагом в полчаса — сеанс с 14:30 не редкость
    first,
    days,
    colW,
    dayStart: 0,
    dayEnd: DAY,
    stepMin: 60,
    snapMin: 30
  })
};

// src/DumbTimeline.tsx
var _tmpl$ = /* @__PURE__ */ template(`<div class=dumb-tl-sum-title>`);
var _tmpl$2 = /* @__PURE__ */ template(`<div class="dumb-tl-days dumb-tl-summary">`);
var _tmpl$3 = /* @__PURE__ */ template(`<div class=dumb-tl-now>`);
var _tmpl$4 = /* @__PURE__ */ template(`<div><div class=dumb-tl-inner><div class=dumb-tl-corner></div><div class=dumb-tl-head><div class=dumb-tl-groups></div><div class=dumb-tl-days></div></div><div class=dumb-tl-rows></div><div class=dumb-tl-canvas>`);
var _tmpl$5 = /* @__PURE__ */ template(`<div class=dumb-tl-group>`);
var _tmpl$6 = /* @__PURE__ */ template(`<div>`);
var _tmpl$7 = /* @__PURE__ */ template(`<div class=dumb-tl-day>`);
var _tmpl$8 = /* @__PURE__ */ template(`<button type=button class=dumb-tl-grouprow><span class=dumb-tl-fold>`);
var _tmpl$9 = /* @__PURE__ */ template(`<div class=dumb-tl-hline>`);
var _tmpl$0 = /* @__PURE__ */ template(`<div class=dumb-tl-closed style=top:0;left:0>`);
var _tmpl$1 = /* @__PURE__ */ template(`<div class=dumb-tl-pick>`);
var _tmpl$10 = /* @__PURE__ */ template(`<div class=dumb-tl-gap style=top:3px;left:0>`);
var _tmpl$11 = /* @__PURE__ */ template(`<span class=dumb-tl-grip data-edge=from>`);
var _tmpl$12 = /* @__PURE__ */ template(`<span class=dumb-tl-grip data-edge=to>`);
var _tmpl$13 = /* @__PURE__ */ template(`<div style=top:3px;left:0>`);
var _tmpl$14 = /* @__PURE__ */ template(`<div class=dumb-tl-room style=top:3px;left:0><b>+`);
var _tmpl$15 = /* @__PURE__ */ template(`<span class=dumb-tl-hh>`);
var _tmpl$16 = /* @__PURE__ */ template(`<span class=dumb-tl-wd>`);
var STYLES = `
  .dumb-tl { position: relative; overflow: auto; overscroll-behavior: contain;
             color: var(--dumb-tl-fg, #0f172a); user-select: none;
             --dumb-tl-line: rgb(0 0 0 / .12) }
  .dumb-tl-inner { position: relative; display: grid;
                   grid-template-columns: var(--dumb-tl-head) 1fr }

  /* \u0428\u0430\u043F\u043A\u0430 \u0438 \u043B\u0435\u0432\u0430\u044F \u043A\u043E\u043B\u043E\u043D\u043A\u0430 \u043B\u0438\u043F\u043A\u0438\u0435. \u041E\u0431\u0435 \u043D\u0430 sticky, \u0430 \u043D\u0435 \u043D\u0430 \u0441\u0432\u043E\u0438\u0445 \u0441\u043B\u043E\u044F\u0445 \u0441
     \u0441\u0438\u043D\u0445\u0440\u043E\u043D\u043D\u043E\u0439 \u043F\u0440\u043E\u043A\u0440\u0443\u0442\u043A\u043E\u0439: \u0443 sticky \u043D\u0435\u0442 \u0440\u0430\u0441\u0441\u0438\u043D\u0445\u0440\u043E\u043D\u0430 \u043D\u0430 \u0438\u043D\u0435\u0440\u0446\u0438\u0438. */
  .dumb-tl-corner { position: sticky; top: 0; left: 0; z-index: 3;
                    display: flex; align-items: flex-end; padding: 0 8px 3px;
                    font-size: 11px; color: var(--dumb-tl-dim, #475569);
                    background: var(--dumb-tl-bg, #fff);
                    border-right: 1px solid var(--dumb-tl-line);
                    border-bottom: 1px solid var(--dumb-tl-line) }
  .dumb-tl-sum-title { white-space: nowrap; overflow: hidden; text-overflow: ellipsis }
  /* \u0437\u0430\u0433\u043E\u043B\u043E\u0432\u043E\u043A \u0433\u0440\u0443\u043F\u043F\u044B \u0441\u0442\u0440\u043E\u043A: \u044D\u0442\u0430\u0436\u0438, \u043A\u043E\u0440\u043F\u0443\u0441\u0430, \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u0438 */
  .dumb-tl-grouprow { display: flex; align-items: center; gap: 4px; width: 100%;
                      padding: 0 6px; border: 0; border-bottom: 1px solid var(--dumb-tl-line);
                      font: inherit; font-size: 12px; font-weight: 600; text-align: left;
                      cursor: pointer; color: inherit;
                      background: var(--dumb-tl-group-bg, rgb(0 0 0 / .04)) }
  /* \u0431\u0435\u0437 opacity: \u044D\u043B\u0435\u043C\u0435\u043D\u0442 \u0443\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u044F \u043E\u0431\u044F\u0437\u0430\u043D \u0447\u0438\u0442\u0430\u0442\u044C\u0441\u044F \u0441\u0440\u0430\u0437\u0443 (\u043F\u0440\u0430\u0432\u0438\u043B\u043E \u043A\u043E\u043D\u0442\u0440\u0430\u0441\u0442\u0430) */
  .dumb-tl-fold { font-size: 9px }
  /* \xAB\u0441\u0435\u0439\u0447\u0430\u0441\xBB: \u0442\u043E\u043D\u043A\u0430\u044F \u043B\u0438\u043D\u0438\u044F \u043F\u043E\u0432\u0435\u0440\u0445 \u0441\u0435\u0442\u043A\u0438, \u043D\u043E \u043F\u043E\u0434 \u043F\u043E\u043B\u043E\u0441\u0430\u043C\u0438 */
  .dumb-tl-now { position: absolute; top: 0; bottom: 0; width: 2px; z-index: 1;
                 background: var(--dumb-tl-now, #2563eb); pointer-events: none }
  /* \u0432\u044B\u0434\u0435\u043B\u0435\u043D\u0438\u0435 \u043F\u0443\u0441\u0442\u043E\u0433\u043E \u043C\u0435\u0441\u0442\u0430 \u043F\u0440\u043E\u0442\u044F\u0436\u043A\u043E\u0439: \u0440\u0430\u043C\u043A\u0430 \u0441 \u043F\u043E\u0434\u043F\u0438\u0441\u044C\u044E \xAB\u0441\u043A\u043E\u043B\u044C\u043A\u043E \u0432\u044B\u0431\u0440\u0430\u043D\u043E\xBB */
  .dumb-tl-pick { position: absolute; z-index: 3; border-radius: 6px; pointer-events: none;
                  display: flex; align-items: center; justify-content: center;
                  font-size: 11px; font-weight: 600; color: var(--dumb-tl-span-bg, #2563eb);
                  border: 2px dashed var(--dumb-tl-span-bg, #2563eb);
                  background: color-mix(in srgb, var(--dumb-tl-span-bg, #2563eb) 12%, transparent) }
  .dumb-tl-head { position: sticky; top: 0; z-index: 2;
                  background: var(--dumb-tl-bg, #fff);
                  border-bottom: 1px solid var(--dumb-tl-line) }
  .dumb-tl-groups { display: grid; border-bottom: 1px solid var(--dumb-tl-line) }
  .dumb-tl-group { font-size: 12px; font-weight: 600; text-align: center; padding: 3px 0;
                   border-left: 1px solid var(--dumb-tl-line);
                   overflow: hidden; white-space: nowrap; text-transform: capitalize }
  .dumb-tl-days { display: grid; background: var(--dumb-tl-bg, #fff) }
  .dumb-tl-summary { border-top: 1px solid var(--dumb-tl-line);
                     font-variant-numeric: tabular-nums;
                     color: var(--dumb-tl-dim, #475569) }
  .dumb-tl-day { font-size: 11px; text-align: center; padding: 3px 0; line-height: 1.15;
                 border-left: 1px solid var(--dumb-tl-line) }
  /* \u0434\u0435\u043D\u044C \u043D\u0435\u0434\u0435\u043B\u0438 \u043C\u0435\u043B\u044C\u0447\u0435 \u0447\u0438\u0441\u043B\u0430: \u043E\u043D \u043F\u043E\u0434\u0441\u043A\u0430\u0437\u043A\u0430, \u0430 \u043D\u0435 \u0433\u043B\u0430\u0432\u043D\u043E\u0435. \u0412\u0442\u043E\u0440\u0438\u0447\u043D\u043E\u0441\u0442\u044C \u2014 \u0440\u0430\u0437\u043C\u0435\u0440\u043E\u043C
     \u0438 \u0446\u0432\u0435\u0442\u043E\u043C \u043D\u0435 \u0441\u0432\u0435\u0442\u043B\u0435\u0435 var(--dumb-tl-dim), \u0430 \u043D\u0435 \u043F\u043E\u043B\u0443\u043F\u0440\u043E\u0437\u0440\u0430\u0447\u043D\u043E\u0441\u0442\u044C\u044E */
  .dumb-tl-wd { display: block; font-size: 9px; color: var(--dumb-tl-dim, #475569) }
  .dumb-tl-rows { position: sticky; left: 0; z-index: 2;
                  background: var(--dumb-tl-bg, #fff);
                  border-right: 1px solid var(--dumb-tl-line) }
  .dumb-tl-row { display: flex; align-items: center; padding: 0 8px; font-size: 13px;
                 border-bottom: 1px solid var(--dumb-tl-line); overflow: hidden;
                 text-overflow: ellipsis; white-space: nowrap }

  /* \u0421\u0435\u0442\u043A\u0430 \u043D\u0430\u0440\u0438\u0441\u043E\u0432\u0430\u043D\u0430 \u0424\u041E\u041D\u041E\u041C, \u0430 \u043D\u0435 \u0441\u043E\u0442\u043D\u044F\u043C\u0438 \u0443\u0437\u043B\u043E\u0432: \u0433\u043E\u0434 \u043F\u043E \u0434\u043D\u044F\u043C \u2014 \u044D\u0442\u043E 365 \u043A\u043E\u043B\u043E\u043D\u043E\u043A,
     \u0438 \u043A\u0430\u0436\u0434\u0430\u044F \u0441\u0432\u043E\u0438\u043C div'\u043E\u043C \u0441\u0442\u043E\u0438\u043B\u0430 \u0431\u044B \u0434\u043E\u0440\u043E\u0436\u0435 \u0432\u0441\u0435\u0433\u043E \u043E\u0441\u0442\u0430\u043B\u044C\u043D\u043E\u0433\u043E \u0432\u043C\u0435\u0441\u0442\u0435 \u0432\u0437\u044F\u0442\u043E\u0433\u043E. */
  /* \u0412\u0435\u0440\u0442\u0438\u043A\u0430\u043B\u0438 \u2014 \u0444\u043E\u043D\u043E\u043C: \u043A\u043E\u043B\u043E\u043D\u043E\u043A \u0441\u043E\u0442\u043D\u0438, \u0438 \u043A\u0430\u0436\u0434\u0430\u044F \u0441\u0432\u043E\u0438\u043C \u0443\u0437\u043B\u043E\u043C \u0441\u0442\u043E\u0438\u043B\u0430 \u0431\u044B \u0434\u043E\u0440\u043E\u0436\u0435
     \u0432\u0441\u0435\u0433\u043E \u043E\u0441\u0442\u0430\u043B\u044C\u043D\u043E\u0433\u043E. \u0413\u043E\u0440\u0438\u0437\u043E\u043D\u0442\u0430\u043B\u0438 \u2014 \u0443\u0437\u043B\u0430\u043C\u0438: \u0441\u0442\u0440\u043E\u043A \u0434\u0435\u0441\u044F\u0442\u043A\u0438, \u0437\u0430\u0442\u043E \u043E\u043D\u0438 \u0420\u0410\u0417\u041D\u041E\u0419
     \u0432\u044B\u0441\u043E\u0442\u044B (\u0441\u0442\u0440\u043E\u043A\u0430 \u0440\u0430\u0441\u0442\u0451\u0442 \u043F\u043E\u0434 \u044D\u0442\u0430\u0436\u0438), \u0430 \u0444\u043E\u043D \u0441 \u0444\u0438\u043A\u0441\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u044B\u043C \u0448\u0430\u0433\u043E\u043C \u044D\u0442\u043E\u0433\u043E \u043D\u0435
     \u0443\u043C\u0435\u0435\u0442. */
  /* \u0414\u0432\u0430 \u0441\u043B\u043E\u044F \u0432\u0435\u0440\u0442\u0438\u043A\u0430\u043B\u0435\u0439: \u0442\u043E\u043D\u043A\u0438\u0435 \u2014 \u043A\u043E\u043B\u043E\u043D\u043A\u0438 (\u0447\u0430\u0441\u044B), \u0436\u0438\u0440\u043D\u0435\u0435 \u2014 \u0441\u0442\u044B\u043A \u0441\u0443\u0442\u043E\u043A. \u041D\u0430
     \u0441\u0443\u0442\u043E\u0447\u043D\u043E\u0439 \u0441\u0435\u0442\u043A\u0435 \u043E\u0431\u0430 \u0441\u043B\u043E\u044F \u0441\u043E\u0432\u043F\u0430\u0434\u0430\u044E\u0442 \u0438 \u0440\u0438\u0441\u0443\u044E\u0442\u0441\u044F \u0446\u0432\u0435\u0442\u043E\u043C \u043E\u0431\u044B\u0447\u043D\u043E\u0439 \u043B\u0438\u043D\u0438\u0438. */
  .dumb-tl-canvas { position: relative;
                    background-image:
                      repeating-linear-gradient(to right, var(--dumb-tl-dayline) 0 1px,
                        transparent 1px var(--dumb-tl-day-w)),
                      repeating-linear-gradient(to right, var(--dumb-tl-line) 0 1px,
                        transparent 1px var(--dumb-tl-col)) }
  /* \u0442\u0438\u043A \u0447\u0430\u0441\u043E\u0432\u043E\u0439 \u043B\u0438\u043D\u0435\u0439\u043A\u0438: \u0434\u0435\u043D\u044C \u0448\u0438\u0440\u043E\u043A\u0438\u0439, \u0447\u0430\u0441 \u2014 \u0434\u0432\u0443\u0437\u043D\u0430\u0447\u043D\u0430\u044F \u043D\u0430\u0441\u0435\u0447\u043A\u0430 */
  .dumb-tl-hh { font-size: 9px; letter-spacing: -0.3px }
  .dumb-tl-hline { position: absolute; left: 0; right: 0; height: 1px;
                   background: var(--dumb-tl-line); pointer-events: none }

  .dumb-tl-span { position: absolute; box-sizing: border-box; display: flex; align-items: center;
                  gap: 4px; padding: 0 6px; border-radius: 6px; font-size: 12px;
                  line-height: 1.2; overflow: hidden; white-space: nowrap; cursor: grab;
                  background: var(--dumb-tl-span-bg, #2563eb); color: #fff;
                  will-change: transform }
  .dumb-tl-span[data-drag="1"] { cursor: grabbing; opacity: .85; z-index: 4 }
  /* \u0437\u0430\u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u0430\u044F \u043F\u043E\u043B\u043E\u0441\u0430: \u0431\u043B\u043E\u043A, \u0440\u0435\u043C\u043E\u043D\u0442, \u0441\u0430\u043D\u0438\u0442\u0430\u0440\u043D\u044B\u0439 \u0434\u0435\u043D\u044C */
  .dumb-tl-span[data-locked="1"] { cursor: default }
  /* \u0437\u0430\u043A\u0440\u044B\u0442\u0430\u044F \u0441\u0442\u0440\u043E\u043A\u0430: \u0432\u0438\u0434\u043D\u0430, \u043D\u043E \u043D\u0438\u0447\u0435\u0433\u043E \u043D\u0435 \u0441\u043E\u0437\u0434\u0430\u0442\u044C */
  .dumb-tl-row[data-off="1"] { opacity: .55 }
  /* \u043D\u0435\u043B\u044C\u0437\u044F \u0441\u044E\u0434\u0430 \u2014 \u0432\u0438\u0434\u043D\u043E \u0441\u0440\u0430\u0437\u0443, \u0430 \u043D\u0435 \u043F\u043E\u0441\u043B\u0435 \u043E\u0442\u043F\u0443\u0441\u043A\u0430\u043D\u0438\u044F */
  .dumb-tl-span[data-bad="1"] { background: var(--dumb-tl-bad, #b91c1c) }
  .dumb-tl-grip { position: absolute; top: 0; bottom: 0; width: 7px; cursor: ew-resize }
  .dumb-tl-grip[data-edge="from"] { left: 0 }
  .dumb-tl-grip[data-edge="to"] { right: 0 }
  /* \u0440\u0443\u0447\u043A\u0443 \u0432\u0438\u0434\u043D\u043E \u0441\u0440\u0430\u0437\u0443: \u043F\u043E\u043B\u043E\u0441\u043A\u0430 \u0443 \u043A\u0440\u0430\u044F, \u0430 \u043D\u0435 \u043F\u0440\u043E\u0437\u0440\u0430\u0447\u043D\u0430\u044F \u0437\u043E\u043D\u0430 \u043D\u0430 \u0443\u0433\u0430\u0434\u0430\u0439 */
  .dumb-tl-span:hover .dumb-tl-grip::before {
    content: ''; position: absolute; top: 25%; bottom: 25%; width: 2px; border-radius: 2px;
    background: rgb(255 255 255 / .85) }
  .dumb-tl-grip[data-edge="from"]::before { left: 2px }
  .dumb-tl-grip[data-edge="to"]::before { right: 2px }

  /* \u0417\u0430\u043A\u0440\u044B\u0442\u044B\u0435 \u0447\u0430\u0441\u044B \u0441\u0442\u0440\u043E\u043A\u0438: \u0448\u0442\u0440\u0438\u0445\u043E\u0432\u043A\u0430. \u0411\u0430\u043D\u043A\u0435\u0442\u043D\u044B\u0439 \u0437\u0430\u043B \u043E\u0442\u043A\u0440\u044B\u0442 \u0441 14:00, \u0438 \u0447\u0430\u0441\u044B \u0434\u043E
     \u0442\u043E\u0433\u043E \u2014 \u043D\u0435 \xAB\u0441\u0432\u043E\u0431\u043E\u0434\u043D\u043E\xBB, \u0430 \xAB\u043D\u0435 \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u0435\u0442\xBB; \u0433\u043B\u0430\u0437\u0443 \u044D\u0442\u043E \u043D\u0430\u0434\u043E \u043F\u043E\u043A\u0430\u0437\u0430\u0442\u044C \u0434\u043E \u0442\u043E\u0433\u043E,
     \u043A\u0430\u043A \u043E\u043D \u043F\u043E\u043F\u0440\u043E\u0431\u0443\u0435\u0442 \u0442\u0443\u0434\u0430 \u0447\u0442\u043E-\u0442\u043E \u043F\u043E\u0441\u0442\u0430\u0432\u0438\u0442\u044C. */
  .dumb-tl-closed { position: absolute; pointer-events: none;
                    background: repeating-linear-gradient(45deg,
                      transparent 0 4px, var(--dumb-tl-closed, rgb(0 0 0 / .1)) 4px 8px) }
  /* \u0417\u0430\u0437\u043E\u0440 \u043F\u043E\u0441\u043B\u0435 \u0431\u0440\u043E\u043D\u0438: \u0443\u0431\u043E\u0440\u043A\u0430 \u0431\u0430\u043D\u0438, \u043F\u0435\u0440\u0435\u0437\u0430\u0440\u044F\u0434\u043A\u0430 \u043F\u0435\u0439\u043D\u0442\u0431\u043E\u043B\u0430. \u0412\u0440\u0435\u043C\u044F \u0444\u043E\u0440\u043C\u0430\u043B\u044C\u043D\u043E
     \u0441\u0432\u043E\u0431\u043E\u0434\u043D\u043E, \u0430 \u0441\u0442\u0430\u0432\u0438\u0442\u044C \u0442\u0443\u0434\u0430 \u043D\u0435\u043B\u044C\u0437\u044F \u2014 \u0432\u043E\u0442 \u0438 \u0432\u0438\u0434\u043D\u043E, \u041F\u041E\u0427\u0415\u041C\u0423 \u0441\u043E\u0441\u0435\u0434 \u043D\u0435 \u0432\u0441\u0442\u044B\u043A. */
  .dumb-tl-gap { position: absolute; pointer-events: none; border-radius: 0 4px 4px 0;
                 border-right: 1px dashed rgb(0 0 0 / .35);
                 background: repeating-linear-gradient(45deg,
                   transparent 0 3px, rgb(0 0 0 / .25) 3px 5px) }
  /* \u0441\u043A\u043E\u043B\u044C\u043A\u043E \u0435\u0449\u0451 \u0441\u0432\u043E\u0431\u043E\u0434\u043D\u043E \u0441\u043F\u0440\u0430\u0432\u0430: \u0432\u0438\u0434\u043D\u043E \u043F\u0440\u0438 \u043D\u0430\u0432\u0435\u0434\u0435\u043D\u0438\u0438, \u0442\u044F\u043D\u0443\u0442\u044C \u043D\u0435 \u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u043E */
  .dumb-tl-room { position: absolute; border-radius: 0 6px 6px 0; pointer-events: none;
                  border: 1px dashed var(--dumb-tl-span-bg, #2563eb);
                  border-left: 0; opacity: .55;
                  background: repeating-linear-gradient(45deg,
                    transparent 0 5px, var(--dumb-tl-span-bg, #2563eb) 5px 6px) }
  .dumb-tl-room > b { position: absolute; right: 4px; top: 50%; transform: translateY(-50%);
                      font-size: 10px; font-weight: 600; white-space: nowrap;
                      color: var(--dumb-tl-fg, #0f172a) }
`;
function DumbTimeline(props) {
  injectStyle("timeline", STYLES);
  const colW = () => props.colW ?? props.scale?.colW ?? 34;
  const rowH = () => props.rowH ?? 34;
  const headW = () => props.headW ?? 200;
  const rowIds = createMemo(() => props.rows.map((r) => r.id));
  const scale = createMemo(() => {
    const first = props.from ?? props.scale?.first;
    if (!first) throw new Error("DumbTimeline: \u043D\u0443\u0436\u0435\u043D \u043F\u0440\u043E\u043F `from` \u0438\u043B\u0438 `scale.first`");
    return {
      first,
      days: props.days ?? props.scale?.days ?? 30,
      colW: colW(),
      dayStart: props.dayStart ?? props.scale?.dayStart ?? 0,
      dayEnd: props.dayEnd ?? props.scale?.dayEnd ?? 1440,
      stepMin: props.stepMin ?? props.scale?.stepMin ?? 1440,
      snapMin: props.snapMin ?? props.scale?.snapMin,
      minMin: props.minMin ?? props.scale?.minMin,
      checkIn: props.checkIn ?? props.scale?.checkIn,
      checkOut: props.checkOut ?? props.scale?.checkOut
    };
  });
  const cols = createMemo(() => columns(scale()));
  const groups = createMemo(() => headGroups(scale()));
  const [folded, setFolded] = createSignal(/* @__PURE__ */ new Set());
  const toggleGroup = (g) => setFolded((was) => {
    const next = new Set(was);
    next.has(g) ? next.delete(g) : next.add(g);
    return next;
  });
  const shownRows = createMemo(() => {
    const out = [];
    let current = null;
    for (const r of props.rows) {
      const g = r.group ?? null;
      if (g !== current) {
        current = g;
        if (g) out.push({
          kind: "group",
          id: g
        });
      }
      if (!g || !folded().has(g)) out.push({
        kind: "row",
        row: r
      });
    }
    return out;
  });
  const rowMap = createMemo(() => new Map(props.rows.map((r) => [r.id, r])));
  const spanById = createMemo(() => new Map(props.spans.map((s) => [s.id, s])));
  const spanIds = createMemo(() => props.spans.map((s) => s.id));
  const rulesOf = (rowId) => {
    const r = rowMap().get(rowId);
    const hourly = !dayGrid() && unitOf(rowId) === "hour";
    return {
      minMin: r?.minMin,
      gapMin: r?.gapMin ?? props.gapMin,
      openMin: hourly ? r?.openMin : void 0,
      closeMin: hourly ? r?.closeMin : void 0
    };
  };
  const gapOf = (rowId) => rulesOf(rowId).gapMin ?? 0;
  const unitOf = (rowId) => rowMap().get(rowId)?.unit ?? "day";
  const dayGrid = () => {
    const sc = scale();
    return sc.stepMin >= Math.max(1, sc.dayEnd - sc.dayStart);
  };
  const canResize = (rowId) => !(dayGrid() && unitOf(rowId) === "hour");
  const daily = createMemo(() => {
    const sc = scale();
    const win = Math.max(1, sc.dayEnd - sc.dayStart);
    return {
      ...sc,
      stepMin: win,
      snapMin: void 0,
      colW: sc.colW * win / sc.stepMin
    };
  });
  const scaleOf = (rowId) => !dayGrid() && unitOf(rowId) === "day" ? daily() : scale();
  const free = (next) => !props.spans.some((s) => s.id !== next.id && s.row === next.row && conflicts(next, s, scale(), gapOf(next.row)));
  const settle = (want) => {
    if (free(want)) return want;
    const sc = scaleOf(want.row);
    const step = snapOf(sc);
    const at = toMinutes(want.from, sc, "from");
    for (let i = 1; i <= 24; i++) {
      for (const dir of [-1, 1]) {
        const min = at + i * dir * step;
        if (min < 0) continue;
        const test = {
          ...want,
          ...moveTo(want, min, sc, rulesOf(want.row))
        };
        if (free(test)) return test;
      }
    }
    return null;
  };
  const floors = createMemo(() => stackFloors(props.spans, scale(), gapOf));
  const perRow = createMemo(() => floorsPerRow(props.spans, floors()));
  const levelsOf = (row) => Math.max(1, perRow().get(row) ?? 1);
  const rowGeom = createMemo(() => {
    const tops = /* @__PURE__ */ new Map();
    const heights = [];
    const offsets = [];
    const items = shownRows();
    let y = 0;
    for (const it of items) {
      const h = it.kind === "group" ? Math.round(rowH() * 0.72) : rowH() * levelsOf(it.row.id);
      if (it.kind === "row") tops.set(it.row.id, y);
      offsets.push(y);
      heights.push(h);
      y += h;
    }
    offsets.push(y);
    return {
      tops,
      heights,
      offsets,
      total: y,
      items
    };
  });
  const rowOrder = createMemo(() => {
    const order = /* @__PURE__ */ new Map();
    props.rows.forEach((r, i) => order.set(r.id, i));
    return order;
  });
  const rowAtY = (y) => {
    const {
      items,
      offsets
    } = rowGeom();
    if (!items.length) return 0;
    let lo = 0;
    let hi = items.length - 1;
    while (lo < hi) {
      const mid = lo + hi + 1 >> 1;
      if (offsets[mid] <= y) lo = mid;
      else hi = mid - 1;
    }
    for (let i = lo; i >= 0; i--) {
      const it = items[i];
      if (it.kind === "row") return rowOrder().get(it.row.id) ?? 0;
    }
    for (let i = lo + 1; i < items.length; i++) {
      const it = items[i];
      if (it.kind === "row") return rowOrder().get(it.row.id) ?? 0;
    }
    return 0;
  };
  function swallowNextClick() {
    const kill = (e) => {
      e.stopPropagation();
      e.preventDefault();
    };
    window.addEventListener("click", kill, {
      capture: true,
      once: true
    });
    setTimeout(() => window.removeEventListener("click", kill, true), 0);
  }
  const [pick, setPick] = createSignal(null);
  let scrollRaf = 0;
  onCleanup(() => scrollRaf && cancelAnimationFrame(scrollRaf));
  const [hovered, setHovered] = createSignal(null);
  const roomOf = (span) => {
    if (props.readonly || !props.showRoom) return null;
    const sc = scale();
    const end = toMinutes(span.to, sc, "to");
    const edge = totalCols(sc) * sc.stepMin;
    const limit = clampEdge(span, "to", edge, props.spans, sc, gapOf(span.row), rulesOf(span.row));
    if (limit === null || limit <= end) return null;
    const minutes = limit - end;
    return {
      x: toX(end, sc),
      w: toX(limit, sc) - toX(end, sc),
      minutes
    };
  };
  const [draft, setDraft] = createSignal(null);
  let canvas;
  let viewport;
  const [vpW, setVpW] = createSignal(0);
  const visibleRange = () => {
    const sc = scale();
    const left = viewport?.scrollLeft ?? 0;
    const width = Math.max(0, vpW() - headW());
    const edge = totalCols(sc) * sc.stepMin;
    const clamp = (m) => Math.min(Math.max(0, m), edge);
    return {
      from: toMoment(clamp(fromX(left, sc, false)), sc),
      to: toMoment(clamp(fromX(left + width, sc, false)), sc, true)
    };
  };
  const api = {
    scrollTo: (at) => {
      if (!viewport) return;
      viewport.scrollLeft = momentX(at, scale(), "from");
    },
    // «сейчас» — НАСТЕННОЕ время, как и все моменты кита. `toISOString` тут
    // была бы ошибкой: она отдаёт UTC, и вне нулевого пояса «Сегодня»
    // промахивалось бы на смещение зоны.
    scrollToNow: () => api.scrollTo(props.now ?? Temporal.Now.plainDateTimeISO().toString().slice(0, 16)),
    visibleRange
  };
  onMounted(() => {
    props.ref?.(api);
    if (!viewport) return;
    const ro = new ResizeObserver((es) => setVpW(es[0]?.contentRect.width ?? 0));
    ro.observe(viewport);
    onCleanup(() => ro.disconnect());
  });
  createEffect(() => {
    scale();
    if (vpW() > 0) props.onVisibleRange?.(visibleRange());
  });
  let origin = null;
  const toLocal = (cx, cy) => ({
    x: cx - origin.x + ((viewport?.scrollLeft ?? 0) - origin.sl),
    y: cy - origin.y + ((viewport?.scrollTop ?? 0) - origin.st)
  });
  const aborts = /* @__PURE__ */ new Set();
  onCleanup(() => {
    for (const abort of [...aborts]) abort();
  });
  function snapOrigin(then) {
    const io = new IntersectionObserver((entries) => {
      const r = entries[0]?.boundingClientRect;
      if (r) {
        origin = {
          x: r.left,
          y: r.top,
          sl: viewport?.scrollLeft ?? 0,
          st: viewport?.scrollTop ?? 0
        };
      }
      io.disconnect();
      then();
    });
    io.observe(canvas);
  }
  function startDrag(ev, span, mode) {
    if (ev.button !== 0) return;
    if (ev.isPrimary === false) return;
    if (props.readonly || props.spanLocked?.(span)) return;
    if (mode !== "move" && !canResize(span.row)) return;
    ev.preventDefault();
    ev.stopPropagation();
    const target = ev.currentTarget;
    target.setPointerCapture?.(ev.pointerId);
    suppressTextSelection();
    const grabbedAt = {
      x: ev.clientX,
      y: ev.clientY
    };
    const startSpan = span;
    let moved = false;
    const apply = (cx, cy) => {
      if (!origin) return;
      const {
        x,
        y
      } = toLocal(cx, cy);
      let next;
      if (mode === "move") {
        const rows = rowIds();
        const rowIdx = Math.max(0, Math.min(rows.length - 1, rowAtY(y)));
        const sc = scaleOf(rows[rowIdx]);
        const step = snapOf(sc);
        const shiftedMin = (cx - grabbedAt.x) / sc.colW * sc.stepMin;
        const startMin = toMinutes(startSpan.from, sc, "from") + Math.round(shiftedMin / step) * step;
        const moved2 = moveTo(startSpan, Math.max(0, startMin), sc, rulesOf(rows[rowIdx]));
        const want = {
          ...startSpan,
          ...moved2,
          row: rows[rowIdx]
        };
        const ok = settle(want);
        if (!ok) return;
        next = ok;
      } else {
        const sc = scaleOf(startSpan.row);
        const want = snapEdge(x, sc, mode);
        const at = clampEdge(startSpan, mode, toMinutes(want, sc, mode), props.spans, sc, gapOf(startSpan.row), rulesOf(startSpan.row));
        if (at === null) return;
        next = mode === "from" ? {
          ...startSpan,
          from: toMoment(at, sc)
        } : {
          ...startSpan,
          to: toMoment(at, sc)
        };
      }
      setDraft({
        id: startSpan.id,
        next,
        ok: free(next)
      });
    };
    const onMove = (e) => {
      if (Math.abs(e.clientX - grabbedAt.x) > 3 || Math.abs(e.clientY - grabbedAt.y) > 3) {
        moved = true;
      }
      apply(e.clientX, e.clientY);
    };
    let dead = false;
    const cleanup = () => {
      dead = true;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointermove", remember);
      restoreTextSelection();
      aborts.delete(abort);
    };
    const abort = () => {
      cleanup();
      if (moved) swallowNextClick();
      setDraft(null);
      origin = null;
    };
    const onCancel = () => abort();
    const onKey = (e) => {
      if (e.key === "Escape") abort();
    };
    const onUp = () => {
      cleanup();
      if (moved) swallowNextClick();
      const d = draft();
      setDraft(null);
      origin = null;
      if (!d) return;
      const sc0 = scale();
      const same = d.next.row === startSpan.row && toMinutes(d.next.from, sc0, "from") === toMinutes(startSpan.from, sc0, "from") && toMinutes(d.next.to, sc0, "to") === toMinutes(startSpan.to, sc0, "to");
      if (same) return;
      const landed = free(d.next) ? d.next : null;
      if (!landed) return;
      const kind = mode === "move" ? "move" : mode === "from" ? "resize-from" : "resize-to";
      void props.onChange?.(landed, startSpan, kind);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("keydown", onKey);
    aborts.add(abort);
    let last = {
      x: ev.clientX,
      y: ev.clientY
    };
    const remember = (e) => {
      last = {
        x: e.clientX,
        y: e.clientY
      };
    };
    window.addEventListener("pointermove", remember);
    snapOrigin(() => {
      window.removeEventListener("pointermove", remember);
      if (dead) return;
      apply(last.x, last.y);
    });
  }
  const shownSpan = (s) => {
    const d = draft();
    return d && d.id === s.id ? d.next : s;
  };
  return (() => {
    var _el$ = _tmpl$4(), _el$2 = _el$.firstChild, _el$3 = _el$2.firstChild, _el$5 = _el$3.nextSibling, _el$6 = _el$5.firstChild, _el$7 = _el$6.nextSibling, _el$9 = _el$5.nextSibling, _el$0 = _el$9.nextSibling;
    _el$.addEventListener("scroll", () => {
      if (!props.onVisibleRange) return;
      if (scrollRaf) return;
      scrollRaf = requestAnimationFrame(() => {
        scrollRaf = 0;
        props.onVisibleRange(visibleRange());
      });
    });
    var _ref$ = viewport;
    typeof _ref$ === "function" ? use(_ref$, _el$) : viewport = _el$;
    insert(_el$3, createComponent(Show, {
      get when() {
        return props.summary;
      },
      get children() {
        var _el$4 = _tmpl$();
        insert(_el$4, () => props.summaryTitle ?? "\u0421\u0432\u043E\u0431\u043E\u0434\u043D\u043E");
        return _el$4;
      }
    }));
    insert(_el$6, createComponent(For, {
      get each() {
        return groups();
      },
      children: (g) => (() => {
        var _el$10 = _tmpl$5();
        insert(_el$10, () => props.groupLabel?.(g.at, g.span) ?? defaultGroupLabel(g.at, scale()));
        return _el$10;
      })()
    }));
    insert(_el$7, createComponent(For, {
      get each() {
        return cols();
      },
      children: (at) => (() => {
        var _el$11 = _tmpl$6();
        insert(_el$11, () => props.dayLabel?.(at) ?? defaultDayLabel(at, scale()));
        effect(() => className(_el$11, `dumb-tl-day ${props.dayClass?.(at) ?? ""}`));
        return _el$11;
      })()
    }));
    insert(_el$5, createComponent(Show, {
      get when() {
        return props.summary;
      },
      get children() {
        var _el$8 = _tmpl$2();
        insert(_el$8, createComponent(For, {
          get each() {
            return cols();
          },
          children: (at) => (() => {
            var _el$12 = _tmpl$7();
            insert(_el$12, () => props.summary(at));
            return _el$12;
          })()
        }));
        effect((_$p) => setStyleProperty(_el$8, "grid-template-columns", `repeat(${totalCols(scale())}, ${colW()}px)`));
        return _el$8;
      }
    }), null);
    insert(_el$9, createComponent(For, {
      get each() {
        return rowGeom().items;
      },
      children: (it, i) => createComponent(Show, {
        get when() {
          return it.kind === "row";
        },
        get fallback() {
          return (
            // заголовок группы: щелчок сворачивает — этажей и корпусов
            // бывает много, и без сворачивания сетка не читается
            (() => {
              var _el$14 = _tmpl$8(), _el$15 = _el$14.firstChild;
              _el$14.$$click = () => toggleGroup(it.id);
              insert(_el$15, () => folded().has(it.id) ? "\u25B8" : "\u25BE");
              insert(_el$14, () => it.id, null);
              effect((_$p) => setStyleProperty(_el$14, "height", `${rowGeom().heights[i()]}px`));
              return _el$14;
            })()
          );
        },
        get children() {
          var _el$13 = _tmpl$6();
          insert(_el$13, () => it.row.title);
          effect((_p$) => {
            var _v$7 = `dumb-tl-row ${props.rowClass?.(it.row) ?? ""}`, _v$8 = props.rowDisabled?.(it.row) ? "1" : void 0, _v$9 = `${rowGeom().heights[i()]}px`;
            _v$7 !== _p$.e && className(_el$13, _p$.e = _v$7);
            _v$8 !== _p$.t && setAttribute(_el$13, "data-off", _p$.t = _v$8);
            _v$9 !== _p$.a && setStyleProperty(_el$13, "height", _p$.a = _v$9);
            return _p$;
          }, {
            e: void 0,
            t: void 0,
            a: void 0
          });
          return _el$13;
        }
      })
    }));
    _el$0.$$click = (ev) => {
      if (!props.onEmptyClick || ev.target !== ev.currentTarget) return;
      const cx = ev.clientX;
      const cy = ev.clientY;
      const sc = scale();
      snapOrigin(() => {
        if (!origin) return;
        const {
          x,
          y
        } = toLocal(cx, cy);
        props.onEmptyClick(toMoment(Math.max(0, fromX(x, sc)), sc), rowIds()[rowAtY(y)]);
      });
    };
    _el$0.$$contextmenu = (ev) => {
      if (!props.onEmptyContextMenu || ev.target !== ev.currentTarget) return;
      ev.preventDefault();
      const cx = ev.clientX;
      const cy = ev.clientY;
      const sc = scale();
      snapOrigin(() => {
        if (!origin) return;
        const {
          x,
          y
        } = toLocal(cx, cy);
        const at = toMoment(Math.max(0, fromX(x, sc)), sc);
        props.onEmptyContextMenu(at, rowIds()[rowAtY(y)], ev);
      });
    };
    _el$0.$$pointerdown = (ev) => {
      if (ev.button !== 0) return;
      if (ev.isPrimary === false) return;
      if (!props.onRangeSelect || ev.target !== ev.currentTarget) return;
      const sc = scale();
      const gridEdge = totalCols(sc) * sc.stepMin;
      const startClient = {
        x: ev.clientX,
        y: ev.clientY
      };
      let last = {
        ...startClient
      };
      let upX = null;
      const minPick = (rowId) => Math.max(snapOf(sc), minLength(sc, rulesOf(rowId)));
      const begin = () => {
        if (!origin) return;
        const {
          x,
          y
        } = toLocal(startClient.x, startClient.y);
        const row = props.rows[rowAtY(y)];
        if (!row || props.rowDisabled?.(row)) return;
        const a = Math.min(Math.max(0, fromX(x, sc)), gridEdge);
        setPick({
          row: row.id,
          a,
          b: Math.min(a + minPick(row.id), gridEdge)
        });
      };
      const update = (cx) => {
        if (!origin) return;
        const at = Math.min(Math.max(0, fromX(toLocal(cx, 0).x, sc)), gridEdge);
        setPick((was) => {
          if (!was) return was;
          const b = at >= was.a ? Math.max(at, Math.min(was.a + minPick(was.row), gridEdge)) : at;
          return {
            ...was,
            b
          };
        });
      };
      const finish = (endX) => {
        const p = pick();
        setPick(null);
        if (!p) return;
        if (Math.abs(endX - startClient.x) < sc.colW / 2) return;
        swallowNextClick();
        let [a, b] = [Math.min(p.a, p.b), Math.max(p.a, p.b)];
        b = Math.min(b, gridEdge);
        const rules = rulesOf(p.row);
        const rowGap = gapOf(p.row);
        if (confined(sc, rules)) {
          const rb = rowBounds(a, sc, rules);
          a = Math.max(a, rb.start);
          b = Math.min(b, rb.end);
        }
        for (const o of props.spans) {
          if (o.row !== p.row) continue;
          const oa = toMinutes(o.from, sc, "from");
          const ob = toMinutes(o.to, sc, "to");
          if (oa >= b || ob <= a) continue;
          if (oa >= a) b = Math.min(b, oa - rowGap);
          else a = Math.max(a, ob + rowGap);
        }
        const need = minLength(sc, rules);
        if (b - a < need) {
          b = a + need;
          if (b > gridEdge) return;
          if (confined(sc, rules) && b > rowBounds(a, sc, rules).end) return;
          const clash = props.spans.some((o) => {
            if (o.row !== p.row) return false;
            const oa = toMinutes(o.from, sc, "from");
            const ob = toMinutes(o.to, sc, "to");
            return a < ob + rowGap && oa < b + rowGap;
          });
          if (clash) return;
        }
        if (b <= a) return;
        const hourly = unitOf(p.row) === "hour";
        props.onRangeSelect({
          row: p.row,
          // Суточной строке отдаём ДАТЫ БЕЗ ВРЕМЕНИ: час заезда и выезда
          // подставит сама шкала (16:00 → 12:00). Написать сюда полночь
          // значило бы соврать на полсуток с каждого края.
          from: dayGrid() && !hourly ? toMoment(a, sc).slice(0, 10) : toMoment(a, sc),
          to: dayGrid() && !hourly ? toMoment(b, sc).slice(0, 10) : toMoment(b, sc, true),
          needsTime: hourly && dayGrid()
        });
      };
      const move = (e) => {
        last = {
          x: e.clientX,
          y: e.clientY
        };
        update(e.clientX);
      };
      const cleanup = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", cancel);
        window.removeEventListener("keydown", key);
        aborts.delete(cancel);
      };
      let dead = false;
      const cancel = () => {
        cleanup();
        dead = true;
        upX = null;
        setPick(null);
      };
      const key = (e) => {
        if (e.key === "Escape") cancel();
      };
      const up = (e) => {
        cleanup();
        if (!pick()) {
          upX = e.clientX;
          return;
        }
        finish(e.clientX);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", cancel);
      window.addEventListener("keydown", key);
      aborts.add(cancel);
      snapOrigin(() => {
        if (dead) return;
        begin();
        if (upX !== null) {
          update(upX);
          finish(upX);
        } else {
          update(last.x);
        }
      });
    };
    var _ref$2 = canvas;
    typeof _ref$2 === "function" ? use(_ref$2, _el$0) : canvas = _el$0;
    insert(_el$0, createComponent(For, {
      get each() {
        return rowGeom().items;
      },
      children: (_, i) => (() => {
        var _el$16 = _tmpl$9();
        effect((_$p) => setStyleProperty(_el$16, "top", `${rowGeom().offsets[i() + 1]}px`));
        return _el$16;
      })()
    }), null);
    insert(_el$0, createComponent(Show, {
      get when() {
        return !dayGrid();
      },
      get children() {
        return createComponent(For, {
          get each() {
            return props.rows;
          },
          children: (row) => {
            const sc = () => scale();
            const win = () => Math.max(1, sc().dayEnd - sc().dayStart);
            const openW = () => toX(Math.min(Math.max((row.openMin ?? sc().dayStart) - sc().dayStart, 0), win()), sc());
            const closeAt = () => toX(Math.min(Math.max((row.closeMin ?? sc().dayEnd) - sc().dayStart, 0), win()), sc());
            const top = () => rowGeom().tops.get(row.id);
            const height = () => rowH() * levelsOf(row.id);
            return createComponent(Show, {
              get when() {
                return memo(() => !!(row.openMin != null || row.closeMin != null))() && top() != null;
              },
              get children() {
                return createComponent(For, {
                  get each() {
                    return Array.from({
                      length: scale().days
                    }, (_, d) => d);
                  },
                  children: (d) => [createComponent(Show, {
                    get when() {
                      return openW() > 0;
                    },
                    get children() {
                      var _el$17 = _tmpl$0();
                      effect((_p$) => {
                        var _v$0 = `translate(${toX(d * win(), sc())}px, ${top()}px)`, _v$1 = `${openW()}px`, _v$10 = `${height()}px`;
                        _v$0 !== _p$.e && setStyleProperty(_el$17, "transform", _p$.e = _v$0);
                        _v$1 !== _p$.t && setStyleProperty(_el$17, "width", _p$.t = _v$1);
                        _v$10 !== _p$.a && setStyleProperty(_el$17, "height", _p$.a = _v$10);
                        return _p$;
                      }, {
                        e: void 0,
                        t: void 0,
                        a: void 0
                      });
                      return _el$17;
                    }
                  }), createComponent(Show, {
                    get when() {
                      return closeAt() < toX(win(), sc());
                    },
                    get children() {
                      var _el$18 = _tmpl$0();
                      effect((_p$) => {
                        var _v$11 = `translate(${toX(d * win(), sc()) + closeAt()}px, ${top()}px)`, _v$12 = `${toX(win(), sc()) - closeAt()}px`, _v$13 = `${height()}px`;
                        _v$11 !== _p$.e && setStyleProperty(_el$18, "transform", _p$.e = _v$11);
                        _v$12 !== _p$.t && setStyleProperty(_el$18, "width", _p$.t = _v$12);
                        _v$13 !== _p$.a && setStyleProperty(_el$18, "height", _p$.a = _v$13);
                        return _p$;
                      }, {
                        e: void 0,
                        t: void 0,
                        a: void 0
                      });
                      return _el$18;
                    }
                  })]
                });
              }
            });
          }
        });
      }
    }), null);
    insert(_el$0, createComponent(Show, {
      get when() {
        return pick();
      },
      children: (p) => {
        const sc = () => scale();
        const x = () => toX(Math.min(p().a, p().b), sc());
        const w = () => toX(Math.abs(p().b - p().a), sc());
        const top = () => rowGeom().tops.get(p().row) ?? 0;
        const hrs = () => Math.abs(p().b - p().a);
        return (() => {
          var _el$19 = _tmpl$1();
          insert(_el$19, () => fmtRoom(hrs(), scale()));
          effect((_p$) => {
            var _v$14 = `translate(${x()}px, ${top() + 3}px)`, _v$15 = `${w()}px`, _v$16 = `${rowH() - 6}px`;
            _v$14 !== _p$.e && setStyleProperty(_el$19, "transform", _p$.e = _v$14);
            _v$15 !== _p$.t && setStyleProperty(_el$19, "width", _p$.t = _v$15);
            _v$16 !== _p$.a && setStyleProperty(_el$19, "height", _p$.a = _v$16);
            return _p$;
          }, {
            e: void 0,
            t: void 0,
            a: void 0
          });
          return _el$19;
        })();
      }
    }), null);
    insert(_el$0, createComponent(Show, {
      get when() {
        return props.now;
      },
      get children() {
        var _el$1 = _tmpl$3();
        effect((_$p) => setStyleProperty(_el$1, "left", `${momentX(props.now, scale(), "from")}px`));
        return _el$1;
      }
    }), null);
    insert(_el$0, createComponent(For, {
      get each() {
        return spanIds();
      },
      children: (id) => {
        const span = () => spanById().get(id);
        const view = () => shownSpan(span());
        const box = () => {
          const sc = scale();
          const x = momentX(view().from, sc, "from");
          const w = Math.max(momentX(view().to, sc, "to") - x, sc.colW * 0.4);
          return {
            x,
            w,
            y: rowGeom().tops.get(view().row) ?? 0
          };
        };
        const dragging = () => draft()?.id === id;
        const floor = () => floors().get(id) ?? 0;
        const room = () => hovered() === id ? roomOf(view()) : null;
        const tailW = () => {
          if (dayGrid()) return 0;
          const g = gapOf(view().row);
          if (g <= 0) return 0;
          const sc = scale();
          const end = toMinutes(view().to, sc, "to");
          const rules = rulesOf(view().row);
          const wall = Math.min(confined(sc, rules) ? rowBounds(Math.max(0, end - 1), sc, rules).end : Infinity, totalCols(sc) * sc.stepMin);
          return Math.max(0, toX(Math.min(end + g, wall), sc) - toX(end, sc));
        };
        return [createComponent(Show, {
          get when() {
            return tailW() > 0;
          },
          get children() {
            var _el$20 = _tmpl$10();
            effect((_p$) => {
              var _v$17 = `\u0437\u0430\u0437\u043E\u0440 ${gapOf(view().row)} \u043C\u0438\u043D`, _v$18 = `translate(${box().x + box().w}px, ${box().y + floor() * rowH()}px)`, _v$19 = `${tailW()}px`, _v$20 = `${rowH() - 6}px`;
              _v$17 !== _p$.e && setAttribute(_el$20, "title", _p$.e = _v$17);
              _v$18 !== _p$.t && setStyleProperty(_el$20, "transform", _p$.t = _v$18);
              _v$19 !== _p$.a && setStyleProperty(_el$20, "width", _p$.a = _v$19);
              _v$20 !== _p$.o && setStyleProperty(_el$20, "height", _p$.o = _v$20);
              return _p$;
            }, {
              e: void 0,
              t: void 0,
              a: void 0,
              o: void 0
            });
            return _el$20;
          }
        }), createComponent(Show, {
          get when() {
            return room();
          },
          children: (r) => (() => {
            var _el$24 = _tmpl$14(), _el$25 = _el$24.firstChild; _el$25.firstChild;
            insert(_el$25, () => fmtRoom(r().minutes, scale()), null);
            effect((_p$) => {
              var _v$29 = `translate(${r().x}px, ${box().y + floor() * rowH()}px)`, _v$30 = `${r().w}px`, _v$31 = `${rowH() - 6}px`;
              _v$29 !== _p$.e && setStyleProperty(_el$24, "transform", _p$.e = _v$29);
              _v$30 !== _p$.t && setStyleProperty(_el$24, "width", _p$.t = _v$30);
              _v$31 !== _p$.a && setStyleProperty(_el$24, "height", _p$.a = _v$31);
              return _p$;
            }, {
              e: void 0,
              t: void 0,
              a: void 0
            });
            return _el$24;
          })()
        }), (() => {
          var _el$21 = _tmpl$13();
          _el$21.$$click = (ev) => props.onOpen?.(span(), {
            x: ev.clientX,
            y: ev.clientY
          });
          _el$21.addEventListener("pointerleave", () => setHovered((was) => was === id ? null : was));
          _el$21.addEventListener("pointerenter", () => setHovered(id));
          _el$21.$$pointerdown = (ev) => startDrag(ev, span(), "move");
          _el$21.$$contextmenu = (ev) => {
            if (!props.onSpanContextMenu) return;
            ev.preventDefault();
            ev.stopPropagation();
            props.onSpanContextMenu(span(), ev);
          };
          insert(_el$21, () => props.children?.(span()) ?? id, null);
          insert(_el$21, createComponent(Show, {
            get when() {
              return memo(() => !!(!props.readonly && !props.spanLocked?.(span())))() && canResize(view().row);
            },
            get children() {
              return [(() => {
                var _el$22 = _tmpl$11();
                _el$22.$$click = (ev) => ev.stopPropagation();
                _el$22.$$pointerdown = (ev) => startDrag(ev, span(), "from");
                return _el$22;
              })(), (() => {
                var _el$23 = _tmpl$12();
                _el$23.$$click = (ev) => ev.stopPropagation();
                _el$23.$$pointerdown = (ev) => startDrag(ev, span(), "to");
                return _el$23;
              })()];
            }
          }), null);
          effect((_p$) => {
            var _v$21 = `dumb-tl-span ${props.spanClass?.(span()) ?? ""}`, _v$22 = props.spanTitle?.(span()), _v$23 = props.spanLocked?.(span()) ? "1" : void 0, _v$24 = dragging() ? "1" : void 0, _v$25 = dragging() && !draft().ok ? "1" : void 0, _v$26 = `translate(${box().x}px, ${box().y + floor() * rowH()}px)`, _v$27 = `${box().w}px`, _v$28 = `${rowH() - 6}px`;
            _v$21 !== _p$.e && className(_el$21, _p$.e = _v$21);
            _v$22 !== _p$.t && setAttribute(_el$21, "title", _p$.t = _v$22);
            _v$23 !== _p$.a && setAttribute(_el$21, "data-locked", _p$.a = _v$23);
            _v$24 !== _p$.o && setAttribute(_el$21, "data-drag", _p$.o = _v$24);
            _v$25 !== _p$.i && setAttribute(_el$21, "data-bad", _p$.i = _v$25);
            _v$26 !== _p$.n && setStyleProperty(_el$21, "transform", _p$.n = _v$26);
            _v$27 !== _p$.s && setStyleProperty(_el$21, "width", _p$.s = _v$27);
            _v$28 !== _p$.h && setStyleProperty(_el$21, "height", _p$.h = _v$28);
            return _p$;
          }, {
            e: void 0,
            t: void 0,
            a: void 0,
            o: void 0,
            i: void 0,
            n: void 0,
            s: void 0,
            h: void 0
          });
          return _el$21;
        })()];
      }
    }), null);
    effect((_p$) => {
      var _v$ = `dumb-tl ${props.class ?? ""}`, _v$2 = {
        "--dumb-tl-head": `${headW()}px`,
        "--dumb-tl-col": `${colW()}px`,
        "--dumb-tl-row-h": `${rowH()}px`,
        // ширина СУТОК в пикселях — для жирной линии на стыке дней
        "--dumb-tl-day-w": `${Math.max(1, scale().dayEnd - scale().dayStart) / scale().stepMin * colW()}px`,
        "--dumb-tl-dayline": dayGrid() ? "var(--dumb-tl-line)" : "rgb(0 0 0 / .3)",
        ...props.style
      }, _v$3 = groups().map((g) => `${g.span * colW()}px`).join(" "), _v$4 = `repeat(${totalCols(scale())}, ${colW()}px)`, _v$5 = `${totalCols(scale()) * colW()}px`, _v$6 = `${rowGeom().total}px`;
      _v$ !== _p$.e && className(_el$, _p$.e = _v$);
      _p$.t = style(_el$, _v$2, _p$.t);
      _v$3 !== _p$.a && setStyleProperty(_el$6, "grid-template-columns", _p$.a = _v$3);
      _v$4 !== _p$.o && setStyleProperty(_el$7, "grid-template-columns", _p$.o = _v$4);
      _v$5 !== _p$.i && setStyleProperty(_el$0, "width", _p$.i = _v$5);
      _v$6 !== _p$.n && setStyleProperty(_el$0, "height", _p$.n = _v$6);
      return _p$;
    }, {
      e: void 0,
      t: void 0,
      a: void 0,
      o: void 0,
      i: void 0,
      n: void 0
    });
    return _el$;
  })();
}
var MONTHS_RU = ["\u044F\u043D\u0432\u0430\u0440\u044C", "\u0444\u0435\u0432\u0440\u0430\u043B\u044C", "\u043C\u0430\u0440\u0442", "\u0430\u043F\u0440\u0435\u043B\u044C", "\u043C\u0430\u0439", "\u0438\u044E\u043D\u044C", "\u0438\u044E\u043B\u044C", "\u0430\u0432\u0433\u0443\u0441\u0442", "\u0441\u0435\u043D\u0442\u044F\u0431\u0440\u044C", "\u043E\u043A\u0442\u044F\u0431\u0440\u044C", "\u043D\u043E\u044F\u0431\u0440\u044C", "\u0434\u0435\u043A\u0430\u0431\u0440\u044C"];
var WD_RU = ["\u0432\u0441", "\u043F\u043D", "\u0432\u0442", "\u0441\u0440", "\u0447\u0442", "\u043F\u0442", "\u0441\u0431"];
function defaultGroupLabel(at, s) {
  const d = /* @__PURE__ */ new Date(`${at.slice(0, 10)}T00:00:00Z`);
  if (s.stepMin >= Math.max(1, s.dayEnd - s.dayStart)) {
    return `${MONTHS_RU[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  }
  return `${d.getUTCDate()} ${MONTHS_RU[d.getUTCMonth()].slice(0, 3)}, ${WD_RU[d.getUTCDay()]}`;
}
function defaultDayLabel(at, s) {
  if (s.stepMin < Math.max(1, s.dayEnd - s.dayStart)) {
    if (at.slice(14, 16) !== "00") return "";
    return (() => {
      var _el$27 = _tmpl$15();
      insert(_el$27, () => at.slice(11, 13));
      return _el$27;
    })();
  }
  const d = /* @__PURE__ */ new Date(`${at.slice(0, 10)}T00:00:00Z`);
  return [memo(() => d.getUTCDate()), (() => {
    var _el$28 = _tmpl$16();
    insert(_el$28, () => WD_RU[d.getUTCDay()]);
    return _el$28;
  })()];
}
function fmtRoom(minutes, s) {
  if (s.stepMin >= 1440) {
    const win = Math.max(1, s.dayEnd - s.dayStart);
    return `${Math.round(minutes / win * 10) / 10} \u0441\u0443\u0442`;
  }
  const h = minutes / 60;
  return h >= 1 ? `${Math.round(h * 10) / 10} \u0447` : `${Math.round(minutes)} \u043C\u0438\u043D`;
}
delegateEvents(["pointerdown", "contextmenu", "click"]);

// src/timelineMath.ts
var plain = (day) => Temporal.PlainDate.from(day.slice(0, 10));
var daysApart = (a, b) => plain(a).until(plain(b), { largestUnit: "day" }).days;
var shiftDay = (day, n) => plain(day).add({ days: n }).toString();

export { DumbTimeline, SCALES, clampEdge, closesAtNight, columns, confined, conflicts, dayBounds, daysApart, floorsPerRow, fromX, headGroups, lengthOf, minLength, minutesOf, momentX, moveTo, rowBounds, shiftDay, snapEdge, snapOf, stackFloors, toMinutes, toMoment, toX, totalCols };

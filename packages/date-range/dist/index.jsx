// src/DumbDateRange.tsx
import { For, Show, createMemo, createSignal } from "solid-js";

// ../shared/dist/index.js
import * as solid from "solid-js";
import { createEffect, untrack } from "solid-js";
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

// src/dateMath.ts
var MS = 864e5;
var toDay = (d) => d.toISOString().slice(0, 10);
var dayToDate = (day) => /* @__PURE__ */ new Date(`${day}T00:00:00Z`);
var addDays = (day, n) => toDay(new Date(dayToDate(day).getTime() + n * MS));
var diffDays = (a, b) => Math.round((dayToDate(b).getTime() - dayToDate(a).getTime()) / MS);
var today = () => toDay(/* @__PURE__ */ new Date());
var weekday = (day) => dayToDate(day).getUTCDay();
var weekIndex = (day) => (weekday(day) + 6) % 7;
var startOfMonth = (day) => `${day.slice(0, 7)}-01`;
function endOfMonth(day) {
  const d = dayToDate(startOfMonth(day));
  d.setUTCMonth(d.getUTCMonth() + 1);
  return toDay(new Date(d.getTime() - MS));
}
var addMonths = (day, n) => {
  const d = dayToDate(startOfMonth(day));
  d.setUTCMonth(d.getUTCMonth() + n);
  return toDay(d);
};
function monthGrid(month) {
  const first = startOfMonth(month);
  const start = addDays(first, -weekIndex(first));
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}
var sameMonth = (a, b) => a.slice(0, 7) === b.slice(0, 7);
function orderRange(a, b) {
  return diffDays(a, b) < 0 ? [b, a] : [a, b];
}
var inRange = (day, from, to) => !!from && !!to && diffDays(from, day) >= 0 && diffDays(day, to) >= 0;
function daysBetween(from, to) {
  const n = diffDays(from, to);
  if (n < 0) return [];
  return Array.from({ length: n + 1 }, (_, i) => addDays(from, i));
}
var overlaps = (a, b) => diffDays(a.from, b.to) > 0 && diffDays(b.from, a.to) > 0;
function checkRange(args) {
  const nights = diffDays(args.from, args.to);
  if (nights < 0) return { ok: false, why: "\u043A\u043E\u043D\u0435\u0446 \u0440\u0430\u043D\u044C\u0448\u0435 \u043D\u0430\u0447\u0430\u043B\u0430" };
  if (args.min && diffDays(args.min, args.from) < 0) return { ok: false, why: "\u0441\u043B\u0438\u0448\u043A\u043E\u043C \u0440\u0430\u043D\u043E" };
  if (args.max && diffDays(args.to, args.max) < 0) return { ok: false, why: "\u0441\u043B\u0438\u0448\u043A\u043E\u043C \u043F\u043E\u0437\u0434\u043D\u043E" };
  if (args.minNights && nights < args.minNights) {
    return { ok: false, why: `\u043C\u0438\u043D\u0438\u043C\u0443\u043C ${args.minNights} \u043D\u043E\u0447.` };
  }
  if (args.maxNights && nights > args.maxNights) {
    return { ok: false, why: `\u043C\u0430\u043A\u0441\u0438\u043C\u0443\u043C ${args.maxNights} \u043D\u043E\u0447.` };
  }
  for (const b of args.busy ?? []) {
    if (overlaps({ from: args.from, to: args.to }, b)) return { ok: false, why: "\u0437\u0430\u043D\u044F\u0442\u043E" };
  }
  return { ok: true };
}
function reachTo(from, busy, limit) {
  let end = limit;
  for (const b of busy) {
    if (diffDays(from, b.from) > 0 && diffDays(b.from, end) >= 0) end = b.from;
  }
  return end;
}

// src/DumbDateRange.tsx
var WEEK = ["\u043F\u043D", "\u0432\u0442", "\u0441\u0440", "\u0447\u0442", "\u043F\u0442", "\u0441\u0431", "\u0432\u0441"];
var MONTHS = [
  "\u044F\u043D\u0432\u0430\u0440\u044C",
  "\u0444\u0435\u0432\u0440\u0430\u043B\u044C",
  "\u043C\u0430\u0440\u0442",
  "\u0430\u043F\u0440\u0435\u043B\u044C",
  "\u043C\u0430\u0439",
  "\u0438\u044E\u043D\u044C",
  "\u0438\u044E\u043B\u044C",
  "\u0430\u0432\u0433\u0443\u0441\u0442",
  "\u0441\u0435\u043D\u0442\u044F\u0431\u0440\u044C",
  "\u043E\u043A\u0442\u044F\u0431\u0440\u044C",
  "\u043D\u043E\u044F\u0431\u0440\u044C",
  "\u0434\u0435\u043A\u0430\u0431\u0440\u044C"
];
var STYLES = `
  /* \u041E\u0444\u043E\u0440\u043C\u043B\u0435\u043D\u0438\u0435 \u2014 daisyUI-\u043A\u043B\u0430\u0441\u0441\u0430\u043C\u0438 \u0432 \u0440\u0430\u0437\u043C\u0435\u0442\u043A\u0435 (btn, join, bg-base-*, text-error).
     \u0417\u0434\u0435\u0441\u044C \u043E\u0441\u0442\u0430\u0451\u0442\u0441\u044F \u0442\u043E, \u0447\u0435\u0433\u043E \u043A\u043B\u0430\u0441\u0441\u043E\u043C \u043D\u0435 \u0432\u044B\u0440\u0430\u0437\u0438\u0442\u044C: \u0441\u0435\u0442\u043A\u0430 \u043D\u0435\u0434\u0435\u043B\u0438, \u0434\u0438\u0430\u0433\u043E\u043D\u0430\u043B\u044C\u043D\u0430\u044F
     \u043F\u0435\u0440\u0435\u0447\u0451\u0440\u043A\u0438\u0432\u0430\u044E\u0449\u0430\u044F \u043F\u043E\u043B\u043E\u0441\u0430 \u0437\u0430\u043D\u044F\u0442\u043E\u0433\u043E \u0434\u043D\u044F \u0438 \u043A\u0440\u0430\u044F \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u043E\u0433\u043E \u043F\u0435\u0440\u0438\u043E\u0434\u0430. */
  .dumb-cal { user-select: none }
  .dumb-cal-grid { display: grid; grid-template-columns: repeat(7, 1fr) }
  .dumb-cal-day { position: relative; aspect-ratio: 1; display: grid; place-items: center }
  /* \u0437\u0430\u043D\u044F\u0442\u044B\u0439 \u0434\u0435\u043D\u044C \u043F\u0435\u0440\u0435\u0447\u0451\u0440\u043A\u043D\u0443\u0442 \u043F\u043E \u0434\u0438\u0430\u0433\u043E\u043D\u0430\u043B\u0438 \u2014 \u0432\u0438\u0434\u043D\u043E \u0438 \u0431\u0435\u0437 \u0446\u0432\u0435\u0442\u0430 */
  .dumb-cal-day[data-busy="1"]::after {
    content: ''; position: absolute; inset: 18%;
    background: linear-gradient(to top right, transparent 45%,
      currentColor 45%, currentColor 55%, transparent 55%) }
  .dumb-cal-day[data-edge="from"] { border-radius: 8px 0 0 8px }
  .dumb-cal-day[data-edge="to"] { border-radius: 0 8px 8px 0 }
  .dumb-cal-day[data-edge="both"] { border-radius: 8px }
  .dumb-cal-extra { position: absolute; left: 0; right: 0; bottom: 1px; font-size: 9px;
                    text-align: center }
`;
function DumbDateRange(props) {
  injectStyle("date-range", STYLES);
  const [shownMonth, setShownMonth] = createSignal(
    startOfMonth(props.value()?.from ?? today())
  );
  const [pending, setPending] = createSignal(null);
  const [hover, setHover] = createSignal(null);
  const busy = () => props.busy?.() ?? [];
  const marks = () => props.marks?.() ?? {};
  const shownRange = createMemo(() => {
    const start = pending();
    if (start) {
      const end = hover() ?? start;
      const [from, to] = orderRange(start, end);
      return { from, to };
    }
    return props.value();
  });
  const limit = createMemo(() => {
    const start = pending();
    if (!start) return null;
    return reachTo(start, busy(), props.max ?? "9999-12-31");
  });
  const isBusy = (day) => busy().some((b) => diffDays(b.from, day) >= 0 && diffDays(day, b.to) <= 0);
  function pick(day) {
    if (props.single) {
      props.onChange({ from: day, to: day });
      return;
    }
    const start = pending();
    if (!start) {
      setPending(day);
      return;
    }
    const [from, to] = orderRange(start, day);
    const check = checkRange({
      from,
      to,
      busy: busy(),
      minNights: props.minNights,
      maxNights: props.maxNights,
      min: props.min,
      max: props.max
    });
    if (!check.ok) {
      props.onReject?.(check.why);
      setPending(day);
      return;
    }
    setPending(null);
    props.onChange({ from, to });
  }
  const months = () => Array.from({ length: props.months ?? 1 }, (_, i) => addMonths(shownMonth(), i));
  const canBack = () => !props.min || diffDays(props.min, shownMonth()) > 0;
  const canFwd = () => !props.max || diffDays(addMonths(shownMonth(), props.months ?? 1), props.max) < 0;
  return <div
    class={`dumb-cal flex flex-wrap gap-5 ${props.class ?? ""}`}
    onMouseLeave={() => setHover(null)}
  >
      <For each={months()}>
        {(month, mi) => <div class="dumb-cal-month min-w-62">
            <div class="dumb-cal-head mb-1.5 flex items-center gap-1">
              <Show when={mi() === 0} fallback={<span class="dumb-cal-nav size-8" />}>
                <button
    type="button"
    class="dumb-cal-nav btn btn-sm btn-ghost btn-circle"
    disabled={!canBack()}
    onClick={() => setShownMonth(addMonths(shownMonth(), -1))}
  >
                  ‹
                </button>
              </Show>
              <div class="dumb-cal-title flex-1 text-center font-semibold capitalize">
                {MONTHS[Number(month.slice(5, 7)) - 1]} {month.slice(0, 4)}
              </div>
              <Show when={mi() === (props.months ?? 1) - 1} fallback={<span class="dumb-cal-nav size-8" />}>
                <button
    type="button"
    class="dumb-cal-nav btn btn-sm btn-ghost btn-circle"
    disabled={!canFwd()}
    onClick={() => setShownMonth(addMonths(shownMonth(), 1))}
  >
                  ›
                </button>
              </Show>
            </div>

            <div class="dumb-cal-grid">
              <For each={WEEK}>
                {(w) => <div class="dumb-cal-week pb-1 text-center text-xs font-medium">{w}</div>}
              </For>
              <For each={monthGrid(month)}>
                {(day) => {
    const range = () => shownRange();
    const edge = () => {
      const r = range();
      if (!r) return void 0;
      if (r.from === day && r.to === day) return "both";
      if (r.from === day) return "from";
      if (r.to === day) return "to";
      return void 0;
    };
    const mark = () => marks()[day];
    const beyond = () => {
      const l = limit();
      return !!l && diffDays(l, day) < 0 && diffDays(pending(), day) > 0;
    };
    const blocked = () => isBusy(day) || beyond() || !!props.min && diffDays(props.min, day) < 0 || !!props.max && diffDays(day, props.max) < 0;
    return <button
      type="button"
      class={`dumb-cal-day btn btn-ghost btn-sm h-auto min-h-0 p-0 font-normal ${edge() ? "btn-active btn-neutral font-semibold" : ""} ${inRange(day, range()?.from ?? null, range()?.to ?? null) && !edge() ? "bg-base-300" : ""} ${isBusy(day) ? "text-error" : ""} ${sameMonth(day, month) ? "" : "italic"} ${day === today() ? "font-bold underline" : ""} ${mark()?.class ?? ""}`}
      data-out={sameMonth(day, month) ? void 0 : "1"}
      data-today={day === today() ? "1" : void 0}
      data-busy={isBusy(day) ? "1" : void 0}
      data-in={inRange(day, range()?.from ?? null, range()?.to ?? null) ? "1" : void 0}
      data-edge={edge()}
      disabled={blocked()}
      title={busy().find((b) => diffDays(b.from, day) >= 0 && diffDays(day, b.to) <= 0)?.title ?? mark()?.title}
      onMouseEnter={() => setHover(day)}
      onClick={() => pick(day)}
    >
                      {Number(day.slice(8, 10))}
                      <Show when={props.dayExtra}>
                        <span class="dumb-cal-extra">{props.dayExtra(day)}</span>
                      </Show>
                    </button>;
  }}
              </For>
            </div>
          </div>}
      </For>
    </div>;
}
export {
  DumbDateRange,
  addDays,
  addMonths,
  checkRange,
  daysBetween,
  diffDays,
  endOfMonth,
  inRange,
  monthGrid,
  orderRange,
  overlaps,
  reachTo,
  sameMonth,
  startOfMonth,
  toDay,
  today,
  weekIndex,
  weekday
};

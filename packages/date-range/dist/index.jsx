// src/DumbDateRange.tsx
import { For, Show, createMemo, createSignal, onCleanup } from "solid-js";

// ../shared/dist/index.js
import * as solid from "solid-js";
import { createEffect, untrack } from "solid-js";
function watch(dep, fn, opts) {
  let first = true;
  let prev;
  createEffect(() => {
    const value = dep();
    const skip = first && (opts?.defer ?? false);
    first = false;
    const before = prev;
    prev = value;
    if (!skip) untrack(() => fn(value, before));
  });
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
  let hitRaf = 0;
  let hitX = 0;
  let hitY = 0;
  const dayAt = (x, y) => {
    const el = document.elementFromPoint(x, y);
    const btn = el?.closest("[data-day]");
    const day = btn?.dataset.day;
    return day ? { day, blocked: btn.disabled } : null;
  };
  function onDayDown(day, ev) {
    if (ev.button !== 0 || props.single) return;
    suppressTextSelection();
    setPending(day);
    setHover(day);
    let moved = false;
    const hit = () => {
      hitRaf = 0;
      const under = dayAt(hitX, hitY);
      if (!under) return;
      if (under.day !== day) moved = true;
      if (!under.blocked) setHover(under.day);
      else {
        const stopAt = limit();
        if (stopAt && diffDays(day, stopAt) > 0) setHover(addDays(stopAt, -1));
      }
    };
    const move = (e) => {
      hitX = e.clientX;
      hitY = e.clientY;
      if (!hitRaf) hitRaf = requestAnimationFrame(hit);
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", stop);
      if (hitRaf) cancelAnimationFrame(hitRaf);
      hitRaf = 0;
      restoreTextSelection();
    };
    const up = () => {
      const end = hover();
      stop();
      if (!moved || !end || end === day) return;
      pick(end);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", stop);
    onCleanup(stop);
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
      return !!l && diffDays(l, day) > 0;
    };
    const blocked = () => isBusy(day) || beyond() || !!props.min && diffDays(props.min, day) < 0 || !!props.max && diffDays(day, props.max) < 0;
    return <button
      type="button"
      class={`dumb-cal-day btn btn-ghost btn-sm h-auto min-h-0 p-0 font-normal ${edge() ? "btn-active btn-neutral font-semibold" : ""} ${inRange(day, range()?.from ?? null, range()?.to ?? null) && !edge() ? "bg-base-300" : ""} ${isBusy(day) ? "text-error" : ""} ${sameMonth(day, month) ? "" : "italic"} ${day === today() ? "font-bold underline" : ""} ${mark()?.class ?? ""}`}
      data-day={day}
      data-out={sameMonth(day, month) ? void 0 : "1"}
      data-today={day === today() ? "1" : void 0}
      data-busy={isBusy(day) ? "1" : void 0}
      data-in={inRange(day, range()?.from ?? null, range()?.to ?? null) ? "1" : void 0}
      data-edge={edge()}
      disabled={blocked()}
      title={busy().find((b) => diffDays(b.from, day) >= 0 && diffDays(day, b.to) <= 0)?.title ?? mark()?.title}
      onMouseEnter={() => setHover(day)}
      onPointerDown={(ev) => onDayDown(day, ev)}
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

// src/DumbDateTimeRange.tsx
import { For as For3, Show as Show3, createMemo as createMemo3, createSignal as createSignal2, onCleanup as onCleanup2 } from "solid-js";

// src/DumbTimeSelect.tsx
import { For as For2, Show as Show2, createMemo as createMemo2 } from "solid-js";

// src/timeMath.ts
var pad2 = (n) => n < 10 ? `0${n}` : String(n);
function toMin(time) {
  const [h, m] = time.split(":");
  const hh = Number(h);
  const mm = Number(m);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return 0;
  return hh * 60 + mm;
}
function toTime(min) {
  const safe = Math.max(0, Math.round(min));
  return `${pad2(Math.floor(safe / 60))}:${pad2(safe % 60)}`;
}
var absMin = (m, base) => diffDays(base, m.day) * 1440 + toMin(m.time);
function fromAbsMin(min, base) {
  const days = Math.floor(min / 1440);
  const rest = min - days * 1440;
  const day = shiftDay(base, days);
  return { day, time: toTime(rest) };
}
function shiftDay(day, n) {
  if (n === 0) return day;
  const d = /* @__PURE__ */ new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
var minutesBetween = (from, to) => absMin(to, from.day) - toMin(from.time);
var snapTime = (time, step) => toTime(Math.floor(toMin(time) / step) * step);
function slotsOfDay(opts) {
  const step = opts.step > 0 ? opts.step : 30;
  const open = Math.max(0, opts.openMin ?? 0);
  const close = Math.min(1440, opts.closeMin ?? 1440);
  const out = [];
  for (let m = Math.ceil(open / step) * step; m < close; m += step) out.push(toTime(m));
  return out;
}
function overlapsMoment(a, b) {
  const base = a.from.day;
  return absMin(a.from, base) < absMin(b.to, base) && absMin(b.from, base) < absMin(a.to, base);
}
function slotBusy(day, time, step, busy) {
  const slot = { from: { day, time }, to: fromAbsMin(toMin(time) + step, day) };
  return busy.find((b) => overlapsMoment(slot, b)) ?? null;
}
function reachToMoment(from, busy, limit) {
  const base = from.day;
  const start = toMin(from.time);
  let end = absMin(limit, base);
  for (const b of busy) {
    const bs = absMin(b.from, base);
    if (bs >= start && bs < end) end = bs;
  }
  return fromAbsMin(end, base);
}
function checkMomentRange(args) {
  const base = args.from.day;
  const from = absMin(args.from, base);
  const to = absMin(args.to, base);
  const length = to - from;
  if (length <= 0) return { ok: false, why: "\u043A\u043E\u043D\u0435\u0446 \u0440\u0430\u043D\u044C\u0448\u0435 \u043D\u0430\u0447\u0430\u043B\u0430" };
  if (args.min && from < absMin(args.min, base)) return { ok: false, why: "\u0441\u043B\u0438\u0448\u043A\u043E\u043C \u0440\u0430\u043D\u043E" };
  if (args.max && to > absMin(args.max, base)) return { ok: false, why: "\u0441\u043B\u0438\u0448\u043A\u043E\u043C \u043F\u043E\u0437\u0434\u043D\u043E" };
  if (args.minMinutes && length < args.minMinutes) {
    return { ok: false, why: `\u043C\u0438\u043D\u0438\u043C\u0443\u043C ${fmtLength(args.minMinutes)}` };
  }
  if (args.maxMinutes && length > args.maxMinutes) {
    return { ok: false, why: `\u043C\u0430\u043A\u0441\u0438\u043C\u0443\u043C ${fmtLength(args.maxMinutes)}` };
  }
  for (const b of args.busy ?? []) {
    if (overlapsMoment({ from: args.from, to: args.to }, b)) {
      return { ok: false, why: b.title ? `\u0437\u0430\u043D\u044F\u0442\u043E: ${b.title}` : "\u0437\u0430\u043D\u044F\u0442\u043E" };
    }
  }
  return { ok: true };
}
function fmtLength(minutes) {
  if (minutes % 1440 === 0) return `${minutes / 1440} \u0441\u0443\u0442`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} \u043C\u0438\u043D`;
  return m ? `${h} \u0447 ${m} \u043C\u0438\u043D` : `${h} \u0447`;
}
var fmtMoment = (m) => `${m.day.slice(8, 10)}.${m.day.slice(5, 7)} ${m.time}`;

// src/DumbTimeSelect.tsx
function DumbTimeSelect(props) {
  const step = () => props.step ?? 30;
  const open = () => Math.max(0, props.openMin ?? 0);
  const close = () => Math.min(1440, props.closeMin ?? 1440);
  const busy = () => props.busy?.() ?? [];
  const cur = () => props.value() ?? toTime(open());
  const curH = () => Math.floor(toMin(cur()) / 60);
  const curM = () => toMin(cur()) % 60;
  const hours = createMemo2(() => {
    const out = [];
    for (let h = Math.floor(open() / 60); h * 60 < close(); h++) out.push(h);
    return out;
  });
  const minutes = createMemo2(() => {
    const s = step();
    if (s >= 60) return [0];
    const out = [];
    for (let m = 0; m < 60; m += s) out.push(m);
    return out;
  });
  const hourBusy = (h) => {
    if (!props.day) return null;
    const s = Math.min(step(), 60);
    for (let m = 0; m < 60; m += s) {
      if (!slotBusy(props.day, toTime(h * 60 + m), s, busy())) return null;
    }
    return slotBusy(props.day, toTime(h * 60), s, busy());
  };
  const minuteBusy = (m) => props.day ? slotBusy(props.day, toTime(curH() * 60 + m), Math.min(step(), 60), busy()) : null;
  const pick = (h, m) => props.onChange(toTime(h * 60 + m));
  return <label class={`dumb-time-select inline-flex items-center gap-2 text-sm ${props.class ?? ""}`}>
      <Show2 when={props.label}>{props.label}</Show2>
      <span class="join">
        <select
    class="join-item select select-sm w-auto"
    disabled={props.disabled}
    value={String(curH())}
    onChange={(e) => pick(Number(e.currentTarget.value), curM())}
  >
          <For2 each={hours()}>
            {(h) => {
    const hit = () => hourBusy(h);
    return <option value={h} disabled={!!hit()}>
                  {String(h).padStart(2, "0")}
                  {hit() ? ` \xB7 ${hit().title ?? "\u0437\u0430\u043D\u044F\u0442\u043E"}` : ""}
                </option>;
  }}
          </For2>
        </select>
        <Show2 when={minutes().length > 1}>
          <select
    class="join-item select select-sm w-auto"
    disabled={props.disabled}
    value={String(curM())}
    onChange={(e) => pick(curH(), Number(e.currentTarget.value))}
  >
            <For2 each={minutes()}>
              {(m) => {
    const hit = () => minuteBusy(m);
    return <option value={m} disabled={!!hit()}>
                    {String(m).padStart(2, "0")}
                    {hit() ? " \xB7 \u0437\u0430\u043D\u044F\u0442\u043E" : ""}
                  </option>;
  }}
            </For2>
          </select>
        </Show2>
      </span>
    </label>;
}

// src/DumbDateTimeRange.tsx
var STYLES2 = `
  /* \u041E\u0444\u043E\u0440\u043C\u043B\u0435\u043D\u0438\u0435 \u2014 daisyUI (btn, join, badge). \u0417\u0434\u0435\u0441\u044C \u0442\u043E\u043B\u044C\u043A\u043E \u0448\u0442\u0440\u0438\u0445\u043E\u0432\u043A\u0430 \u0437\u0430\u043D\u044F\u0442\u043E\u0433\u043E
     \u0441\u043B\u043E\u0442\u0430: \u0435\u0451 \u043D\u0430\u0434\u043E \u0432\u0438\u0434\u0435\u0442\u044C \u0438 \u0432 \u0447\u0451\u0440\u043D\u043E-\u0431\u0435\u043B\u043E\u0439 \u043F\u0435\u0447\u0430\u0442\u0438, \u0438 \u0434\u0430\u043B\u044C\u0442\u043E\u043D\u0438\u043A\u0443, \u0430 \u043A\u043B\u0430\u0441\u0441\u0430 \u043F\u043E\u0434
     \u0442\u0430\u043A\u043E\u0435 \u0443 daisyUI \u043D\u0435\u0442. */
  .dumb-dt-slot[data-busy="1"] {
    background-image: repeating-linear-gradient(45deg,
      transparent 0 4px, currentColor 4px 5px) }
  .dumb-dt-slots { display: flex; flex-wrap: wrap; gap: 4px }
  /* \u0432\u043E \u0432\u0440\u0435\u043C\u044F \u043F\u0440\u043E\u0442\u044F\u0436\u043A\u0438 \u043A\u0443\u0440\u0441\u043E\u0440 \u043D\u0435 \u0434\u043E\u043B\u0436\u0435\u043D \xAB\u043F\u0440\u0438\u043B\u0438\u043F\u0430\u0442\u044C\xBB \u043A \u0442\u0435\u043A\u0441\u0442\u0443 \u0441\u043B\u043E\u0442\u043E\u0432 */
  .dumb-dt-slots[data-dragging="1"] { cursor: ew-resize }

  /* \u041E\u0432\u0435\u0440\u043B\u0435\u0439 \u0441 \u0447\u0430\u0441\u0430\u043C\u0438 \u0437\u0430\u0435\u0437\u0434\u0430 \u0438 \u0432\u044B\u0435\u0437\u0434\u0430. \u041B\u0435\u0436\u0438\u0442 \u041F\u041E\u0412\u0415\u0420\u0425 \u043D\u0438\u0437\u0430 \u043A\u0430\u043B\u0435\u043D\u0434\u0430\u0440\u044F, \u0430 \u043D\u0435 \u043F\u043E\u0434
     \u043D\u0438\u043C: \u0442\u0430\u043A \u0432\u0440\u0435\u043C\u044F \u0432\u0438\u0434\u043D\u043E, \u043D\u0435 \u043E\u0442\u0432\u043E\u0434\u044F \u0433\u043B\u0430\u0437 \u043E\u0442 \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u043E\u0433\u043E \u043F\u0435\u0440\u0438\u043E\u0434\u0430, \u0438 \u0440\u0430\u0441\u043A\u043B\u0430\u0434\u043A\u0430
     \u043D\u0435 \u043F\u0440\u044B\u0433\u0430\u0435\u0442, \u043A\u043E\u0433\u0434\u0430 \u043F\u0435\u0440\u0438\u043E\u0434 \u043F\u043E\u044F\u0432\u0438\u043B\u0441\u044F. \u041F\u043E\u0437\u0438\u0446\u0438\u043E\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435 \u0442\u0443\u0442, \u0432\u0438\u0434 \u2014 daisyUI. */
  .dumb-dt-wrap { position: relative }
  /* \u043C\u0435\u0441\u0442\u043E \u043F\u043E\u0434 \u043E\u0432\u0435\u0440\u043B\u0435\u0439 \u043E\u0442\u0432\u043E\u0434\u0438\u0442\u0441\u044F \u0437\u0430\u0440\u0430\u043D\u0435\u0435: \u0438\u043D\u0430\u0447\u0435 \u043E\u043D \u043D\u0430\u043A\u0440\u044B\u0432\u0430\u0435\u0442 \u043F\u043E\u0441\u043B\u0435\u0434\u043D\u044E\u044E \u043D\u0435\u0434\u0435\u043B\u044E,
     \u0438 \u0432 \u043D\u0435\u0451 \u043D\u0435\u043B\u044C\u0437\u044F \u0442\u043A\u043D\u0443\u0442\u044C */
  .dumb-dt-wrap[data-overlay="1"] { padding-bottom: 3.5rem }
  .dumb-dt-overlay { position: absolute; left: 0; right: 0; bottom: 0; z-index: 2 }
  /* \u043F\u043E\u0434\u043F\u0438\u0441\u044C \u0432\u0440\u0435\u043C\u0435\u043D\u0438 \u0432 \u043A\u0440\u0430\u0439\u043D\u0435\u043C \u0434\u043D\u0435 \u043F\u0435\u0440\u0438\u043E\u0434\u0430: \u043C\u0435\u043B\u043A\u0438\u043C, \u043F\u043E\u0432\u0435\u0440\u0445 \u0447\u0438\u0441\u043B\u0430 */
  .dumb-dt-edge { font-variant-numeric: tabular-nums; font-weight: 600 }
`;
function busyDays(busy) {
  return busy.map((b) => ({
    from: b.from.day,
    to: addDays(b.to.day, -1),
    title: b.title
  })).filter((b) => diffDays(b.from, b.to) >= 0);
}
function DumbDateTimeRange(props) {
  injectStyle("date-time-range", STYLES2);
  const step = () => props.step ?? 30;
  const busy = () => props.busy?.() ?? [];
  const [days, setDays] = createSignal2(
    props.value() ? { from: props.value().from.day, to: props.value().to.day } : null
  );
  const [startTime, setStartTime] = createSignal2(props.value()?.from.time ?? null);
  const [endTime, setEndTime] = createSignal2(props.value()?.to.time ?? null);
  watch(
    () => {
      const v = props.value();
      return v ? `${v.from.day} ${v.from.time} ${v.to.day} ${v.to.time}` : "";
    },
    (key) => {
      const v = props.value();
      if (!v) {
        if (!days() && !startTime() && !endTime()) return;
        setDays(null);
        setStartTime(null);
        setEndTime(null);
        return;
      }
      const mine = picked();
      if (mine && key === `${mine.from.day} ${mine.from.time} ${mine.to.day} ${mine.to.time}`) return;
      setDays({ from: v.from.day, to: v.to.day });
      setStartTime(v.from.time);
      setEndTime(v.to.time);
    },
    { defer: true }
  );
  const slots = createMemo3(() => slotsOfDay({
    step: step(),
    openMin: props.openMin,
    closeMin: props.closeMin
  }));
  const picked = createMemo3(() => {
    const d = days();
    const ft = startTime();
    const tt = endTime();
    if (!d || !ft || !tt) return null;
    return { from: { day: d.from, time: ft }, to: { day: d.to, time: tt } };
  });
  const length = () => {
    const p = picked();
    return p ? minutesBetween(p.from, p.to) : 0;
  };
  function commit() {
    const p = picked();
    if (!p) return;
    const check = checkMomentRange({
      from: p.from,
      to: p.to,
      busy: busy(),
      minMinutes: props.minMinutes,
      maxMinutes: props.maxMinutes
    });
    if (!check.ok) {
      props.onReject?.(check.why);
      return;
    }
    props.onChange(p);
  }
  function pickDays(next) {
    setDays(next);
    if (!next) {
      setStartTime(null);
      setEndTime(null);
      props.onChange(null);
      return;
    }
    if (!startTime()) setStartTime(props.defaultFromTime ?? null);
    if (!endTime()) setEndTime(props.defaultToTime ?? null);
    queueMicrotask(commit);
  }
  function pickTime(which, time) {
    which === "from" ? setStartTime(time) : setEndTime(time);
    queueMicrotask(commit);
  }
  const slotState = (day, time) => {
    if (!day) return { busy: null, disabled: true };
    const hit = slotBusy(day, time, step(), busy());
    return { busy: hit, disabled: !!hit };
  };
  const tooEarly = (time) => {
    const d = days();
    const ft = startTime();
    if (!d || !ft) return false;
    return absMin({ day: d.to, time }, d.from) <= toMin(ft);
  };
  const [dragFrom, setDragFrom] = createSignal2(null);
  const [dragTo, setDragTo] = createSignal2(null);
  let hitRaf = 0;
  let hitX = 0;
  let hitY = 0;
  const slotAt = (x, y) => {
    const el = document.elementFromPoint(x, y);
    return el?.closest("[data-slot]")?.dataset.slot ?? null;
  };
  const limitTo = (day, from, to) => {
    const reach = reachToMoment({ day, time: from }, busy(), { day, time: "24:00" });
    const cap = absMin(reach, day);
    const want = toMin(to) + step();
    return toTime(Math.min(want, cap) - step());
  };
  function onSlotDown(day, time, ev) {
    if (ev.button !== 0) return;
    suppressTextSelection();
    setDragFrom(time);
    setDragTo(time);
    const box = ev.currentTarget;
    const hit = () => {
      hitRaf = 0;
      const under = slotAt(hitX, hitY);
      if (under) setDragTo(limitTo(day, dragFrom(), under));
    };
    const move = (e) => {
      hitX = e.clientX;
      hitY = e.clientY;
      if (!hitRaf) hitRaf = requestAnimationFrame(hit);
    };
    const up = () => {
      box.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      if (hitRaf) cancelAnimationFrame(hitRaf);
      hitRaf = 0;
      restoreTextSelection();
      const a = dragFrom();
      const b = dragTo();
      setDragFrom(null);
      setDragTo(null);
      if (!a || !b) return;
      const start = toMin(a) <= toMin(b) ? a : b;
      const stop = toTime(Math.max(toMin(a), toMin(b)) + step());
      setDays({ from: day, to: day });
      setStartTime(start);
      setEndTime(stop);
      queueMicrotask(commit);
    };
    const cancel = () => {
      setDragFrom(null);
      setDragTo(null);
      restoreTextSelection();
      box.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
    };
    box.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    onCleanup2(cancel);
  }
  const inDrag = (time) => {
    const a = dragFrom();
    const b = dragTo();
    if (!a || !b) return false;
    const m = toMin(time);
    return m >= Math.min(toMin(a), toMin(b)) && m <= Math.max(toMin(a), toMin(b));
  };
  const inPicked = (day, time) => {
    const pk = picked();
    if (!pk || !day) return false;
    const m = absMin({ day, time }, pk.from.day);
    return m >= absMin(pk.from, pk.from.day) && m < absMin(pk.to, pk.from.day);
  };
  const Slots = (p) => <div>
      <div class="mb-1 flex items-center gap-2 text-sm font-semibold">
        {p.label}
        <Show3 when={p.day}>
          <span class="badge badge-sm badge-ghost">{p.day}</span>
        </Show3>
      </div>
      <div
    class="dumb-dt-slots"
    data-dragging={dragFrom() ? "1" : void 0}
    onPointerDown={(ev) => {
      if (!p.drag || !p.day) return;
      const time = ev.target.closest("[data-slot]")?.dataset.slot;
      if (time) onSlotDown(p.day, time, ev);
    }}
  >
        <For3 each={slots()}>
          {(time) => {
    const state = () => slotState(p.day, time);
    const early = () => !p.drag && p.which === "to" && tooEarly(time);
    const chosen = () => p.drag ? inDrag(time) || inPicked(p.day, time) : (p.which === "from" ? startTime() : endTime()) === time;
    return <button
      type="button"
      class="dumb-dt-slot btn btn-xs"
      data-slot={time}
      classList={{
        "btn-neutral": chosen(),
        "btn-ghost": !chosen(),
        "btn-disabled": state().disabled || early(),
        "text-error": !!state().busy
      }}
      data-busy={state().busy ? "1" : void 0}
      disabled={state().disabled || early()}
      title={state().busy?.title ?? (early() ? "\u0440\u0430\u043D\u044C\u0448\u0435 \u0437\u0430\u0435\u0437\u0434\u0430" : void 0)}
      onClick={() => !p.drag && pickTime(p.which, time)}
    >
                {time}
              </button>;
  }}
        </For3>
      </div>
    </div>;
  return <div class={`dumb-dt flex flex-col gap-4 ${props.class ?? ""}`} style={props.style}>
      <div class="dumb-dt-wrap" data-overlay={days() ? "1" : void 0}>
        <DumbDateRange
    value={days}
    onChange={pickDays}
    months={props.months}
    min={props.min ?? today()}
    max={props.max}
    busy={() => busyDays(busy())}
    onReject={props.onReject}
    dayExtra={(day) => {
      const d = days();
      if (d && day === d.from && startTime()) {
        return <span class="dumb-dt-edge">{startTime()}</span>;
      }
      if (d && day === d.to && endTime()) {
        return <span class="dumb-dt-edge">{endTime()}</span>;
      }
      return props.dayExtra?.(day) ?? null;
    }}
  />

        {
    /* Оверлей: часы обоих краёв под рукой, менять можно не сходя с
       календаря. Появляется вместе с выбранным периодом. */
  }
        <Show3 when={days()}>
          {(d) => <div class="dumb-dt-overlay">
              <div class="bg-base-100/95 border-base-300 rounded-box flex flex-wrap items-center gap-3 border p-2 shadow-lg backdrop-blur">
                <DumbTimeSelect
    label={<span class="font-semibold">{props.fromLabel ?? "\u0417\u0430\u0435\u0437\u0434"}</span>}
    value={startTime}
    onChange={(t) => pickTime("from", t)}
    step={step()}
    openMin={props.openMin}
    closeMin={props.closeMin}
    day={d().from}
    busy={busy}
  />
                <span class="opacity-90">→</span>
                <DumbTimeSelect
    label={<span class="font-semibold">{props.toLabel ?? "\u0412\u044B\u0435\u0437\u0434"}</span>}
    value={endTime}
    onChange={(t) => pickTime("to", t)}
    step={step()}
    openMin={props.openMin}
    closeMin={props.closeMin}
    day={d().to}
    busy={busy}
  />
                <Show3 when={picked() && length() > 0}>
                  <span class="badge badge-sm badge-neutral ml-auto">{fmtLength(length())}</span>
                </Show3>
              </div>
            </div>}
        </Show3>
      </div>

      <Show3 when={days()}>
        {(d) => <Show3
    when={props.mode === "select"}
    fallback={<Show3
      when={d().from !== d().to}
      fallback={
        /* один день — ОДНА лента, период обводится протяжкой */
        <Slots
          which="from"
          day={d().from}
          label={props.fromLabel ?? "\u0412\u0440\u0435\u043C\u044F"}
          drag
        />
      }
    >
                <div class="flex flex-wrap gap-6">
                  <Slots which="from" day={d().from} label={props.fromLabel ?? "\u0417\u0430\u0435\u0437\u0434"} />
                  <Slots which="to" day={d().to} label={props.toLabel ?? "\u0412\u044B\u0435\u0437\u0434"} />
                </div>
              </Show3>}
  >
            {
    /* списками: мелкий шаг, тесная форма, телефон */
  }
            <div class="flex flex-wrap gap-6">
              <DumbTimeSelect
    label={props.fromLabel ?? "\u0417\u0430\u0435\u0437\u0434"}
    value={startTime}
    onChange={(t) => pickTime("from", t)}
    step={step()}
    openMin={props.openMin}
    closeMin={props.closeMin}
    day={d().from}
    busy={busy}
  />
              <DumbTimeSelect
    label={props.toLabel ?? "\u0412\u044B\u0435\u0437\u0434"}
    value={endTime}
    onChange={(t) => pickTime("to", t)}
    step={step()}
    openMin={props.openMin}
    closeMin={props.closeMin}
    day={d().to}
    busy={busy}
  />
            </div>
          </Show3>}
      </Show3>

      <Show3 when={picked()}>
        {(p) => <div class="text-sm">
            <b>{fmtMoment(p().from)}</b> → <b>{fmtMoment(p().to)}</b>
            <Show3 when={length() > 0}>
              <span class="ml-2">· {fmtLength(length())}</span>
              <Show3 when={diffDays(p().from.day, p().to.day) > 0}>
                <span class="ml-2 badge badge-sm badge-ghost">
                  {diffDays(p().from.day, p().to.day)} ноч.
                </span>
              </Show3>
            </Show3>
          </div>}
      </Show3>
    </div>;
}
export {
  DumbDateRange,
  DumbDateTimeRange,
  DumbTimeSelect,
  absMin,
  addDays,
  addMonths,
  checkMomentRange,
  checkRange,
  daysBetween,
  diffDays,
  endOfMonth,
  fmtLength,
  fmtMoment,
  fromAbsMin,
  inRange,
  minutesBetween,
  monthGrid,
  orderRange,
  overlaps,
  overlapsMoment,
  reachTo,
  reachToMoment,
  sameMonth,
  slotBusy,
  slotsOfDay,
  snapTime,
  startOfMonth,
  toDay,
  toMin,
  toTime,
  today,
  weekIndex,
  weekday
};

import { delegateEvents, insert, createComponent, effect, setAttribute, className, memo, style, template } from '@solidjs/web';
import { createSignal, untrack, createMemo, For, Show, createEffect, onCleanup } from 'solid-js';

// src/DumbDateRange.tsx
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
var _tmpl$ = /* @__PURE__ */ template(`<div>`);
var _tmpl$2 = /* @__PURE__ */ template(`<button type=button class="dumb-cal-nav btn btn-sm btn-ghost btn-circle">\u2039`);
var _tmpl$3 = /* @__PURE__ */ template(`<button type=button class="dumb-cal-nav btn btn-sm btn-ghost btn-circle">\u203A`);
var _tmpl$4 = /* @__PURE__ */ template(`<div class="dumb-cal-month min-w-62"><div class="dumb-cal-head mb-1.5 flex items-center gap-1"><div class="dumb-cal-title flex-1 text-center font-semibold capitalize"> <!></div><!></div><div class=dumb-cal-grid><!><!>`);
var _tmpl$5 = /* @__PURE__ */ template(`<span class="dumb-cal-nav size-8">`);
var _tmpl$6 = /* @__PURE__ */ template(`<div class="dumb-cal-week pb-1 text-center text-xs font-medium">`);
var _tmpl$7 = /* @__PURE__ */ template(`<span class=dumb-cal-extra>`);
var _tmpl$8 = /* @__PURE__ */ template(`<button type=button><!><!>`);
var WEEK = ["\u043F\u043D", "\u0432\u0442", "\u0441\u0440", "\u0447\u0442", "\u043F\u0442", "\u0441\u0431", "\u0432\u0441"];
var MONTHS = ["\u044F\u043D\u0432\u0430\u0440\u044C", "\u0444\u0435\u0432\u0440\u0430\u043B\u044C", "\u043C\u0430\u0440\u0442", "\u0430\u043F\u0440\u0435\u043B\u044C", "\u043C\u0430\u0439", "\u0438\u044E\u043D\u044C", "\u0438\u044E\u043B\u044C", "\u0430\u0432\u0433\u0443\u0441\u0442", "\u0441\u0435\u043D\u0442\u044F\u0431\u0440\u044C", "\u043E\u043A\u0442\u044F\u0431\u0440\u044C", "\u043D\u043E\u044F\u0431\u0440\u044C", "\u0434\u0435\u043A\u0430\u0431\u0440\u044C"];
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
  const [shownMonth, setShownMonth] = createSignal(startOfMonth(untrack(() => props.value()?.from) ?? today()));
  const [pending, setPending] = createSignal(null);
  const [hover, setHover] = createSignal(null);
  const busy = () => props.busy?.() ?? [];
  const marks = () => props.marks?.() ?? {};
  const shownRange = createMemo(() => {
    const start = pending();
    if (start) {
      const end = hover() ?? start;
      const [from, to] = orderRange(start, end);
      return {
        from,
        to
      };
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
      props.onChange({
        from: day,
        to: day
      });
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
    props.onChange({
      from,
      to
    });
  }
  let hitRaf = 0;
  let hitX = 0;
  let hitY = 0;
  const dayAt = (x, y) => {
    const el = document.elementFromPoint(x, y);
    const btn = el?.closest("[data-day]");
    const day = btn?.dataset.day;
    return day ? {
      day,
      blocked: btn.disabled
    } : null;
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
  const months = () => Array.from({
    length: props.months ?? 1
  }, (_, i) => addMonths(shownMonth(), i));
  const canBack = () => !props.min || diffDays(props.min, shownMonth()) > 0;
  const canFwd = () => !props.max || diffDays(addMonths(shownMonth(), props.months ?? 1), props.max) < 0;
  var _el$ = _tmpl$();
  _el$.addEventListener("mouseleave", () => setHover(null));
  insert(_el$, createComponent(For, {
    get each() {
      return months();
    },
    children: (month, mi) => (() => {
      var _el$2 = _tmpl$4(), _el$3 = _el$2.firstChild, _el$5 = _el$3.firstChild, _el$6 = _el$5.firstChild, _el$7 = _el$6.nextSibling, _el$9 = _el$5.nextSibling, _el$0 = _el$3.nextSibling, _el$1 = _el$0.firstChild, _el$10 = _el$1.nextSibling;
      insert(_el$3, createComponent(Show, {
        get when() {
          return mi() === 0;
        },
        get fallback() {
          return _tmpl$5();
        },
        get children() {
          var _el$4 = _tmpl$2();
          _el$4.$$click = () => setShownMonth(addMonths(shownMonth(), -1));
          effect(() => !canBack(), (_v$) => {
            setAttribute(_el$4, "disabled", _v$);
          });
          return _el$4;
        }
      }), _el$5);
      insert(_el$5, () => MONTHS[Number(month.slice(5, 7)) - 1], _el$6);
      insert(_el$5, () => month.slice(0, 4), _el$7);
      insert(_el$3, createComponent(Show, {
        get when() {
          return mi() === (props.months ?? 1) - 1;
        },
        get fallback() {
          return _tmpl$5();
        },
        get children() {
          var _el$8 = _tmpl$3();
          _el$8.$$click = () => setShownMonth(addMonths(shownMonth(), 1));
          effect(() => !canFwd(), (_v$) => {
            setAttribute(_el$8, "disabled", _v$);
          });
          return _el$8;
        }
      }), _el$9);
      insert(_el$0, createComponent(For, {
        each: WEEK,
        children: (w) => (() => {
          var _el$13 = _tmpl$6();
          insert(_el$13, w);
          return _el$13;
        })()
      }), _el$1);
      insert(_el$0, createComponent(For, {
        get each() {
          return monthGrid(month);
        },
        children: (day) => {
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
          var _el$14 = _tmpl$8(), _el$16 = _el$14.firstChild, _el$17 = _el$16.nextSibling;
          _el$14.$$click = () => pick(day);
          _el$14.$$pointerdown = (ev) => onDayDown(day, ev);
          _el$14.addEventListener("mouseenter", () => setHover(day));
          setAttribute(_el$14, "data-day", day);
          insert(_el$14, () => Number(day.slice(8, 10)), _el$16);
          insert(_el$14, createComponent(Show, {
            get when() {
              return props.dayExtra;
            },
            get children() {
              var _el$15 = _tmpl$7();
              insert(_el$15, () => props.dayExtra(day));
              return _el$15;
            }
          }), _el$17);
          effect(() => ({
            e: `dumb-cal-day btn btn-ghost btn-sm h-auto min-h-0 p-0 font-normal ${edge() ? "btn-active btn-neutral font-semibold" : ""} ${inRange(day, range()?.from ?? null, range()?.to ?? null) && !edge() ? "bg-base-300" : ""} ${isBusy(day) ? "text-error" : ""} ${sameMonth(day, month) ? "" : "italic"} ${day === today() ? "font-bold underline" : ""} ${mark()?.class ?? ""}`,
            t: sameMonth(day, month) ? void 0 : "1",
            a: day === today() ? "1" : void 0,
            o: isBusy(day) ? "1" : void 0,
            i: inRange(day, range()?.from ?? null, range()?.to ?? null) ? "1" : void 0,
            n: edge(),
            s: blocked(),
            h: busy().find((b) => diffDays(b.from, day) >= 0 && diffDays(day, b.to) <= 0)?.title ?? mark()?.title
          }), ({
            e,
            t,
            a,
            o,
            i,
            n,
            s,
            h
          }, _p$) => {
            className(_el$14, e, _p$?.e);
            t !== _p$?.t && setAttribute(_el$14, "data-out", t);
            a !== _p$?.a && setAttribute(_el$14, "data-today", a);
            o !== _p$?.o && setAttribute(_el$14, "data-busy", o);
            i !== _p$?.i && setAttribute(_el$14, "data-in", i);
            n !== _p$?.n && setAttribute(_el$14, "data-edge", n);
            s !== _p$?.s && setAttribute(_el$14, "disabled", s);
            h !== _p$?.h && setAttribute(_el$14, "title", h);
          });
          return _el$14;
        }
      }), _el$10);
      return _el$2;
    })()
  }));
  effect(() => `dumb-cal flex flex-wrap gap-5 ${props.class ?? ""}`, (_v$, _$p) => {
    className(_el$, _v$, _$p);
  });
  return _el$;
}
delegateEvents(["click", "pointerdown"]);

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
var _tmpl$9 = /* @__PURE__ */ template(`<select class="join-item select select-sm w-auto">`);
var _tmpl$22 = /* @__PURE__ */ template(`<label><span class=join><select class="join-item select select-sm w-auto">`);
var _tmpl$32 = /* @__PURE__ */ template(`<option><!><!>`);
function DumbTimeSelect(props) {
  const step = () => props.step ?? 30;
  const open = () => Math.max(0, props.openMin ?? 0);
  const close = () => Math.min(1440, props.closeMin ?? 1440);
  const busy = () => props.busy?.() ?? [];
  const cur = () => props.value() ?? toTime(open());
  const curH = () => Math.floor(toMin(cur()) / 60);
  const curM = () => toMin(cur()) % 60;
  const hours = createMemo(() => {
    const out = [];
    for (let h = Math.floor(open() / 60); h * 60 < close(); h++) out.push(h);
    return out;
  });
  const minutes = createMemo(() => {
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
  var _el$ = _tmpl$22(), _el$2 = _el$.firstChild, _el$3 = _el$2.firstChild;
  insert(_el$, createComponent(Show, {
    get when() {
      return props.label;
    },
    get children() {
      return props.label;
    }
  }), _el$2);
  _el$3.addEventListener("change", (e) => pick(Number(e.currentTarget.value), curM()));
  insert(_el$3, createComponent(For, {
    get each() {
      return hours();
    },
    children: (h) => {
      const hit = () => hourBusy(h);
      var _el$5 = _tmpl$32(), _el$6 = _el$5.firstChild, _el$7 = _el$6.nextSibling;
      _el$5.value = h;
      insert(_el$5, () => String(h).padStart(2, "0"), _el$6);
      insert(_el$5, (() => {
        var _c$ = memo(() => !!hit());
        return () => _c$() ? ` \xB7 ${hit().title ?? "\u0437\u0430\u043D\u044F\u0442\u043E"}` : "";
      })(), _el$7);
      effect(() => !!hit(), (_v$) => {
        setAttribute(_el$5, "disabled", _v$);
      });
      return _el$5;
    }
  }));
  insert(_el$2, createComponent(Show, {
    get when() {
      return minutes().length > 1;
    },
    get children() {
      var _el$4 = _tmpl$9();
      _el$4.addEventListener("change", (e) => pick(curH(), Number(e.currentTarget.value)));
      insert(_el$4, createComponent(For, {
        get each() {
          return minutes();
        },
        children: (m) => {
          const hit = () => minuteBusy(m);
          var _el$8 = _tmpl$32(), _el$9 = _el$8.firstChild, _el$0 = _el$9.nextSibling;
          _el$8.value = m;
          insert(_el$8, () => String(m).padStart(2, "0"), _el$9);
          insert(_el$8, () => hit() ? " \xB7 \u0437\u0430\u043D\u044F\u0442\u043E" : "", _el$0);
          effect(() => !!hit(), (_v$) => {
            setAttribute(_el$8, "disabled", _v$);
          });
          return _el$8;
        }
      }));
      effect(() => ({
        e: props.disabled,
        t: String(curM())
      }), ({
        e,
        t
      }, _p$) => {
        e !== _p$?.e && setAttribute(_el$4, "disabled", e);
        queueMicrotask(() => _el$4.value = t) || (_el$4.value = t);
      });
      return _el$4;
    }
  }), null);
  effect(() => ({
    e: `dumb-time-select inline-flex items-center gap-2 text-sm ${props.class ?? ""}`,
    t: props.disabled,
    a: String(curH())
  }), ({
    e,
    t,
    a
  }, _p$) => {
    className(_el$, e, _p$?.e);
    t !== _p$?.t && setAttribute(_el$3, "disabled", t);
    queueMicrotask(() => _el$3.value = a) || (_el$3.value = a);
  });
  return _el$;
}

// src/DumbDateTimeRange.tsx
var _tmpl$10 = /* @__PURE__ */ template(`<span class="badge badge-sm badge-ghost">`);
var _tmpl$23 = /* @__PURE__ */ template(`<div><div class="mb-1 flex items-center gap-2 text-sm font-semibold"><!><!></div><div class=dumb-dt-slots>`);
var _tmpl$33 = /* @__PURE__ */ template(`<button type=button>`);
var _tmpl$42 = /* @__PURE__ */ template(`<div><div class=dumb-dt-wrap><!><!></div><!><!>`);
var _tmpl$52 = /* @__PURE__ */ template(`<span class=dumb-dt-edge>`);
var _tmpl$62 = /* @__PURE__ */ template(`<span class="badge badge-sm badge-neutral ml-auto">`);
var _tmpl$72 = /* @__PURE__ */ template(`<div class=dumb-dt-overlay><div class="bg-base-100/95 border-base-300 rounded-box flex flex-wrap items-center gap-3 border p-2 shadow-lg backdrop-blur"><span class=opacity-90>\u2192</span><!><!>`);
var _tmpl$82 = /* @__PURE__ */ template(`<span class=font-semibold>`);
var _tmpl$92 = /* @__PURE__ */ template(`<div class="flex flex-wrap gap-6"><!><!>`);
var _tmpl$0 = /* @__PURE__ */ template(`<span class=ml-2>\xB7 `);
var _tmpl$1 = /* @__PURE__ */ template(`<span class="ml-2 badge badge-sm badge-ghost"> \u043D\u043E\u0447.`);
var _tmpl$102 = /* @__PURE__ */ template(`<div class=text-sm><b></b> \u2192 <b>`);
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
  const initial = untrack(() => props.value());
  const [days, setDays] = createSignal(initial ? {
    from: initial.from.day,
    to: initial.to.day
  } : null);
  const [startTime, setStartTime] = createSignal(initial?.from.time ?? null);
  const [endTime, setEndTime] = createSignal(initial?.to.time ?? null);
  createEffect(() => {
    const v = props.value();
    return v ? `${v.from.day} ${v.from.time} ${v.to.day} ${v.to.time}` : "";
  }, (key) => {
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
    setDays({
      from: v.from.day,
      to: v.to.day
    });
    setStartTime(v.from.time);
    setEndTime(v.to.time);
  }, {
    defer: true
  });
  const slots = createMemo(() => slotsOfDay({
    step: step(),
    openMin: props.openMin,
    closeMin: props.closeMin
  }));
  const picked = createMemo(() => {
    const d = days();
    const ft = startTime();
    const tt = endTime();
    if (!d || !ft || !tt) return null;
    return {
      from: {
        day: d.from,
        time: ft
      },
      to: {
        day: d.to,
        time: tt
      }
    };
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
    if (!day) return {
      busy: null,
      disabled: true
    };
    const hit = slotBusy(day, time, step(), busy());
    return {
      busy: hit,
      disabled: !!hit
    };
  };
  const tooEarly = (time) => {
    const d = days();
    const ft = startTime();
    if (!d || !ft) return false;
    return absMin({
      day: d.to,
      time
    }, d.from) <= toMin(ft);
  };
  const [dragFrom, setDragFrom] = createSignal(null);
  const [dragTo, setDragTo] = createSignal(null);
  let hitRaf = 0;
  let hitX = 0;
  let hitY = 0;
  const slotAt = (x, y) => {
    const el = document.elementFromPoint(x, y);
    return el?.closest("[data-slot]")?.dataset.slot ?? null;
  };
  const limitTo = (day, from, to) => {
    const reach = reachToMoment({
      day,
      time: from
    }, busy(), {
      day,
      time: "24:00"
    });
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
      setDays({
        from: day,
        to: day
      });
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
    onCleanup(cancel);
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
    const m = absMin({
      day,
      time
    }, pk.from.day);
    return m >= absMin(pk.from, pk.from.day) && m < absMin(pk.to, pk.from.day);
  };
  const Slots = (p) => (() => {
    var _el$ = _tmpl$23(), _el$2 = _el$.firstChild, _el$4 = _el$2.firstChild, _el$5 = _el$4.nextSibling, _el$6 = _el$2.nextSibling;
    insert(_el$2, () => p.label, _el$4);
    insert(_el$2, createComponent(Show, {
      get when() {
        return p.day;
      },
      get children() {
        var _el$3 = _tmpl$10();
        insert(_el$3, () => p.day);
        return _el$3;
      }
    }), _el$5);
    _el$6.$$pointerdown = (ev) => {
      if (!p.drag || !p.day) return;
      const time = ev.target.closest("[data-slot]")?.dataset.slot;
      if (time) onSlotDown(p.day, time, ev);
    };
    insert(_el$6, createComponent(For, {
      get each() {
        return slots();
      },
      children: (time) => {
        const state = () => slotState(p.day, time);
        const early = () => !p.drag && p.which === "to" && tooEarly(time);
        const chosen = () => p.drag ? inDrag(time) || inPicked(p.day, time) : (p.which === "from" ? startTime() : endTime()) === time;
        var _el$7 = _tmpl$33();
        _el$7.$$click = () => {
          if (!p.drag) pickTime(p.which, time);
        };
        setAttribute(_el$7, "data-slot", time);
        insert(_el$7, time);
        effect(() => ({
          e: `dumb-dt-slot btn btn-xs ${chosen() ? "btn-neutral" : "btn-ghost"} ${state().disabled || early() ? "btn-disabled" : ""} ${state().busy ? "text-error" : ""}`,
          t: state().busy ? "1" : void 0,
          a: state().disabled || early(),
          o: state().busy?.title ?? (early() ? "\u0440\u0430\u043D\u044C\u0448\u0435 \u0437\u0430\u0435\u0437\u0434\u0430" : void 0)
        }), ({
          e,
          t,
          a,
          o
        }, _p$) => {
          className(_el$7, e, _p$?.e);
          t !== _p$?.t && setAttribute(_el$7, "data-busy", t);
          a !== _p$?.a && setAttribute(_el$7, "disabled", a);
          o !== _p$?.o && setAttribute(_el$7, "title", o);
        });
        return _el$7;
      }
    }));
    effect(() => dragFrom() ? "1" : void 0, (_v$) => {
      setAttribute(_el$6, "data-dragging", _v$);
    });
    return _el$;
  })();
  var _el$8 = _tmpl$42(), _el$9 = _el$8.firstChild, _el$0 = _el$9.firstChild, _el$1 = _el$0.nextSibling, _el$10 = _el$9.nextSibling, _el$11 = _el$10.nextSibling;
  insert(_el$9, createComponent(DumbDateRange, {
    value: days,
    onChange: pickDays,
    get months() {
      return props.months;
    },
    get min() {
      return props.min ?? today();
    },
    get max() {
      return props.max;
    },
    busy: () => busyDays(busy()),
    get onReject() {
      return props.onReject;
    },
    dayExtra: (day) => {
      const d = days();
      if (d && day === d.from && startTime()) {
        var _el$12 = _tmpl$52();
        insert(_el$12, startTime);
        return _el$12;
      }
      if (d && day === d.to && endTime()) {
        var _el$13 = _tmpl$52();
        insert(_el$13, endTime);
        return _el$13;
      }
      return props.dayExtra?.(day) ?? null;
    }
  }), _el$0);
  insert(_el$9, createComponent(Show, {
    get when() {
      return days();
    },
    children: (d) => (() => {
      var _el$14 = _tmpl$72(), _el$15 = _el$14.firstChild, _el$16 = _el$15.firstChild, _el$18 = _el$16.nextSibling, _el$19 = _el$18.nextSibling;
      insert(_el$15, createComponent(DumbTimeSelect, {
        get label() {
          var _el$20 = _tmpl$82();
          insert(_el$20, () => props.fromLabel ?? "\u0417\u0430\u0435\u0437\u0434");
          return _el$20;
        },
        value: startTime,
        onChange: (t) => pickTime("from", t),
        get step() {
          return step();
        },
        get openMin() {
          return props.openMin;
        },
        get closeMin() {
          return props.closeMin;
        },
        get day() {
          return d().from;
        },
        busy
      }), _el$16);
      insert(_el$15, createComponent(DumbTimeSelect, {
        get label() {
          var _el$21 = _tmpl$82();
          insert(_el$21, () => props.toLabel ?? "\u0412\u044B\u0435\u0437\u0434");
          return _el$21;
        },
        value: endTime,
        onChange: (t) => pickTime("to", t),
        get step() {
          return step();
        },
        get openMin() {
          return props.openMin;
        },
        get closeMin() {
          return props.closeMin;
        },
        get day() {
          return d().to;
        },
        busy
      }), _el$18);
      insert(_el$15, createComponent(Show, {
        get when() {
          return memo(() => !!picked())() ? length() > 0 : picked();
        },
        get children() {
          var _el$17 = _tmpl$62();
          insert(_el$17, () => fmtLength(length()));
          return _el$17;
        }
      }), _el$19);
      return _el$14;
    })()
  }), _el$1);
  insert(_el$8, createComponent(Show, {
    get when() {
      return days();
    },
    children: (d) => createComponent(Show, {
      get when() {
        return props.mode === "select";
      },
      get fallback() {
        return createComponent(Show, {
          get when() {
            return d().from !== d().to;
          },
          get fallback() {
            return (
              /* один день — ОДНА лента, период обводится протяжкой */
              createComponent(Slots, {
                which: "from",
                get day() {
                  return d().from;
                },
                get label() {
                  return props.fromLabel ?? "\u0412\u0440\u0435\u043C\u044F";
                },
                drag: true
              })
            );
          },
          get children() {
            var _el$25 = _tmpl$92(), _el$26 = _el$25.firstChild, _el$27 = _el$26.nextSibling;
            insert(_el$25, createComponent(Slots, {
              which: "from",
              get day() {
                return d().from;
              },
              get label() {
                return props.fromLabel ?? "\u0417\u0430\u0435\u0437\u0434";
              }
            }), _el$26);
            insert(_el$25, createComponent(Slots, {
              which: "to",
              get day() {
                return d().to;
              },
              get label() {
                return props.toLabel ?? "\u0412\u044B\u0435\u0437\u0434";
              }
            }), _el$27);
            return _el$25;
          }
        });
      },
      get children() {
        var _el$22 = _tmpl$92(), _el$23 = _el$22.firstChild, _el$24 = _el$23.nextSibling;
        insert(_el$22, createComponent(DumbTimeSelect, {
          get label() {
            return props.fromLabel ?? "\u0417\u0430\u0435\u0437\u0434";
          },
          value: startTime,
          onChange: (t) => pickTime("from", t),
          get step() {
            return step();
          },
          get openMin() {
            return props.openMin;
          },
          get closeMin() {
            return props.closeMin;
          },
          get day() {
            return d().from;
          },
          busy
        }), _el$23);
        insert(_el$22, createComponent(DumbTimeSelect, {
          get label() {
            return props.toLabel ?? "\u0412\u044B\u0435\u0437\u0434";
          },
          value: endTime,
          onChange: (t) => pickTime("to", t),
          get step() {
            return step();
          },
          get openMin() {
            return props.openMin;
          },
          get closeMin() {
            return props.closeMin;
          },
          get day() {
            return d().to;
          },
          busy
        }), _el$24);
        return _el$22;
      }
    })
  }), _el$10);
  insert(_el$8, createComponent(Show, {
    get when() {
      return picked();
    },
    children: (p) => (() => {
      var _el$28 = _tmpl$102(), _el$29 = _el$28.firstChild, _el$30 = _el$29.nextSibling, _el$31 = _el$30.nextSibling;
      insert(_el$29, () => fmtMoment(p().from));
      insert(_el$31, () => fmtMoment(p().to));
      insert(_el$28, createComponent(Show, {
        get when() {
          return length() > 0;
        },
        get children() {
          return [(() => {
            var _el$32 = _tmpl$0(); _el$32.firstChild;
            insert(_el$32, () => fmtLength(length()), null);
            return _el$32;
          })(), createComponent(Show, {
            get when() {
              return diffDays(p().from.day, p().to.day) > 0;
            },
            get children() {
              var _el$34 = _tmpl$1(), _el$35 = _el$34.firstChild;
              insert(_el$34, () => diffDays(p().from.day, p().to.day), _el$35);
              return _el$34;
            }
          })];
        }
      }), null);
      return _el$28;
    })()
  }), _el$11);
  effect(() => ({
    e: `dumb-dt flex flex-col gap-4 ${props.class ?? ""}`,
    t: props.style,
    a: days() ? "1" : void 0
  }), ({
    e,
    t,
    a
  }, _p$) => {
    className(_el$8, e, _p$?.e);
    style(_el$8, t, _p$?.t);
    a !== _p$?.a && setAttribute(_el$9, "data-overlay", a);
  });
  return _el$8;
}
delegateEvents(["pointerdown", "click"]);

export { DumbDateRange, DumbDateTimeRange, DumbTimeSelect, absMin, addDays, addMonths, checkMomentRange, checkRange, daysBetween, diffDays, endOfMonth, fmtLength, fmtMoment, fromAbsMin, inRange, minutesBetween, monthGrid, orderRange, overlaps, overlapsMoment, reachTo, reachToMoment, sameMonth, slotBusy, slotsOfDay, snapTime, startOfMonth, toDay, toMin, toTime, today, weekIndex, weekday };

import { delegateEvents, insert, createComponent, effect, className, setAttribute, template } from 'solid-js/web';
import { createSignal, createMemo, For, Show } from 'solid-js';

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
var _tmpl$4 = /* @__PURE__ */ template(`<div class="dumb-cal-month min-w-62"><div class="dumb-cal-head mb-1.5 flex items-center gap-1"><div class="dumb-cal-title flex-1 text-center font-semibold capitalize"> </div></div><div class=dumb-cal-grid>`);
var _tmpl$5 = /* @__PURE__ */ template(`<span class="dumb-cal-nav size-8">`);
var _tmpl$6 = /* @__PURE__ */ template(`<div class="dumb-cal-week pb-1 text-center text-xs font-medium">`);
var _tmpl$7 = /* @__PURE__ */ template(`<span class=dumb-cal-extra>`);
var _tmpl$8 = /* @__PURE__ */ template(`<button type=button>`);
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
  const [shownMonth, setShownMonth] = createSignal(startOfMonth(props.value()?.from ?? today()));
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
  const months = () => Array.from({
    length: props.months ?? 1
  }, (_, i) => addMonths(shownMonth(), i));
  const canBack = () => !props.min || diffDays(props.min, shownMonth()) > 0;
  const canFwd = () => !props.max || diffDays(addMonths(shownMonth(), props.months ?? 1), props.max) < 0;
  return (() => {
    var _el$ = _tmpl$();
    _el$.addEventListener("mouseleave", () => setHover(null));
    insert(_el$, createComponent(For, {
      get each() {
        return months();
      },
      children: (month, mi) => (() => {
        var _el$2 = _tmpl$4(), _el$3 = _el$2.firstChild, _el$5 = _el$3.firstChild, _el$6 = _el$5.firstChild, _el$8 = _el$3.nextSibling;
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
            effect(() => _el$4.disabled = !canBack());
            return _el$4;
          }
        }), _el$5);
        insert(_el$5, () => MONTHS[Number(month.slice(5, 7)) - 1], _el$6);
        insert(_el$5, () => month.slice(0, 4), null);
        insert(_el$3, createComponent(Show, {
          get when() {
            return mi() === (props.months ?? 1) - 1;
          },
          get fallback() {
            return _tmpl$5();
          },
          get children() {
            var _el$7 = _tmpl$3();
            _el$7.$$click = () => setShownMonth(addMonths(shownMonth(), 1));
            effect(() => _el$7.disabled = !canFwd());
            return _el$7;
          }
        }), null);
        insert(_el$8, createComponent(For, {
          each: WEEK,
          children: (w) => (() => {
            var _el$1 = _tmpl$6();
            insert(_el$1, w);
            return _el$1;
          })()
        }), null);
        insert(_el$8, createComponent(For, {
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
              return !!l && diffDays(l, day) < 0 && diffDays(pending(), day) > 0;
            };
            const blocked = () => isBusy(day) || beyond() || !!props.min && diffDays(props.min, day) < 0 || !!props.max && diffDays(day, props.max) < 0;
            return (() => {
              var _el$10 = _tmpl$8();
              _el$10.$$click = () => pick(day);
              _el$10.addEventListener("mouseenter", () => setHover(day));
              insert(_el$10, () => Number(day.slice(8, 10)), null);
              insert(_el$10, createComponent(Show, {
                get when() {
                  return props.dayExtra;
                },
                get children() {
                  var _el$11 = _tmpl$7();
                  insert(_el$11, () => props.dayExtra(day));
                  return _el$11;
                }
              }), null);
              effect((_p$) => {
                var _v$ = `dumb-cal-day btn btn-ghost btn-sm h-auto min-h-0 p-0 font-normal ${edge() ? "btn-active btn-neutral font-semibold" : ""} ${inRange(day, range()?.from ?? null, range()?.to ?? null) && !edge() ? "bg-base-300" : ""} ${isBusy(day) ? "text-error" : ""} ${sameMonth(day, month) ? "" : "italic"} ${day === today() ? "font-bold underline" : ""} ${mark()?.class ?? ""}`, _v$2 = sameMonth(day, month) ? void 0 : "1", _v$3 = day === today() ? "1" : void 0, _v$4 = isBusy(day) ? "1" : void 0, _v$5 = inRange(day, range()?.from ?? null, range()?.to ?? null) ? "1" : void 0, _v$6 = edge(), _v$7 = blocked(), _v$8 = busy().find((b) => diffDays(b.from, day) >= 0 && diffDays(day, b.to) <= 0)?.title ?? mark()?.title;
                _v$ !== _p$.e && className(_el$10, _p$.e = _v$);
                _v$2 !== _p$.t && setAttribute(_el$10, "data-out", _p$.t = _v$2);
                _v$3 !== _p$.a && setAttribute(_el$10, "data-today", _p$.a = _v$3);
                _v$4 !== _p$.o && setAttribute(_el$10, "data-busy", _p$.o = _v$4);
                _v$5 !== _p$.i && setAttribute(_el$10, "data-in", _p$.i = _v$5);
                _v$6 !== _p$.n && setAttribute(_el$10, "data-edge", _p$.n = _v$6);
                _v$7 !== _p$.s && (_el$10.disabled = _p$.s = _v$7);
                _v$8 !== _p$.h && setAttribute(_el$10, "title", _p$.h = _v$8);
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
              return _el$10;
            })();
          }
        }), null);
        return _el$2;
      })()
    }));
    effect(() => className(_el$, `dumb-cal flex flex-wrap gap-5 ${props.class ?? ""}`));
    return _el$;
  })();
}
delegateEvents(["click"]);

export { DumbDateRange, addDays, addMonths, checkRange, daysBetween, diffDays, endOfMonth, inRange, monthGrid, orderRange, overlaps, reachTo, sameMonth, startOfMonth, toDay, today, weekIndex, weekday };

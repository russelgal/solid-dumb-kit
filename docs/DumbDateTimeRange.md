**English** · [Русский](ru/DumbDateTimeRange.md)

# DumbDateTimeRange

A period with time: check-in on 12 August at 16:00 — check-out on 15 August at
12:00.

```tsx
import { DumbDateTimeRange, DumbTimeSelect, type Moment } from '@solid-dumb-kit/date-range'
```

## Two halves, not one clever widget

Days are picked by [`DumbDateRange`](DumbDateRange.md) — the same calendar, the
same occupancy, the same two clicks or drag. Time is picked separately, and that
is the whole difference between "works" and "torture":

- a **strip of slots** with a `step` — a busy slot is hatched and not clickable,
  and the period is drawn by pressing and dragging, like in a calendar;
- **dropdowns** for hours and minutes (`mode="select"`) — when the step is small,
  space is tight, or it happens on a phone, where `<select>` gives a native wheel.

```tsx
const [when, setWhen] = createSignal<{ from: Moment; to: Moment } | null>(null)

<DumbDateTimeRange
  value={when}
  onChange={setWhen}
  busy={() => bookings}
  step={60}
  defaultFromTime="16:00"
  defaultToTime="12:00"
  minMinutes={12 * 60}
  onReject={(why) => toast.error(why)}
/>
```

## A moment is a pair of strings

```ts
type Time = string                       // 'HH:mm'
type Moment = { day: Day; time: Time }   // day — 'YYYY-MM-DD'
```

No `Date` in the API. The reason is the one that made a day a string in
`dateMath`: `new Date('2026-08-12 14:00')` is parsed in the local zone, so the
very same value lands on **different days** for a server in UTC and a guest in
Vladivostok. Comparison reduces to minutes: within one day `toMin` is enough,
across days there is `absMin`, which adds the day number relative to a base date.

## Touching is not overlapping

A guest leaves at 12:00, the next one arrives at 16:00 the same day. The day is
both taken and free — that is how every hotel works, and the component allows it:
**touching at the ends does not count as an overlap**. A slot is the interval
`[time, time + step)`, not a point, so a booking that starts exactly where its
neighbour ended does not look busy.

## Dragging

Press a slot, drag, release — the period is set. The end is taken from the **end
of the last slot touched**: circle one half-hour slot and you get half an hour,
not a zero-length period.

Dragging **stops at what is taken** rather than passing through or being
cancelled halfway. What is under the cursor is asked from the browser once per
frame: `elementFromPoint` is a hit test, it needs a fresh layout, and
highlighting the previous slot has just invalidated it. No slot is ever measured
— not a single `getBoundingClientRect`.

The draggable strip appears when a **single** day is selected. A multi-day period
shows two groups of slots instead: arrival in its day, departure in its own.

## Hours on the calendar

Check-in and check-out times sit right inside the edge cells of the period, and a
panel with both of them lies below the calendar — they can be corrected without
leaving it. Room for that panel is reserved in advance: otherwise it would cover
the last week of the month, and that week could not be clicked.

Your own corner of a day (`dayExtra`, usually a price) stays: time replaces it
only in the two edge cells.

## Props

| prop | type | what it does |
| --- | --- | --- |
| `value` | `() => { from: Moment; to: Moment } \| null` | the selected period |
| `onChange` | `(next) => void` | the period is complete or cleared |
| `busy` | `() => BusyMoment[]` | taken intervals: visible and not selectable |
| `mode` | `'slots' \| 'select'` | slot strip (default) or dropdowns |
| `step` | `number` | slot step in minutes; 30 by default |
| `openMin` / `closeMin` | `number` | working window in minutes from midnight: the night is cut out |
| `defaultFromTime` / `defaultToTime` | `Time` | what to offer once a day is picked but a slot is not |
| `minMinutes` / `maxMinutes` | `number` | duration limits |
| `months` | `number` | how many calendar months at once; 1 by default |
| `min` / `max` | `Day` | date bounds; from today by default |
| `dayExtra` | `(day: Day) => JSX.Element` | your own corner of a day; on the period edges time replaces it |
| `fromLabel` / `toLabel` | `string` | captions; "Заезд" and "Выезд" by default |
| `onReject` | `(why: string) => void` | the pick failed: the reason in words |

## DumbTimeSelect

Time as two dropdowns — a separate component, usable without the calendar too.

```tsx
<DumbTimeSelect
  label="from"
  value={time}
  onChange={setTime}
  step={30}
  openMin={9 * 60}
  closeMin={20 * 60}
  day={day()}
  busy={() => bookings}
/>
```

Occupancy is shown inside the list: an hour that is **fully** taken is marked and
cannot be picked. Fully — otherwise the list starts lying: half an hour inside it
may still be free.

## Maths apart from markup

`timeMath` is exported in full: occupancy has to be checked on the server before
writing to the database, and in tests too.

| function | what it does |
| --- | --- |
| `toMin` / `toTime` | `HH:mm` ↔ minutes; never wraps a day (1500 → `25:00`) |
| `absMin` / `fromAbsMin` | moment ↔ minutes relative to a base day |
| `minutesBetween` | duration between moments |
| `slotsOfDay` | cut a day into steps, excluding the end of the window |
| `slotBusy` | is a slot taken; touching at the ends does not count |
| `overlapsMoment` | do two intervals overlap |
| `reachToMoment` | how far you can drag without hitting what is taken |
| `checkMomentRange` | full check of a period; refusal comes as a human phrase |
| `snapTime` | round down to the grid step |
| `fmtLength` / `fmtMoment` | "1 ч 30 мин", "12.08 14:00" |

**English** · [Русский](ru/DumbDateRange.md)

# DumbDateRange

A calendar: pick a day or a range, with occupancy visible.

```tsx
import { DumbDateRange } from '@solid-dumb-kit/date-range'
```

## A date is a string, not a `Date`

`YYYY-MM-DD`, and that's not pedantry. A `Date` is a moment in a timezone, so
"June 1st" for a user in Kaliningrad and for a server in UTC land on different
days. In booking that's an error worth a room: the arrival slides by a day.
Everything is computed in UTC inside — then there are exactly as many days as the
calendar shows.

## A range takes two clicks

First the start, then the end, with the range following the cursor in between.
That beats dragging: on a touchscreen dragging fights with page scrolling, while
two taps work the same everywhere.

**Occupancy is shown BEFORE the click.** Taken days are struck through
diagonally (not by colour alone — visible without it), and days beyond the
nearest taken stretch are dimmed: you couldn't reach them anyway. Complaining
after the choice is the worst option, the person has already decided.

**If it didn't fit, we restart from that day**, not from nothing: nine times out
of ten they mis-clicked rather than changed their mind.

## A month grid is always 42 days

Six full weeks from Monday, including the neighbouring months' tails. That way
the calendar doesn't jump in height when you flip months — the one thing that
truly annoys in a date picker.

## Props

| prop | type | what it does |
| --- | --- | --- |
| `value`, `onChange` | `{from, to}` | the selected range |
| `single` | `boolean` | a single date instead of a range |
| `busy` | `() => Array<BusySpan>` | taken stretches |
| `marks` | `() => Record<Day, {title, class}>` | holidays and weekends |
| `months` | `number` | how many months to show at once |
| `min`, `max` | `Day` | bounds |
| `minNights`, `maxNights` | `number` | length limits |
| `dayExtra` | `(day) => JSX.Element` | a price or anything in the day's corner |
| `onReject` | `(why) => void` | the reason: "taken", "3 nights minimum" |

## The maths is public

`checkRange`, `overlaps`, `reachTo`, `daysBetween`, `monthGrid` — pure functions,
no DOM. Day boundaries **meet**: checking out and checking in on the same day is
not an overlap, the room frees up in the morning. Use the same functions to check
availability on the server.

## A range with time: `DumbDateTimeRange`

The same calendar, but a point on the axis is
`{ day: 'YYYY-MM-DD', time: 'HH:mm' }`: both parts are strings, exactly as they
go into the database.

```tsx
import { DumbDateTimeRange, type Moment } from '@solid-dumb-kit/date-range'

<DumbDateTimeRange
  value={range}
  onChange={setRange}
  step={30}           // slot step, minutes
  openMin={9 * 60}    // working window: from 09:00
  closeMin={21 * 60}  // to 21:00
  busy={busy}
  minMinutes={60}
  onReject={(why) => toast.error(why)}
/>
```

Busy time is tracked **to the minute**, and the end of a span is NOT included: a
14:00–15:00 booking doesn't stop the next one from starting exactly at 15:00 —
otherwise the schedule would grow dead gaps. Busy slots are hatched, not merely
recoloured: that reads in black-and-white print and for colour-blind users.

Time is picked in one of two ways (`mode`):

- `slots` (default) — a slot strip; the range is dragged out with a press and a
  pull: busy time is visible at once, a free window is taken in at a glance;
- `select` — hours and minutes as lists (`DumbTimeSelect`, also available on its
  own). For a fine step, a tight form, and phones, where `<select>` gives the
  native wheel.

The night can be cut out with the working window: nobody books a master at
03:00, and showing that slot only gets in the way.

## Time arithmetic

Just like with dates, it is needed outside the widget too — on the server,
before writing to the database:

```ts
import {
  toMin, toTime, minutesBetween, fmtLength,
  overlapsMoment, checkMomentRange, slotsOfDay, snapTime,
} from '@solid-dumb-kit/date-range'

minutesBetween(from, to)   // duration
fmtLength(90)              // "1 h 30 min"

const res = checkMomentRange({ from, to, busy: busy(), minMinutes: 60 })
if (!res.ok) return toast.error(res.why)
```

`checkMomentRange` is the very check the component itself runs, so the UI and
the server never disagree on the answer.

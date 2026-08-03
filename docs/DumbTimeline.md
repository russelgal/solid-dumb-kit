[Русский](ru/DumbTimeline.md) · **English**

# DumbTimeline

A booking chart: resource rows × time columns, events as bars. Rooms by the
night, saunas by the hour, gazebos by the day — the same grid.

```tsx
import { DumbTimeline, SCALES } from '@solid-dumb-kit/timeline'
```

## Why there isn't a single measurement here

A bar's position is computed **from dates**: `left = nights_from_start ×
column_width`. The column width is a prop, not something measured. So during a
drag only numbers change — on a chart a year wide that's the difference between
"moves" and "stutters".

The only DOM read per gesture is the grid's own position, taken once at the
start through `IntersectionObserver` (its `boundingClientRect` is computed off
the main thread). From there the pointer is converted to time by arithmetic.

Vertical grid lines are painted as a **background**: there are hundreds of
columns, and a node each would cost more than everything else combined.
Horizontal ones are nodes — rows are few, but they differ in height.

## The scale: days are a special case

Internally time is **minutes from the origin**, and a column is a fixed number of
minutes. That's how three unlike cases run on one code path:

| | column | day window | quirks |
| --- | --- | --- | --- |
| hotel | a day | around the clock | check-in 16:00, check-out 12:00 |
| sauna | an hour | 10:00–24:00 | 30 min gap for cleaning |
| gazebo | an hour | 12:00–23:00 | night isn't on the grid at all |
| venues | an hour | around the clock | windows, minimums and gaps live on rows |

```tsx
<DumbTimeline rows={rooms} spans={bookings} scale={SCALES.hotel('2026-08-03', 30)} />
```

Ready-made sets: `SCALES.hotel` / `SCALES.sauna` / `SCALES.gazebo` /
`SCALES.venues`. The scale is passed as a preset, **whole**; flat props
(`from`, `days`, `stepMin`, `checkIn`, …) act as overrides on top — handy for
taking a preset and swapping a single field.

On an hourly grid columns are captioned as an **hour ruler**: a narrow hour
column with a two-digit tick "00…23", the day as a wide band above it, day seams
as a heavier vertical line. That's how a week of a round-the-clock grid fits on
one screen.

Calendar arithmetic runs on **Temporal** (native where available, the
FullCalendar polyfill otherwise): time zones and DST simply don't exist in
`PlainDate`. Temporal is never called per frame — date ↔ day-index answers are
cached.

**The working window cuts the night out.** A gazebo's day ends at 23:00, and
eleven night hours aren't wanted on the grid — they'd fill half the screen with
nothing. The scale folds days together: `dayEnd` is immediately followed by the
next day's `dayStart`.

**Check-in and check-out hours aren't decoration.** A bar runs from 16:00 on the
arrival day to 12:00 on the departure day, so on a turnover day you see **both**
bookings and the gap between them — the one the cleaning fits into. Draw whole
days and the departure day looks occupied while the room is already free.

## Overlapping neighbours is impossible

Three ways at once, and it isn't belt-and-braces — each covers its own gesture:

- **moving** snaps to the nearest free spot mid-flight. A bar is never drawn on
  top of someone else's booking, not for a frame: while it sits there the eye
  assumes that's the result, and then it jumps;
- **resizing** stops the edge against the neighbour (`clampEdge`). Hunting for
  "the nearest free spot" is wrong here: an edge is dragged deliberately, and a
  bar that ended up past someone else's booking is no longer what was stretched;
- **creating by dragging** is clipped by neighbours. Learning a slot is taken is
  better before the form opens, not after it's filled in.

The gap (`gapMin`) takes part in all three: after a sauna session there's half an
hour of cleaning, and the next one can't start then even though the time is
formally free.

## A row knows what it sells

`unit: 'day' | 'hour'` — and the two live side by side in one chart: a hotel with
saunas has different resources but a single grid.

From this follows a rule worth understanding once: **when the grid is coarser
than the unit of sale, the component refuses to change time by mouse.** An hourly
row on a daily grid has no resize handles — the handle's step there is a day, and
a two-hour paintball game would become a two-week one in a single move. And
selecting on such a row returns `needsTime: true`: the exact time can't be pulled
out of that gesture, you can't aim at 14:00 inside a column a day wide. Asking is
more honest than guessing.

## Row rules

The grid is shared, but rows sell differently — so the minimum, the gap and the
working window live **on the row** (`RowRules`), not on the grid:

```tsx
const rows = [
  // sauna: sessions from two hours, half an hour of cleaning after; no window —
  // it's fired up at night too
  { id: 'ban', title: 'Sauna', unit: 'hour', minMin: 120, gapMin: 30 },
  // paintball: from an hour, an hour to reload, nobody plays in the dark
  { id: 'pb', title: 'Paintball', unit: 'hour', minMin: 60, gapMin: 60,
    openMin: 10 * 60, closeMin: 22 * 60 },
  // the banquet hall opens at 14:00 even though the grid starts in the morning
  { id: 'hall', title: 'Hall', unit: 'hour', openMin: 14 * 60, closeMin: 23 * 60 },
]
```

- **`minMin`** — we don't sell shorter. Select one hour on the sauna and the
  frame immediately shows two: the minimum is topped up, not rejected. Resizing
  below the minimum won't go.
- **`gapMin`** — the gap to neighbours, and it's **visible**: a hatched tail
  behind every bar. Drag a booking into the paintball row and the tail grows to
  an hour mid-flight.
- **`openMin`/`closeMin`** — the row's own window; closed hours are hatched, and
  nothing can be placed, dragged or stretched into them. Hourly grids only: on a
  daily grid a row window is silently ignored — otherwise it would squeeze a
  multi-day booking into a single day.

Whatever a row doesn't define comes from the grid: `gapMin` and `minMin` also
exist as shared props.

## Props

| prop | type | what it does |
| --- | --- | --- |
| `rows` | `Array<TimelineRow>` | resource rows |
| `spans` | `Array<Span>` | event bars; keyed by `id` — a fresh server array doesn't rebuild the DOM |
| `scale` | `Partial<Scale>` | the scale as a whole preset; flat props override on top |
| `from`, `days` | `string`, `number` | first day of the grid and how many to show; win over `scale` |
| `stepMin` | `number` | minutes per column: `1440` a day, `60` an hour |
| `snapMin` | `number` | movement step; absent — equals the column |
| `dayStart`, `dayEnd` | `number` | working window, minutes from midnight |
| `checkIn`, `checkOut` | `number` | what a date without a time means |
| `gapMin`, `minMin` | `number` | default gap and minimum; rows may carry their own |
| `colW`, `rowH`, `headW` | `number` | grid sizes, px |
| `onChange` | `(next, prev, kind) => void` | moved or resized; `kind`: `'move' \| 'resize-from' \| 'resize-to'` |
| `onOpen` | `(span, at) => void` | click on a bar; `at` is the click point |
| `onRangeSelect` | `({row, from, to, needsTime}) => void` | dragged across empty space (leftwards too) |
| `onEmptyClick` | `(at, row) => void` | click on an empty cell |
| `onSpanContextMenu`, `onEmptyContextMenu` | `(…, ev) => void` | right click on a bar / empty space |
| `onVisibleRange` | `({from, to}) => void` | the visible range changed — for lazy loading; at most once a frame |
| `ref` | `(api: TimelineApi) => void` | outside control: `scrollTo`, `scrollToNow`, `visibleRange` |
| `dayLabel`, `groupLabel` | `(at) => JSX.Element` | column and group captions |
| `dayClass` | `(at) => string` | mark a column: weekend, holiday |
| `summary`, `summaryTitle` | `(at) => JSX.Element` | summary row above the grid |
| `now` | `Moment` | vertical "now" line |
| `showRoom` | `boolean` | "how far you can extend" hint; off by default |
| `readonly` | `boolean` | no moving, no resizing — the whole grid |
| `spanLocked` | `(span) => boolean` | this bar won't move: a block, repairs, a sanitary day |
| `spanClass`, `spanTitle` | `(span) => string` | status class and tooltip per bar |
| `rowDisabled`, `rowClass` | `(row) => …` | row closed for creation / class per row |
| `children` | `(span) => JSX.Element` | bar contents |

### TimelineRow

| field | meaning |
| --- | --- |
| `id`, `title` | key and caption |
| `group` | group: floor, building, category. Collapses on click |
| `unit` | `'day'` or `'hour'` — what the row sells |
| `minMin` | we don't sell shorter, minutes |
| `gapMin` | gap to neighbours, minutes: cleaning, reloading |
| `openMin`, `closeMin` | the row's own window, minutes from midnight (hourly grids only) |

### Span

`{ id, row, from, to }`, where moments are `YYYY-MM-DD` or `YYYY-MM-DDTHH:mm`.
A date **without a time** on a nightly booking is normal: the scale supplies the
check-in and check-out hours. Writing midnight there would lie by half a day on
each end.

## Header, groups, summary

The header has **two rows**: the upper one merges by month on a daily grid and by
day on an hourly one. Without it you can't tell which day you're on in an hourly
scale, or which month in a monthly one.

Rows group together (`group`), and a group collapses on click. Above the grid you
can render a summary row (`summary`) — rooms free, revenue per day: in booking
systems people look at it more often than at the bookings themselves.

## Opens on click only

The browser fires `click` after a drag too. The open handler stays clean —
`onClick={() => onOpen(span)}` — and the stray click is removed by the gesture
itself, with a one-shot capture-phase listener. Whoever made the mess cleans it
up; there are no distance checks or state flags in the handler.

Dragging is **left button only** and first finger only: the right button belongs
to the context menu, the middle one to scrolling, and a second finger doesn't
barge into someone else's gesture.

**A gesture knows how to cancel.** Esc and `pointercancel` (the browser took the
pointer for its own scroll) drop the drag and the selection frame: the bar goes
back, listeners come off, text-selection suppression is restored — even if the
component was unmounted mid-gesture.

## The maths is public

`scale.ts` depends on neither DOM nor Solid and is exported whole: `toMinutes`,
`momentX`, `snapEdge`, `clampEdge`, `conflicts`, `moveTo`, `stackFloors`,
`minLength`. **Call these on the server too** when you check availability: then
the answer matches what the person sees on screen.

For that reason a second, simplified copy of the geometry was deleted from the
package: its `spansOverlap` said "free" where the grid shows a conflict. Two
truths in a public API are worse than one incomplete — server checks get written
against the second one.

## What the tests cover

Round trips (moment → minutes → moment, pixels → minutes → pixels), idempotence
of edge snapping, symmetry of overlaps and gaps, independence of floor stacking
from array order, header groups covering every column with no holes, day
boundaries at the seam, moments before the grid starts, leap February, DST dates,
and "reversed" hours (arrive in the morning, leave in the evening — a hall or a
coworking space).

Gestures separately, in the DOM: a move with exact dates and `kind`, cancelling
via Esc and `pointercancel`, a second finger, unmounting mid-drag, the
"gesture faster than the IO snapshot" race, leftward selection, topping up to the
row minimum, clipping by a neighbour with its gap.

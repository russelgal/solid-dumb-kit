[Русский](ru/DumbDateRange.md) · **English**

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

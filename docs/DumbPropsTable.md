**English** · [Русский](ru/DumbPropsTable.md)

# DumbPropsTable

A debug table: what actually arrived in the props. Name, type, value —
**everything**, functions and `undefined` included.

```bash
pnpm add github:russelgal/solid-dumb-kit#path:/packages/props-table
```

```tsx
import { DumbPropsTable } from '@solid-dumb-kit/props-table'

<DumbPropsTable value={props} title="DumbTimeline" skip={['rows', 'spans']} />
```

Live — the [`#props-table`](https://russelgal.github.io/solid-dumb-kit/#props-table) tab.

## Why, when `JSON.stringify` exists

The usual way to peek at props does not work here: `JSON.stringify` **silently
drops functions and `undefined`**. In this kit almost all behaviour *is*
functions (`onOpen`, `dayClass`, `spanClass`), and they are simply absent from
the dump — which reads as "the prop never arrived", although it did.

```tsx
const props = { onOpen: () => {}, summary: undefined, title: 'room' }
JSON.stringify(props)   // {"title":"room"} — now go find why the handler is not called
```

The table shows both rows: `ƒ onOpen(0)` and `undefined`. The difference between
"there is no prop" and "the prop is there, the value is not" is usually exactly
what you are missing.

## How to read it

- **Nested objects come first and get expanded** — that is where the cause
  usually hides. Then functions, then plain values; alphabetical within a group,
  so the dump does not jump around between repaints.
- **Arrays show their first items and a count** (`Array(2133)`): nobody needs a
  dump of two thousand bookings. How many items to expand — `maxItems`.
- **The kind of value shows as colour**: object, array, function, plain. The
  colours live in `--dumb-props-object`, `--dumb-props-array`,
  `--dumb-props-function`, `--dumb-props-dim`, so a dark theme can repaint them.
- **The path to a value** sits in the cell's `title`: hover `stepMin` and you get
  `scale.stepMin`.

## Props

| Prop | Type | What it does |
| --- | --- | --- |
| `value` | `object` | what to dump: props, a store, anything |
| `title` | `string` | heading above the table |
| `depth` | `number` | how deep to expand nesting; `0` — do not expand, `1` by default |
| `maxItems` | `number` | how many array items to show, `8` by default |
| `skip` | `string[]` | what not to expand: `['rows', 'spans']` — thousands of rows in there |
| `indent` | `number` | indent per nesting level, px (14 by default) |
| `headless` | `boolean` | drop the header — in a narrow panel it only eats a row |
| `class` | `string` | class for the wrapper |

The markup is deliberately bare — `table > thead/tbody`, without a single class
of its own. daisyUI's `table table-xs` lands on it without wrappers; this is a
debugging tool, and its looks should belong to the consumer.

## `dumpProps` — the same thing without markup

The dump logic lives apart from the table: a plain function, no Solid, no DOM.
Fine in a test, in a log, on the server.

```tsx
import { dumpProps, describe } from '@solid-dumb-kit/props-table'

console.table(dumpProps(props, { depth: 2, skip: ['spans'] }))
describe(() => {})        // 'ƒ anonymous(0)'
describe([1, 2, 3])       // 'Array(3)'
```

`dumpProps` returns a flat list: `key`, `path` (`scale.stepMin`), `depth`,
`type`, `kind` (`object` / `array` / `function` / `primitive`), `value` (the
short form) and `raw` — the value itself, if the caller needs more.

## What it does not do

- **It does not watch for changes.** It is a snapshot taken at render time; the
  table repaints when its parent repaints.
- **It is not for production code.** Keys are read off the object, and Solid's
  props are enumerable getters: reading every property means subscribing to it.
  Fine for a debug panel, not fine inside a working component.
- **It does not guard against heavy values** beyond `maxItems` and `skip`: expand
  an array of a hundred thousand items and you get a hundred thousand rows.

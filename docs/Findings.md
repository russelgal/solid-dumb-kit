**English** · [Русский](ru/Findings.md)

# What turned out to be true

Verified claims, with how they were verified. Only things that cost time and are easy to forget; general reasoning lives in `CLAUDE.md`, and the history of changes in `CHANGELOG.md`.

## Distributing packages

**A git install can take a subdirectory.** `pnpm add "github:owner/repo#tag&path:/packages/foo"` works — verified against `solid-primitives` itself. A registry isn't required for separate packages.

**But `workspace:` doesn't resolve that way.** `ERR_PNPM_WORKSPACE_PKG_NOT_FOUND`: pnpm goes looking for a workspace on the consumer's side. It's rewritten only on publish, so a git install only ever works for **leaves** of the dependency graph. Hence compiling siblings into the build (`noExternal` in `configs/tsup.ts`) — 0.1–5 KB gzip per package, tsup dropping whatever isn't used.

**Copies of the shared code are safe.** `shared` and `sortable` hold no module-level state — factories only — so two copies can't drift apart. Worth re-checking when adding code: a module-level `Map`/`Set`/counter would break the assumption.

**npm is withdrawing 2FA-bypass tokens.** Phase one landed in August 2026 and already blocks "package management", which is what a first publish is. `whoami` still works while `publish` returns `404`. Direct publishing goes away around January 2027; the replacement is trusted publishing over OIDC from GitHub Actions.

**Tags are named after the folder, not the package.** `changeset tag` produces `@solid-dumb-kit/table@0.5.0`, which makes the git URL read `solid-dumb-kit#@solid-dumb-kit/table` — the repo name, then almost the same string again. A tag marks a point in history; which package is meant is already said by `path:`. `scripts/tag.mjs` does it.

## Building

**The `solid` condition is only emitted for entries whose file ends in `.tsx`.** That's how `tsup-preset-solid` decides (line 36 of its `dist/index.js`). So component barrels carry that extension even without JSX in them: without it an SSR consumer gets DOM calls it cannot run on the server.

**One config for all packages, not a copy in each.** Eleven identical files drift silently. The only thing they disagreed on was the entry extension — and that can be worked out from whether `src/index.tsx` exists.

**A custom export condition for development.** `solid-dumb-kit-source` in each package's `exports` points at `src`; `vitest` and the playground ask for it in `resolve.conditions`. A change in a sibling package is visible without a rebuild, while `tsc` goes through `dist` — the way a real install would.

## Native drag-and-drop

**It doesn't need a library.** `@atlaskit/pragmatic-drag-and-drop` is gone: the browser does the hit test anyway, and its stack of drop targets — inner first — is what `closest('[data-dnd-zone]')` returns. What remained was `dragenter`/`dragleave` normalisation and a honey pot for someone else's `:hover` bug; that cost 6.9 KB gzip and a CJS tail, `bind-event-listener`, which took down a consumer's dev server twice.

**Listeners go on the container, not the element.** Events bubble and `ev.target.closest` names the target. On a three-hundred-row list that's 4 entries in the listener table instead of 1200. Check it with CDP: `DOMDebugger.getEventListeners`.

**The drag image is taken from the element WHOLE.** For a tree node with an expanded branch, the snapshot includes the whole subtree. Either set `setDragImage` explicitly or — better — put `draggable` on the element that should travel (for a tree that's the `<li>`, with the branch inside it).

**`dataTransfer.getData()` is empty during `dragover`.** Only the list of types is available. So the accept decision is made from the type; see `GlobalDnd.md`.

**Hiding the source with `visibility`/`display` doesn't work** — it stops receiving `drag` events, which autoscroll depends on. Opacity only.

**`setData` is required for Firefox**, or the gesture won't start. `preventDefault()` in `dragover` is required everywhere, or there'll be no `drop`.

**You can't rely on `drop` alone.** The browser doesn't always deliver it: under fast movement Chrome swallows `dragover`, and without a fresh one it won't count the drop — most visible during autoscroll, where the cursor is still and events are scarce. The user watches the neighbours part, releases, and everything silently reverts. `dropEffect` won't tell you: a dropped-but-undelivered gesture reads `none`, exactly like a cancelled one. `dragend` settles it (it always arrives), and "did it happen" is decided by your own signal: released over the zone, and Escape wasn't pressed.

**Escape cancels the gesture, but `keydown` never reaches the page.** The drag mechanism takes the keyboard for the duration: a `keydown` listener will never fire. The page only gets `keyup`, and only AFTER `dragend`, about a millisecond later (measured). So the outcome is settled a frame and a half after `dragend` rather than inside it — enough to tell a cancel from an ordinary drop. `dropEffect` can't tell them apart: an undelivered drop reads `none` too.

**An ordinary drop very often isn't delivered at all.** In the same probe where Escape produced `dragend` + `keyup`, a normal release produced ONE `dragend` and no `drop` whatsoever. That's the common case, not a rare one — another argument for changing the order during the gesture instead of banking it until the drop.

**`dragleave` very often arrives with a null `relatedTarget`.** Moving from one element to another is also a `dragleave`, and clearing an "over the zone" flag on it cancels gestures for no reason. Count it as leaving only when the browser names where it went and that isn't a descendant of yours.

**Deferred source dimming has a race.** The dimming must happen on the next tick (otherwise the transparency lands in the drag image), but if the gesture ends before that tick, the deferred call switches it on *after* cleanup. A synchronous gesture flag fixes it.

**Gaps between elements are holes in the hit test.** The cursor falls between them onto the container, and "append" fires where nobody expects it. Caught twice: in the tree (fixed by butting rows together) and on the board, where the grid `gap` is part of the design and can't go. There the fix is different: **"missed the elements" doesn't mean "append"** while dragging inside your own zone. To become last you hover the last element — the rule "target below us, so go after it" gets you there. Empty space only means something for a visitor from another zone: in an empty zone there's nothing else to hover.

## Animation

**`order` cannot be animated at all** — it's a discrete layout property. View Transitions don't fit either: they're snapshot-based and survive interruption poorly, while the insert position is overridden by every `dragover`. That leaves FLIP.

**A `transition` assigned in the same frame as the `transform` doesn't start.** The only way around it is to attach transitions to every element up front — hundreds of `style` writes for the three that actually move. `el.animate()` starts immediately and writes nothing into `style`.

**An animation cut short has to be picked up where it actually is.** Computed by inverting the Bézier against its `currentTime`; no layout read.

**Neighbours of unequal size oscillate, and one threshold isn't enough.** Drag a narrow block onto a wide one, the order changes — and the wide one lands exactly under the cursor; the next event takes it as the target and swaps back. The "target is animating" guard doesn't help: under slow movement the animation has time to finish. Three rules were needed together, each covering its own case:

1. **A threshold at the target's midpoint** in the direction of travel (the SortableJS rule) — otherwise the swap fires on touching the edge.
2. **One swap per entry onto a neighbour**: until the cursor leaves it, no second swap. This catches oscillation on a SINGLE target.
3. **A ban on putting the block back where it just came from** — oscillation also happens across TWO targets alternating: over one neighbour the slot comes out third, over the other first, and they alternate every frame. The ban holds only while the hand keeps travelling the same way; a reversal lifts it, or you couldn't change your mind mid-gesture.

Computing the slot from the layout WITHOUT the dragged block is tempting (it doesn't depend on where that block goes, so the slot becomes a pure function of the pointer), but it doesn't work: the block stays in the flow, merely dimmed, so that layout disagrees with the picture and the block jumps to someone else's place the moment the gesture starts.

**A target that is itself moving is a bad target.** It ended up under the cursor on its way somewhere else. Check `el.getAnimations().length` and skip it.

**The cursor has to actually move.** The browser sends `dragover` with the mouse standing still, and the hit test follows the *visible* picture — one element after another slides under the cursor and the order starts twitching on its own. Compare `clientX/clientY` against the previous event.

## Measurements

**"Just measure it" costs more than it looks, but not catastrophically.** Textbook FLIP (read everything, change the layout, read again) against a snapshot: 0.90 ms versus 0.30 ms per relayout, 400 reads versus none. The gap grows linearly with element count and step frequency, and it's a synchronous forced layout inside an event handler — the cost depends on how dirty the layout happens to be. Live probe: `examples/lab/FlipBench.example.tsx`.

**Reading `scrollTop` per frame is also a forced layout.** Polling it every frame produced 82 style recalculations out of 88 for a whole gesture. The autoscroller now tracks the position itself and swallows the echo of its own scrolling.

**Autoscroll coordinates come from the native `drag` event.** It keeps firing with the mouse standing still, while `dragover` has gone quiet — precisely when scrolling at the edge matters most.

## Traps when verifying

**Playwright throttles `dragover` under fast synthetic movement.** `mouse.move(..., {steps: N})` sends a burst with no pauses and Chrome skips events entirely. Use small steps with 45–80 ms pauses, and dwell in place when entering a new zone. **Three times this session I recorded "it's broken" where nothing was.**

**Geometry can't be read mid-animation.** The measurement lands on an intermediate position. Read state (`style.order`, DOM order) rather than coordinates, or wait for the animation to finish.

**`git+file://` fetches the committed tree, not the working one.** Testing an edit that isn't committed measures the old code.

## Slugs

`genSlug` from `utils` is `slug(name)`, and it **does not match** the common transliterate-then-slug pairing: `й` → `j` against `i`, `ы` → `y` against `i`. `klej-karandash-15g` against `klei-karandash-15g`. For a fresh catalogue that's irrelevant; if slugs are already in a database with live URLs on them, swapping the function changes addresses.

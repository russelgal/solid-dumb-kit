---
'@solid-dumb-kit/grid': minor
'@solid-dumb-kit/sortable': minor
'@solid-dumb-kit/table': patch
---

Старт жеста можно отдавать из JSX: `ref={s.row(id)} onPointerDown={s.press(id)}`
у `sortable` (плюс `pressHandle`, а у списков группы — `card(id)` + `press(id)`),
`ref={g.block(id)} onPointerDown={g.press(id)}` у `grid` (плюс `pressResize`).

`pointerdown` из JSX Solid делегирует, поэтому на всю таблицу висит один
слушатель на документ вместо слушателя на каждой строке. Старый самодостаточный
`bind(id)` остаётся — движки зовут и вне Solid, там JSX взять неоткуда.
`DumbTable` переведён на новую пару.

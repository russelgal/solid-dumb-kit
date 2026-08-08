// Ядро реактивности: Solid 1 против Solid 2 (@solidjs/signals).
//
// Без DOM и без JSX — меряется только граф сигналов, то есть ровно то, что
// переписали ко второй линии. Три нагрузки:
//
//   1. создание графа: N сигналов, поверх них N мемо
//   2. точечные записи: тысяча обновлений по одному сигналу за раз
//   3. широкая запись: обновить сразу все N сигналов и дождаться пересчёта
//
// В Solid 2 обновления флашатся микротаском, поэтому после записей зовётся
// `flush()` — иначе мы бы засекали время НЕ сделанной работы.
//
// ЗАПУСКАТЬ ТОЛЬКО ТАК: node --conditions=browser scripts/_bench-reactivity.mjs
// Без этого Node берёт у solid-js СЕРВЕРНУЮ сборку, где реактивности нет
// вовсе, и Solid 1 «выигрывает» просто потому, что ничего не делает.

import * as s1 from 'solid-js'
import * as s2 from '@solidjs/signals'

const N = 2000
const WRITES = 1000
const RUNS = 5
const median = (xs) => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)]

function bench(lib, name, isV2) {
  const build = []
  const point = []
  const wide = []

  for (let run = 0; run < RUNS; run++) {
    let dispose = () => {}
    let sigs, memos, seen = 0

    const t0 = performance.now()
    lib.createRoot((d) => {
      dispose = d
      sigs = Array.from({ length: N }, (_, i) => lib.createSignal(i))
      memos = sigs.map(([get]) => lib.createMemo(() => get() * 2 + 1))
      // эффект на каждый мемо: в Solid 2 он двухфазный
      for (const m of memos) {
        if (isV2) lib.createEffect(() => m(), () => void seen++)
        else lib.createEffect(() => { m(); seen++ })
      }
      if (isV2) lib.flush()
    })
    build.push(performance.now() - t0)

    const t1 = performance.now()
    for (let i = 0; i < WRITES; i++) {
      sigs[i % N][1]((v) => v + 1)
      if (isV2) lib.flush()
    }
    point.push(performance.now() - t1)

    // широкая запись: все сигналы разом, пересчёт один
    const t2 = performance.now()
    if (isV2) {
      for (const [, set] of sigs) set((v) => v + 1)
      lib.flush()
    } else {
      lib.batch(() => { for (const [, set] of sigs) set((v) => v + 1) })
    }
    wide.push(performance.now() - t2)

    dispose()
  }

  return { name, build: median(build), point: median(point), wide: median(wide) }
}

const rows = [
  bench(s1, `Solid 1 (${(await import('solid-js/package.json', { with: { type: 'json' } })).default.version})`, false),
  bench(s2, `Solid 2 (@solidjs/signals ${(await import('@solidjs/signals/package.json', { with: { type: 'json' } })).default.version})`, true),
]

console.log(`\n=== граф из ${N} сигналов + ${N} мемо + ${N} эффектов, медиана ${RUNS} заходов ===\n`)
console.log('  библиотека'.padEnd(46) + 'создание'.padStart(12) + `${WRITES} записей`.padStart(14) + 'широкая'.padStart(12))
for (const r of rows) {
  console.log('  ' + r.name.padEnd(44) + `${r.build.toFixed(1)} мс`.padStart(12) + `${r.point.toFixed(1)} мс`.padStart(14) + `${r.wide.toFixed(2)} мс`.padStart(12))
}
const [a, b] = rows
console.log(`\n  отношение 2/1:  создание ×${(b.build / a.build).toFixed(2)}   записи ×${(b.point / a.point).toFixed(2)}   широкая ×${(b.wide / a.wide).toFixed(2)}`)

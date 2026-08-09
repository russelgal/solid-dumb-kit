// Сколько слушателей висит на живых экранах витрины.
//
// Считает счётчиком JSEventListeners из CDP: в JS-куче слушателей почти не
// видно, это выяснилось на прошлом замере.
//
// По умолчанию идёт на прод, чтобы не требовать поднятого дев-сервера; свой
// адрес — переменной BASE.
import { chromium } from 'playwright'

const BASE = process.env.BASE ?? 'https://solid-dumb-kit.vercel.app'

const PAGES = [
  ['sortable', 'DumbSortable — список и сетка'],
  ['sortdnd', 'DumbSortableDnd — нативный DnD'],
  ['dashboard', 'DumbGrid — дашборд'],
  ['table', 'DumbTable'],
  ['virtual', 'Виртуализация — миллион строк'],
  ['finder', 'DumbFinder'],
]

const b = await chromium.launch({ channel: 'chrome' })
const p = await b.newPage({ viewport: { width: 1500, height: 950 } })
const cdp = await p.context().newCDPSession(p)
await cdp.send('Performance.enable')

const metrics = async () => {
  const { metrics } = await cdp.send('Performance.getMetrics')
  const get = (n) => metrics.find((m) => m.name === n)?.value ?? 0
  return { listeners: get('JSEventListeners'), nodes: get('Nodes') }
}

await p.goto(`${BASE}/theme`, { waitUntil: 'networkidle' })
await p.waitForTimeout(1000)
const base = await metrics()
console.log(`\n  фон (вкладка «Тема»): ${base.listeners} слушателей, ${base.nodes} узлов\n`)
console.log('  экран'.padEnd(36) + 'слушателей'.padStart(12) + 'узлов'.padStart(9) + 'на узел'.padStart(10))

for (const [id, label] of PAGES) {
  await p.goto(`${BASE}/${id}`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(1200)
  const m = await metrics()
  const perNode = m.nodes ? (m.listeners / m.nodes).toFixed(2) : '—'
  console.log('  ' + label.padEnd(34) + String(m.listeners).padStart(12) + String(m.nodes).padStart(9) + String(perNode).padStart(10))
}
await b.close()

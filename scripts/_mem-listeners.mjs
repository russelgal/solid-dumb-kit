import { chromium } from 'playwright'

const b = await chromium.launch({ channel: 'chrome' })
const p = await b.newPage()
await p.goto('about:blank')
const cdp = await p.context().newCDPSession(p)
await cdp.send('Performance.enable')

/**
 * Слушатели живут НЕ в JS-куче, а в памяти рендерера — `Runtime.getHeapUsage`
 * их не видит вовсе (первый заход дал отрицательные дельты). Считаем тем, что
 * их действительно считает: счётчиками DOM.
 */
async function counters() {
  await cdp.send('HeapProfiler.collectGarbage')
  await p.waitForTimeout(150)
  const { metrics } = await cdp.send('Performance.getMetrics')
  const get = (n) => metrics.find((m) => m.name === n)?.value ?? 0
  return { listeners: get('JSEventListeners'), nodes: get('Nodes'), heapKb: Math.round(get('JSHeapUsedSize') / 1024) }
}

const N = 20000
const median = (xs) => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)]
console.log(`\n=== ${N.toLocaleString('ru-RU')} элементов, медиана 3 заходов ===`)
for (const kind of ['без слушателей', 'по слушателю на элемент', 'один на контейнер']) {
  const heaps = []
  let listeners = 0
  for (let pass = 0; pass < 3; pass++) {
  await p.evaluate(() => { document.body.innerHTML = ''; window.__keep = null })
  const before = await counters()

  await p.evaluate(({ kind, N }) => {
    const host = document.createElement('div')
    const onHit = () => {}
    for (let i = 0; i < N; i++) {
      const el = document.createElement('div')
      el.textContent = 'строка ' + i
      if (kind === 'по слушателю на элемент') el.addEventListener('pointerdown', onHit)
      host.appendChild(el)
    }
    if (kind === 'один на контейнер') host.addEventListener('pointerdown', onHit)
    document.body.appendChild(host)
    window.__keep = host
  }, { kind, N })

  const after = await counters()
  heaps.push(after.heapKb - before.heapKb)
  listeners = after.listeners - before.listeners
  }
  console.log(
    `  ${kind.padEnd(26)} слушателей: ${String(listeners).padStart(6)}` +
    `   JS heap: +${median(heaps)} КБ   (заходы: ${heaps.join(', ')})`,
  )
}
await b.close()

import { chromium } from 'playwright'
const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto('http://localhost:4199/solid-dumb-kit/#orderkanban', { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
console.log('  цветов левой рамки:', await page.evaluate(() => [...new Set([...document.querySelectorAll('[data-card]')]
  .map((e) => getComputedStyle(e).borderLeftColor))].length))
await browser.close()

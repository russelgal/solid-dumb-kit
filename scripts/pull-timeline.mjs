// Снять данные шахматки с локального стенда — чтобы витрина кита показывала
// правдоподобные цены и брони, а не выдуманные.
//
// Скрипт НЕ хранит и не печатает учётку: логин и пароль берутся из `.env`
// (`TEST_USER`, `TEST_PASS`) и уходят прямо в форму стенда. Запускать руками:
//
//     node scripts/pull-timeline.mjs
//
// На выходе — два файла в /tmp:
//   timeline-raw.json   сырые ответы стенда (там настоящие имена; в репу НЕ кладём)
//   timeline-anon.json  обезличенное: имена заменены, цены и даты сохранены
//
// Обезличивание простое и тупое по смыслу: любое поле, похожее на имя гостя,
// телефон или почту, заменяется на «Гость N» / пусто. Цены, даты, номера
// комнат и статусы остаются как есть — они и нужны витрине.

import { readFileSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'

const BASE = process.env.STAND_URL ?? 'http://localhost:5001'
const TARGET = process.argv[2] ?? '2026-07-27'

/** креды из .env, а не из аргументов: в истории команд им не место */
function creds() {
  const env = {}
  try {
    for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
      const m = line.match(/^([A-Z_]+)=(.*)$/)
      if (m) env[m[1]] = m[2].trim()
    }
  } catch {
    /* .env может не быть — тогда смотрим на окружение */
  }
  const user = process.env.TEST_USER ?? env.TEST_USER
  const pass = process.env.TEST_PASS ?? env.TEST_PASS
  if (!user || !pass) {
    console.error('Нет TEST_USER/TEST_PASS: заполни их в .env и запусти снова.')
    process.exit(1)
  }
  return { user, pass }
}

const { user, pass } = creds()
const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })

/** всё, что стенд отдал JSON'ом: из этого потом и собираем набор */
const payloads = []
page.on('response', async (res) => {
  const type = res.headers()['content-type'] ?? ''
  if (!type.includes('application/json')) return
  try {
    payloads.push({ url: res.url(), status: res.status(), body: await res.json() })
  } catch {
    /* не JSON, хотя обещали — пропускаем */
  }
})

console.log('логинюсь…')
await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
const login = page.locator('input[type="email"], input[name="email"], input[name="login"]').first()
const password = page.locator('input[type="password"]').first()
await login.fill(user)
await password.fill(pass)
await Promise.all([
  page.waitForLoadState('networkidle').catch(() => {}),
  page.locator('button[type="submit"], button:has-text("Войти")').first().click(),
])
await page.waitForTimeout(1500)

if (page.url().includes('/login')) {
  console.error('Логин не прошёл: стенд оставил нас на /login. Проверь TEST_USER/TEST_PASS.')
  await browser.close()
  process.exit(1)
}

console.log('открываю шахматку…')
await page.goto(`${BASE}/timeline?target=${TARGET}`, { waitUntil: 'networkidle' })
await page.waitForTimeout(2500)

/* ── что нарисовано на экране: подстраховка, если данных в JSON не нашлось ── */
const dom = await page.evaluate(() => {
  const text = (el) => (el?.textContent ?? '').trim()
  return {
    rows: Array.from(document.querySelectorAll('[class*="row"], [data-row]'))
      .slice(0, 60)
      .map((el) => text(el).slice(0, 80))
      .filter(Boolean),
    spans: Array.from(document.querySelectorAll('[class*="span"], [data-span], [data-booking]'))
      .slice(0, 200)
      .map((el) => ({
        text: text(el).slice(0, 80),
        data: { ...el.dataset },
      })),
  }
})

writeFileSync('/tmp/timeline-raw.json', JSON.stringify({ payloads, dom }, null, 2))
console.log('сырое →  /tmp/timeline-raw.json')
console.log('ответов JSON:', payloads.length, '| адреса:')
for (const p of payloads) console.log('   ', p.status, p.url.replace(BASE, ''))

/* ── обезличивание ───────────────────────────────────────────────────────── */

const NAMES = ['Гость 1', 'Гость 2', 'Гость 3', 'Гость 4', 'Гость 5', 'Гость 6', 'Гость 7', 'Гость 8']
const seen = new Map()
const alias = (v) => {
  if (!seen.has(v)) seen.set(v, NAMES[seen.size % NAMES.length] + (seen.size >= NAMES.length ? ` (${seen.size})` : ''))
  return seen.get(v)
}

/** имя, телефон, почта — прочь; цены, даты, номера — остаются */
const PERSONAL = /(name|guest|client|customer|display|title|фио|имя|гост)/i
const CONTACT = /(phone|tel|email|mail|телефон|почта|comment|note|коммент)/i

function scrub(node) {
  if (Array.isArray(node)) return node.map(scrub)
  if (node && typeof node === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(node)) {
      if (typeof v === 'string' && PERSONAL.test(k)) out[k] = alias(v)
      else if (typeof v === 'string' && CONTACT.test(k)) out[k] = ''
      else out[k] = scrub(v)
    }
    return out
  }
  return node
}

writeFileSync('/tmp/timeline-anon.json', JSON.stringify(scrub({ payloads, dom }), null, 2))
console.log('обезличенное → /tmp/timeline-anon.json')

await browser.close()

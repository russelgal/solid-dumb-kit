// Разовый конвертер: хардкод-цвета в <style> примеров → токены daisyUI.
//
// Смотрит на СВОЙСТВО, а не только на цвет: один и тот же #94a3b8 в `color:` —
// это текст (base-content), а в `border:` — граница (base-300). В тёмной теме
// base-300 темнее base-100, поэтому перепутать нельзя: текст станет невидим.
import { readFileSync, writeFileSync } from 'node:fs'

const SURFACE = {
  '#fff': '--color-base-100', '#ffffff': '--color-base-100', white: '--color-base-100',
  '#f8fafc': '--color-base-200', '#f1f5f9': '--color-base-200',
  '#eef2f7': '--color-base-200', '#e9eef5': '--color-base-200',
  '#e2e8f0': '--color-base-300', '#cbd5e1': '--color-base-300', '#94a3b8': '--color-base-300',
}
const INK = {
  '#0f172a': '--color-base-content', '#1e293b': '--color-base-content',
  '#334155': '--color-base-content', '#475569': '--color-base-content',
  '#64748b': '--color-base-content', '#94a3b8': '--color-base-content',
  '#cbd5e1': '--color-base-content', black: '--color-base-content',
}
const ACCENT = {
  '#3b82f6': '--color-primary', '#2563eb': '--color-primary', '#6366f1': '--color-primary',
  '#4338ca': '--color-primary', '#4f46e5': '--color-primary', '#818cf8': '--color-primary',
  '#7c3aed': '--color-secondary', '#db2777': '--color-secondary',
  '#16a34a': '--color-success', '#22c55e': '--color-success', '#15803d': '--color-success',
  '#047857': '--color-success', '#065f46': '--color-success', '#0f766e': '--color-success',
  '#0ea5e9': '--color-info', '#0284c7': '--color-info', '#0369a1': '--color-info',
  '#dc2626': '--color-error', '#ef4444': '--color-error', '#b91c1c': '--color-error',
  '#7f1d1d': '--color-error', '#991b1b': '--color-error',
  '#b45309': '--color-warning', '#d97706': '--color-warning', '#f59e0b': '--color-warning',
}
// бледные плашки акцентов: подмешиваем акцент в фон, чтобы жили в обеих темах
const TINT = {
  '#eef2ff': '--color-primary', '#dbeafe': '--color-primary', '#eff6ff': '--color-primary',
  '#c7d2fe': '--color-primary', '#e0e7ff': '--color-primary',
  '#ecfdf5': '--color-success', '#f0fdf4': '--color-success', '#dcfce7': '--color-success',
  '#fef2f2': '--color-error', '#fee2e2': '--color-error',
  '#fffbeb': '--color-warning', '#fef3c7': '--color-warning',
}

const tint = (v) => `color-mix(in oklch, var(${v}) 18%, var(--color-base-100))`

/** какое свойство описывает ОДНА декларация — от этого зависит, чем красить */
function kindOf(decl) {
  const l = decl.toLowerCase()
  if (/(^|[{\s])color\s*:/.test(l)) return 'ink'
  if (/border|outline|box-shadow|ring|stroke|caret|divide/.test(l)) return 'edge'
  return 'surface'
}

/** полупрозрачный белый/чёрный — это «подмешать контраста», а не «сделать светлым» */
const mixAlpha = (alpha) =>
  `color-mix(in oklch, var(--color-base-content) ${Math.round(Number(alpha) * 100)}%, transparent)`

function convertDecl(decl) {
  const kind = kindOf(decl)
  let out = decl.replace(/rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*(\.\d+|0?\.\d+|1|0)\s*\)/g, (_, a) => mixAlpha(a))
    .replace(/rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*(\.\d+|0?\.\d+|1|0)\s*\)/g, (_, a) => mixAlpha(a))
    // rgba(15,23,42,.06) и подобные тени по slate-900
    .replace(/rgba\(\s*15\s*,\s*23\s*,\s*42\s*,\s*(\.\d+|0?\.\d+)\s*\)/g, (_, a) => mixAlpha(a))
    .replace(/rgba\(\s*148\s*,\s*163\s*,\s*184\s*,\s*(\.\d+|0?\.\d+)\s*\)/g, (_, a) => mixAlpha(a))

  // `white` только как ЗНАЧЕНИЕ: в `white-space` это часть имени свойства,
  // и подстановка туда переменной ломает объявление целиком
  return out.replace(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|\bwhite\b(?!-)|\bblack\b(?!-)/g, (raw) => {
    const c = raw.toLowerCase()
    if (ACCENT[c]) return `var(${ACCENT[c]})`
    if (TINT[c]) return tint(TINT[c])
    if (kind === 'ink' && INK[c]) return `var(${INK[c]})`
    if (SURFACE[c]) return `var(${SURFACE[c]})`
    if (INK[c]) return `var(${INK[c]})`
    return raw
  })
}

/** режем строку на декларации: в одной строке бывает и фон, и цвет текста */
function convertLine(line) {
  return line.split(';').map(convertDecl).join(';')
}

let total = 0
for (const file of process.argv.slice(2)) {
  const src = readFileSync(file, 'utf8')
  let inStyle = false
  let changed = 0
  const out = src.split('\n').map((line) => {
    if (/<style>/.test(line)) inStyle = true
    if (!inStyle) return line
    if (/<\/style>/.test(line)) inStyle = false
    const next = convertLine(line)
    if (next !== line) changed++
    return next
  }).join('\n')
  if (changed) { writeFileSync(file, out); total += changed }
  console.log(`${String(changed).padStart(3)} строк — ${file}`)
}
console.log('итого строк изменено:', total)

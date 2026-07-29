// Одно место, где решается «анимировать или нет».
//
// Правило: явный флаг потребителя важнее, но системная настройка сильнее
// умолчания. То есть animate по умолчанию включён, однако при
// prefers-reduced-motion: reduce анимации выключаются сами — это не каприз
// пользователя ОС, а требование доступности (вестибулярные расстройства).
// Явный animate: true перебивает и её, если потребитель точно знает, что делает.

export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** анимировать ли: undefined → да, но с оглядкой на системную настройку */
export function shouldAnimate(explicit?: boolean): boolean {
  if (explicit !== undefined) return explicit
  return !prefersReducedMotion()
}

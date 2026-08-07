// С какой стороны рисовать кнопку закрытия.
//
// Привычка эта системная, а не вкусовая: в macOS кнопки окна слева, в
// Windows и Linux — справа. Окно, у которого крестик не там, где рука его
// ищет, каждый раз стоит лишнего движения глазами.
//
// Поэтому кит смотрит на платформу и ставит крестик туда, где его ждут. Правил
// три, по убыванию силы:
//
// 1. проп компонента (`closeSide`) — потребитель знает лучше;
// 2. общая настройка приложения (`configureCloseSide`) — задать один раз, а не
//    прокидывать в каждый компонент;
// 3. платформа: Apple — слева, всё остальное — справа.
//
// Платформу не определили (SSR, экзотический агент) — берём macOS-сторону:
// это осознанное умолчание кита, а не «как получится».
//
// Ни DOM, ни фреймворка: чистая функция и одна переменная модуля.

export type CloseSide = 'left' | 'right'
/** `auto` — решает платформа */
export type CloseSideOption = CloseSide | 'auto'

let configured: CloseSideOption = 'auto'

/**
 * Задать сторону на всё приложение разом. Зовётся один раз при старте; чтобы
 * вернуться к платформенному поведению — `configureCloseSide('auto')`.
 */
export function configureCloseSide(side: CloseSideOption): void {
  configured = side
}

/** узнанная платформа: считается один раз, дальше берётся из кэша */
let apple: boolean | null = null

/**
 * Apple ли это (macOS, iPadOS, iOS). `userAgentData.platform` — то, что
 * браузеры оставили после урезания UA-строки; `navigator.platform` устарел, но
 * жив и в Safari отвечает точнее. Ни одно из этих чтений не трогает раскладку.
 */
export function isApplePlatform(): boolean {
  if (apple !== null) return apple
  const nav = typeof navigator === 'undefined' ? null : navigator
  if (!nav) return (apple = false)
  const uaData = (nav as { userAgentData?: { platform?: string } }).userAgentData
  const src = uaData?.platform || nav.platform || nav.userAgent || ''
  // iPadOS 13+ представляется Mac'ом — и это ровно то, что нам нужно
  apple = /mac|iphone|ipad|ipod/i.test(src)
  return apple
}

/**
 * Итоговая сторона: проп важнее общей настройки, та важнее платформы.
 * Платформа неизвестна — сторона macOS (слева).
 */
export function resolveCloseSide(explicit?: CloseSideOption): CloseSide {
  const pick = explicit && explicit !== 'auto' ? explicit : configured
  if (pick !== 'auto') return pick
  const nav = typeof navigator === 'undefined' ? null : navigator
  if (!nav) return 'left'
  return isApplePlatform() ? 'left' : 'right'
}

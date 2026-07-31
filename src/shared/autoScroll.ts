// Автоскролл во время перетаскивания — общий для всех DnD-фич кита.
//
// Почему свой, а не готовый из Pragmatic: тот крутит, только пока курсор над
// зарегистрированной целью. Стоит увести блок ЗА нижний край списка — а тащат
// именно так — и прокрутка встаёт. Их `unsafe-overflow` этот случай не закрыл:
// за краем целей нет вовсе, активировать автоскролл нечему.
//
// В кадре НЕ ЧИТАЕТСЯ НИЧЕГО. Это не педантизм: чтение `scrollTop` заставляет
// браузер разрешить стили, и покадровый опрос давал под сотню пересчётов за
// жест — они и выглядели «постоянными репейнтами». Поэтому положение прокрутки
// движок ведёт сам (сколько накрутил, столько и запомнил), а расходится с
// реальностью только если крутят ещё и снаружи — на этот случай есть пассивный
// слушатель `scroll`, который сверяет цифру уже готовым значением.
//
// Цикл засыпает, как только крутить нечего (курсор ушёл от края, уровень
// докручен до упора), и просыпается на следующем движении. В покое жест не
// стоит браузеру ни кадра.
//
// Геометрия уровней снимается один раз на старте: скролл самого элемента его
// прямоугольник не двигает, а вложенные скроллеры за один жест обычно крутят
// по одному.

import { autoScrollSpeed, EDGE } from './viewport'

type Level = {
  el: HTMLElement | null   // null — окно
  top: number
  bottom: number
  left: number
  right: number
  max: number
  /** где уровень прокручен сейчас — ведём сами, из DOM не перечитываем */
  pos: number
}

export type AutoScroller = {
  /** снять цепочку прокручиваемых уровней от элемента вверх (на старте жеста) */
  start: (el: HTMLElement) => void
  /** последняя известная позиция курсора */
  move: (x: number, y: number) => void
  stop: () => void
}

const SCROLLABLE = /(auto|scroll|overlay)/

/** потолок скорости, px за кадр (~1100px/с) */
const MAX_STEP = 18

export function createAutoScroller(): AutoScroller {
  let levels: Array<Level> = []
  let x = 0
  let y = 0
  let raf = 0
  let live = false
  /** ждём эхо от собственной прокрутки — на него реагировать не нужно */
  let echo = 0

  /**
   * Позицию курсора берём из нативного `drag` — он приходит и когда мышь стоит
   * (браузер шлёт его сам, пару раз в секунду). Полагаться только на `dragover`
   * нельзя: стоит остановиться у края, как события кончаются, последняя
   * известная точка устаревает — и прокрутка встаёт ровно там, где она нужнее
   * всего.
   */
  const onNativeDrag = (ev: DragEvent) => {
    // у последнего `drag` перед завершением координаты обнуляются — игнорируем
    if (!ev.clientX && !ev.clientY) return
    x = ev.clientX
    y = ev.clientY
    wake()
  }

  /**
   * Кто-то прокрутил помимо нас (колесо, клавиатура) — принимаем новую цифру.
   *
   * Своё же эхо пропускаем не из экономии: каждая наша запись рождает событие,
   * а чтение в ответ на него — пересчёт стилей, то есть покадровый круг из
   * «крутим → читаем → крутим». Пока автоскролл работает, позиция и так наша;
   * сверяться нужно ровно тогда, когда крутит кто-то другой.
   */
  const onScroll = (ev: Event) => {
    if (echo > 0) { echo = 0; return }
    const t = ev.target
    for (const level of levels) {
      if (level.el ? t === level.el : t === document || t === document.documentElement) {
        level.pos = level.el ? level.el.scrollTop : window.scrollY
        return
      }
    }
  }

  /** один шаг прокрутки; возвращает false, если крутить больше нечего */
  function step(): boolean {
    for (const level of levels) {
      // по горизонтали должны быть в пределах уровня, по вертикали — у края
      // либо за ним: увели блок ниже списка, значит листаем вниз
      if (x < level.left - EDGE || x > level.right + EDGE) continue
      const speed = autoScrollSpeed({
        pointerY: y,
        viewTop: level.top,
        clientH: level.bottom - level.top,
        scrollY: level.pos,
        scrollMax: level.max,
      })
      if (!speed) continue
      // За краем скорость иначе растёт до «телепорта»: увёл курсор далеко —
      // список пролетел тысячи пикселей за секунду и найти нужное место
      // невозможно. Держим потолок на уровне разумного листания.
      const capped = Math.max(-MAX_STEP, Math.min(MAX_STEP, speed))
      const next = Math.max(0, Math.min(level.max, level.pos + capped))
      if (next === level.pos) continue
      level.pos = next
      echo++
      if (level.el) level.el.scrollTop = next
      else window.scrollTo(window.scrollX, next)
      return true                             // крутим один уровень за кадр — ближайший
    }
    return false
  }

  function frame() {
    if (!live) return
    if (!step()) { raf = 0; return }           // нечего крутить — засыпаем до движения
    raf = requestAnimationFrame(frame)
  }

  function wake() {
    if (live && !raf) raf = requestAnimationFrame(frame)
  }

  return {
    start(el: HTMLElement) {
      levels = []
      let node: HTMLElement | null = el
      // единственное чтение геометрии за весь жест — здесь, на старте
      while (node && node !== document.body && node !== document.documentElement) {
        const style = getComputedStyle(node)
        if (SCROLLABLE.test(style.overflowY) || SCROLLABLE.test(style.overflowX)) {
          const r = node.getBoundingClientRect()
          levels.push({
            el: node,
            top: r.top, bottom: r.bottom, left: r.left, right: r.right,
            max: node.scrollHeight - node.clientHeight,
            pos: node.scrollTop,
          })
        }
        node = node.parentElement
      }
      // страница — последний рубеж: до неё очередь доходит, если внутренние
      // уровни курсора не касаются либо уже докручены
      levels.push({
        el: null,
        top: 0, bottom: window.innerHeight, left: 0, right: window.innerWidth,
        max: (document.scrollingElement?.scrollHeight ?? 0) - window.innerHeight,
        pos: window.scrollY,
      })

      live = true
      document.addEventListener('drag', onNativeDrag, true)
      document.addEventListener('scroll', onScroll, { capture: true, passive: true })
      wake()
    },

    move(nextX: number, nextY: number) {
      x = nextX
      y = nextY
      wake()
    },

    stop() {
      live = false
      echo = 0
      document.removeEventListener('drag', onNativeDrag, true)
      document.removeEventListener('scroll', onScroll, true)
      if (raf) cancelAnimationFrame(raf)
      raf = 0
      levels = []
    },
  }
}

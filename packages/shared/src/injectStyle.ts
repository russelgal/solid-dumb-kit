// Разовый инжект стилей в `<head>`.
//
// Соблазн написать это внутри компонента — `<Show when={первыйРаз}><style>…` —
// выглядит правильным и ломается ровно на второй раз. Флаг «уже вставили» живёт
// в модуле, а сам `<style>` — в дереве компонента: ушёл со страницы первый
// экземпляр, фреймворк удалил его разметку вместе со стилями, а флаг остался
// поднятым. Возвращаешься на вкладку — и компонент без стилей.
//
// Поэтому стиль кладётся в `<head>` мимо дерева и не убирается никогда: он
// весит сотню байт, а его отсутствие ломает вёрстку.

const done = new Set<string>()

/**
 * Вставить стили один раз на документ.
 *
 * @param id  ключ, он же `data-dumb-kit` у тега — по нему видно в инспекторе,
 *            кто это положил, и по нему же ищется уже вставленное
 * @param css  сами правила
 */
export function injectStyle(id: string, css: string): void {
  if (typeof document === 'undefined') return   // SSR: на сервере вставлять некуда
  if (done.has(id)) return
  done.add(id)

  // мог остаться от предыдущей загрузки модуля (HMR) — второй раз не нужен
  if (document.querySelector(`style[data-dumb-kit="${id}"]`)) return

  const el = document.createElement('style')
  el.setAttribute('data-dumb-kit', id)
  el.textContent = css
  document.head.appendChild(el)
}

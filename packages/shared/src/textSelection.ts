// Подавление выделения текста на время жеста.
//
// Две тонкости, из-за которых это отдельный файл:
//  • Safari до сих пор смотрит на -webkit-user-select, поэтому ставим оба свойства;
//  • жест начинается не сразу (порог/долгое нажатие), и к этому моменту браузер
//    уже успел что-то выделить — просто запретить дальнейшее выделение мало,
//    надо снять уже выделенное.

type BodyStyle = CSSStyleDeclaration & { webkitUserSelect?: string }

export function suppressTextSelection() {
  if (typeof document === 'undefined') return
  const s = document.body.style as BodyStyle
  s.userSelect = 'none'
  s.webkitUserSelect = 'none'
  // то, что успело выделиться, пока ждали порога
  const sel = window.getSelection?.()
  if (sel && !sel.isCollapsed) sel.removeAllRanges()
}

export function restoreTextSelection() {
  if (typeof document === 'undefined') return
  const s = document.body.style as BodyStyle
  s.userSelect = ''
  s.webkitUserSelect = ''
}

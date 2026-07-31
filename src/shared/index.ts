// Публичная часть общего слоя. Всё остальное в `shared/` — внутреннее
// (вьюпорт, подавление выделения, правила старта жеста): оно живёт для фич
// кита и меняется вместе с ними.

export { createFlip, type Flip } from './flip'
export { createAutoScroller, type AutoScroller } from './autoScroll'

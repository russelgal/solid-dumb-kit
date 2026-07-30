export {
  DumbGrid,
  mergeLayout,
  type DumbGridProps,
  type DumbGridItem,
  type DumbGridLayout,
} from './DumbGrid'

// Solid-обёртка (для своей разметки вместо готового компонента)
export {
  createDumbGrid,
  type DumbGridHandle,
  type GridActive,
} from './solid'

// Движок без привязки к фреймворку
export {
  createGridEngine,
  type GridEngine,
  type DumbGridOptions,
  type DumbGridBlock,
} from './gridCore'

// Математика сетки — чистые функции, полезны и снаружи
export {
  packFlow,
  placeFree,
  resolveSpan,
  firstFreeCell,
  pointToCell,
  overlaps,
  fitSpan,
  cellRect,
  colWidth,
  spanSize,
  rowCount,
  insertIndex,
  moveDeltas,
  snapSpan,
  reorder,
  type GridSpan,
  type FreeSpan,
  type SpanValue,
  type SpanPreset,
  type LayoutMode,
  type FlowMode,
  type Placed,
  type Metrics,
  type Rect,
  type SpanLimits,
} from './gridMath'

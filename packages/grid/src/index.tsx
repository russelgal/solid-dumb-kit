export {
  DumbGrid,
  mergeLayout,
  // разметку сетки рисует и доска: линии считаются через calc, без замеров
  gridLinesBackground,
  type DumbGridProps,
  type DumbGridItem,
  type DumbGridLayout,
} from './DumbGrid'

// Solid-обёртка (для своей разметки вместо готового компонента)
export {
  createDumbGrid,
  type DumbGridHandle,
  createDumbGridGroup,
  type DumbGridGroupHandle,
  type GridGroupActive,
  type GridActive,
} from './solid'

// Движок без привязки к фреймворку
export {
  createGridEngine,
  type GridEngine,
  type DumbGridOptions,
  type DumbGridBlock,
} from './gridCore'

// Группа сеток: перенос блока между сетками
export {
  createGridGroupEngine,
  type GridGroupEngine,
  type GridGroupOptions,
  type GridZoneOptions,
  type GridZoneEngine,
  type GridTransferSource,
  type GridTransferTarget,
} from './gridGroup'

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

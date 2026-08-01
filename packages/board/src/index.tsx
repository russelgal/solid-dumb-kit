export { DumbBoard, type DumbBoardProps, type BoardSection } from './DumbBoard'

// Арифметика доски — без DOM и без фреймворка. Наружу отдаётся потому, что по
// ней считается раскладка: пригодится, если рисуешь свою доску, а взять хочешь
// только расчёты.
export {
  slotAt,
  panelFlow,
  rowsFor,
  moveAt,
  type Slot,
  type ZoneGeom,
  type ZoneFlow,
  type PanelBox,
} from './boardMath'

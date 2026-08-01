export { DumbBoard, type DumbBoardProps, type BoardSection, type BlockLimits } from './DumbBoard'

// Арифметика доски — без DOM и без фреймворка. Наружу отдаётся потому, что по
// ней считается раскладка: пригодится, если рисуешь свою доску, а взять хочешь
// только расчёты.
export {
  panelFlow,
  moveAt,
  type Slot,
  type PanelBox,
} from './boardMath'

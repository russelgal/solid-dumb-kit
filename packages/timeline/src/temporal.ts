/**
 * Единая точка входа в Temporal.
 *
 * Temporal — Stage 4 и часть ES2026, но Baseline он ещё не стал: Safari отдаёт
 * его только в Technology Preview за флагом. Поэтому полифил FullCalendar —
 * он меньше и быстрее альтернативы от чемпионов предложения и не тянет BigInt.
 *
 * КОГДА СНИМАТЬ ПОЛИФИЛ: после Safari достаточно заменить строку ниже на
 * `export const Temporal = globalThis.Temporal` — остальной код не меняется,
 * он уже написан на стандартном API.
 */
import { Temporal as Polyfill } from 'temporal-polyfill'

/** Нативный, если он есть (Chrome 144+, Firefox 139+, Node ≥ 26), иначе полифил. */
export const Temporal = (globalThis as { Temporal?: typeof Polyfill }).Temporal ?? Polyfill

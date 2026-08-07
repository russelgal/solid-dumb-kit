export { DumbPropsTable, type DumbPropsTableProps } from './DumbPropsTable';
/**
 * Разбор объекта в плоский список — без Solid. Годится и в тестах, и в логе:
 * `console.table(dumpProps(props))` читается лучше, чем развёрнутый объект.
 */
export { describe, dumpProps, type DumpKind, type DumpOptions, type DumpRow } from './propsDump';

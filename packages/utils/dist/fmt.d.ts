type Numeric = number | string | null | undefined;
/** 1 234,56 ₽ */
export declare function RubR2(v: Numeric): string;
/** 1 234,56 */
export declare function Rub2(v: Numeric): string;
/** 1 235 */
export declare function Rub0(v: Numeric): string;
/** 1 235 ₽ */
export declare function Rub0R(v: Numeric): string;
/** 1 234,5678 */
export declare function Rub4(v: Numeric): string;
/** 1 234 или — */
export declare function fmtNum(v: Numeric): string;
/** 1 234,56 ₽ или — */
export declare function fmtPrice(v: Numeric): string;
type DateInput = string | number | Date | null | undefined;
/** 23.02.2026, 16:40:22 */
export declare function fmtDateTime(v: DateInput): string;
/** 23.02.2026, 16:40 */
export declare function fmtDateTimeShort(v: DateInput): string;
/** 23.02.2026 */
export declare function fmtDate(v: DateInput): string;
/** 16:40:22 */
export declare function fmtTime(v: DateInput): string;
/** 23 февр. 2026 г. */
export declare function fmtDateMonth(v: DateInput): string;
/** 512 Б / 24 КБ / 1.3 МБ */
export declare function fmtSize(bytes: number): string;
/** "2 ч. назад", "3 дн. назад" или — */
export declare function timeAgo(v: DateInput): string;
export {};

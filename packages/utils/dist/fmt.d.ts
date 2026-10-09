/**
 * Копейки в цене: `auto` — только когда они есть («1 500 ₽», «1 416,67 ₽»),
 * `always` — всегда двумя знаками («1 500,00 ₽»), `never` — до рубля («1 417 ₽»).
 */
export type PriceKopecks = 'auto' | 'always' | 'never';
export interface PriceFormat {
    kopecks: PriceKopecks;
}
/**
 * Откуда `fmtPrice` берёт формат — ФУНКЦИЕЙ, а не значением: приложение отдаёт
 * геттер своих настроек, и реактивный расчёт, напечатавший цену, сам
 * подписывается на них — смена настройки перерисовывает суммы без перезагрузки.
 * Сам кит ни от какого фреймворка не зависит: он только вызывает функцию.
 */
export declare function configurePrice(source: () => PriceFormat): void;
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
/**
 * Сумма БЕЗ знака рубля по формату `configurePrice` или —. Для отдельно
 * стоящей суммы, у которой знак рисует CSS (`::after`): так при выделении и
 * копировании берутся только цифры.
 */
export declare function fmtAmount(v: Numeric): string;
/** Цена со знаком рубля по формату `configurePrice` (по умолчанию копейки — только когда есть) или —. Для суммы внутри фразы. */
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

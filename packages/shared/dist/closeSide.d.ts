export type CloseSide = 'left' | 'right';
/** `auto` — решает платформа */
export type CloseSideOption = CloseSide | 'auto';
/**
 * Задать сторону на всё приложение разом. Зовётся один раз при старте; чтобы
 * вернуться к платформенному поведению — `configureCloseSide('auto')`.
 */
export declare function configureCloseSide(side: CloseSideOption): void;
/**
 * Apple ли это (macOS, iPadOS, iOS). `userAgentData.platform` — то, что
 * браузеры оставили после урезания UA-строки; `navigator.platform` устарел, но
 * жив и в Safari отвечает точнее. Ни одно из этих чтений не трогает раскладку.
 */
export declare function isApplePlatform(): boolean;
/**
 * Итоговая сторона: проп важнее общей настройки, та важнее платформы.
 * Платформа неизвестна — сторона macOS (слева).
 */
export declare function resolveCloseSide(explicit?: CloseSideOption): CloseSide;

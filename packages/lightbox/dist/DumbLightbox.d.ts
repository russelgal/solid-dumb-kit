import { type JSX } from 'solid-js';
import { type CloseSideOption } from '@solid-dumb-kit/shared';
export type LightboxItem = {
    /** что показывать */
    url: string;
    /** подпись под картинкой */
    title?: string;
    /** мелкая версия: показывается, пока грузится большая */
    preview?: string;
};
export type DumbLightboxProps = {
    items: Array<LightboxItem>;
    /** что открыто; `null` — закрыт */
    index: () => number | null;
    onIndexChange: (index: number | null) => void;
    /** анимировать открытие; по умолчанию да, но не при prefers-reduced-motion */
    animate?: boolean;
    /** свой низ: скачать, удалить, поделиться */
    actions?: (item: LightboxItem, index: number) => JSX.Element;
    /** сторона крестика; по умолчанию по платформе: macOS слева, иначе справа */
    closeSide?: CloseSideOption;
    class?: string;
};
export declare function DumbLightbox(props: DumbLightboxProps): JSX.Element;

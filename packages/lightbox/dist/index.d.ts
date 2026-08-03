import { JSX } from 'solid-js';

type LightboxItem = {
    /** что показывать */
    url: string;
    /** подпись под картинкой */
    title?: string;
    /** мелкая версия: показывается, пока грузится большая */
    preview?: string;
};
type DumbLightboxProps = {
    items: Array<LightboxItem>;
    /** что открыто; `null` — закрыт */
    index: () => number | null;
    onIndexChange: (index: number | null) => void;
    /** анимировать открытие; по умолчанию да, но не при prefers-reduced-motion */
    animate?: boolean;
    /** свой низ: скачать, удалить, поделиться */
    actions?: (item: LightboxItem, index: number) => JSX.Element;
    class?: string;
};
declare function DumbLightbox(props: DumbLightboxProps): JSX.Element;

export { DumbLightbox, type DumbLightboxProps, type LightboxItem };

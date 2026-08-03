import { JSX } from 'solid-js';
import { Uploader } from '@solid-dumb-kit/shared';
export { Presigned, PresignedOptions, QueueEvents, UploadQueue, UploadResult, Uploader, createPresignedUploader, createUploadQueue } from '@solid-dumb-kit/shared';

type GalleryStatus = 
/** транспорта нет: файл живёт только в браузере */
'local'
/** поставлен в очередь, но ещё не поехал */
 | 'queued' | 'uploading' | 'done' | 'error';
type GalleryItem = {
    id: string;
    /** адрес, по которому картинка живёт «по-настоящему» (после заливки) */
    url: string;
    /** `objectURL` выбранного файла: показывается, пока он есть */
    preview?: string;
    name?: string;
    size?: number;
    status?: GalleryStatus;
    error?: string;
    /** ключ в хранилище — приходит из транспорта */
    key?: string;
};
type DumbGalleryProps = {
    items: Array<GalleryItem>;
    /** позвать с новым набором: добавили, переставили, удалили, долилось */
    setItems: (next: Array<GalleryItem>) => void;
    /**
     * Чем заливать. Не задан — галерея локальная: файлы живут в браузере и
     * пропадут с перезагрузкой. Для S3-совместимого хранилища бери
     * `createPresignedUploader`.
     */
    upload?: Uploader;
    /** сколько тянуть одновременно; по умолчанию 3 */
    concurrency?: number;
    /** что пускать в выбор; по умолчанию `image/*` */
    accept?: string;
    /** можно ли выбрать несколько разом; по умолчанию да */
    multiple?: boolean;
    /** больше стольких не принимать; не задан — без предела */
    max?: number;
    /** ширина плитки, css-трек; по умолчанию `minmax(120px, 1fr)` */
    tile?: string;
    /** зазор сетки, px; по умолчанию 10 */
    gap?: number;
    /** правка: без неё нет ни выбора, ни перестановки, ни удаления */
    editable?: boolean;
    /** анимировать перестановку; по умолчанию да, но не при prefers-reduced-motion */
    animate?: boolean;
    /** клик по плитке — открыть просмотр, например */
    onOpen?: (item: GalleryItem, index: number) => void;
    /**
     * Своя плитка целиком; не задана — рисуем свою. Третьим аргументом идёт
     * прогресс (0…1): в `items` его нет намеренно, см. ниже.
     */
    children?: (item: GalleryItem, index: () => number, progress: () => number) => JSX.Element;
    class?: string;
    style?: JSX.CSSProperties;
};
declare function DumbGallery(props: DumbGalleryProps): JSX.Element;

export { DumbGallery, type DumbGalleryProps, type GalleryItem, type GalleryStatus };

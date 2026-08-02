export { DumbGallery, type DumbGalleryProps, type GalleryItem, type GalleryStatus } from './DumbGallery'

/**
 * Заливка по подписанной ссылке — то, чем это делается с S3-совместимым
 * хранилищем. Ключей от бакета галерея не видит: их место на сервере.
 */
export { createPresignedUploader, type Presigned, type PresignedOptions } from './presigned'

/** Очередь без DOM и без фреймворка: пригодится, если рисуешь свою галерею. */
export {
  createUploadQueue,
  type UploadQueue,
  type Uploader,
  type UploadResult,
  type QueueEvents,
} from './uploadQueue'

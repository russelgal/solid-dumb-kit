export { DumbGallery, type DumbGalleryProps, type GalleryItem, type GalleryStatus } from './DumbGallery'

/**
 * Заливка по подписанной ссылке и очередь к ней. Сам код переехал в
 * `@solid-dumb-kit/shared` — заливают файлы и другие пакеты, а к плиткам
 * очередь не привязана ничем. Здесь оставлен реэкспорт: у потребителя галереи
 * `createPresignedUploader` как импортировался из неё, так и импортируется.
 */
export {
  createPresignedUploader,
  createUploadQueue,
  type Presigned,
  type PresignedOptions,
  type UploadQueue,
  type Uploader,
  type UploadResult,
  type QueueEvents,
} from '@solid-dumb-kit/shared'

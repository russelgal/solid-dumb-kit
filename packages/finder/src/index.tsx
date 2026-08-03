export { DumbFinder, type DumbFinderProps, type FinderView } from './DumbFinder'

/**
 * Договор с хранилищем. Файндер не знает ни про S3, ни про бакеты: он спрашивает
 * у `source` содержимое папки и просит что-нибудь с ним сделать.
 */
export type { FinderEntry, FinderSource, FinderUploader } from './finderTypes'

/**
 * Готовые адаптеры к хранилищу. Свой нужен, только если оно говорит на чём-то,
 * чего тут нет:
 *
 * - `createS3Source` — S3-совместимое (Garage, MinIO, AWS): сервер подписывает
 *   ссылку, файл летит в бакет мимо сервера;
 * - `createNodeSource` — простой сервер с папками на диске: файл идёт ЧЕРЕЗ
 *   него, телом запроса;
 * - `createWebdavSource` — Nextcloud, ownCloud, любой `mod_dav`: PROPFIND,
 *   MKCOL, MOVE, никакого своего API;
 * - `createMemorySource` — в памяти вкладки: витрина без сервера, оффлайн, тесты;
 * - `createHttpSource` — общая основа первых двух, если ручки называются иначе.
 */
export {
  createS3Source,
  createNodeSource,
  createWebdavSource,
  createMemorySource,
  createHttpSource,
  type S3SourceOptions,
  type NodeSourceOptions,
  type WebdavSourceOptions,
  type MemorySourceOptions,
  type HttpSourceOptions,
} from './sources'

/**
 * Пути и порядок — чистые функции. Наружу выложены потому, что свой адаптер
 * пишет потребитель, и делить `a/b/c.jpg` на части ему придётся тем же самым.
 */
export {
  ICONS,
  canMove,
  crumbs,
  joinPrefix,
  kindOf,
  nameOf,
  parentOf,
  sortEntries,
  type FileKind,
  type SortKey,
} from './finderPath'

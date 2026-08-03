// DumbFinder — файловый менеджер по чужому хранилищу.
//
// Витрина показывает оба конца провода. В деве адаптер ходит в НАСТОЯЩИЙ S3
// через дев-ручки `/api/s3/*` (плагин `devS3`, `apply: 'serve'`): они подписаны
// ключами из локального `.env` и наружу ключей не отдают. В собранной витрине и
// на Pages сервера нет, значит нет и ручек — там работает хранилище в памяти
// вкладки, с теми же папками и тем же поведением.
//
// Своё хранилище подсовывается параметром `?s3=<база>` — именно в `search`, а
// не в хеше: хеш витрина разбирает как имя вкладки.
import { createMemo, createSignal, For } from "solid-js";
import {
  DumbFinder,
  createMemorySource,
  createS3Source,
} from "@solid-dumb-kit/finder";
import { Bar, Switch, Note } from "../_controls";

/**
 * Значки — Solar через iconify (`@plugin "@iconify/tailwind4"` в `app.css`).
 * Кит своих не несёт и нести не должен: он берёт КЛАССЫ, а картинку из них
 * делает Tailwind потребителя. Захочешь Phosphor — меняешь `solar--` на `ph--`,
 * и ни строчки в пакете править не надо.
 */
const ICONS = {
  dir: "icon-[solar--folder-bold] text-sky-600",
  dirOpen: "icon-[solar--folder-open-bold] text-sky-600",
  image: "icon-[solar--gallery-bold] text-violet-600",
  video: "icon-[solar--clapperboard-play-bold] text-rose-600",
  audio: "icon-[solar--music-note-bold] text-amber-600",
  pdf: "icon-[solar--file-text-bold] text-red-600",
  archive: "icon-[solar--archive-bold] text-orange-600",
  text: "icon-[solar--document-text-bold] text-slate-600",
  file: "icon-[solar--file-bold] text-slate-600",
  twist: "icon-[solar--alt-arrow-right-outline]",
  // тулбар
  refresh: "icon-[solar--refresh-bold]",
  viewGrid: "icon-[solar--widget-4-bold]",
  viewList: "icon-[solar--list-bold]",
  mkdir: "icon-[solar--folder-with-files-bold]",
  upload: "icon-[solar--upload-bold]",
  remove: "icon-[solar--trash-bin-trash-bold]",
};

/* ────────── настоящее хранилище: только в деве ────────── */

const api =
  new URLSearchParams(location.search).get("s3") ??
  (import.meta.env.DEV ? "/api/s3" : null);
/**
 * Настоящее хранилище — через ГОТОВЫЙ адаптер кита.
 *
 * Раньше здесь лежало полсотни строк своих `fetch`: список, подпись, удаление,
 * перенос. Ровно это и живёт теперь в `createS3Source` — свой адаптер нужен,
 * только если ручки называются иначе или хранилище говорит на чём-то ещё
 * (`createWebdavSource`, `createNodeSource`).
 */
const liveSource = (base: string) =>
  createS3Source({ base, sign: "/api/sign" });

/**
 * Хранилище в памяти вкладки — тоже готовое. Ведёт себя как S3: ключи плоские,
 * папка живёт, пока в ней есть файлы, вес папки считается по всему вложенному.
 */
const fakeSource = () =>
  createMemorySource({
    seed: {
      "фото/2026/море.jpg": 182_400,
      "фото/2026/горы.jpg": 240_100,
      "фото/2025/старое.png": 96_800,
      "документы/договор.pdf": 412_000,
      "документы/смета.csv": 8_400,
      "архив/выгрузка.zip": 3_120_000,
      "readme.txt": 1_200,
    },
  });

export default function DumbFinderExample() {
  const [edit, setEdit] = createSignal(true)
  // ОДИН кегль на весь файндер: дерево слева, строки списка, подписи плиток
  const [treeSize, setTreeSize] = createSignal("13px");
  const [note, setNote] = createSignal<string | null>(null);

  // источник создаётся ОДИН раз: поддельный держит файлы в себе, пересоздай
  // его на перерисовке — и всё залитое пропадёт
  const source = createMemo(() => (api ? liveSource(api) : fakeSource()));

  return (
    <div class="p-5 text-base-content">
      <h3 class="mb-1 text-lg font-semibold">
        DumbFinder — файлы в хранилище: смотреть и разбирать
      </h3>
      <p class="mb-2 max-w-[92ch] text-sm text-base-content">
        Папки, выделение <b>рамкой</b> (та же <code>SelectionArea</code>, что и
        на своей вкладке — ни одного замера элемента за жест), заливка броском
        из системы, перенос перетаскиванием на папку или на крошку пути. Двойной
        клик по папке — внутрь, по файлу — открыть. <b>Del</b> — удалить,{" "}
        <b>Backspace</b> — на уровень выше, <b>Ctrl/Cmd+A</b> — выделить всё,{" "}
        <b>Esc</b> — снять выделение.
      </p>
      <p class="mb-2 max-w-[92ch] text-sm text-base-content">
        Компонент не знает ни про S3, ни про бакеты: он спрашивает у{" "}
        <code>source</code> содержимое папки и просит что-нибудь с ним сделать.
        Здесь{" "}
        {api ? (
          <>
            <b>настоящее хранилище</b> — дев-ручки <code>/api/s3/*</code>{" "}
            подписаны ключами из <code>.env</code>. Пишет по всему бакету,
            отмены нет и удаление тут пачками. Нужен предохранитель —{" "}
            <code>S3_DEV_LOCK</code> в <code>.env</code> запирает запись в
            префикс.
          </>
        ) : (
          <>
            <b>хранилище в памяти вкладки</b>: сервера у собранной витрины нет,
            а значит нет и подписи. Ведёт себя как S3 — ключи плоские, папка
            живёт, пока в ней есть файлы.
          </>
        )}
      </p>

      <Bar>
        <Switch checked={edit()} onChange={setEdit}>
          режим правки
        </Switch>
        {/* размер дерева ОДНИМ кеглем: высота строк, полосы и значки едут следом */}
        <div class="join">
          <For each={[["11px", "S"], ["13px", "M"], ["15px", "L"], ["17px", "XL"]] as const}>
            {([value, label]) => (
              <button
                class={`btn join-item btn-xs ${treeSize() === value ? "btn-active" : "btn-ghost"}`}
                title="размер"
                onClick={() => setTreeSize(value)}
              >
                {label}
              </button>
            )}
          </For>
        </div>
        <Note>
          {note() ?? (api ? "настоящее хранилище" : "подделка в памяти")}
        </Note>
      </Bar>

      <DumbFinder
        source={source()}
        editable={edit()}
        height="58vh"
        style={{ "--dumb-finder-size": treeSize() }}
        icons={ICONS}
        class="max-w rounded-box border border-base-300 p-2
               [&_.dumb-finder-crumbs]:breadcrumbs [&_.dumb-finder-crumbs]:text-sm
               [&_.dumb-finder-crumbs]:[--dumb-finder-crumb-sep:none]
               [&_.dumb-finder-find]:input [&_.dumb-finder-find]:input-xs
               [&_.dumb-finder-bar>button]:btn [&_.dumb-finder-bar>button]:btn-xs
               [&_.dumb-finder-bar_input]:input [&_.dumb-finder-bar_input]:input-xs
               [&_.dumb-finder-body]:rounded-box [&_.dumb-finder-body]:bg-base-100"
        onOpen={(entry) =>
          entry.url && window.open(entry.url, "_blank", "noopener")
        }
        onError={(msg) => setNote(msg)}
      />
    </div>
  );
}

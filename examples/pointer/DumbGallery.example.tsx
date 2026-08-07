// DumbGallery — выбрать картинки, посмотреть, переставить, залить.
//
// Витрина показывает оба режима. Без транспорта галерея локальная: файл виден
// сразу из `objectURL` и никуда не уходит. С транспортом каждый файл встаёт в
// очередь, на плитке едет полоса, а результат прилетает обратно в `items`.
//
// Транспорт тут ПОДДЕЛЬНЫЙ — настоящий ходит к твоему серверу за подписью, и
// показывать это в статичной витрине нечем. Как выглядит настоящий, написано
// прямо на странице.
import { createSignal, Show } from "solid-js";
import {
  DumbGallery,
  createPresignedUploader,
  type GalleryItem,
  type Uploader,
} from "@solid-dumb-kit/gallery";
import { DumbLightbox } from "@solid-dumb-kit/lightbox";
import { Bar, Switch, Check, Pick, Btn, Note, Code, Doc, Props } from "../_controls";
// Сниппеты доки живут отдельным файлом: их подсвечивает Shiki на сборке, и
// сюда приезжает уже готовая разметка (playground/snippets.ts).
import SNIP from "./DumbGallery.snippets";

const GALLERY_PROPS = [
  { name: "items", type: "GalleryItem[]", about: "Что показано. Источник истины — у потребителя." },
  {
    name: "setItems",
    type: "(next: GalleryItem[]) => void",
    about: "Добавили, переставили, удалили, долилось — новый набор целиком.",
  },
  {
    name: "upload",
    type: "Uploader",
    about: "Чем заливать. Не задан — галерея локальная: файлы живут в браузере и пропадут с перезагрузкой.",
  },
  { name: "concurrency", type: "number", def: "3", about: "Сколько файлов тянуть одновременно." },
  { name: "accept", type: "string", def: "image/*", about: "Что пускать в выбор." },
  { name: "multiple", type: "boolean", def: "true", about: "Можно ли выбрать несколько разом." },
  { name: "max", type: "number", about: "Больше стольких не принимать." },
  { name: "tile", type: "string", def: "minmax(120px, 1fr)", about: "Ширина плитки — css-трек грида." },
  { name: "gap", type: "number", def: "10", about: "Зазор сетки, px." },
  {
    name: "editable",
    type: "boolean",
    def: "true",
    about: "Правка. Без неё нет ни выбора файлов, ни перестановки, ни крестика удаления.",
  },
  { name: "onOpen", type: "(item, index) => void", about: "Клик по плитке — например, открыть просмотр в лайтбоксе." },
  {
    name: "children",
    type: "(item, index, progress) => JSX.Element",
    about: "Своя плитка. Прогресс (0…1) приходит третьим аргументом, а не полем items — он меняется десятки раз в секунду.",
  },
  {
    name: "animate",
    type: "boolean",
    def: "системная настройка",
    about: "Перестановка плиток. Не задан — анимируем, но не при prefers-reduced-motion.",
  },
];

const ITEM_PROPS = [
  { name: "id", type: "string", about: "Ключ плитки." },
  { name: "url", type: "string", about: "Адрес, по которому картинка живёт после заливки." },
  { name: "preview", type: "string", about: "objectURL выбранного файла: показывается, пока он есть." },
  { name: "name / size", type: "string / number", about: "Имя и размер файла." },
  { name: "status", type: "GalleryStatus", about: "local, queued, uploading, done, error — по нему рисуется полоса и обводка." },
  { name: "error", type: "string", about: "Что пошло не так при заливке." },
  { name: "key", type: "string", about: "Ключ в хранилище — приходит из транспорта." },
];

/**
 * Поддельная заливка: тянет полосу до конца за пару секунд и умеет падать.
 *
 * Отмену уважает по-настоящему — на ней и видно, что снятая плитка обрывает
 * запрос, а не досчитывает его в никуда.
 */
const fakeUploader = (opts: {
  failEvery: () => number;
  ms: number;
}): Uploader => {
  // счётчик живёт СНАРУЖИ обещания: пересоздай транспорт на каждой перерисовке —
  // и он обнулится, а «каждая третья» не наступит никогда
  let n = 0;
  return (file, ctx) =>
    new Promise((resolve, reject) => {
      const mine = ++n;
      const started = performance.now();
      let raf = 0;
      const tick = () => {
        if (ctx.signal.aborted) return reject(new Error("отменено"));
        const f = Math.min(1, (performance.now() - started) / opts.ms);
        ctx.onProgress(f);
        if (f < 1) {
          raf = requestAnimationFrame(tick);
          return;
        }
        const every = opts.failEvery();
        if (every && mine % every === 0) {
          reject(new Error("хранилище ответило 403: подпись просрочена"));
        } else {
          resolve({ url: URL.createObjectURL(file), key: `demo/${file.name}` });
        }
      };
      raf = requestAnimationFrame(tick);
      ctx.signal.addEventListener("abort", () => cancelAnimationFrame(raf), {
        once: true,
      });
    });
};

export default function DumbGalleryExample() {
  /**
   * Настоящее хранилище — ТОЛЬКО В ДЕВЕ.
   *
   * Витрина в деве поднимает у себя ручку `/api/sign` (плагин `devSign`,
   * `apply: 'serve'`), которая подписывает ссылку ключами из локального `.env`.
   * В собранной витрине и на Pages никакого сервера нет, значит нет и подписи —
   * там вкладка честно работает на поддельном транспорте.
   *
   * Свою ручку можно подсунуть параметром `?sign=<url>` — именно в `search`, а
   * не в хеше: хеш витрина разбирает как имя вкладки.
   */
  const signUrl =
    new URLSearchParams(location.search).get("sign") ??
    (import.meta.env.DEV ? "/api/sign" : null);
  const real =
    signUrl &&
    createPresignedUploader({
      sign: (file) =>
        fetch(signUrl, {
          method: "POST",
          body: JSON.stringify({ name: file.name, type: file.type }),
        }).then((r) => r.json()),
    });

  const [items, setItems] = createSignal<Array<GalleryItem>>([]);
  // есть настоящее хранилище — сразу в него: в деве проверять надо именно его,
  // а не поддельную полосу
  const [mode, setMode] = createSignal<"local" | "upload">(
    real ? "upload" : "local",
  );
  const [failing, setFailing] = createSignal(false);
  const [edit, setEdit] = createSignal(true);
  const [conc, setConc] = createSignal(2);

  // транспорт создаётся ОДИН раз, а режим падений читается в момент заливки
  const fake = fakeUploader({ failEvery: () => (failing() ? 3 : 0), ms: 2200 });

  const uploader = () => (mode() === "upload" ? real || fake : undefined);

  // что открыто в просмотрщике; null — закрыт
  const [shown, setShown] = createSignal<number | null>(null);

  const done = () => items().filter((i) => i.status === "done").length;
  const bad = () => items().filter((i) => i.status === "error").length;

  return (
    <div class="p-5 text-base-content">
      <h3 class="mb-1 text-lg font-semibold">
        DumbGallery — картинки: выбрать, переставить, залить
      </h3>
      <p class="mb-2 max-w-[92ch] text-sm text-base-content">
        Выбор файлов и перетаскивание их в окно — примитив{" "}
        <code>@solid-primitives/upload</code>; перестановка —{" "}
        <b>DumbSortableDnd</b>: порядок задаётся CSS <code>order</code>, и
        разметка за жест не шевелится ни на узел. Картинка показывается{" "}
        <b>сразу</b>, из <code>objectURL</code>, ещё до всякой заливки. Жест
        нативный, значит <b>пальцем переставить нельзя</b> — HTML5 drag-and-drop
        на тачскрине не существует; выбор, просмотр и удаление пальцем работают.
      </p>
      <p class="mb-2 max-w-[92ch] text-sm text-base-content">
        Заливка идёт <b>очередью</b>: два-три файла разом, остальные ждут. Так и
        должно быть — браузер всё равно держит к одному хосту около шести
        соединений, а двадцать «идущих» полосок, из которых движутся шесть,
        просто врут. Снятая плитка <b>обрывает</b> запрос, а не досчитывает его
        в никуда.
      </p>
      <p class="mb-3 max-w-[92ch] text-sm text-base-content">
        <b>Ключей от хранилища галерея не видит.</b> Ключ к бакету — это ключ ко
        всему бакету, и в браузере ему не место ни в каком виде. Наружу она
        ходит только за подписанной ссылкой, которую выдаёт твой сервер:
      </p>
      <pre class="mb-3 max-w-[92ch] overflow-x-auto rounded-box bg-neutral px-3 py-2.5 text-[12px] text-neutral-content">
        {`const upload = createPresignedUploader({
  sign: (file) => fetch('/api/sign', {
    method: 'POST',
    body: JSON.stringify({ name: file.name, type: file.type }),
  }).then((r) => r.json()),   // → { url, headers?, key?, publicUrl? }
})

<DumbGallery items={items()} setItems={setItems} upload={upload} />`}
      </pre>

      <Bar>
        <Switch checked={edit()} onChange={setEdit}>
          режим правки
        </Switch>
        <Pick
          label="куда заливать"
          value={mode()}
          options={[
            { value: "local", label: "никуда — локально" },
            {
              value: "upload",
              label: real ? "в настоящее хранилище" : "в поддельное хранилище",
            },
          ]}
          onChange={(v) => setMode(v as "local" | "upload")}
        />
        <Show when={mode() === "upload"}>
          {/* ронять умеет только подделка — настоящее хранилище падает само, когда захочет */}
          <Show when={!real}>
            <Check checked={failing()} onChange={setFailing}>
              ронять каждую третью
            </Check>
          </Show>
          <Pick
            label="одновременно"
            value={conc()}
            options={[1, 2, 3, 6].map((n) => ({ value: n }))}
            onChange={(v) => setConc(Number(v))}
          />
        </Show>
        <Btn onClick={() => setItems([])}>Очистить</Btn>
        <Note>
          {items().length
            ? `${items().length} шт.${done() ? `, залито ${done()}` : ""}${bad() ? `, с ошибкой ${bad()}` : ""}`
            : "выбери файлы или брось их сюда"}
        </Note>
      </Bar>

      <DumbGallery
        items={items()}
        setItems={setItems}
        upload={uploader()}
        concurrency={conc()}
        editable={edit()}
        tile="minmax(140px, 1fr)"
        class="rounded-box border border-dashed border-base-300 p-3
               [&_.dumb-gallery-tile]:ring-1 [&_.dumb-gallery-tile]:ring-base-300
               [&_.dumb-gallery-tile]:cursor-grab [&_.dumb-gallery-tile]:bg-base-200
               [&_.dumb-gallery-tile>button]:btn [&_.dumb-gallery-tile>button]:btn-xs
               [&_.dumb-gallery-tile>button]:btn-circle [&_.dumb-gallery-tile>button]:absolute
               [&_.dumb-gallery-tile>button]:top-1 [&_.dumb-gallery-tile>button]:right-1
               [&>button]:btn [&>button]:btn-sm [&>button]:mt-3
               [&_[data-gallery-stats]]:ml-3 [&_[data-gallery-stats]]:text-sm"
        onOpen={(_item, i) => setShown(i)}
      />

      {/*
        Просмотрщик — отдельный пакет кита. Галерея про него не знает: она лишь
        сообщает, по какой плитке щёлкнули, а показывает уже он.
      */}
      <DumbLightbox
        items={items().map((it) => ({
          url: it.url,
          preview: it.preview,
          title: it.name,
        }))}
        index={shown}
        onIndexChange={setShown}
      />

      <Show when={items().some((i) => i.status === "error")}>
        <p class="mt-3 max-w-[92ch] text-sm text-error">
          Плитки с ошибкой обведены. Настоящая галерея тут предложила бы
          повторить — очередь это умеет, достаточно позвать <code>upload</code>{" "}
          ещё раз для тех же файлов.
        </p>
      </Show>

      <hr class="my-6 border-base-300" />

      <h4 class="text-lg font-semibold">Как это подключить</h4>
      <p class="mt-1 max-w-[92ch] text-sm">
        Пакет ставится отдельно от остального кита — потребитель берёт только то, что взял.
      </p>
      <Code title="Установка" code={SNIP.install} />

      <Doc title="Локальная галерея">
        <p>
          Без <code>upload</code> ничего никуда не уходит: выбранные файлы живут в браузере как{" "}
          <code>objectURL</code>. Этого хватает форме, где всё отправляется разом при сохранении, —
          и это же режим, в котором удобно смотреть на перестановку плиток.
        </p>
      </Doc>
      <Code title="Плитки без заливки" code={SNIP.basic} />

      <Doc title="Заливка по подписанной ссылке">
        <p>
          Сервер подписывает URL, браузер кладёт файл прямо в хранилище — трафик идёт мимо
          приложения. Очередь держит <code>concurrency</code> потоков, снятая плитка обрывает свой
          запрос по-настоящему, а упавшую можно позвать заново теми же файлами.
        </p>
      </Doc>
      <Code title="S3-совместимое хранилище" code={SNIP.upload} />

      <Doc title="Вид и режим просмотра">
        <p>
          Раскладка задаётся css-треком и зазором, а <code>editable={"{false}"}</code> убирает
          правку целиком: ни выбора файлов, ни перестановки, ни крестика. Клик по плитке отдаётся
          наружу — обычно им открывают лайтбокс.
        </p>
      </Doc>
      <Code title="Сетка и просмотр" code={SNIP.look} />

      <Doc title="Своя плитка">
        <p>
          <code>children</code> отдаёт разметку плитки целиком. Прогресс приходит ТРЕТЬИМ
          аргументом, а не полем в <code>items</code>, и это принципиально: он меняется десятки раз
          в секунду, и живи он в данных — на каждый процент перерисовывался бы весь список.
        </p>
      </Doc>
      <Code title="children" code={SNIP.custom} />

      <h4 class="mt-6 text-lg font-semibold">DumbGallery</h4>
      <Props rows={GALLERY_PROPS} />

      <h4 class="mt-6 text-lg font-semibold">GalleryItem</h4>
      <Props rows={ITEM_PROPS} />

    </div>
  );
}

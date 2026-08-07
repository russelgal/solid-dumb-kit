// DumbContextMenu + DumbToaster — меню по правому клику и сообщения.
//
// Оба живут в top layer через Popover API. Проверить это можно прямо здесь:
// открой модалку и щёлкни правой кнопкой внутри неё — меню окажется НАД ней, а
// не под, и тост тоже. Со своим `z-index` так не выходит: модалка в top layer
// перекрывает любое число.
import { For, createSignal } from "solid-js";
import { DumbContextMenu, type MenuItem } from "@solid-dumb-kit/context-menu";
import { DumbToaster, toast } from "@solid-dumb-kit/toast";
import { Bar, Btn, Code, Doc, Note, Props } from "../_controls";
// Сниппеты доки живут отдельным файлом: их подсвечивает Shiki на сборке, и
// сюда приезжает уже готовая разметка (playground/snippets.ts).
import SNIP from "./ContextMenu.snippets";

const MENU_PROPS = [
  {
    name: "items",
    type: "() => MenuItem[]",
    about:
      "Пункты. Функция зовётся на КАЖДОЕ открытие, поэтому набор и подписи спокойно зависят от выделения.",
  },
  {
    name: "target",
    type: "() => HTMLElement | null",
    def: "весь документ",
    about: "Внутри чего ловить правый клик. Вернули null — меню временно не открывается.",
  },
  {
    name: "disabled",
    type: "() => boolean",
    def: "false",
    about: "Не открывать вовсе: по полю ввода меню лучше отдать браузеру, там своё, с «вставить».",
  },
  {
    name: "onToggle",
    type: "(open: boolean) => void",
    about: "Меню открылось или закрылось — например, чтобы притушить подложку.",
  },
  { name: "class", type: "string", about: "Класс на панель — поверх daisyUI-вида." },
];

const ITEM_PROPS = [
  { name: "label", type: "string", about: "Что написано в пункте." },
  {
    name: "icon",
    type: "string",
    about: "Класс значка. Своих иконок кит не несёт: подходит iconify, свой шрифт, что угодно.",
  },
  { name: "hint", type: "string", about: "Подсказка справа — обычно сочетание клавиш." },
  { name: "disabled", type: "boolean", def: "false", about: "Пункт виден, но не выбирается; стрелки его пропускают." },
  { name: "danger", type: "boolean", def: "false", about: "Опасное действие: красится и ставится внизу." },
  {
    name: "items",
    type: "MenuItem[]",
    about: "Делает пункт веткой: раскрывает подменю вбок, а сам ничего не делает — run не вызывается.",
  },
  { name: "run", type: "() => void", about: "Что сделать при выборе." },
  { name: "kind", type: "'item' | 'separator'", def: "'item'", about: "Разделитель — это { kind: 'separator' } и больше ничего." },
];

const POPOVER_PROPS = [
  {
    name: "at",
    type: "() => { x, y } | null",
    about: "Точка, у которой стоит карточка. null — закрыта.",
  },
  { name: "onClose", type: "() => void", about: "Закрыли крестиком, Esc или кликом мимо." },
  { name: "title", type: "JSX.Element", about: "Шапка. Не задан — шапки нет." },
  { name: "footer", type: "JSX.Element", about: "Низ карточки: кнопки." },
  {
    name: "keepOnOutside",
    type: "boolean",
    def: "false",
    about: "Не закрывать по клику мимо — когда в карточке форма и промах не должен стирать ввод.",
  },
  { name: "width", type: "string", def: "min(320px, 92vw)", about: "Ширина, css." },
  {
    name: "closeSide",
    type: "'auto' | 'left' | 'right'",
    def: "'auto'",
    about: "Сторона крестика. По умолчанию по платформе: в macOS слева, иначе справа.",
  },
];

const ICONS = {
  open: "icon-[solar--eye-bold]",
  copy: "icon-[solar--copy-bold]",
  rename: "icon-[solar--pen-2-bold]",
  trash: "icon-[solar--trash-bin-trash-bold]",
  share: "icon-[solar--share-bold]",
  export: "icon-[solar--download-bold]",
  tag: "icon-[solar--tag-bold]",
};

export default function ContextMenuExample() {
  const [picked, setPicked] = createSignal<string | null>(null);
  const [open, setOpen] = createSignal(false);
  let area: HTMLDivElement | undefined;
  let modal!: HTMLDialogElement;

  const items = (): Array<MenuItem> => [
    {
      label: picked() ? `Открыть «${picked()}»` : "Открыть",
      icon: ICONS.open,
      disabled: !picked(),
      run: () => toast.info(`открыли ${picked()}`),
    },
    {
      label: "Копировать",
      icon: ICONS.copy,
      hint: "⌘C",
      run: () => toast.success("скопировано"),
    },
    {
      label: "Переименовать",
      icon: ICONS.rename,
      hint: "F2",
      disabled: !picked(),
      run: () => {},
    },
    { kind: "separator" },
    // Ветка: пункт с `items` раскрывает подменю вбок и сам ничего не делает.
    // Подменю — такой же popover в top layer, поэтому его не режет ни
    // `overflow` предков, ни `clip-path` из темы витрины, и сторону у края
    // экрана браузер выбирает сам.
    {
      label: "Отправить",
      icon: ICONS.share,
      disabled: !picked(),
      items: [
        {
          label: "Почтой",
          run: () => toast.info(`отправили почтой: ${picked()}`),
        },
        {
          label: "Ссылкой",
          hint: "⌘L",
          run: () => toast.success("ссылка в буфере"),
        },
        { kind: "separator" },
        // вложенность любая — панель рекурсивна
        {
          label: "Экспорт",
          icon: ICONS.export,
          items: [
            { label: "PDF", run: () => toast.info("экспорт в PDF") },
            { label: "CSV", run: () => toast.info("экспорт в CSV") },
            { label: "ZIP архивом", run: () => toast.info("экспорт в ZIP") },
          ],
        },
      ],
    },
    {
      label: "Метка",
      icon: ICONS.tag,
      items: [
        { label: "Срочное", run: () => toast.success("метка: срочное") },
        {
          label: "На проверку",
          run: () => toast.success("метка: на проверку"),
        },
        { label: "Архив", disabled: true, run: () => {} },
      ],
    },
    { kind: "separator" },
    {
      label: "Удалить",
      icon: ICONS.trash,
      hint: "Del",
      danger: true,
      disabled: !picked(),
      // спрашиваем ПЛАШКОЙ, а не `confirm()`: тот останавливает вкладку
      // целиком — вместе с идущей заливкой — и написать в нём, что именно
      // удаляется, нельзя
      run: async () => {
        // спрашиваем У КУРСОРА: вопрос про эту строку читают здесь же, а не в
        // углу экрана, куда ещё надо перевести взгляд
        const ok = await toast.confirm(`Удалить «${picked()}» безвозвратно?`, {
          yes: "Удалить",
          danger: true,
          at: "pointer",
        });
        if (!ok) return;
        toast.error(`удалено: ${picked()}`, {
          action: { label: "Вернуть", run: () => toast.success("возвращено") },
        });
      },
    },
  ];

  return (
    <div class="p-5 text-base-content">
      <h3 class="mb-1 text-lg font-semibold">
        DumbContextMenu — меню там, где щёлкнули
      </h3>
      <p class="mb-2 max-w-[92ch] text-sm text-base-content">
        Место выбирает <b>браузер</b>: в точке клика ставится якорь в пиксель,
        меню цепляется за него (<code>position-anchor</code>), а у края окна
        разворачивается в другую сторону (<code>position-try-fallbacks</code>).
        Ни одного <code>getBoundingClientRect</code> — обычный способ «вставить
        и измерить» это forced layout ровно в тот момент, когда браузер и так
        занят.
      </p>
      <p class="mb-3 max-w-[92ch] text-sm text-base-content">
        Щёлкни правой кнопкой по карточке — и попробуй у самого низа окна: меню
        раскроется вверх. Стрелки водят по пунктам, Enter выбирает, Esc
        закрывает. По полю ввода меню НЕ перехватывается — там своё, браузерное,
        с «вставить».
      </p>

      <Bar>
        <Btn onClick={() => toast.info("обычное сообщение")}>Сообщение</Btn>
        <Btn onClick={() => toast.success("получилось")}>Успех</Btn>
        <Btn onClick={() => toast.error("не получилось")}>Ошибка</Btn>
        <Btn
          onClick={() => {
            for (let i = 0; i < 3; i++) toast.error("одно и то же");
          }}
        >
          Три одинаковых
        </Btn>
        <Btn
          onClick={async () => {
            const ok = await toast.confirm("Отправить отчёт руководителю?", {
              yes: "Отправить",
            });
            toast.info(ok ? "отправлено" : "передумали");
          }}
        >
          Вопрос
        </Btn>
        <Btn
          onClick={async () => {
            const ok = await toast.confirm("Тот же вопрос, но у курсора", {
              yes: "Ага",
              at: "pointer",
            });
            toast.info(ok ? "ага" : "не-а");
          }}
        >
          Вопрос у курсора
        </Btn>
        <Btn
          onClick={() =>
            toast.ask("Файл изменён на диске. Что делать?", [
              {
                label: "Перечитать",
                kind: "primary",
                run: () => toast.success("перечитано"),
              },
              { label: "Оставить моё", run: () => toast.info("оставили") },
              {
                label: "Показать разницу",
                keepOpen: true,
                run: () => toast.info("разница…"),
              },
            ])
          }
        >
          Три ответа
        </Btn>
        <Btn
          onClick={() => {
            setOpen(true);
            modal.showModal();
          }}
        >
          Открыть модалку
        </Btn>
        <Note>
          {picked() ? `выбрано: ${picked()}` : "правый клик по карточке"}
        </Note>
      </Bar>

      <div ref={area} class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <For
          each={[
            "Отчёт",
            "Договор",
            "Смета",
            "Акт",
            "Приказ",
            "Заявка",
            "Счёт",
            "Накладная",
            "Отчёт",
            "Договор",
            "Смета",
            "Акт",
            "Приказ",
            "Заявка",
            "Счёт",
            "Накладная",
          ]}
        >
          {(name) => (
            <button
              class={`rounded-box border p-4 text-left text-sm ${
                picked() === name
                  ? "border-primary bg-primary/10"
                  : "border-base-300"
              }`}
              onClick={() => setPicked(name)}
              onContextMenu={() => setPicked(name)}
            >
              {name}
            </button>
          )}
        </For>
      </div>

      <p class="mt-3 max-w-[92ch] text-sm text-base-content">
        Поле ввода — меню тут браузерное:{" "}
        <input class="input input-sm" value="правый клик сюда" />
      </p>

      <dialog ref={modal} class="modal" onClose={() => setOpen(false)}>
        <div class="modal-box">
          <h4 class="mb-2 font-semibold">Модалка в top layer</h4>
          <p class="mb-3 text-sm">
            Щёлкни правой кнопкой здесь и нажми «Ошибка» — меню и тост окажутся{" "}
            <b>над</b> модалкой. Со своим <code>z-index</code> такого не
            добиться: элемент в top layer перекрывает любое число.
          </p>
          <Btn onClick={() => toast.error("поверх модалки")}>
            Показать ошибку
          </Btn>
          <div class="modal-action">
            <button class="btn btn-sm" onClick={() => modal.close()}>
              Закрыть
            </button>
          </div>
        </div>
      </dialog>

      <hr class="my-6 border-base-300" />

      <h4 class="text-lg font-semibold">Как это подключить</h4>
      <p class="mt-1 max-w-[92ch] text-sm">
        Пакет ставится отдельно от остального кита — потребитель берёт только то, что взял.
      </p>
      <Code title="Установка" code={SNIP.install} />

      <Doc title="Меню и его область">
        <p>
          Компонент ничего не рисует до правого клика: он вешает слушатель на{" "}
          <code>target</code> и по клику ставит в точке невидимый якорь размером в пиксель, к
          которому цепляется панель. Сторону у края экрана выбирает браузер (anchor positioning),
          поэтому <b>ни одного замера</b> с нашей стороны — и панель живёт в top layer, а значит
          её не режет <code>overflow</code> предков и ей не нужен <code>z-index</code>.
        </p>
      </Doc>
      <Code title="Меню на области" code={SNIP.basic} />

      <Doc title="Пункты пересчитываются на каждое открытие">
        <p>
          <code>items</code> — функция, а не массив. Её зовут в момент открытия, поэтому меню
          знает, что сейчас выделено: набор пунктов, подписи и доступность считаются по текущему
          состоянию, а не по тому, каким оно было при монтировании.
        </p>
      </Doc>
      <Code title="Меню по выделению" code={SNIP.dynamic} />

      <Doc title="Подменю">
        <p>
          Пункт с <code>items</code> становится веткой. Мышью ветка раскрывается наведением, с
          клавиатуры — только <code>→</code> или Enter, <code>←</code> возвращает к родителю,
          <code>Esc</code> сворачивает по одному уровню. Жест «нажал правую, повёл, отпустил»
          продолжается и во вложенной панели.
        </p>
      </Doc>
      <Code title="Ветка" code={SNIP.nested} />

      <Doc title="Когда меню не нужно">
        <p>
          По полю ввода своё меню только мешает: там браузерное, со «вставить» и проверкой
          орфографии. <code>disabled</code> отдаёт клик системе, не снимая компонент.
        </p>
      </Doc>
      <Code title="Отдать клик браузеру" code={SNIP.disabled} />

      <Doc title="DumbPopover — карточка у точки">
        <p>
          То же место в top layer и та же привязка якорем, но содержимое произвольное. Нужен там,
          где модалка по центру рвёт связь с тем, что описывает: карточка брони должна стоять
          рядом с бронью, а не в середине экрана.
        </p>
      </Doc>
      <Code title="Карточка у клика" code={SNIP.popover} />

      <h4 class="mt-6 text-lg font-semibold">DumbContextMenu</h4>
      <Props rows={MENU_PROPS} />

      <h4 class="mt-6 text-lg font-semibold">MenuItem</h4>
      <Props rows={ITEM_PROPS} />

      <h4 class="mt-6 text-lg font-semibold">DumbPopover</h4>
      <Props rows={POPOVER_PROPS} />

      {/* меню ловит правый клик только внутри своей области */}
      <DumbContextMenu
        target={() => (open() ? null : (area ?? null))}
        items={items}
      />
      <DumbToaster />
    </div>
  );
}

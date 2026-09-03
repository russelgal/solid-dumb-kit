// ALT-КЛИК ПО ЭЛЕМЕНТУ → ЕГО РАЗМЕТКА В РЕДАКТОРЕ.
//
// Браузерная половина локатора: ловит alt-клик, берёт у ближайшего предка
// атрибут с местом в исходнике и просит дев-сервер открыть это место.
// Расставляет атрибуты вторая половина — vite-плагин (`./vite`).
//
// Движок без фреймворка: принимает цель, возвращает функцию отписки — как
// остальные движки кита. Solid тут не нужен вовсе.

/** Настройки локатора; у всех есть разумные значения. */
export interface LocatorOptions {
  /** Атрибут с местом в исходнике. По умолчанию `data-loc`. */
  attribute?: string;
  /** Адрес, открывающий файл. По умолчанию штатный эндпоинт Vite. */
  endpoint?: string;
  /** Где слушать клики. По умолчанию окно документа. */
  target?: EventTarget;
  /** Какая клавиша открывает редактор. По умолчанию alt. */
  key?: 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey';
}

/** Атрибут по умолчанию — тот же, что ставит плагин. */
export const LOC_ATTR = 'data-loc';

/** Штатный эндпоинт дев-сервера Vite: он же выбирает редактор. */
const ENDPOINT = '/__open-in-editor';

/**
 * Ставит локатор и отдаёт функцию отписки.
 *
 * Слушатель висит НА ПЕРЕХВАТЕ: alt-клик обязан открыть редактор, а не
 * сработать кнопкой или ссылкой под курсором.
 */
export function createLocator(options: LocatorOptions = {}): () => void {
  const attribute = options.attribute ?? LOC_ATTR;
  const endpoint = options.endpoint ?? ENDPOINT;
  const target = options.target ?? window;
  const key = options.key ?? 'altKey';

  const onClick = (event: Event) => {
    const click = event as MouseEvent;
    if (!click[key] || click.button !== 0) return;

    const node = click.target instanceof Element ? click.target.closest(`[${attribute}]`) : null;
    const loc = node?.getAttribute(attribute);
    if (!loc) return;

    // Клик съедаем целиком: под курсором может быть что угодно, вплоть до
    // «удалить», и открытие редактора не повод это нажимать.
    event.preventDefault();
    event.stopPropagation();
    void fetch(`${endpoint}?file=${encodeURIComponent(loc)}`);
  };

  target.addEventListener('click', onClick, { capture: true });
  return () => target.removeEventListener('click', onClick, { capture: true });
}

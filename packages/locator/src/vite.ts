// ALT-КЛИК ПО ЭЛЕМЕНТУ → ЕГО РАЗМЕТКА В РЕДАКТОРЕ.
//
// Половина для сборщика: каждому элементу разметки достаётся атрибут с файлом,
// строкой и колонкой, где он написан. Ловит клик и открывает редактор вторая
// половина — браузерная (`createLocator` из корня пакета).
//
// ⚠️ Открывает файл САМ VITE: у дев-сервера есть штатный «/__open-in-editor»
// (launch-editor), и он же выбирает редактор — по запущенному процессу либо по
// переменной «LAUNCH_EDITOR». Своего эндпоинта пакет не заводит.
//
// ⚠️ Разметка СТРОКОВАЯ, кода не перегенерирует: парсер даёт позиции тегов,
// атрибут вставляется в ту же строку — номера строк не сдвигаются, и карты
// кода остаются верными. Цена — около 3 мс на файл, и только на дев-сервере.
import { parse } from '@babel/parser';

import { LOC_ATTR } from './index';

/** Настройки половины для сборщика. */
export interface LocatorPluginOptions {
  /** Атрибут с местом в исходнике. По умолчанию `data-loc`. */
  attribute?: string;
  /**
   * Точка входа, в которую вставить браузерную половину: путь от корня
   * проекта (`src/App.tsx`). Не задана — потребитель зовёт `createLocator()`
   * сам, и плагин в его код не лезет.
   */
  entry?: string;
  /**
   * Редактор для `launch-editor`, если тот не угадает его по запущенному
   * процессу (`webstorm`, `code`, `cursor`). Значение из окружения не
   * перебивается.
   */
  editor?: string;
  /** Какие файлы размечать. По умолчанию — свои `.tsx`, кроме тестов. */
  include?: (id: string) => boolean;
}

/** Минимум от Vite, который нужен пакету: тип плагина не импортируем. */
interface LocatorPlugin {
  name: string;
  apply: 'serve';
  enforce: 'pre';
  config(): void;
  configResolved(config: { root: string }): void;
  transform(code: string, id: string, options?: { ssr?: boolean }): string | null;
}

/** Место в исходнике: строка и колонка начала тега плюс смещение вставки. */
interface TagPosition {
  at: number;
  line: number;
  column: number;
}

/** Своя разметка: чужие пакеты и тесты открывать в редакторе незачем. */
const isOwnMarkup = (id: string) =>
  id.endsWith('.tsx') && !id.endsWith('.test.tsx') && !id.includes('/node_modules/');

/**
 * Места вставки для каждого ЭЛЕМЕНТА разметки. Компоненты (`<DumbTable/>`)
 * пропускаем: в DOM они ничего не создают, а место их использования всё равно
 * достаётся ближайшему элементу-предку.
 *
 * Обход руками, без «@babel/traverse»: нужен один тип узла, а лишняя
 * зависимость — это лишний вес у каждого потребителя.
 */
function tagPositions(node: unknown, found: TagPosition[]): void {
  if (!node || typeof node !== 'object') return;

  if (Array.isArray(node)) {
    for (const item of node) tagPositions(item, found);
    return;
  }

  const record = node as Record<string, unknown>;
  if (record.type === 'JSXOpeningElement') {
    const name = record.name as { type: string; name?: string; end?: number | null };
    const loc = record.loc as { start: { line: number; column: number } } | null;
    const first = name.name?.[0] ?? '';

    // Элемент от компонента отличает регистр первой буквы — то же правило, по
    // которому их различает сам JSX.
    if (name.type === 'JSXIdentifier' && first !== first.toUpperCase() && name.end && loc) {
      found.push({ at: name.end, line: loc.start.line, column: loc.start.column + 1 });
    }
  }

  for (const value of Object.values(record)) tagPositions(value, found);
}

/**
 * Разметка одного файла. Атрибуты вставляются С КОНЦА, иначе каждая вставка
 * сбивала бы смещения следующих.
 */
export function markLocations(code: string, file: string, attribute = LOC_ATTR): string {
  const found: TagPosition[] = [];
  tagPositions(parse(code, { sourceType: 'module', plugins: ['jsx', 'typescript'] }).program, found);

  let marked = code;
  for (const tag of found.sort((a, b) => b.at - a.at)) {
    marked = `${marked.slice(0, tag.at)} ${attribute}="${file}:${tag.line}:${tag.column}"${marked.slice(tag.at)}`;
  }
  return marked;
}

/** Путь от корня проекта: своя обрезка, чтобы не тащить в бандл «node:path». */
const relativeTo = (root: string, file: string) =>
  file.startsWith(`${root}/`) ? file.slice(root.length + 1) : file;

/**
 * Плагин Vite: размечает разметку и, если названа точка входа, вставляет в неё
 * браузерную половину.
 *
 * ⚠️ Ставить его надо ПЕРЕД плагином фреймворка (`enforce: 'pre'` это и
 * делает): тот сворачивает разметку в шаблоны, и после него вставлять атрибут
 * уже некуда.
 */
export function locator(options: LocatorPluginOptions = {}): LocatorPlugin {
  const attribute = options.attribute ?? LOC_ATTR;
  const include = options.include ?? isOwnMarkup;
  let root = '';

  return {
    name: 'dumb-locator',
    // Только дев-сервер: в сборке ни атрибутов, ни браузерной половины нет.
    apply: 'serve',
    enforce: 'pre',
    config() {
      // Редактор угадывается по запущенному процессу, но если тот закрыт,
      // launch-editor уходит в «EDITOR»/«VISUAL» — там может оказаться vim.
      const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process;
      if (options.editor && env && !env.env.LAUNCH_EDITOR) env.env.LAUNCH_EDITOR = options.editor;
    },
    configResolved(config) {
      root = config.root;
    },
    transform(code, id, transformOptions) {
      const file = id.split('?')[0];
      if (!include(file)) return null;

      const marked = markLocations(code, relativeTo(root, file), attribute);
      // Точка входа тянет браузерную половину — приложение про неё не знает.
      // В серверном графе её нет: там нет ни документа, ни мыши.
      return options.entry && !transformOptions?.ssr && file === `${root}/${options.entry}`
        ? `import { createLocator as __locator } from '@solid-dumb-kit/locator';\n__locator(${
            attribute === LOC_ATTR ? '' : JSON.stringify({ attribute })
          });\n${marked}`
        : marked;
    },
  };
}

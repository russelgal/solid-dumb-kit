// Крошечный zero-dep FLIP-сортировщик для Solid: вертикальный список ИЛИ сетка,
// с авто-скроллом, переменной высотой строк и нулевым reflow.
// Зачем свой, а не @dnd-kit: dnd-kit меряет getBoundingClientRect покадрово во
// время драга → reflow → джанк (поэтому раньше пришлось гасить optimistic).
// Здесь позиции ячеек снимаются ОДИН раз на старте через IntersectionObserver
// (entry.boundingClientRect считается off-main-thread, БЕЗ reflow —
//  https://toruskit.com/blog/how-to-get-element-bounds-without-reflow),
// а во время движения мы ТОЛЬКО пишем transform (GPU/compositor, без layout).
//
// Геометрия скроллера (top/left/clientW/clientH/max) тоже снимается один раз;
// в кадре читаются лишь scrollTop/scrollLeft и window.scrollX/Y — они не форсят
// layout. Сдвиг контейнера от прокрутки страницы компенсируется арифметикой
// (viewOrigin), а не свежим getBoundingClientRect.
//
// Движок — FLIP «элемент → ячейка»: каждому элементу считаем новый визуальный
// индекс и двигаем его в СНЯТУЮ позицию той ячейки (translate dx,dy). Отсюда даром:
//   • переменная высота строк (берём реальные позиции, не усреднённый шаг);
//   • сетка (дельта по X и Y, диагональный прыжок на переносе строки).
// Вся математика — в координатах КОНТЕНТА контейнера (− top/left + scroll),
// поэтому хиттест/сдвиги иммунны к скроллу и авто-скролл у краёв «просто работает».
// Сами формулы живут в ./geometry.ts (чистые функции, покрыты тестами).
// Порядок массива коммитим на pointerup → opts.onEnd(fromIndex, toIndex).
//
// Файл НЕ зависит от Solid: движок принимает элементы и отдаёт функции отписки.
// Solid-обёртки (createDumbSortable и т.д.) живут в ./solid.ts.

import {
    autoScrollSpeed, clampDragged, gapOf, gridLayout, hitIndex, holeTop, listLayout, nextInsertIndex, viewOrigin,
    type Cell, type Item, type ViewGeom,
} from './geometry';
import { doScroll, measure, scrollOf, scrollParent } from '../shared/viewport';
import { shouldAnimate } from '../shared/motion';

/**
 * Движок сортировки. Ничего не знает про фреймворк: принимает элементы и
 * возвращает функции отписки — привязку к жизненному циклу делает обёртка
 * (для Solid — ./solid.ts, там onCleanup).
 */
export type SortableEngine = {
    /** зарегистрировать элемент И повесить старт драга (ручка = дочка с [data-drag-handle]) */
    attach: (el: HTMLElement, id: string) => () => void;
    /** только зарегистрировать элемент-ячейку */
    attachRow: (el: HTMLElement, id: string) => () => void;
    /** только повесить старт драга на отдельную ручку */
    attachHandle: (el: HTMLElement, id: string) => () => void;
    /** снять слушатели и прибрать стили */
    destroy: () => void;
};

type Drag = {
    id: string;
    pid: number;
    startX: number; startY: number;
    lastX: number; lastY: number;
    dragEl: HTMLElement;
    ids: string[];
    fromIndex: number;
    cells: Cell[];          // позиции ячеек по визуальному индексу (порядок ids)
    others: Item[];         // чужие ячейки в порядке чтения (хиттест сетки)
    restCells: Cell[];      // то же без перетаскиваемой (хиттест списка)
    top: number;            // верх колонки в координатах контента
    gap: number;
    toIndex: number;
    scroller: HTMLElement | null;
    geom: ViewGeom;         // геометрия скроллера, снятая на старте
    scrollX0: number; scrollY0: number;
    raf: number;
    ready: boolean;
    moved: boolean;         // указатель реально сдвинулся (иначе не авто-скроллим — иначе дёрг при захвате у края)
    touched: Set<HTMLElement>;  // кому довелось поехать — только их стили и трогаем
};

// Когда ручки нет и тянется весь элемент, драг не должен начинаться с того,
// с чем пользователь взаимодействует: полей, кнопок, ссылок, выделяемого текста.
// Внутри [data-drag-handle] запрет не действует — там ручка и есть цель.
const NO_DRAG = 'input, textarea, select, option, button, a, label, [contenteditable=""], [contenteditable="true"], [data-no-drag]';

const SLIDE = 'transform .18s cubic-bezier(.2,.8,.2,1)';
const LONGPRESS = 350;    // тач: удержание до старта драга, мс
const MOVE_TOL = 10;      // тач: сдвиг за время удержания = скролл, отменяем, px
const LIFT_SHADOW = '0 10px 24px -6px rgba(0,0,0,.28)';

/** Позиция скроллера во вьюпорте сейчас: для окна это всегда начало координат. */
function originOf(d: Drag) {
    return d.scroller ? viewOrigin(d.geom, window.scrollX, window.scrollY) : { top: 0, left: 0 };
}

export type DumbSortableOptions = {
    /** текущий визуальный порядок id (совпадает с порядком data) */
    order: () => string[];
    /** 'y' — вертикальный список (по умолчанию), 'grid' — двумерная сетка */
    axis?: 'y' | 'grid';
    /** drag запрещён (напр. активна сортировка колонки) */
    disabled?: () => boolean;
    /** тач: удержание до старта драга, мс (0 = сразу). По умолчанию 350 */
    pressDelay?: number;
    /** мышь: long-press до старта, мс (0 = выкл). Имеет приоритет над mouseThreshold */
    mousePressDelay?: number;
    /** мышь: дистанция до старта драга, px (0 = сразу, как было). По умолчанию 0 */
    mouseThreshold?: number;
    /**
     * Анимировать расступание соседей и приземление на дропе.
     * По умолчанию да, но при системном `prefers-reduced-motion: reduce` —
     * нет. Явное `true` перебивает и системную настройку.
     */
    animate?: boolean;
    /** на дропе: переставить из fromIndex в toIndex (индексы в order()) */
    onEnd: (fromIndex: number, toIndex: number) => void;
};

export function createSortableEngine(opts: DumbSortableOptions): SortableEngine {
    const grid = opts.axis === 'grid';
    const pressDelay = opts.pressDelay ?? LONGPRESS;
    const mousePress = opts.mousePressDelay ?? 0;
    const mouseThresh = opts.mouseThreshold ?? 0;
    const rowEls = new Map<string, HTMLElement>();
    let drag: Drag | null = null;

    // Снимок позиций ВСЕХ строк на старте драга. Ключевой трюк: даже если в DOM
    // тысячи элементов, страница НЕ захлебнётся синхронным reflow — мы не зовём
    // getBoundingClientRect в цикле (он форсил бы layout на каждый элемент). Вместо
    // этого IntersectionObserver отдаёт boundingClientRect батчем, посчитанным
    // off-main-thread, за один асинхронный колбэк → ноль форсированных reflow.
    function snapshot(ids: string[], cb: (rects: Map<string, DOMRectReadOnly>) => void) {
        const out = new Map<string, DOMRectReadOnly>();
        const io = new IntersectionObserver(entries => {
            for (const e of entries) {
                const el = e.target as HTMLElement;
                if (el.dataset.flipId) out.set(el.dataset.flipId, e.boundingClientRect);
            }
            io.disconnect();
            cb(out);
        });
        let n = 0;
        for (const id of ids) { const el = rowEls.get(id); if (el) { io.observe(el); n++; } }
        if (n === 0) cb(out);
    }

    function frame() {
        if (!drag) return;
        const d = drag;
        let origin = originOf(d);
        let { sx, sy } = scrollOf(d.scroller);

        // авто-скролл: чем дальше указатель за краем контейнера — тем быстрее.
        // ВАЖНО: только после реального движения — иначе захват у нижнего края сразу скроллит,
        // dragged получает +ty, его трансформ растит scrollHeight → скроллбар/сдвиг/съезд сортировки.
        // Предел снизу — снятый на старте (живой scrollHeight растёт от трансформа dragged → гонка).
        const speed = d.moved
            ? autoScrollSpeed({
                pointerY: d.lastY, viewTop: origin.top, clientH: d.geom.clientH,
                scrollY: sy, scrollMax: d.geom.max,
            })
            : 0;
        if (speed) {
            doScroll(d.scroller, 0, speed);
            ({ sx, sy } = scrollOf(d.scroller));   // скролл изменился — перечитываем (это не reflow)
            origin = originOf(d);
        }

        // перетаскиваемая следует за курсором (+ компенсация прокрутки контента)
        let tx = grid ? (d.lastX - d.startX) + (sx - d.scrollX0) : 0;
        let ty = (d.lastY - d.startY) + (sy - d.scrollY0);
        // кламп: перетаскиваемый не выходит за видимую область контейнера
        if (d.ready && d.cells.length) {
            ({ tx, ty } = clampDragged({
                cell: d.cells[d.fromIndex], tx, ty,
                scrollX: sx, scrollY: sy, clientW: d.geom.clientW, clientH: d.geom.clientH, grid,
            }));
        }
        d.dragEl.style.transform = `translate(${tx}px,${ty}px)`;

        if (d.ready) {
            const pX = d.lastX - origin.left + sx;
            const pY = d.lastY - origin.top + sy;
            // список: считаем по ВИДИМЫМ позициям от текущей дырки (иначе она
            // перескакивает раньше, чем курсор дошёл до середины соседа);
            // сетка: по снятым центрам — там дырки как таковой нет
            const k = grid
                ? hitIndex(d.others, pX, pY, true)
                : nextInsertIndex({
                    cells: d.restCells, gap: d.gap, top: d.top,
                    holeH: d.cells[d.fromIndex].height, k: d.toIndex, pointerY: pY,
                });
            d.toIndex = k;

            const moves = grid
                ? gridLayout({ ids: d.ids, dragId: d.id, fromIndex: d.fromIndex, k, cells: d.cells })
                : listLayout({ ids: d.ids, dragId: d.id, fromIndex: d.fromIndex, k, cells: d.cells });

            for (const m of moves) {
                const el = rowEls.get(m.id);
                if (!el) continue;
                const dx = 'dx' in m ? m.dx : 0;
                if (!dx && !m.dy) {
                    if (d.touched.has(el)) el.style.transform = '';
                    continue;
                }
                // Стили трогаем ТОЛЬКО у тех, кто реально поехал, и только один раз.
                // Вешать transition/will-change всем подряд на старте — это сотня
                // лишних записей и сотня композиторных слоёв на ровном месте.
                // Первый кадр отдаём под transition, со второго элемент едет плавно.
                if (!d.touched.has(el)) {
                    d.touched.add(el);
                    el.style.willChange = 'transform';
                    if (!shouldAnimate(opts.animate)) {       // без анимации — двигаем сразу
                        el.style.transform = `translate(${dx}px,${m.dy}px)`;
                        continue;
                    }
                    el.style.transition = SLIDE;
                    continue;
                }
                el.style.transform = `translate(${dx}px,${m.dy}px)`;
            }
        }
        d.raf = requestAnimationFrame(frame);
    }

    function onMove(ev: PointerEvent) {
        if (!drag || ev.pointerId !== drag.pid) return;
        if (!drag.moved && (Math.abs(ev.clientX - drag.startX) > 2 || Math.abs(ev.clientY - drag.startY) > 2)) drag.moved = true;
        drag.lastX = ev.clientX;
        drag.lastY = ev.clientY;
    }

    function detach() {
        document.body.style.userSelect = '';
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
    }

    function resetStyles(d: Drag) {
        const reset = (el: HTMLElement) => {
            el.style.transition = '';
            el.style.transform = '';
            el.style.zIndex = '';
            el.style.position = '';
            el.style.willChange = '';
            el.style.boxShadow = '';
            el.style.opacity = '';
            el.style.cursor = '';
        };
        reset(d.dragEl);
        for (const el of d.touched) reset(el);   // остальных мы и не трогали
    }

    function cleanup() {
        if (!drag) return;
        const d = drag;
        if (d.raf) cancelAnimationFrame(d.raf);
        detach();
        resetStyles(d);
        drag = null;
    }

    /**
     * Приземление: вместо того чтобы снять transform и дать элементу телепортом
     * оказаться на новом месте, доводим его до места анимацией. Целевая позиция
     * известна из снимка — мерить ничего не нужно.
     */
    function land(d: Drag, done: () => void) {
        if (!shouldAnimate(opts.animate)) { done(); return; }
        const from = d.cells[d.fromIndex];
        let tx = 0, ty = 0;
        if (grid) {
            const target = d.cells[d.toIndex];
            if (!target) { done(); return; }
            tx = target.left - from.left;
            ty = target.top - from.top;
        } else {
            ty = holeTop({ cells: d.restCells, gap: d.gap, top: d.top, k: d.toIndex }) - from.top;
        }

        const el = d.dragEl;
        el.style.transition = SLIDE;
        el.style.transform = `translate(${tx}px,${ty}px)`;
        let fired = false;
        const finish = () => {
            if (fired) return;
            fired = true;
            el.removeEventListener('transitionend', finish);
            done();
        };
        el.addEventListener('transitionend', finish);
        setTimeout(finish, 240);   // страховка, если transitionend не придёт
    }

    function onUp(ev: PointerEvent) {
        if (!drag || ev.pointerId !== drag.pid) return;
        const d = drag;
        const { fromIndex, toIndex, ready } = d;

        if (!ready || toIndex === fromIndex) {
            cleanup();
            return;
        }

        // слушатели снимаем сразу, стили — после приземления
        detach();
        if (d.raf) cancelAnimationFrame(d.raf);
        drag = null;
        land(d, () => {
            resetStyles(d);
            opts.onEnd(fromIndex, toIndex);
        });
    }

    function begin(id: string, handle: HTMLElement, pid: number, x: number, y: number) {
        const dragEl = rowEls.get(id);
        if (!dragEl) return;
        const ids = opts.order();
        const fromIndex = ids.indexOf(id);
        if (fromIndex < 0) return;

        const scroller = scrollParent(dragEl);
        const geom = measure(scroller);
        const s0 = scrollOf(scroller);
        drag = {
            id, pid,
            startX: x, startY: y, lastX: x, lastY: y,
            dragEl, ids, fromIndex, cells: [], others: [], restCells: [], top: 0, gap: 0, toIndex: fromIndex,
            scroller, geom, scrollX0: s0.sx, scrollY0: s0.sy, raf: 0, ready: false, moved: false,
            touched: new Set(),
        };
        dragEl.style.position = 'relative';
        dragEl.style.zIndex = '2';
        dragEl.style.willChange = 'transform';
        // «подъём»: тень + лёгкая прозрачность (плавно; transform НЕ анимируем — он следует за курсором)
        dragEl.style.boxShadow = LIFT_SHADOW;
        dragEl.style.opacity = '0.97';
        dragEl.style.cursor = 'grabbing';
        dragEl.style.transition = 'box-shadow .15s ease, opacity .15s ease';
        document.body.style.userSelect = 'none';

        // bounds без reflow → ячейки (в координатах контента) + чужие центры для хиттеста
        snapshot(ids, rects => {
            if (!drag || drag.id !== id) return;
            const origin = originOf(drag);
            const s = scrollOf(scroller);
            const ox = (r: DOMRectReadOnly) => r.left - origin.left + s.sx;
            const oy = (r: DOMRectReadOnly) => r.top - origin.top + s.sy;
            drag.cells = ids.map(i => { const r = rects.get(i); return r ? { left: ox(r), top: oy(r), width: r.width, height: r.height } : { left: 0, top: 0, width: 0, height: 0 }; });
            drag.others = ids
                .filter(oid => oid !== id)
                .map(oid => {
                    const r = rects.get(oid)!;
                    const l = ox(r), t = oy(r);
                    return { id: oid, cx: l + r.width / 2, cy: t + r.height / 2, top: t, bottom: t + r.height };
                });
            drag.restCells = drag.cells.filter((_, i) => ids[i] !== id);
            drag.top = drag.cells.length ? drag.cells[0].top : 0;
            drag.gap = gapOf(drag.cells);
            drag.ready = true;
        });

        try { handle.setPointerCapture(pid); } catch { /* noop */ }
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
        drag.raf = requestAnimationFrame(frame);
    }

    // ожидание старта: тач — long-press ('press'), мышь — порог-дистанция ('dist')
    let pending: { id: string; handle: HTMLElement; pid: number; x: number; y: number; timer: any; mode: 'press' | 'dist'; thresh: number } | null = null;
    function addPend() {
        window.addEventListener('pointermove', pendMove);
        window.addEventListener('pointerup', pendCancel);
        window.addEventListener('pointercancel', pendCancel);
    }
    function clearPending() {
        if (!pending) return;
        clearTimeout(pending.timer);
        window.removeEventListener('pointermove', pendMove);
        window.removeEventListener('pointerup', pendCancel);
        window.removeEventListener('pointercancel', pendCancel);
        pending = null;
    }
    function pendMove(ev: PointerEvent) {
        if (!pending || ev.pointerId !== pending.pid) return;
        const moved = Math.abs(ev.clientX - pending.x) > pending.thresh || Math.abs(ev.clientY - pending.y) > pending.thresh;
        if (!moved) return;
        if (pending.mode === 'press') clearPending();             // палец поехал = скролл, отменяем
        else { const p = pending; clearPending(); begin(p.id, p.handle, p.pid, ev.clientX, ev.clientY); } // мышь: старт
    }
    function pendCancel(ev: PointerEvent) {
        if (pending && ev.pointerId === pending.pid) clearPending();
    }

    function onDown(id: string, handle: HTMLElement, ev: PointerEvent) {
        if (ev.button !== 0 || opts.disabled?.() || drag || pending) return;
        if (!rowEls.get(id)) return;
        const touch = ev.pointerType === 'touch';
        const delay = touch ? pressDelay : mousePress;
        if (delay > 0) {
            // long-press (тач или мышь): ждём удержание, отмена при сдвиге или отпускании
            pending = { id, handle, pid: ev.pointerId, x: ev.clientX, y: ev.clientY, timer: 0, mode: 'press', thresh: MOVE_TOL };
            pending.timer = setTimeout(() => {
                const p = pending; clearPending();
                if (p) { if (touch) navigator.vibrate?.(8); begin(p.id, p.handle, p.pid, p.x, p.y); }
            }, delay);
            addPend();
            return;
        }
        if (!touch && mouseThresh > 0) {
            // мышь: стартуем только после сдвига на mouseThreshold px
            pending = { id, handle, pid: ev.pointerId, x: ev.clientX, y: ev.clientY, timer: 0, mode: 'dist', thresh: mouseThresh };
            addPend();
            return;
        }
        ev.preventDefault();
        begin(id, handle, ev.pointerId, ev.clientX, ev.clientY);
    }

    return {
        // самодостаточно: регистрирует элемент И навешивает старт драга.
        // ручка = дочка с [data-drag-handle] (делегирование); нет её → тянем за весь элемент.
        attach(el: HTMLElement, id: string) {
            el.dataset.flipId = id;
            rowEls.set(id, el);
            const h = el.querySelector('[data-drag-handle]') as HTMLElement | null;
            if (h) h.style.touchAction = 'none';
            const down = (ev: PointerEvent) => {
                const handle = el.querySelector('[data-drag-handle]') as HTMLElement | null;
                if (handle) {
                    if (!(ev.target instanceof Node && handle.contains(ev.target))) return;
                } else if (ev.target instanceof Element && ev.target.closest(NO_DRAG)) {
                    return;                       // это поле/кнопка — пусть работает как обычно
                }
                onDown(id, handle || el, ev);
            };
            el.addEventListener('pointerdown', down);
            return () => {
                el.removeEventListener('pointerdown', down);
                if (rowEls.get(id) === el) rowEls.delete(id);
            };
        },
        // низкоуровневое: ячейка и ручка порознь (когда ручка не потомок ячейки)
        attachRow(el: HTMLElement, id: string) {
            el.dataset.flipId = id;
            rowEls.set(id, el);
            return () => { if (rowEls.get(id) === el) rowEls.delete(id); };
        },
        attachHandle(el: HTMLElement, id: string) {
            const down = (ev: PointerEvent) => onDown(id, el, ev);
            el.addEventListener('pointerdown', down);
            return () => el.removeEventListener('pointerdown', down);
        },
        destroy() {
            clearPending();
            cleanup();
        },
    };
}

// Проигрыватель FLIP-сдвигов: элементу говорят, на сколько он должен отъехать
// от своего места, и он доезжает туда плавно.
//
// Почему Web Animations, а не `style.transition` + `style.transform`:
//
// 1. Переход, назначенный в одном кадре с трансформом, не запускается — строка
//    просто прыгает. Обойти это можно, только развесив переходы заранее ВСЕМ
//    элементам списка, а это сотни лишних записей в `style` и сотни слоёв
//    композитора ради трёх реально едущих строк.
// 2. `el.animate()` стартует от заданной точки сразу и не пишет в `style`
//    вообще: у строк, которых жест не касается, атрибут остаётся ровно таким,
//    каким его сделал потребитель.
//
// Layout не читается ни разу: точка, из которой подхватывается перебитая на
// полпути анимация, считается арифметикой по её же `currentTime`.

/** длительность сдвига; столько же, сколько было у CSS-перехода */
// const DUR = 880;
const DUR = 380;
// const DUR = 180;
const EASE = "cubic-bezier(.2,.8,.2,1)";

// та же кривая числами — нужна, чтобы перехватить анимацию там, где она
// действительно сейчас находится, а не там, где она была бы при линейном ходе
const C = { x1: 0.2, y1: 0.8, x2: 0.2, y2: 1 };

const curve = (a: number, b: number, t: number) => {
  const u = 1 - t;
  return 3 * u * u * t * a + 3 * u * t * t * b + t * t * t;
};

/** обратить кривую по X (Ньютон, пары итераций хватает при такой точности) */
function progress(p: number): number {
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  let t = p;
  for (let i = 0; i < 4; i++) {
    const x = curve(C.x1, C.x2, t) - p;
    const u = 1 - t;
    const d =
      3 * u * u * C.x1 + 6 * u * t * (C.x2 - C.x1) + 3 * t * t * (1 - C.x2);
    if (Math.abs(d) < 1e-6) break;
    t -= x / d;
  }
  return curve(C.y1, C.y2, Math.max(0, Math.min(1, t)));
}

type State = {
  anim: Animation;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
};

export type Flip = {
  /** отправить элемент на смещение (dx, dy) от его места в потоке */
  to: (el: HTMLElement, dx: number, dy: number) => void;
  /**
   * Элемент УЖЕ переехал (переставили DOM, сменили `order`, изменилась
   * раскладка) — доиграть переезд: стартовать со смещения (dx, dy), то есть со
   * старого места, и приехать в ноль. Классический FLIP: Invert + Play.
   */
  nudge: (el: HTMLElement, dx: number, dy: number) => void;
  /** снять всё разом — на завершении жеста */
  clear: () => void;
};

export function createFlip(animate: boolean): Flip {
  const live = new Map<HTMLElement, State>();

  /** где элемент визуально находится прямо сейчас (с учётом недоигранного) */
  function at(cur: State | undefined): { x: number; y: number } {
    if (!cur) return { x: 0, y: 0 };
    if (!cur.anim) return { x: cur.toX, y: cur.toY };
    const e = progress(Number(cur.anim.currentTime ?? 0) / DUR);
    return {
      x: cur.fromX + (cur.toX - cur.fromX) * e,
      y: cur.fromY + (cur.toY - cur.fromY) * e,
    };
  }

  /** отпустить элемент, когда он приехал в ноль: `fill` иначе держит его вечно */
  function release(el: HTMLElement, anim: Animation) {
    anim.finished
      .then(() => {
        if (live.get(el)?.anim !== anim) return;
        anim.cancel();
        live.delete(el);
      })
      .catch(() => {});
  }

  return {
    nudge(el: HTMLElement, dx: number, dy: number) {
      const cur = live.get(el);
      const now = at(cur);
      cur?.anim?.cancel();
      const fromX = now.x + dx;
      const fromY = now.y + dy;

      if (!animate || (!fromX && !fromY)) {
        el.style.transform = "";
        live.delete(el);
        return;
      }
      const anim = el.animate(
        [
          { transform: `translate(${fromX}px,${fromY}px)` },
          { transform: "translate(0px,0px)" },
        ],
        { duration: DUR, easing: EASE, fill: "forwards" },
      );
      live.set(el, { anim, fromX, fromY, toX: 0, toY: 0 });
      release(el, anim);
    },

    to(el: HTMLElement, dx: number, dy: number) {
      const cur = live.get(el);
      const atX = cur ? cur.toX : 0;
      const atY = cur ? cur.toY : 0;
      if (atX === dx && atY === dy) return; // уже едет туда — не мешаем

      if (!animate) {
        el.style.transform = dx || dy ? `translate(${dx}px,${dy}px)` : "";
        if (dx || dy)
          live.set(el, {
            anim: null as never,
            fromX: dx,
            fromY: dy,
            toX: dx,
            toY: dy,
          });
        else live.delete(el);
        return;
      }

      // откуда стартовать: если прошлая анимация не доиграла — с той точки,
      // где она в этот момент находится, иначе сдвиг подхватится рывком
      const now = at(cur);
      const fromX = now.x;
      const fromY = now.y;
      cur?.anim?.cancel();

      const anim = el.animate(
        [
          { transform: `translate(${fromX}px,${fromY}px)` },
          { transform: `translate(${dx}px,${dy}px)` },
        ],
        { duration: DUR, easing: EASE, fill: "forwards" },
      );
      live.set(el, { anim, fromX, fromY, toX: dx, toY: dy });

      // вернулся на своё место — по приезде отпускаем совсем, чтобы `fill`
      // не держал элемент в анимации до конца жеста
      if (!dx && !dy) release(el, anim);
    },

    clear() {
      for (const [el, st] of live) {
        st.anim?.cancel();
        el.style.transform = "";
      }
      live.clear();
    },
  };
}

/* BABYLAND — награда за «правильный» выбор.
 *
 * Бриф Ланы, стр. 3: при выборе конвенционально красивых вещей «персонаж
 * улыбается; появляется красивое свечение; интерфейс становится "слишком
 * идеальным"; можно использовать анимации блесток». Стр. 11 добавляет к
 * интерфейсу: блёстки, пиксельные вспышки, курсор-звёздочку.
 *
 * До этого в игре была только половина петли — наказание. Это перекос:
 * машина, которая умеет лишь бить, читается как враг, и играть в неё
 * незачем. Она должна СНАЧАЛА нравиться.
 *
 * Ключевое решение: награда идёт по той же шкале, что и ужас, только в
 * другую сторону. dread портит рабочий стол, bliss доводит его до
 * невыносимого совершенства — розовеет хром, множатся блёстки, заголовки
 * обзаводятся сердечками. На шестой ступени интерфейс «слишком идеальный»,
 * и это пугает ровно так же, как порча: обе крайности неживые.
 */

const SPARK = 7;              // искр на клик — больше читается как мусор
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)');

/* Курсор-звёздочка. Рисуем в data-URI, чтобы не заводить файл: курсор
   должен смениться мгновенно вместе со ступенью, а не грузиться. */
export function starCursor(color = '%23f0a8c0') {
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='22' height='22'>` +
    `<path d='M11 1 L13 8 L20 11 L13 14 L11 21 L9 14 L2 11 L9 8 Z' ` +
    `fill='${color}' stroke='%23fff' stroke-width='.8'/></svg>`;
  return `url("data:image/svg+xml,${svg}") 11 11, pointer`;
}

export function createShine(root) {
  const layer = document.createElement('div');
  layer.className = 'shine-layer';
  layer.setAttribute('aria-hidden', 'true');
  root.append(layer);
  let level = 0;

  /* Блёстки в точке клика.
     Уборка держится на двух ногах: animationend и запасной таймер. Одного
     события мало — в фоновой вкладке CSS-анимации замирают, animationend не
     наступает, и искры копятся без предела (проверено: 70 штук с пяти
     кликов). Плюс жёсткий потолок на живые элементы. */
  const LIVE_MAX = 80;
  function drop(el) { el.remove(); }
  function sparkle(x, y, count = SPARK) {
    if (REDUCED.matches) return;
    while (layer.childElementCount > LIVE_MAX) layer.firstElementChild.remove();
    const box = root.getBoundingClientRect();
    for (let i = 0; i < count; i++) {
      const s = document.createElement('i');
      s.className = 'spark';
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.7;
      const dist = 16 + Math.random() * 30;
      s.style.left = `${x - box.left}px`;
      s.style.top = `${y - box.top}px`;
      s.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
      s.style.setProperty('--dy', `${Math.sin(angle) * dist}px`);
      const life = 420 + Math.random() * 320;
      s.style.setProperty('--d', `${life}ms`);
      s.addEventListener('animationend', () => drop(s), { once: true });
      setTimeout(() => drop(s), life + 400);      // запасная уборка
      layer.append(s);
    }
  }

  /* Пиксельная вспышка: не мягкое свечение, а сетка квадратов, которая
     гаснет ступенями. Мягкое размытие выдало бы современный движок. */
  // Вспышка одна на всю игру и переиспользуется: пять наложенных вспышек
  // дают сплошную розовую пелену вместо блика.
  let flashEl = null;
  function flash() {
    if (REDUCED.matches) return;
    if (!flashEl) { flashEl = document.createElement('div'); flashEl.className = 'pixel-flash'; }
    flashEl.remove();
    layer.append(flashEl);
    flashEl.style.animation = 'none';
    void flashEl.offsetWidth;
    flashEl.style.animation = '';
    setTimeout(() => flashEl?.remove(), 700);
  }

  return {
    sparkle,
    flash,
    /* Свечение на окне со сценой — «красивое свечение» из брифа. */
    glow(target) {
      if (REDUCED.matches || !target) return;
      target.classList.remove('glow');
      void target.offsetWidth;            // перезапуск анимации
      target.classList.add('glow');
    },
    set(next) {
      const v = Math.max(0, Math.min(6, next));
      if (v === level) return;
      level = v;
      root.dataset.bliss = String(level);
    },
    get() { return level; },
    reset() { level = 0; root.dataset.bliss = '0'; layer.replaceChildren(); },
  };
}

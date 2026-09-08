/* BABYLAND — анкета («дневничок»).
 *
 * Бриф Ланы, стр. 12: «в течение всей игры в углу страницы был доступен
 * дневничок, где хранились бы все анкетки игроков + можно было создать свою
 * и поделиться ею в соцсетях». Элементы: декоративная рамка, цвет листа,
 * набор стикеров, возможность разместить наклейки поверх, ответы на
 * короткие вопросы.
 *
 * Про «все анкетки игроков»: общее хранилище требует бэкенда, а его из
 * проекта осознанно выпилили (коммит 94ff102). Врать кнопкой, которая никуда
 * не отправляет, нельзя, поэтому здесь честная локальная половина: своя
 * анкета живёт в localStorage и выгружается картинкой. Общую ленту можно
 * добавить, когда появится сервер, — модель данных к этому готова.
 *
 * Почему это не просто «ещё одна фича». Вся игра — про то, как девочку
 * заставляют быть красивой для чужого взгляда. Анкета разворачивает ту же
 * механику на игрока: теперь ты сам украшаешь себя рамочкой и наклейками,
 * чтобы понравиться. Поэтому она нарочно тёплая и приторная — единственный
 * тёплый объект на чёрном рабочем столе.
 */

const KEY = 'vol4_babyland_diary';
const clamp01 = (v) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.5);

export const PAPERS = ['#fff1f7', '#fdf3d8', '#eaf6ff', '#f1ffe9', '#f6ecff'];
export const FRAMES = ['сердечки', 'кружево', 'звёздочки', 'клетка'];
export const STICKERS = ['♡', '★', '✿', '☆', '✧', '❀', '☺', '✂', '♪', '✈'];

export const QUESTIONS = [
  { id: 'name',  label: 'Имя, фамилия',      hint: 'как тебя зовут' },
  { id: 'dish',  label: 'Моё любимое блюдо', hint: '' },
  { id: 'film',  label: 'Мой любимый фильм', hint: '' },
  { id: 'book',  label: 'Моя любимая книга', hint: '' },
  { id: 'never', label: 'Я никогда не…',     hint: '' },
];

const BLANK = () => ({
  answers: { name: '', dish: '', film: '', book: '', never: '' },
  paper: PAPERS[0],
  frame: FRAMES[0],
  stickers: [],           // {ch, x, y} в долях листа, чтобы не зависеть от размера
});

export function loadDiary() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return BLANK();
    const saved = JSON.parse(raw);
    const model = { ...BLANK(), ...saved,
      answers: { ...BLANK().answers, ...(saved.answers || {}) } };
    // выбрасываем наклейки без координат: они остались от прежней ошибки
    // и всё равно неотрисуемы
    model.stickers = (model.stickers || [])
      .filter((s) => Number.isFinite(s?.x) && Number.isFinite(s?.y));
    return model;
  } catch { return BLANK(); }
}

export function saveDiary(model) {
  try { localStorage.setItem(KEY, JSON.stringify(model)); } catch { /* приватный режим */ }
}

/* Рамка рисуется повторяющимся знаком по периметру — так её делали в
   тетрадях и на дешёвых сайтах: не картинкой, а символом подряд. */
const FRAME_CHAR = { 'сердечки': '♡', 'кружево': '❀', 'звёздочки': '✧', 'клетка': '▫' };

/* Отрисовка в canvas. Рисуем из модели, а не снимаем с DOM: так картинка
   не зависит от вёрстки и одинакова в любом браузере. */
export function renderDiary(model, scale = 2) {
  const W = 420, H = 560;
  const cv = document.createElement('canvas');
  cv.width = W * scale; cv.height = H * scale;
  const x = cv.getContext('2d');
  x.scale(scale, scale);

  x.fillStyle = model.paper; x.fillRect(0, 0, W, H);

  // рамка по периметру
  const ch = FRAME_CHAR[model.frame] || '♡';
  x.fillStyle = '#e2789f'; x.font = '14px "Comic Sans MS", cursive';
  x.textBaseline = 'middle'; x.textAlign = 'center';
  for (let i = 0; i < W; i += 20) { x.fillText(ch, i + 10, 12); x.fillText(ch, i + 10, H - 12); }
  for (let i = 20; i < H - 20; i += 20) { x.fillText(ch, 12, i + 10); x.fillText(ch, W - 12, i + 10); }

  // заголовок
  x.textAlign = 'center'; x.fillStyle = '#c2436f';
  x.font = 'bold 26px "Comic Sans MS", cursive';
  x.fillText('анкета', W / 2, 56);
  x.font = '11px "Comic Sans MS", cursive'; x.fillStyle = '#a86a86';
  x.fillText('BABYLAND · заполни и оставь на память', W / 2, 76);

  // вопросы и ответы на линейках
  x.textAlign = 'left';
  let y = 116;
  for (const q of QUESTIONS) {
    x.fillStyle = '#b8517c'; x.font = '12px "Comic Sans MS", cursive';
    x.fillText(q.label, 42, y);
    x.strokeStyle = '#e7b9cb'; x.lineWidth = 1;
    x.beginPath(); x.moveTo(42, y + 24); x.lineTo(W - 42, y + 24); x.stroke();
    x.fillStyle = '#4a3340'; x.font = '15px "Comic Sans MS", cursive';
    const text = (model.answers[q.id] || '').slice(0, 40);
    x.fillText(text, 46, y + 20);
    y += 62;
  }

  // наклейки поверх всего — их и «размещают поверх анкетки»
  for (const s of model.stickers) {
    x.save();
    x.translate(s.x * W, s.y * H);
    x.rotate((s.rot || 0) * Math.PI / 180);
    x.font = `${s.size || 30}px serif`;
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = s.color || '#e2789f';
    x.fillText(s.ch, 0, 0);
    x.restore();
  }
  return cv;
}

/* ── интерфейс ───────────────────────────────────────────────────────────
   Предпросмотр — тот же canvas, что уходит в картинку. Так «что вижу, то и
   сохраню» выполняется буквально, и клик по листу сразу даёт координату
   для наклейки, без пересчёта из вёрстки. */
export function mountDiary(doc = document) {
  const $ = (id) => doc.getElementById(id);
  const win = $('diaryWin'), canvas = $('diaryCanvas');
  if (!win || !canvas) return null;

  const model = loadDiary();
  let sticker = STICKERS[0];

  function draw() {
    const out = renderDiary(model, 2);
    const ctx = canvas.getContext('2d');
    canvas.width = out.width; canvas.height = out.height;
    ctx.drawImage(out, 0, 0);
  }

  // поля
  const fields = $('diaryFields');
  fields.replaceChildren(...QUESTIONS.map((q) => {
    const wrap = doc.createElement('label');
    const span = doc.createElement('span'); span.textContent = q.label;
    const input = doc.createElement('input');
    input.type = 'text'; input.maxLength = 40; input.value = model.answers[q.id] || '';
    input.placeholder = q.hint;
    input.addEventListener('input', () => { model.answers[q.id] = input.value; draw(); });
    wrap.append(span, input);
    return wrap;
  }));

  // цвет листа
  $('diaryPapers').replaceChildren(...PAPERS.map((color) => {
    const b = doc.createElement('button');
    b.type = 'button'; b.className = 'swatch'; b.style.background = color;
    b.setAttribute('aria-label', `цвет листа ${color}`);
    b.setAttribute('aria-pressed', String(model.paper === color));
    b.onclick = () => {
      model.paper = color;
      [...$('diaryPapers').children].forEach((el) =>
        el.setAttribute('aria-pressed', String(el === b)));
      draw();
    };
    return b;
  }));

  // рамка
  $('diaryFrames').replaceChildren(...FRAMES.map((name) => {
    const b = doc.createElement('button');
    b.type = 'button'; b.className = 'chip'; b.textContent = name;
    b.setAttribute('aria-pressed', String(model.frame === name));
    b.onclick = () => {
      model.frame = name;
      [...$('diaryFrames').children].forEach((el) =>
        el.setAttribute('aria-pressed', String(el === b)));
      draw();
    };
    return b;
  }));

  // наклейки
  $('diaryStickers').replaceChildren(...STICKERS.map((ch) => {
    const b = doc.createElement('button');
    b.type = 'button'; b.className = 'chip sticker'; b.textContent = ch;
    b.setAttribute('aria-label', `наклейка ${ch}`);
    b.setAttribute('aria-pressed', String(sticker === ch));
    b.onclick = () => {
      sticker = ch;
      [...$('diaryStickers').children].forEach((el) =>
        el.setAttribute('aria-pressed', String(el === b)));
    };
    return b;
  }));

  // клик по листу ставит наклейку. Координаты в долях — картинка и
  // предпросмотр могут быть разного размера.
  canvas.addEventListener('click', (e) => {
    const r = canvas.getBoundingClientRect();
    // Пока диалог не разложен, ширина нулевая, и доля превращается в NaN.
    // JSON пишет NaN как null, наклейка молча теряется навсегда — поэтому
    // отказываемся ставить, а не сохраняем мусор.
    if (!r.width || !r.height) return;
    model.stickers.push({
      ch: sticker,
      x: clamp01((e.clientX - r.left) / r.width),
      y: clamp01((e.clientY - r.top) / r.height),
      rot: Math.round(Math.random() * 40 - 20),
      size: 26 + Math.round(Math.random() * 14),
    });
    draw();
  });
  $('diaryUndo').onclick = () => { model.stickers.pop(); draw(); };

  $('diarySave').onclick = () => {
    saveDiary(model);
    $('diaryNote').textContent = 'Сохранено. Анкета лежит у тебя в браузере.';
  };

  $('diaryShare').onclick = () => {
    saveDiary(model);
    renderDiary(model, 2).toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = doc.createElement('a');
      a.href = url; a.download = 'babyland-анкета.png';
      doc.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      $('diaryNote').textContent = 'Картинка сохранена — можно выложить куда захочешь.';
    }, 'image/png');
  };

  $('diaryOpen').onclick = () => { draw(); win.showModal(); };
  $('diaryClose').onclick = () => win.close();

  draw();
  return { model, draw, open: () => { draw(); win.showModal(); } };
}

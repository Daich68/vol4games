// НЭНСИ ДРЮ — hidden object по стиху Милены Степанян «Все Смерти Нэнси Дрю».
// Все предметы — настоящие 3D-формы (эллипсоиды/плоскости/торы), рендерятся
// ASCII-символами с подвижным светом — той же эстетикой, что и сферы птиц.
import "../../shared/type.css";
import { bindBackLink, markDone, backToMap, showCompleted } from "../../shared/nav.js";
import { ensureAudio, thud, creak, chime } from "../../shared/audio.js";

bindBackLink();

// ── DOM ────────────────────────────────────────────────────────────────────
const canvas    = document.getElementById("c");
const ctx       = canvas.getContext("2d");
const riddleEl  = document.getElementById("riddle");
const riddleN   = document.getElementById("riddle-num");
const foundN    = document.getElementById("found-count");
const noteEl    = document.getElementById("notebook");
const winOv     = document.getElementById("winOverlay");
const winPoem   = document.getElementById("winPoem");
const winStats  = document.getElementById("winStats");
const scoreEl   = document.getElementById("score");
const streakEl  = document.getElementById("streak");

// ── canvas ─────────────────────────────────────────────────────────────────
const VW = 360, VH = 460;
let scale = 1, offX = 0, offY = 0;

function fitCanvas() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.clientWidth, h = canvas.clientHeight;
  canvas.width  = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  const sx = w / VW, sy = h / VH;
  const s  = Math.min(sx, sy);
  const ox = (w - VW * s) / 2;
  const oy = (h - VH * s) / 2;
  ctx.setTransform(s * dpr, 0, 0, s * dpr, ox * dpr, oy * dpr);
  scale = s; offX = ox; offY = oy;
}
window.addEventListener("resize", fitCanvas);

// ── загадки ────────────────────────────────────────────────────────────────
const RIDDLES = [
  { answer: "apple", label: "яблоко",
    text: "В глазнице — если повезёт,\nбывает, висит в небе на рассвете,\nа третье стукнется о лоб,\nкогда решишь ты отдохнуть под древом." },
  { answer: "skull", label: "плутон",
    text: "Недр подземного царства ему не хватило —\nон добрался до звёздных высот.\nОко бога и римское позднее имя\nозирают ночью твой сон." },
  { answer: "fang", label: "клык",
    text: "Он рыка друг, охранник языка,\nдля мягкой плоти он как нож опасен.\nБелесый царь улыбки; брат клинка,\nкогда вампир и зверь проголодались." },
  { answer: "key", label: "ключ",
    text: "Им бьёт вода. О нём мечтает вор,\nзапутавшись в ворованных отмычках.\nОтвет на все загадки — тоже он\n(для этой точно ты другого не отыщешь)." },
  { answer: "lupa", label: "лупа",
    text: "Аксессуар для детектива из стекла,\nс ним бабушки читают, вышивают,\nбожественную кару муравья\nв мультфильмах им же совершают." },
  { answer: "queen", label: "дама пик",
    text: "Скажи её имя три раза,\nлюбовно запрячь в рукаве.\nВалет, король, туз и шестёрка —\nкого не хватило тебе?" },
];

// ── палитры предметов (deep/base/core RGB + размеры эллипсоида) ───────────
// kind = идентификатор, ra/rb/rc — полуоси, glyph — буква поверх (опционально)
// Холодный монохром: предметы различаются ФОРМОЙ (а не цветом), поэтому
// палитра — стекло/сталь/кость/иней в сине-серых тонах. Тёплый красный
// зарезервирован под сигнал «мимо» (flash-wrong), в предметах его нет.
const KINDS = {
  // СОЛЮШНЫ
  apple:  { ra:18, rb:18, rc:16, deep:[40,52,76],  base:[150,176,220], core:[225,238,255] },
  skull:  { ra:18, rb:22, rc:18, deep:[44,46,54],  base:[176,180,196], core:[244,248,255], holes:[[-7,-3,4.5],[7,-3,4.5]] },
  fang:   { ra:9,  rb:20, rc:9,  deep:[50,52,62],  base:[182,188,205], core:[248,250,255] },
  key:    { ra:12, rb:12, rc:10, deep:[30,34,46],  base:[140,150,176], core:[214,224,245], composite:"key" },
  lupa:   { ra:16, rb:16, rc:5,  deep:[18,40,50],  base:[96,150,170],  core:[190,228,240], hollow: 0.55, composite:"lupa" },
  queen:  { ra:14, rb:20, rc:5,  deep:[40,32,58],  base:[150,140,178], core:[228,222,245], glyph:"Q", glyphColor:"#0c0e16" },

  // ДИСТРАКТОРЫ
  candle: { ra:8,  rb:22, rc:8,  deep:[30,34,46],  base:[140,150,176], core:[214,224,245], composite:"candle" },
  coin:   { ra:13, rb:13, rc:3,  deep:[30,34,46],  base:[138,148,172], core:[210,220,242], glyph:"$", glyphColor:"#0c0e16" },
  ring:   { ra:11, rb:11, rc:4,  deep:[30,34,46],  base:[140,150,176], core:[214,224,245], hollow:0.55 },
  feather:{ ra:7,  rb:20, rc:5,  deep:[24,26,34],  base:[120,128,148], core:[196,204,224] },
  die:    { ra:13, rb:13, rc:13, deep:[44,46,56],  base:[176,182,200], core:[242,246,255], cube:true, pips:true },
  letter: { ra:18, rb:13, rc:3,  deep:[40,44,54],  base:[170,176,194], core:[238,242,252], glyph:"✉", glyphColor:"#0c0e16" },
  bottle: { ra:8,  rb:22, rc:7,  deep:[14,42,50],  base:[78,146,166],  core:[182,226,236] },
  clock:  { ra:16, rb:16, rc:4,  deep:[30,34,46],  base:[140,150,176], core:[214,224,245], glyph:"◷", glyphColor:"#0c0e16" },
  spider: { ra:9,  rb:9,  rc:9,  deep:[16,12,22],  base:[70,58,86],    core:[140,120,160], composite:"spider" },

  // ДОБАВЛЕННЫЕ ДИСТРАКТОРЫ (плотность сцены → дольше искать)
  pearl:  { ra:9,  rb:9,  rc:9,  deep:[44,52,72],  base:[168,186,216], core:[238,246,255] },
  bead:   { ra:7,  rb:7,  rc:7,  deep:[36,28,52],  base:[128,110,160], core:[210,198,236] },
  thimble:{ ra:8,  rb:11, rc:8,  deep:[28,32,44],  base:[132,142,168], core:[206,216,238] },
  shell:  { ra:13, rb:10, rc:6,  deep:[38,42,52],  base:[166,172,190], core:[236,240,250] },
  nail:   { ra:5,  rb:17, rc:5,  deep:[26,30,42],  base:[126,136,162], core:[202,212,236] },
  acorn:  { ra:9,  rb:12, rc:9,  deep:[22,24,32],  base:[112,120,142], core:[188,198,220] },
  marble: { ra:8,  rb:8,  rc:8,  deep:[14,40,48],  base:[84,150,168],  core:[186,228,238] },
  domino: { ra:14, rb:8,  rc:3,  deep:[40,44,54],  base:[170,176,194], core:[238,242,252] },
};

// ── расположение предметов на сцене ────────────────────────────────────────
// 6 солюшнов разнесены по сцене + 17 дистракторов = плотное поле поиска.
const ITEMS = [
  // ряд 1
  { id:"apple",   kind:"apple",   x:  52, y:  62 },
  { id:"candle",  kind:"candle",  x: 120, y:  58 },
  { id:"spider",  kind:"spider",  x: 186, y:  66 },
  { id:"skull",   kind:"skull",   x: 254, y:  60 },
  { id:"coin",    kind:"coin",    x: 316, y:  64 },
  // ряд 2
  { id:"feather", kind:"feather", x:  46, y: 150 },
  { id:"ring",    kind:"ring",    x: 116, y: 146 },
  { id:"key",     kind:"key",     x: 188, y: 154 },
  { id:"pearl",   kind:"pearl",   x: 258, y: 148 },
  { id:"bead",    kind:"bead",    x: 318, y: 156 },
  // ряд 3
  { id:"bottle",  kind:"bottle",  x:  54, y: 236 },
  { id:"fang",    kind:"fang",    x: 124, y: 242 },
  { id:"die",     kind:"die",     x: 192, y: 232 },
  { id:"thimble", kind:"thimble", x: 262, y: 240 },
  { id:"lupa",    kind:"lupa",    x: 320, y: 236 },
  // ряд 4
  { id:"letter",  kind:"letter",  x:  48, y: 326 },
  { id:"nail",    kind:"nail",    x: 120, y: 318 },
  { id:"queen",   kind:"queen",   x: 190, y: 330 },
  { id:"clock",   kind:"clock",   x: 258, y: 322 },
  { id:"shell",   kind:"shell",   x: 318, y: 328 },
  // ряд 5
  { id:"acorn",   kind:"acorn",   x:  60, y: 408 },
  { id:"marble",  kind:"marble",  x: 132, y: 400 },
  { id:"domino",  kind:"domino",  x: 204, y: 412 },
];

// ── состояние ──────────────────────────────────────────────────────────────
let currentRiddle = 0;
let foundIds      = new Set();
let solvedAnswers = new Set();
let state         = "play";
let hover         = null;
let flashTimer    = null;
let particles     = [];   // ASCII-частицы при разгадке
let typed         = 0;    // символов проявленного риддла
let typedTarget   = "";

// дофаминовый слой: очки, серия (множитель), бонус за скорость, лупа-подсказка.
let score        = 0;
let streak       = 0;     // подряд верных находок без ошибки
let bestStreak   = 0;
let riddleStartT = 0;     // момент показа текущей загадки (для бонуса за скорость)
let startT       = 0;     // старт партии (для финальной статы)
let hintT        = 0;     // сколько ищем текущий предмет → после порога зажигаем лупу
let banners      = [];    // всплывающие надписи на канвасе (+очки / СЕРИЯ ×N)
let shake        = 0;     // тряска сцены
const HINT_DELAY = 9;     // сек до появления лупы-подсказки; он же потолок бонуса

// ── свет (глобальный, поворачивается каждый кадр) ─────────────────────────
const LIGHT = [0, 0, 1];
const HV    = [0, 0, 1];
function updateLight(t) {
  const s = t / 1000;
  const yaw   = Math.sin(s * 0.22) * 0.7;
  const pitch = -0.32 + Math.sin(s * 0.13) * 0.18;
  const lx = Math.sin(yaw) * Math.cos(pitch);
  const ly = Math.sin(pitch);
  const lz = Math.cos(yaw) * Math.cos(pitch);
  LIGHT[0] = lx; LIGHT[1] = ly; LIGHT[2] = lz;
  const hx = lx, hy = ly, hz = lz + 1;
  const hm = Math.hypot(hx, hy, hz);
  HV[0] = hx/hm; HV[1] = hy/hm; HV[2] = hz/hm;
}

// ── ввод ───────────────────────────────────────────────────────────────────
canvas.addEventListener("mousemove", e => {
  if (state !== "play") return;
  const p = canvasToWorld(e);
  hover = pickItem(p.x, p.y);
});
canvas.addEventListener("mouseleave", () => { hover = null; });

// мобайл: touchmove → hover, touchend → click
canvas.addEventListener("touchmove", e => {
  e.preventDefault();
  const t = e.changedTouches[0];
  if (state !== "play") return;
  const p = canvasToWorld({ clientX: t.clientX, clientY: t.clientY });
  hover = pickItem(p.x, p.y);
}, { passive: false });
canvas.addEventListener("touchend", e => {
  e.preventDefault();
  const t = e.changedTouches[0];
  canvas.dispatchEvent(new MouseEvent("click", { clientX: t.clientX, clientY: t.clientY, bubbles: true }));
  hover = null;
}, { passive: false });

canvas.addEventListener("click", e => {
  ensureAudio();
  if (state !== "play") return;
  const p = canvasToWorld(e);
  const it = pickItem(p.x, p.y);
  if (!it || foundIds.has(it.id)) return;
  const need = RIDDLES[currentRiddle].answer;
  if (it.kind === need) onCorrect(it);
  else onWrong(it);
});

addEventListener("keydown", e => { if (e.code === "Escape") backToMap(); });

function canvasToWorld(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left - offX) / scale,
    y: (e.clientY - rect.top  - offY) / scale,
  };
}
function pickItem(x, y) {
  for (const it of ITEMS) {
    const k = KINDS[it.kind];
    const dx = x - it.x, dy = y - it.y;
    const r = Math.max(k.ra, k.rb) + 4;
    if (dx*dx + dy*dy <= r*r) return it;
  }
  return null;
}

// ── реакции ────────────────────────────────────────────────────────────────
function onCorrect(it) {
  foundIds.add(it.id);
  solvedAnswers.add(it.kind);

  // очки: (база + бонус за скорость) × серия. Нашёл быстро и без ошибок → много.
  const elapsed   = (performance.now() - riddleStartT) / 1000;
  const speedBonus = Math.max(0, Math.ceil(HINT_DELAY - elapsed)) * 20;
  streak++;
  if (streak > bestStreak) bestStreak = streak;
  const gained = (100 + speedBonus) * streak;
  score += gained;

  thud(0.8);
  ensureAudio();
  chime(Math.min(24, (streak - 1) * 3), Math.min(0.4, 0.2 + streak * 0.03));
  flash("flash-right");
  spawnDissolve(it, streak);
  pushBanner(it.x, it.y, `+${gained}`, streak >= 2 ? "#dccafa" : "#cde0ff", streak >= 2);
  if (streak >= 2) pushBanner(it.x, it.y - 22, `СЕРИЯ ×${streak}`, "#b4e8f0", true);
  shake = Math.max(shake, 5 + Math.min(8, streak));

  updateNotebook();
  currentRiddle++;
  if (currentRiddle >= RIDDLES.length) onWin();
  else showCurrentRiddle();
  updateHUD();
}

function onWrong(it) {
  creak();
  flash("flash-wrong");
  streak = 0;                 // ошибка обнуляет серию — цена невнимательности
  shake = Math.max(shake, 7);
  pushBanner(it.x, it.y, "мимо", "#d96a6a", false);
  updateHUD();
}
function flash(cls) {
  riddleEl.classList.add(cls);
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => riddleEl.classList.remove(cls), 400);
}

function showCurrentRiddle() {
  if (currentRiddle >= RIDDLES.length) return;
  typedTarget = RIDDLES[currentRiddle].text;
  typed = 0;
  riddleEl.textContent = "";
  riddleStartT = performance.now();
  hintT = 0;
}
function updateHUD() {
  if (riddleN) riddleN.textContent = `${Math.min(currentRiddle + 1, RIDDLES.length)} / ${RIDDLES.length}`;
  if (foundN)  foundN.textContent  = String(foundIds.size);
  if (scoreEl) scoreEl.textContent = String(score).padStart(5, "0");
  if (streakEl) {
    streakEl.textContent = streak >= 2 ? `×${streak}` : "—";
    streakEl.classList.toggle("hot", streak >= 3);
  }
}
function updateNotebook() {
  if (foundIds.size === 0) {
    noteEl.innerHTML = `<span class="nb-empty">блокнот пуст</span>`;
    return;
  }
  const labels = RIDDLES.filter(r => solvedAnswers.has(r.answer)).map(r => r.label);
  noteEl.innerHTML = labels.map(l => `<span class="nb-item">${l}</span>`).join(" · ");
}

function spawnDissolve(it, boost = 1) {
  const k = KINDS[it.kind];
  const n = 18 + Math.min(30, (boost - 1) * 8);   // длиннее серия → пышнее взрыв
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = (60 + Math.random() * 80) * (1 + (boost - 1) * 0.12);
    particles.push({
      x: it.x, y: it.y,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30,
      life: 0, ttl: 0.7 + Math.random() * 0.4,
      ch: ASCII_RAMP[5 + Math.floor(Math.random() * 4)],
      col: `rgb(${k.core[0]},${k.core[1]},${k.core[2]})`,
    });
  }
}

// ── всплывающие баннеры (+очки / СЕРИЯ ×N / мимо) ──────────────────────────
function pushBanner(x, y, text, col, big = false) {
  banners.push({ x, y, text, col, big, life: 0, ttl: 1.1 });
}

function onWin() {
  state = "win";
  markDone("nancy-drew");
  const secs = Math.round((performance.now() - startT) / 1000);
  const mm = Math.floor(secs / 60), ss = secs % 60;
  if (winStats) winStats.textContent =
    `ОЧКОВ ${score} · ЛУЧШАЯ СЕРИЯ ×${Math.max(1, bestStreak)} · ${mm}:${String(ss).padStart(2, "0")}`;
  fetch(`${import.meta.env.BASE_URL}poems/nancy-drew.txt`)
    .then(r => r.ok ? r.text() : "")
    .then(t => { winPoem.textContent = t || ""; });
  setTimeout(() => winOv.classList.add("show"), 800);
}

// ── 3D ASCII renderer (универсальный эллипсоид) ────────────────────────────
const ASCII_RAMP = " .·-+*x#@█";

// Рендер эллипсоида (ra, rb, rc — полуоси по X, Y, Z) с ASCII-шейдингом.
// hollow ∈ (0, 1) — пустотелый (для кольца/лупы): не рисуем точки ближе hollow*ra к центру в XY.
function renderEllipsoid(cx, cy, ra, rb, rc, deep, base, core, light, hv, hollow) {
  const N = 16;
  const w = Math.max(ra, rb) * 2.05;
  const cellPx = w / N;
  const half = w / 2;
  const hollowR2 = hollow ? (hollow * Math.min(ra, rb)) ** 2 : -1;

  ctx.save();
  ctx.font = `bold ${Math.round(cellPx * 1.25)}px 'JetBrains Mono', ui-monospace, monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (let j = 0; j < N; j++) {
    const y = (j + 0.5) * cellPx - half;
    for (let i = 0; i < N; i++) {
      const x = (i + 0.5) * cellPx - half;
      // дырка для торо-подобных
      if (hollowR2 > 0 && (x*x + y*y) < hollowR2) continue;
      const xn = x / ra, yn = y / rb;
      const r2n = xn * xn + yn * yn;
      if (r2n > 1) continue;
      const zn = Math.sqrt(1 - r2n);
      // нормаль = (xn/ra, yn/rb, zn/rc) нормализованная
      const nx = xn / ra, ny = yn / rb, nz = zn / rc;
      const nm = Math.hypot(nx, ny, nz);
      const nnx = nx / nm, nny = ny / nm, nnz = nz / nm;

      const lambert = nnx * light[0] + nny * light[1] + nnz * light[2];
      const diffuse = lambert > 0 ? lambert : 0;
      const hdot = nnx * hv[0] + nny * hv[1] + nnz * hv[2];
      const spec = hdot > 0 ? Math.pow(hdot, 80) * 1.35 : 0;
      const oneMinusNz = 1 - nnz;
      const rim = oneMinusNz * oneMinusNz * oneMinusNz * oneMinusNz * 0.16;

      let I = 0.04 + diffuse * 1.2 + spec + rim;
      if (I > 1) I = 1;

      const ri = (I * ASCII_RAMP.length) | 0;
      const ch = ASCII_RAMP[Math.min(ASCII_RAMP.length - 1, ri)];
      if (ch === " ") continue;

      let R, G, B;
      if (I < 0.5) {
        const k = I * 2;
        R = deep[0] + (base[0] - deep[0]) * k;
        G = deep[1] + (base[1] - deep[1]) * k;
        B = deep[2] + (base[2] - deep[2]) * k;
      } else {
        const k = (I - 0.5) * 2;
        R = base[0] + (core[0] - base[0]) * k;
        G = base[1] + (core[1] - base[1]) * k;
        B = base[2] + (core[2] - base[2]) * k;
      }
      ctx.fillStyle = `rgb(${R|0},${G|0},${B|0})`;
      ctx.fillText(ch, cx + x, cy + y);
    }
  }
  ctx.restore();
}

// Рендер куба с равномерной заливкой ASCII (для кубика)
function renderCube(cx, cy, r, deep, base, core, light, hv) {
  const N = 14;
  const cellPx = (r * 2) / N;
  const half = r;
  ctx.save();
  ctx.font = `bold ${Math.round(cellPx * 1.25)}px 'JetBrains Mono', ui-monospace, monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // три видимые грани: верх, перёд, право
  for (let j = 0; j < N; j++) {
    const y = (j + 0.5) * cellPx - half;
    for (let i = 0; i < N; i++) {
      const x = (i + 0.5) * cellPx - half;
      // определим, какая грань: дальше всего от центра по X/Y
      let nx = 0, ny = 0, nz = 1;
      const rx = Math.abs(x / r), ry = Math.abs(y / r);
      if (rx > ry && rx > 0.5) nx = x > 0 ? 1 : -1;
      else if (ry > 0.5) ny = y > 0 ? 1 : -1;
      else nz = 1;
      const lambert = nx * light[0] + ny * light[1] + nz * light[2];
      const diffuse = lambert > 0 ? lambert : 0.1;
      const I = Math.min(1, 0.18 + diffuse * 0.85);
      const ri = (I * ASCII_RAMP.length) | 0;
      const ch = ASCII_RAMP[Math.min(ASCII_RAMP.length - 1, ri)];
      if (ch === " ") continue;
      const k = I;
      const R = deep[0] + (core[0] - deep[0]) * k;
      const G = deep[1] + (core[1] - deep[1]) * k;
      const B = deep[2] + (core[2] - deep[2]) * k;
      ctx.fillStyle = `rgb(${R|0},${G|0},${B|0})`;
      ctx.fillText(ch, cx + x, cy + y);
    }
  }
  ctx.restore();
}

// ── рендер конкретного предмета ────────────────────────────────────────────
function drawItem(it) {
  const k = KINDS[it.kind];
  if (!k) return;
  const { ra, rb, rc, deep, base, core } = k;

  if (k.composite === "key") {
    // головка ключа — кольцо
    renderEllipsoid(it.x - 10, it.y, ra, rb, rc, deep, base, core, LIGHT, HV, 0.5);
    // стержень — горизонтальный эллипсоид
    renderEllipsoid(it.x + 8, it.y, 12, 4, 4, deep, base, core, LIGHT, HV);
    // зубцы
    renderEllipsoid(it.x + 16, it.y + 5, 3, 4, 3, deep, base, core, LIGHT, HV);
    return;
  }
  if (k.composite === "lupa") {
    renderEllipsoid(it.x - 2, it.y - 2, ra, rb, rc, deep, base, core, LIGHT, HV, k.hollow);
    // ручка — наклонный эллипсоид
    renderEllipsoid(it.x + 11, it.y + 12, 4, 9, 4,
      [40,28,16], [120,90,50], [200,160,100], LIGHT, HV);
    return;
  }
  if (k.composite === "candle") {
    // тело свечи
    renderEllipsoid(it.x, it.y + 4, 7, 16, 7, deep, base, core, LIGHT, HV);
    // пламя
    renderEllipsoid(it.x, it.y - 16, 4, 6, 4,
      [80,30,10], [220,140,60], [255,220,140], LIGHT, HV);
    return;
  }
  if (k.composite === "spider") {
    // тело — две сферы
    renderEllipsoid(it.x, it.y + 2,  6, 7, 6, deep, base, core, LIGHT, HV);
    renderEllipsoid(it.x, it.y - 8,  4, 4, 4, deep, base, core, LIGHT, HV);
    // ноги — несколько вытянутых эллипсоидов
    ctx.save();
    ctx.strokeStyle = `rgb(${base[0]},${base[1]},${base[2]})`;
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      const ang = 0.45 + i * 0.32;
      ctx.beginPath();
      ctx.moveTo(it.x - 3, it.y - 1);
      ctx.lineTo(it.x - 3 - Math.sin(ang) * 12, it.y - 1 + Math.cos(ang - 0.6) * 8);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(it.x + 3, it.y - 1);
      ctx.lineTo(it.x + 3 + Math.sin(ang) * 12, it.y - 1 + Math.cos(ang - 0.6) * 8);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }
  if (k.cube) {
    renderCube(it.x, it.y, ra, deep, base, core, LIGHT, HV);
    if (k.pips) {
      ctx.fillStyle = "#161410";
      const dots = [[-6,-6],[6,-6],[0,0],[-6,6],[6,6]];
      for (const [dx, dy] of dots) {
        ctx.beginPath();
        ctx.arc(it.x + dx, it.y + dy, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    return;
  }

  // обычный эллипсоид
  renderEllipsoid(it.x, it.y, ra, rb, rc, deep, base, core, LIGHT, HV, k.hollow);

  // глазницы черепа — закрашиваем чёрным
  if (k.holes) {
    ctx.fillStyle = "rgba(8,6,12,0.95)";
    for (const [hx, hy, hr] of k.holes) {
      ctx.beginPath();
      ctx.arc(it.x + hx, it.y + hy, hr, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // глиф (буква/символ поверх)
  if (k.glyph) {
    ctx.fillStyle = k.glyphColor || "#161410";
    ctx.font = `bold ${Math.round(rb * 0.7)}px 'JetBrains Mono', ui-monospace, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(k.glyph, it.x, it.y + 1);
  }
}

// ── render ─────────────────────────────────────────────────────────────────
function render(t) {
  // тряска сцены при находке/ошибке (с запасом по краям, чтобы не смазывало)
  const shx = shake > 0 ? (Math.random() - 0.5) * shake : 0;
  const shy = shake > 0 ? (Math.random() - 0.5) * shake : 0;
  ctx.clearRect(-16, -16, VW + 32, VH + 32);
  ctx.save();
  ctx.translate(shx, shy);

  // фон-текстура: ASCII-шум очень слабый
  ctx.fillStyle = "rgba(255,255,255,0.03)";
  ctx.font = "8px 'JetBrains Mono', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const noiseT = (t / 1000) * 6 | 0;
  for (let i = 0; i < 28; i++) {
    const sx = ((i * 53 + noiseT * 13) % VW);
    const sy = ((i * 31 + noiseT * 7)  % VH);
    ctx.fillText(".", sx, sy);
  }

  // предметы
  for (const it of ITEMS) {
    if (foundIds.has(it.id)) {
      // найденный — приглушённое и со золотым кольцом
      ctx.globalAlpha = 0.3;
      drawItem(it);
      ctx.globalAlpha = 1;
      const k = KINDS[it.kind];
      const pulse = 0.5 + Math.sin(t / 250 + it.x) * 0.18;
      ctx.strokeStyle = `rgba(232,236,245,${pulse})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(it.x, it.y, Math.max(k.ra, k.rb) + 6, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      const isHover = hover === it;
      if (isHover) {
        ctx.shadowColor = "rgba(232,236,245,0.9)";
        ctx.shadowBlur  = 14;
      }
      drawItem(it);
      ctx.shadowBlur = 0;
    }
  }

  // лупа-подсказка: если ищем дольше HINT_DELAY — у цели пульсирует «радар»
  if (state === "play" && currentRiddle < RIDDLES.length && hintT > HINT_DELAY) {
    const need = RIDDLES[currentRiddle].answer;
    const tgt = ITEMS.find(it => it.kind === need && !foundIds.has(it.id));
    if (tgt) {
      const k = KINDS[tgt.kind];
      const baseR = Math.max(k.ra, k.rb) + 8;
      const phase = (t / 950) % 1;
      for (let i = 0; i < 2; i++) {
        const pp = (phase + i * 0.5) % 1;
        ctx.strokeStyle = `rgba(232,236,245,${0.55 * (1 - pp)})`;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.arc(tgt.x, tgt.y, baseR + pp * 30, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  // частицы (распад при разгадке)
  ctx.font = "bold 10px 'JetBrains Mono', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const p of particles) {
    const a = 1 - p.life / p.ttl;
    ctx.globalAlpha = a;
    ctx.fillStyle = p.col;
    ctx.fillText(p.ch, p.x, p.y);
  }
  ctx.globalAlpha = 1;

  // всплывающие баннеры (+очки / СЕРИЯ ×N / мимо)
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const b of banners) {
    const p = b.life / b.ttl;
    const a = p < 0.12 ? p / 0.12 : 1 - (p - 0.12) / 0.88;
    const rise = p * 26;
    const size = b.big ? 14 : 11;
    ctx.globalAlpha = Math.max(0, Math.min(1, a));
    ctx.font = `bold ${size}px 'JetBrains Mono', ui-monospace, monospace`;
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillText(b.text, b.x + 1, b.y - rise + 1);
    ctx.fillStyle = b.col;
    ctx.fillText(b.text, b.x, b.y - rise);
  }
  ctx.globalAlpha = 1;

  ctx.restore();
}

// ── update ─────────────────────────────────────────────────────────────────
function update(dt, t) {
  updateLight(t);
  if (state === "play" && currentRiddle < RIDDLES.length) hintT += dt;
  if (shake > 0) shake = Math.max(0, shake - dt * 32);
  // частицы
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life += dt;
    if (p.life >= p.ttl) { particles.splice(i, 1); continue; }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 180 * dt;
    p.vx *= 0.96;
  }
  // баннеры
  for (let i = banners.length - 1; i >= 0; i--) {
    banners[i].life += dt;
    if (banners[i].life >= banners[i].ttl) banners.splice(i, 1);
  }
  // typewriter риддла
  if (typed < typedTarget.length) {
    typed = Math.min(typedTarget.length, typed + dt * 36);
    riddleEl.textContent = typedTarget.slice(0, typed | 0);
  }
}

// ── главный цикл ──────────────────────────────────────────────────────────
let prev = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - prev) / 1000);
  prev = now;
  update(dt, now);
  render(now);
  requestAnimationFrame(loop);
}

// ── старт ──────────────────────────────────────────────────────────────────
if (!showCompleted("nancy-drew", "нэнси дрю")) {
  fitCanvas();
  startT = performance.now();
  showCurrentRiddle();
  updateHUD();
  requestAnimationFrame(loop);
}

import "../../shared/type.css";
import { showCompleted, markDone } from "../../shared/nav.js";
import { ensureAudio, chime, thud, rumble } from "../../shared/audio.js";
import { osPowerOn, osBindLinks, osTitleCard, osRevealLines } from "../../shared/os.js";
import { submitScore } from "../../shared/leaderboard.js";

// сдать результат в таблицу лидеров и дописать место к строке статистики
function reportScore(baseStats) {
  submitScore("birds", score).then(r => {
    const ws = document.getElementById("winStats");
    if (ws && r && r.rank) ws.textContent = `${baseStats} · МЕСТО ${r.rank}`;
  });
}
// Match-3 «Много снега и много птиц».
// 5 типов фишек (снежки, воробьи, голуби, вёдра, бутоны) — образы стиха.
// Сверху над полем — текст стиха, проявляющийся посимвольно по мере матчей.
//
// Геймплей: таймер 90с, 3 жизни. Не успел до таймера — минус жизнь, таймер
// перезапускается. Жизни кончились — game over. Раскрыл стих целиком — win.

const POEM = [
  "Много снега и много птиц —",
  "перегрузка апреля, несогласованность",
  "двух расписаний. Крик вернувшихся:",
  "они не должны были видеть горы",
  "и бутоны мусорных вёдер; вообще крик",
  "невольных свидетелей несезонной",
  "смерти. Чувствительный контент",
  "в инстаграме, мокредь под пальцами,",
  "двухгодовщина, двухголовый голубь",
  "лифляндской заставы с растянутыми",
  "крыльями, как остеклевший",
  "детский воротничок. Не могу заснуть,",
  "потому что всю ночь кричат",
  "так как видят, что не должны.",
].join("\n");

// ── DOM ──────────────────────────────────────────────────────────────────
const canvas    = document.getElementById("c");
const ctx       = canvas.getContext("2d");
const poemEl    = document.getElementById("poem");
const poemInner = document.querySelector("#poem .inner");
const counter   = document.getElementById("counter");
const timerEl   = document.getElementById("timer");
const heartsEl  = document.getElementById("hearts");
const winOv     = document.getElementById("winOverlay");
const loseOv    = document.getElementById("loseOverlay");
const loseSub   = document.getElementById("loseSub");
const scoreEl   = document.getElementById("score");
const comboEl   = document.getElementById("combo");

// спаны создаются заранее, но в DOM попадают только при раскрытии —
// иначе невидимые символы занимают место и ломают скролл.
const charEls = [];
for (const ch of POEM) {
  const s = document.createElement("span");
  s.textContent = ch;
  s.style.opacity = "0";
  charEls.push(s);
}

// ── константы поля ───────────────────────────────────────────────────────
const COLS = 7, ROWS = 8;
const CELL = 64;
const GRID_W = COLS * CELL;
const GRID_H = ROWS * CELL;

// ── canvas DPR-fit ───────────────────────────────────────────────────────
// Используем clientWidth/Height (CSS-пиксели, до 3D-трансформа), чтобы
// внутренний размер канваса и хитбоксы кликов оставались согласованными
// даже когда канвас наклонён/повёрнут CSS-камерой.
function fitCanvas() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width  = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener("resize", fitCanvas);

function viewport() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  const sx = w / GRID_W, sy = h / GRID_H;
  const s  = Math.min(sx, sy);
  const gw = GRID_W * s, gh = GRID_H * s;
  return { ox: (w - gw) / 2, oy: (h - gh) / 2, s, w, h };
}

// ── state ────────────────────────────────────────────────────────────────
let grid, anim, particles, snow;
let revealed = 0;
let busy = false;
let selected = null;
let hover    = null;

let lives = 3;
const TIME_LIMIT = 90;
let timeLeft = TIME_LIMIT;
let gameOver = false;
let won      = false;

// дофаминовый слой: очки, каскадный множитель, всплывающие баннеры, тряска.
let score     = 0;
let cascade   = 0;   // текущий множитель внутри серии каскадов
let bestCombo = 0;   // лучший каскад за партию
let banners   = [];  // всплывающие надписи на канвасе
let shake     = 0;   // сила тряски экрана

function makeGrid() {
  const g = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      let t;
      do {
        t = 1 + Math.floor(Math.random() * 5);
      } while (
        (c >= 2 && g[r][c-1] === t && g[r][c-2] === t) ||
        (r >= 2 && g[r-1][c] === t && g[r-2][c] === t)
      );
      g[r][c] = t;
    }
  }
  return g;
}

function freshAnim() {
  return Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({
      fallFrom: 0, fallStart: -1, fallDur: 300,
      removeStart: -1, removeDur: 320,
      swapDx: 0, swapDy: 0, swapStart: -1, swapDur: 160,
      bornAt: 0,
    }))
  );
}

function resetGame() {
  grid = makeGrid();
  anim = freshAnim();
  particles = [];
  snow = [];
  for (let i = 0; i < 28; i++) { spawnSnow(); snow[snow.length - 1].y = Math.random() * GRID_H; }
  revealed = 0;
  busy = false; selected = null; hover = null;
  lives = 3; timeLeft = TIME_LIMIT; gameOver = false; won = false;
  score = 0; cascade = 0; bestCombo = 0; banners = []; shake = 0;
  // стих
  poemInner.innerHTML = "";   // отвязываем все раскрытые спаны от DOM
  for (const el of charEls) { el.style.opacity = "0"; el.style.color = "#c7c7d2"; }
  poemEl.scrollTop = 0;
  // ui
  updateHearts(); updateTimer(); updateCounter(); updateScore();
  winOv.classList.remove("show");
  loseOv.classList.remove("show");
  // плитки выезжают сверху
  const t0 = now();
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      anim[r][c].bornAt    = t0 + (r + c) * 28;
      anim[r][c].fallFrom  = -(r + 2) * CELL;
      anim[r][c].fallStart = t0 + (r + c) * 28;
      anim[r][c].fallDur   = 520;
    }
  }
}

// ── палитра — настоящие 3D-сферы в ASCII ────────────────────────────────
// Каждый тип = три ключевых цвета (deep → base → core) для shading-ramp.
// Сферы шейдятся попиксельно (Lambert + specular) и рисуются монохромными
// ASCII-символами разной плотности. Спрайты пре-рендерятся один раз.
// Холодный монохром: 5 РАЗЛИЧИМЫХ холодных тонов — разнесены и по светлоте,
// и по оттенку (бел → графит → фиолет → бирюза → синий), чтобы поле читалось
// без путаницы. Ядра держат свой оттенок даже в блике, а не уходят в белый.
const TYPE_COL = {
  1: { deep: "#3a4a72", base: "#e8f2ff", core: "#ffffff" }, // снежок — почти белый лёд (самый светлый)
  2: { deep: "#15171e", base: "#565d70", core: "#878fa6" }, // воробей — тёмный графит (самый тёмный)
  3: { deep: "#2c0f44", base: "#a64de0", core: "#e3b6ff" }, // голубь — насыщенный фиолет
  4: { deep: "#05333a", base: "#1fc2be", core: "#86f0ea" }, // ведро — яркая бирюза
  5: { deep: "#0a1d6e", base: "#3b6bf5", core: "#9bb6ff" }, // бутон — насыщенный синий
};

// Плотностная лестница ASCII — узкая, с резким переходом тень/свет.
// Тёмный край обрывается в «·», свет даёт сплошной блок «█» в самом ярком.
const ASCII_RAMP = " .·-+*x#@█";

// Свет: верх-лево-перёд, ближе к фронту чем раньше — даёт яркий блик в центре.
const LIGHT = (() => {
  const v = [-0.42, -0.55, 0.72];
  const m = Math.hypot(v[0], v[1], v[2]);
  return [v[0]/m, v[1]/m, v[2]/m];
})();

function parseHex(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}
function mixColor(a, b, t) {
  return [a[0] + (b[0]-a[0]) * t, a[1] + (b[1]-a[1]) * t, a[2] + (b[2]-a[2]) * t];
}

// Цвета типов в виде заранее распарсенных RGB-троек — чтобы не пересчитывать в горячем цикле.
const TYPE_RGB = {};
for (const k of Object.keys(TYPE_COL)) {
  const t = TYPE_COL[k];
  TYPE_RGB[k] = { deep: parseHex(t.deep), base: parseHex(t.base), core: parseHex(t.core) };
}

// Живой рендер сферы. Свет передаётся каждый кадр снаружи — при его повороте
// блик движется по поверхности, и сфера выглядит настоящим 3D-объектом.
function drawSphereLive(cx, cy, size, type, alpha, scale, hi, light, hv) {
  if (!type || alpha <= 0.005) return;
  const cols = TYPE_RGB[type];
  if (!cols) return;
  const { deep, base, core } = cols;

  const N = 14;
  const w = size * 1.0 * scale;
  const cellPx = w / N;
  const half = w / 2;
  const r = half * 0.96;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `bold ${Math.round(cellPx * 1.2)}px "SF Mono", ui-monospace, Menlo, monospace`;

  // контактная тень (короткая, без свечения)
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.beginPath();
  ctx.ellipse(cx, cy + half * 0.85, half * 0.95, half * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();

  const lx = light[0], ly = light[1], lz = light[2];
  const hx = hv[0], hy = hv[1], hz = hv[2];

  for (let j = 0; j < N; j++) {
    const y = (j + 0.5) * cellPx - half;
    for (let i = 0; i < N; i++) {
      const x = (i + 0.5) * cellPx - half;
      const d2 = x * x + y * y;
      if (d2 > r * r) continue;
      const z  = Math.sqrt(r * r - d2);
      const nx = x / r, ny = y / r, nz = z / r;

      // Lambert
      const lambert = nx * lx + ny * ly + nz * lz;
      const diffuse = lambert > 0 ? lambert : 0;
      // Blinn specular — tight highlight
      const hdot = nx * hx + ny * hy + nz * hz;
      const spec = hdot > 0 ? Math.pow(hdot, 110) * 1.6 : 0;
      // Rim — reduced so shadow side stays dark
      const oneMinusNz = 1 - nz;
      const rim = oneMinusNz * oneMinusNz * oneMinusNz * oneMinusNz * 0.15;

      let I = 0.02 + diffuse * 1.25 + spec + rim;
      if (I > 1) I = 1;

      const ri = (I * ASCII_RAMP.length) | 0;
      const ch = ASCII_RAMP[ri >= ASCII_RAMP.length ? ASCII_RAMP.length - 1 : ri];
      if (ch === " ") continue;

      // лерп цвета
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

  // selected — тонкий ASCII-кружок вокруг (без свечения)
  if (hi) {
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, half * 1.02, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

// drawSphereLive объявлена выше — здесь только её обёртка для совместимости
// с интерфейсом старого вызова drawSphereAt.
function drawSphereAt(cx, cy, size, type, alpha, scale, hi) {
  drawSphereLive(cx, cy, size, type, alpha, scale, hi, CURRENT_LIGHT, CURRENT_HV);
}

// ── снег и частицы ──────────────────────────────────────────────────────
function spawnSnow() {
  snow.push({
    x: Math.random() * GRID_W,
    y: -10,
    vx: (Math.random() - 0.5) * 8,
    vy: 10 + Math.random() * 18,
    r: 0.6 + Math.random() * 1.8,
    sway: Math.random() * Math.PI * 2,
    swaySpeed: 0.6 + Math.random() * 1.2,
  });
}

function updateSnow(dt) {
  if (Math.random() < dt * 8) spawnSnow();
  for (let i = snow.length - 1; i >= 0; i--) {
    const s = snow[i];
    s.sway += dt * s.swaySpeed;
    s.x += (s.vx + Math.sin(s.sway) * 6) * dt;
    s.y += s.vy * dt;
    if (s.y > GRID_H + 8) snow.splice(i, 1);
  }
}

function drawSnow(vp) {
  ctx.fillStyle = "rgba(220,230,255,0.18)";
  for (const s of snow) {
    ctx.beginPath();
    ctx.arc(vp.ox + s.x * vp.s, vp.oy + s.y * vp.s, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function burstAt(r, c, type) {
  const cx = c * CELL + CELL / 2;
  const cy = r * CELL + CELL / 2;
  const col = TYPE_COL[type]?.base || "#fff";
  for (let i = 0; i < 14; i++) {
    const ang = Math.random() * Math.PI * 2;
    const sp  = 80 + Math.random() * 160;
    particles.push({
      x: cx, y: cy,
      vx: Math.cos(ang) * sp,
      vy: Math.sin(ang) * sp - 50,
      r: 1.4 + Math.random() * 2.6,
      col, life: 0, ttl: 0.55 + Math.random() * 0.35,
    });
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life += dt;
    if (p.life >= p.ttl) { particles.splice(i, 1); continue; }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 240 * dt;
    p.vx *= 0.96;
  }
}

function drawParticles(vp) {
  for (const p of particles) {
    const a = 1 - p.life / p.ttl;
    ctx.fillStyle = p.col;
    ctx.globalAlpha = a;
    ctx.beginPath();
    ctx.arc(vp.ox + p.x * vp.s, vp.oy + p.y * vp.s, p.r * (0.5 + a * 0.7) * vp.s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ── всплывающие баннеры (×каскад / +очки / ЛИНИЯ / ВСПЫШКА) ───────────────
function pushBanner(text, col, big = false) {
  const slot = banners.length % 3;
  banners.push({ text, col, big, life: 0, ttl: 0.95, slot });
}

function updateBanners(dt) {
  for (let i = banners.length - 1; i >= 0; i--) {
    banners[i].life += dt;
    if (banners[i].life >= banners[i].ttl) banners.splice(i, 1);
  }
}

function drawBanners(vp) {
  if (!banners.length) return;
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const b of banners) {
    const p    = b.life / b.ttl;
    const a    = p < 0.12 ? p / 0.12 : 1 - (p - 0.12) / 0.88;
    const pop  = b.life < 0.12 ? 0.55 + (b.life / 0.12) * 0.45 : 1;
    const rise = easeOutCubic(Math.min(1, p * 1.3)) * 52;
    const size = (b.big ? 30 : 21) * pop;
    const x = vp.ox + GRID_W * vp.s / 2;
    const y = vp.oy + GRID_H * vp.s * 0.40 - rise + b.slot * 30;
    ctx.globalAlpha = clamp01(a);
    ctx.font = `bold ${Math.round(size)}px "SF Mono", ui-monospace, Menlo, monospace`;
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillText(b.text, x + 1.5, y + 1.5);
    ctx.fillStyle = b.col;
    ctx.fillText(b.text, x, y);
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

// ── утилиты тайминга ─────────────────────────────────────────────────────
const now = () => performance.now();
const sleep   = ms => new Promise(r => setTimeout(r, ms));
const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
const easeOutCubic = p => 1 - Math.pow(1 - p, 3);
const easeOutBack  = p => { const c = 1.70158; const x = p - 1; return 1 + (c + 1) * x * x * x + c * x * x; };
const easeInQuad   = p => p * p;

// ── киношная камера = подвижный свет ─────────────────────────────────────
// Канвас не наклоняется — это делало сферы плоскими «стикерами». Вместо
// этого крутится сам источник света: блик скользит по сферам, и они
// читаются как 3D-объекты, а не как 2D-картинки.
const CURRENT_LIGHT = [0, 0, 1];   // обновляется в updateCamera каждый кадр
const CURRENT_HV    = [0, 0, 1];   // half-vector для блика

function updateCamera(t) {
  const s = t / 1000;
  // базовый свет — верх-перёд, медленно орбитирует вокруг сферы
  const yawAmp   = 0.55;
  const yaw      = Math.sin(s * 0.18) * yawAmp;
  const pitchAmp = 0.18;
  const pitch    = -0.45 + Math.sin(s * 0.11) * pitchAmp;

  const lx = Math.sin(yaw) * Math.cos(pitch);
  const ly = Math.sin(pitch);
  const lz = Math.cos(yaw) * Math.cos(pitch);

  CURRENT_LIGHT[0] = lx; CURRENT_LIGHT[1] = ly; CURRENT_LIGHT[2] = lz;

  // half-vector к зрителю (+Z)
  const hx = lx, hy = ly, hz = lz + 1;
  const hm = Math.hypot(hx, hy, hz);
  CURRENT_HV[0] = hx / hm; CURRENT_HV[1] = hy / hm; CURRENT_HV[2] = hz / hm;
}

// ── главный RAF ──────────────────────────────────────────────────────────
let prevT = now();
function frame() {
  const t  = now();
  const dt = Math.min(0.06, (t - prevT) / 1000);
  prevT = t;

  if (!gameOver && !won) tickTime(dt);
  updateSnow(dt);
  updateParticles(dt);
  updateBanners(dt);
  if (shake > 0) shake = Math.max(0, shake - dt * 55);
  updateCamera(t);

  const vp = viewport();
  ctx.clearRect(0, 0, vp.w, vp.h);
  drawSnow(vp);

  // тёмное «дно» поля — мягкое
  ctx.fillStyle = "rgba(255,255,255,0.015)";
  ctx.fillRect(vp.ox, vp.oy, vp.w, vp.h);

  // тряска поля при крупных матчах — смещаем весь игровой слой
  const shx = shake > 0 ? (Math.random() - 0.5) * shake : 0;
  const shy = shake > 0 ? (Math.random() - 0.5) * shake : 0;
  ctx.save();
  ctx.translate(shx, shy);

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const type = grid[r][c];
      if (!type) continue;
      const a = anim[r][c];

      const breath = Math.sin((t * 0.001 + r * 0.43 + c * 0.31) * Math.PI * 2 * 0.16) * 1.1;

      let fallY = 0;
      if (a.fallStart >= 0) {
        const p = clamp01((t - a.fallStart) / a.fallDur);
        if (p >= 1) a.fallStart = -1;
        fallY = a.fallFrom * (1 - easeOutCubic(p));
      }

      let sx = 0, sy = 0;
      if (a.swapStart >= 0) {
        const p = clamp01((t - a.swapStart) / a.swapDur);
        if (p >= 1) a.swapStart = -1;
        sx = a.swapDx * (1 - easeOutCubic(p));
        sy = a.swapDy * (1 - easeOutCubic(p));
      }

      let alpha = 1, scale = 1;
      if (a.removeStart >= 0) {
        const p = clamp01((t - a.removeStart) / a.removeDur);
        alpha = 1 - p;
        scale = 1 + easeInQuad(p) * 0.6;
      }

      const since = (t - a.bornAt) / 1000;
      if (since < 0.45 && since > 0) {
        const p = clamp01(since / 0.45);
        scale *= 0.4 + 0.6 * easeOutBack(p);
        alpha *= p;
      }

      const isSel  = selected && selected.r === r && selected.c === c;
      const isHov  = hover    && hover.r    === r && hover.c    === c;
      const pulse  = isSel ? 1 + Math.sin(t * 0.012) * 0.06 : 1;
      const hoverK = isHov ? 1.06 : 1;

      const px = vp.ox + (c * CELL + CELL / 2 + sx) * vp.s;
      const py = vp.oy + (r * CELL + CELL / 2 + sy + fallY + breath) * vp.s;

      drawSphereAt(px, py, CELL * vp.s, type, alpha, scale * pulse * hoverK, isSel || isHov);
    }
  }

  drawParticles(vp);
  ctx.restore();

  drawBanners(vp);
  requestAnimationFrame(frame);
}

// ── таймер / жизни ───────────────────────────────────────────────────────
let timerCum = 0;
function tickTime(dt) {
  timerCum += dt;
  if (timerCum >= 1) {
    timeLeft = Math.max(0, timeLeft - Math.floor(timerCum));
    timerCum = timerCum - Math.floor(timerCum);
    updateTimer();
    if (timeLeft <= 0) loseLife();
  }
}

function updateTimer() {
  const m = Math.floor(timeLeft / 60);
  const s = timeLeft % 60;
  timerEl.textContent = `${m}:${String(s).padStart(2, "0")}`;
  timerEl.classList.toggle("danger", timeLeft <= 10);
}

function updateHearts() {
  const els = heartsEl.querySelectorAll(".h");
  els.forEach((el, i) => {
    const lost = i >= lives;
    el.classList.toggle("lost", lost);
    el.textContent = lost ? "♡" : "♥";
  });
}

function updateCounter() {
  const frac = revealed / charEls.length;
  counter.textContent = `${Math.round(frac * 100)}%`;
  const bar = document.getElementById("poemBar");
  if (bar) {
    const n = 10, filled = Math.round(frac * n);
    bar.textContent = "▮".repeat(filled) + "▯".repeat(n - filled);
  }
}

function updateScore() {
  if (scoreEl) scoreEl.textContent = String(score).padStart(5, "0");
  if (comboEl) {
    comboEl.textContent = bestCombo > 1 ? `×${bestCombo}` : "—";
    comboEl.classList.toggle("hot", bestCombo >= 3);
  }
}

function loseLife() {
  lives--;
  updateHearts();
  if (lives <= 0) {
    gameOver = true;
    loseSub.textContent = revealed > 0
      ? `раскрыто ${Math.round(revealed / charEls.length * 100)}% стиха`
      : "стих не дочитан";
    loseOv.classList.add("show");
    submitScore("birds", score);          // партия окончена — рекорд в таблицу
  } else {
    timeLeft = TIME_LIMIT;
    updateTimer();
  }
}

// ── матчинг и каскады ────────────────────────────────────────────────────
// Возвращает массив серий длиной ≥3: { cells:[key…], len, type, dir, line }.
// len управляет спецэффектами (4 → очистка линии, 5+ → стирание типа),
// поэтому матчинг хранит не просто множество клеток, а сами серии.
function findRuns() {
  const runs = [];
  for (let r = 0; r < ROWS; r++) {
    let s = 0;
    for (let c = 1; c <= COLS; c++) {
      const here  = c < COLS ? grid[r][c] : -1;
      const there = grid[r][s];
      if (here !== there) {
        if (there && c - s >= 3) {
          const cells = [];
          for (let k = s; k < c; k++) cells.push(r * COLS + k);
          runs.push({ cells, len: c - s, type: there, dir: "h", line: r });
        }
        s = c;
      }
    }
  }
  for (let c = 0; c < COLS; c++) {
    let s = 0;
    for (let r = 1; r <= ROWS; r++) {
      const here  = r < ROWS ? grid[r][c] : -1;
      const there = grid[s][c];
      if (here !== there) {
        if (there && r - s >= 3) {
          const cells = [];
          for (let k = s; k < r; k++) cells.push(k * COLS + c);
          runs.push({ cells, len: r - s, type: there, dir: "v", line: c });
        }
        s = r;
      }
    }
  }
  return runs;
}

function applyGravity() {
  const tNow = now();
  for (let c = 0; c < COLS; c++) {
    let writeR = ROWS - 1;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (grid[r][c]) {
        if (writeR !== r) {
          grid[writeR][c] = grid[r][c];
          grid[r][c] = 0;
          anim[writeR][c].fallFrom  = -(writeR - r) * CELL;
          anim[writeR][c].fallStart = tNow;
          anim[writeR][c].fallDur   = 260 + (writeR - r) * 40;
          anim[writeR][c].bornAt    = anim[r][c].bornAt;
        }
        writeR--;
      }
    }
    for (let r = writeR; r >= 0; r--) {
      grid[r][c] = 1 + Math.floor(Math.random() * 5);
      anim[r][c].fallFrom  = -(writeR + 1 - r) * CELL - 30;
      anim[r][c].fallStart = tNow + r * 30;
      anim[r][c].fallDur   = 360;
      anim[r][c].bornAt    = tNow + r * 30;
    }
  }
}

async function resolveMatches() {
  busy = true;
  cascade = 0;
  while (true) {
    const runs = findRuns();
    if (runs.length === 0) break;
    cascade++;
    const mult = cascade;

    // Собираем клетки на удаление + определяем спецэффекты.
    const toClear = new Set();
    let special = "";        // "" | "line" | "wipe"
    let wipeType = 0;
    for (const run of runs) {
      for (const k of run.cells) toClear.add(k);
      if (run.len === 4) {   // 4 в ряд → сметает всю строку/столбец
        if (!special) special = "line";
        if (run.dir === "h") for (let c = 0; c < COLS; c++) toClear.add(run.line * COLS + c);
        else                 for (let r = 0; r < ROWS; r++) toClear.add(r * COLS + run.line);
      }
      if (run.len >= 5) { special = "wipe"; wipeType = run.type; }  // 5+ → стереть весь тип
    }
    if (wipeType) {
      for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS; c++)
          if (grid[r][c] === wipeType) toClear.add(r * COLS + c);
    }

    // Анимация удаления + взрывы частиц.
    const tNow = now();
    for (const key of toClear) {
      const r = (key / COLS) | 0, c = key % COLS;
      anim[r][c].removeStart = tNow;
      burstAt(r, c, grid[r][c]);
    }

    // Очки: (плитки×10 + бонус за длину серий) × множитель каскада.
    const tiles = toClear.size;
    let lenBonus = 0;
    for (const run of runs) lenBonus += (run.len - 2) * 15;
    const gained = (tiles * 10 + lenBonus) * mult;
    score += gained;
    updateScore();

    // Звук — высота ноты растёт с каждым витком каскада.
    ensureAudio();
    chime(Math.min(24, (mult - 1) * 2), Math.min(0.42, 0.18 + mult * 0.04));

    // Баннеры + тряска.
    const label  = special === "wipe" ? "ВСПЫШКА" : special === "line" ? "ЛИНИЯ" : "";
    const prefix = mult >= 2 ? `×${mult}  ` : "";
    pushBanner(`${prefix}+${gained}`, mult >= 3 || special ? "#dccafa" : "#cde0ff", mult >= 3 || !!special);
    if (label) pushBanner(label, special === "wipe" ? "#b4e8f0" : "#cde0ff", true);
    if (special === "wipe") { rumble(); shake = Math.max(shake, 16); }
    else if (special === "line") shake = Math.max(shake, 9);
    shake = Math.max(shake, 4 + mult * 1.6);

    revealChars(tiles, mult);
    await sleep(300);
    for (const key of toClear) {
      const r = (key / COLS) | 0, c = key % COLS;
      grid[r][c] = 0;
      anim[r][c].removeStart = -1;
    }
    await sleep(40);
    applyGravity();
    await sleep(420);
    if (cascade > 40) break;
  }
  if (cascade > bestCombo) { bestCombo = cascade; updateScore(); }
  busy = false;
  if (revealed >= charEls.length && !won) {
    won = true;
    markDone("birds");
    const baseStats = `ОЧКОВ ${score} · МАКС КАСКАД ×${Math.max(1, bestCombo)}`;
    const ws = document.getElementById("winStats");
    if (ws) ws.textContent = baseStats;
    const wp = document.getElementById("winPoem");
    if (wp) { wp.textContent = POEM; osRevealLines(wp); }
    winOv.classList.add("show");
    reportScore(baseStats);               // рекорд в таблицу + место в статистику
  }
}

function revealChars(matchCount, mult = 1) {
  // Базовый темп замедлен (×2 вместо ×3) — партия длиннее; крупные каскады
  // дают бонусные символы, так что мастерство всё равно ускоряет раскрытие.
  const want = matchCount * 2 + (mult - 1) * 2;
  let done = 0;
  while (done < want && revealed < charEls.length) {
    const el = charEls[revealed++];
    poemInner.appendChild(el);  // добавляем в DOM только сейчас
    el.style.opacity = "1";
    el.style.color = "#fff";
    if (el.textContent.trim()) done++;
  }
  updateCounter();
  // прокрутка к последнему раскрытому символу
  poemEl.scrollTop = poemEl.scrollHeight;
}

// ── ввод ────────────────────────────────────────────────────────────────
function cellFromEvent(e) {
  // координаты считаем от getBoundingClientRect: clientX/Y есть и у реального
  // клика, и у тача — в отличие от offsetX/Y, который не вычисляется у
  // синтетических событий (из-за чего тапы на iOS «не срабатывали»).
  const vp = viewport();
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) - vp.ox;
  const y = (e.clientY - rect.top)  - vp.oy;
  if (x < 0 || y < 0 || x >= GRID_W * vp.s || y >= GRID_H * vp.s) return null;
  return { r: (y / (CELL * vp.s)) | 0, c: (x / (CELL * vp.s)) | 0 };
}

canvas.addEventListener("mousemove", e => {
  hover = (busy || gameOver || won) ? null : cellFromEvent(e);
});
canvas.addEventListener("mouseleave", () => { hover = null; });

// мобайл: touchend → click (offsetX/Y вычисляется браузером из clientX/Y)
canvas.addEventListener("touchend", e => {
  e.preventDefault();
  const t = e.changedTouches[0];
  canvas.dispatchEvent(new MouseEvent("click", { clientX: t.clientX, clientY: t.clientY, bubbles: true }));
}, { passive: false });

canvas.addEventListener("click", async e => {
  if (busy || gameOver || won) return;
  ensureAudio();
  const cell = cellFromEvent(e);
  if (!cell) return;
  if (!selected) { selected = cell; return; }
  const dr = Math.abs(cell.r - selected.r);
  const dc = Math.abs(cell.c - selected.c);
  if (dr === 0 && dc === 0) { selected = null; return; }
  if (dr + dc === 1) {
    const a = selected, b = cell;
    selected = null;
    await animateSwap(a, b);
    swap(a, b);
    if (findRuns().length === 0) {
      await sleep(80);
      await animateSwap(a, b);
      swap(a, b);
    } else {
      await resolveMatches();
    }
  } else {
    selected = cell;
  }
});

function swap(a, b) {
  const t = grid[a.r][a.c];
  grid[a.r][a.c] = grid[b.r][b.c];
  grid[b.r][b.c] = t;
}

async function animateSwap(a, b) {
  const tNow = now();
  const dur = 170;
  anim[a.r][a.c].swapDx = (b.c - a.c) * CELL;
  anim[a.r][a.c].swapDy = (b.r - a.r) * CELL;
  anim[a.r][a.c].swapStart = tNow;
  anim[a.r][a.c].swapDur = dur;
  anim[b.r][b.c].swapDx = (a.c - b.c) * CELL;
  anim[b.r][b.c].swapDy = (a.r - b.r) * CELL;
  anim[b.r][b.c].swapStart = tNow;
  anim[b.r][b.c].swapDur = dur;
  await sleep(dur);
}

// ── restart ─────────────────────────────────────────────────────────────
for (const btn of document.querySelectorAll('[data-action="restart"]')) {
  btn.addEventListener("click", () => resetGame());
}

// ── старт ────────────────────────────────────────────────────────────────
osPowerOn();
osBindLinks();
if (!showCompleted("birds", "птицы")) {
  osTitleCard({ index: "01", title: "птицы", poem: "много снега и много птиц", author: "лиза хереш" });
  fitCanvas();
  resetGame();
  requestAnimationFrame(frame);
}

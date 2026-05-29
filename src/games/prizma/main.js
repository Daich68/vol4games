// ПРИЗМА — Icy Tower по стиху Данилы Кудимова «Призматическая пагода».
//
// Подъём по призматической пагоде света. Разбег ← → даёт высоту прыжка,
// скип этажей складывается в COMBO, вращение в воздухе (флипы) даёт бонус.
//
// Визуальная идея: белый свет преломляется призмой в холодные спектральные
// двойники — хроматическая аберрация сине-голубых каналов, которая
// усиливается со скоростью и высотой. Игрок — преломляющий осколок света,
// башня — кристаллическая пагода, ветер крепчает с каждым ярусом, а
// скобочные слова стиха 〔ты〕〔слышишь〕〔умер〕 врываются глитчем.
import "../../shared/type.css";
import { bindBackLink, markDone, backToMap, showCompleted, getPlayerName } from "../../shared/nav.js";
import { ensureAudio, thud, creak, chime, rumble } from "../../shared/audio.js";

bindBackLink();

// ── DOM ────────────────────────────────────────────────────────────────────
const canvas    = document.getElementById("c");
const ctx       = canvas.getContext("2d");
const floorEl   = document.getElementById("floor");
const scoreEl   = document.getElementById("score");
const comboEl   = document.getElementById("combo");
const windEl    = document.getElementById("windMeter");
const orbEl     = document.getElementById("orbMeter");
const stanzaEl  = document.getElementById("stanza");
const winOv     = document.getElementById("winOverlay");
const winPoem   = document.getElementById("winPoem");
const winName   = document.getElementById("winName");
const loseOv    = document.getElementById("loseOverlay");
const loseSub   = document.getElementById("loseSub");

// ── константы мира ───────────────────────────────────────────────────────
const VW = 360, VH = 640;
const TOP_FLOOR  = 64;          // длинный подъём — десятки прыжков до вершины
const FLOOR_GAP  = 70;
const GROUND_Y   = 70;
const PLAYER_W   = 16, PLAYER_H = 24;

// физика (мир-Y вверх = +)
const GRAVITY              = 2000;
const ACCEL                = 1900;
const FRICTION             = 1400;
const MAX_HSP              = 380;
const JUMP_BASE            = 580;
const JUMP_BONUS_PER_SPEED = 0.62;
const WALL_BOUNCE_RETAIN   = 0.82;
const ROT_PER_VX           = 0.022;

// камера
const CAM_PLAYER_FRAC = 0.55;
const CAM_FOLLOW_K    = 6.0;
const AUTO_SCROLL_DELAY = 9;
const AUTO_SCROLL_BASE  = 22;
const AUTO_SCROLL_RAMP   = 0.035;

// комбо
const COMBO_TIMEOUT  = 2.6;
const COMBO_MIN_JUMP = 2;
// [мин. суммарных этажей, метка] — в монохроме различаем размером и расщеплением
const COMBO_LABELS = [
  [2,  "NICE"],
  [4,  "COOL"],
  [6,  "EXTRA"],
  [9,  "SUPER"],
  [13, "ULTRA"],
  [18, "WOW"],
  [24, "AMAZING"],
  [32, "INSANE"],
];

// ── холодная палитра призмы ─────────────────────────────────────────────
const CORE    = "#eaf0ff";   // ядро белого света
const GHOST_B = "#2f54c8";   // синий спектральный двойник
const GHOST_C = "#26b4ce";   // голубой спектральный двойник
const DANGER  = "#d96a6a";   // единственный сигнальный цвет — линия смерти

const WIND_LABELS  = ["тихо", "шумит", "громко", "сильнее", "буря"];
// скобочные слова из стиха — вспыхивают глитчем при подъёме
const GLITCH_WORDS = ["ты", "слышишь", "теперь", "умер", "ветер", "дует"];

// ── canvas DPR fit ──────────────────────────────────────────────────────
function fitCanvas() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.clientWidth, h = canvas.clientHeight;
  canvas.width  = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  const s  = Math.min(w / VW, h / VH);
  const ox = (w - VW * s) / 2;
  const oy = (h - VH * s) / 2;
  ctx.setTransform(s * dpr, 0, 0, s * dpr, ox * dpr, oy * dpr);
}
window.addEventListener("resize", fitCanvas);

// ── строфы стиха по этажам ──────────────────────────────────────────────
const STANZAS = {
  1:  "первый этаж. один монах,\nодно священное писание.",
  3:  "три монаха, три сутры.\nкогда дует ветер — шумит.",
  5:  "пять монахов, пять сутр.\nпять золотых подвесок, двадцать таэлей.",
  7:  "семь высоких столов с двадцатью восемью ножками.\nсемь золотых подвесок.",
  9:  "девять монахов, девять писаний.\nдевять цимбал и девять курантов.",
  11: "одиннадцать монахов. одиннадцать сутр.\n〔ветер〕 дует.",
  13: "тринадцать этажей на вершине.\nпагода сокровищ ведёт обратный отсчёт.",
};

// ── вехи: 7 строф стиха разнесены по длинной башне ────────────────────────
// поэма — 13 «названных» этажей; в игре это контрольные ярусы-пагоды,
// между которыми лежат десятки обычных ледяных уступов.
const MILESTONES = [
  [1,         STANZAS[1]],
  [11,        STANZAS[3]],
  [22,        STANZAS[5]],
  [33,        STANZAS[7]],
  [44,        STANZAS[9]],
  [54,        STANZAS[11]],
  [TOP_FLOOR, STANZAS[13]],   // вершина = победа
];
const MILESTONE_MAP    = new Map(MILESTONES);
const MILESTONE_FLOORS = new Set(MILESTONES.map(m => m[0]));

// ── состояние ────────────────────────────────────────────────────────────
let player, platforms, cameraY;
let prevFloor, topFloorReached;
let keys, state, time, autoScroll;
let score, combo, comboBanner, flipsThisJump;
let shake, glitch, trail;
let particles, motes, shafts, bgPagodas, windStreaks;
// дофаминовый слой: осколки света, всплывающие очки, точные приземления.
let orbs, popups, scoreShown, orbsTaken;
let orbStreak, orbStreakTimer, perfectStreak, perfectTimer, flashT;

// ── фоновые системы (параллакс) ──────────────────────────────────────────
function initBackground() {
  // вертикальные шахты призменного света
  shafts = [];
  for (let i = 0; i < 5; i++) {
    shafts.push({ x: 30 + Math.random() * (VW - 60), w: 28 + Math.random() * 64,
                  ph: Math.random() * 6.28, sp: 0.04 + Math.random() * 0.09 });
  }
  // дальние силуэты пагод — несколько слоёв глубины
  bgPagodas = [];
  for (let i = 0; i < Math.round(TOP_FLOOR * 0.95); i++) {
    const depth = 0.16 + Math.random() * 0.52;        // меньше = дальше = медленнее
    bgPagodas.push({
      x: Math.random() * VW,
      y: 30 + Math.random() * (FLOOR_GAP * TOP_FLOOR + 260),
      depth,
      scale: (0.55 + Math.random() * 1.0) * (0.55 + depth),
      tiers: 3 + Math.floor(Math.random() * 4),
      bright: 0.035 + depth * 0.11,
    });
  }
  bgPagodas.sort((a, b) => a.depth - b.depth);          // дальние рисуем первыми
  // парящие световые пылинки
  motes = [];
  for (let i = 0; i < 46; i++) {
    motes.push({ x: Math.random() * VW, y: Math.random() * VH,
                 z: 0.3 + Math.random() * 0.7, sp: 3 + Math.random() * 9,
                 tw: Math.random() * 6.28 });
  }
}

function rebuildWind() {
  windStreaks = [];
  for (let i = 0; i < 20; i++) {
    windStreaks.push({ y: Math.random() * VH, len: 26 + Math.random() * 70,
                       spd: 110 + Math.random() * 240, ph: Math.random() * (VW + 120),
                       w: Math.random() < 0.28 ? 1.4 : 0.7 });
  }
}

// ── построение башни ───────────────────────────────────────────────────────
function buildTower() {
  platforms = [];
  platforms.push({ x: 0, y: GROUND_Y, w: VW, h: 8, floor: 0, milestone: true, ground: true });

  let prevCx = VW / 2;          // центр предыдущего уступа
  let side   = Math.random() < 0.5 ? 1 : -1;
  let streak = 0;               // сколько ещё уступов подряд в одну сторону
  for (let f = 1; f <= TOP_FLOOR; f++) {
    const ms    = MILESTONE_FLOORS.has(f);
    const diffT = f / TOP_FLOOR;        // 0 у земли → 1 на вершине

    // ── ширина: вехи широкие, обычные уступы варьируются ──
    let w;
    if (ms) {
      w = 96 + Math.random() * 26;                       // широкая пагода-веха
    } else {
      const r = Math.random();
      if      (r < 0.07) w = 52 + Math.random() * 16;    // узкий челлендж (редко)
      else if (r < 0.30) w = 130 + Math.random() * 40;   // широкий «отдых»
      else               w = 100 + Math.random() * 40;   // обычный
    }
    const half = w / 2;

    // ── горизонтальная раскладка: змейка со «стейками» ──
    // несколько уступов подряд в одну сторону = диагональная разгонная лестница
    // (на ней копится скорость → высокий прыжок → скип этажей в комбо)
    if (streak <= 0) { side = -side; streak = 1 + Math.floor(Math.random() * 3); }
    streak--;

    // дистанция растёт с высотой — честный, но нарастающий разрыв
    const maxShift = ms ? 72 : 88 + diffT * 56;          // ~88 внизу → ~144 наверху
    const minShift = ms ? 24 : 34;
    let cx = prevCx + side * (minShift + Math.random() * (maxShift - minShift));

    // отражение от стен
    if (cx - half < 16)          { cx = 16 + half;        side =  1; streak = 1; }
    else if (cx + half > VW - 16){ cx = VW - 16 - half;   side = -1; streak = 1; }

    platforms.push({
      x: cx - half, y: GROUND_Y + f * FLOOR_GAP, w,
      h: ms ? 8 : 7, floor: f, milestone: ms, ground: false,
    });
    prevCx = cx;
  }
}

// ── осколки света: коллекционные кристаллы над уступами ───────────────────
// часть обычных уступов несёт одиночный осколок, часть — цепочку из трёх по
// дуге к следующему ярусу (награда за высокий прыжок); вехи несут крупный.
function buildOrbs() {
  orbs = [];
  for (let f = 1; f <= TOP_FLOOR; f++) {
    const p = platforms[f];
    if (!p) continue;
    const cx = p.x + p.w / 2;
    if (p.milestone) {
      orbs.push(makeOrb(cx, p.y + 32, true, 70 + p.floor * 4));
      continue;
    }
    const r = Math.random();
    if (r < 0.30) {
      orbs.push(makeOrb(cx, p.y + 26, false, 20 + Math.floor(p.floor * 1.1)));
    } else if (r < 0.44) {
      const np = platforms[f + 1];
      const tx = np ? np.x + np.w / 2 : cx;
      for (let k = 0; k < 3; k++) {
        const t = k / 2;
        orbs.push(makeOrb(cx + (tx - cx) * t * 0.5, p.y + 24 + k * 20,
                          false, 18 + Math.floor(p.floor * 1.1)));
      }
    }
  }
}
function makeOrb(x, y, big, value) {
  return { x, y, r: big ? 9 : 6, big, value: Math.round(value), taken: false, ph: Math.random() * 6.28 };
}

function reset() {
  player = {
    x: VW / 2 - PLAYER_W / 2, y: GROUND_Y,
    vx: 0, vy: 0, rot: 0, rotV: 0, onGround: true, dir: 1,
  };
  cameraY = 0;
  prevFloor = 0;
  topFloorReached = 0;
  state = "play";
  time = 0;
  autoScroll = 0;
  score = 0;
  combo = { floors: 0, jumps: 0, timer: 0, peakIdx: -1 };
  comboBanner = null;
  flipsThisJump = 0;
  shake = 0;
  glitch = null;
  trail = [];
  particles = [];
  orbs = [];
  popups = [];
  scoreShown = 0;
  orbsTaken = 0;
  orbStreak = 0; orbStreakTimer = 0;
  perfectStreak = 0; perfectTimer = 0;
  flashT = 0;
  keys = new Set();
  updateHUD();
  hideStanza();
  winOv.classList.remove("show");
  loseOv.classList.remove("show");
  buildTower();
  buildOrbs();
  initBackground();
  rebuildWind();
}

// ── ввод ──────────────────────────────────────────────────────────────────
const LEFT_KEYS  = ["ArrowLeft",  "KeyA"];
const RIGHT_KEYS = ["ArrowRight", "KeyD"];
const JUMP_KEYS  = ["Space", "ArrowUp", "KeyW"];

addEventListener("keydown", e => {
  ensureAudio();
  if (e.code === "Escape") { backToMap(); return; }
  if (LEFT_KEYS.includes(e.code) || RIGHT_KEYS.includes(e.code) || JUMP_KEYS.includes(e.code)) {
    keys.add(e.code);
    e.preventDefault();
  }
  if (e.code === "Enter" && (state === "win" || state === "lose")) reset();
});
addEventListener("keyup", e => { keys.delete(e.code); });

for (const b of document.querySelectorAll('[data-action="restart"]')) {
  b.addEventListener("click", () => reset());
}

// ── прыжок ──────────────────────────────────────────────────────────────────
function tryJump() {
  if (!player.onGround) return;
  const sp = Math.abs(player.vx);
  player.vy = JUMP_BASE + sp * JUMP_BONUS_PER_SPEED;
  player.onGround = false;
  player.rotV = -player.dir * (sp * ROT_PER_VX + 1.6);
  flipsThisJump = 0;
  addBurst(player.x + PLAYER_W / 2, player.y, 6, 70, 0.6);
  thud(0.45 + Math.min(0.55, sp / MAX_HSP * 0.55));
}

// ── update ────────────────────────────────────────────────────────────────
function update(dt) {
  // фон и частицы живут всегда (даже на оверлеях — чтобы сцена дышала)
  updateAmbient(dt);
  updateParticles(dt);
  if (shake > 0) shake = Math.max(0, shake - dt * (6 + shake * 4));
  if (glitch) { glitch.age += dt; if (glitch.age >= glitch.ttl) glitch = null; }
  if (comboBanner) { comboBanner.age += dt; if (comboBanner.age >= comboBanner.ttl) comboBanner = null; }
  updatePopups(dt);
  if (flashT > 0) flashT = Math.max(0, flashT - dt * 2.2);
  // плавный «накрут» счётчика очков — числа всегда докручиваются до цели
  scoreShown += (score - scoreShown) * Math.min(1, dt * 9);
  if (Math.abs(score - scoreShown) < 0.5) scoreShown = score;
  if (scoreEl) scoreEl.textContent = String(Math.round(scoreShown));

  if (state !== "play") return;
  time += dt;

  // таймеры дофаминовых серий: подряд собранные осколки и точные приземления
  if (orbStreakTimer > 0) { orbStreakTimer -= dt; if (orbStreakTimer <= 0) orbStreak = 0; }
  if (perfectTimer  > 0) { perfectTimer  -= dt; if (perfectTimer  <= 0) perfectStreak = 0; }

  // ── ввод → горизонтальная скорость ──
  const left  = keys.has("ArrowLeft")  || keys.has("KeyA");
  const right = keys.has("ArrowRight") || keys.has("KeyD");
  const lr = (right ? 1 : 0) - (left ? 1 : 0);
  if (lr !== 0) {
    player.vx += lr * ACCEL * dt;
    player.vx = Math.max(-MAX_HSP, Math.min(MAX_HSP, player.vx));
    player.dir = lr;
  } else if (player.onGround) {
    // скорость-зависимое трение: на полном разгоне инерция почти не гасится,
    // при остановке — чистое и быстрое торможение (как в классическом Icy Tower)
    const spd    = Math.abs(player.vx);
    const fScale = Math.max(0.08, 1 - (spd / MAX_HSP) * 0.92);
    const f      = FRICTION * fScale * dt;
    if (player.vx > 0) player.vx = Math.max(0, player.vx - f);
    else if (player.vx < 0) player.vx = Math.min(0, player.vx + f);
  }

  for (const k of keys) if (JUMP_KEYS.includes(k)) { tryJump(); keys.delete(k); }

  // ── ветер: горизонтальный дрейф, нарастает с высотой ──
  const windStrength = Math.min(1, topFloorReached / TOP_FLOOR);
  const windPush = Math.sin(time * 0.45) * 70 * windStrength;
  player.vx += windPush * dt;

  // ── физика ──
  player.vy -= GRAVITY * dt;
  player.x  += player.vx * dt;
  player.y  += player.vy * dt;

  if (!player.onGround) {
    player.rot += player.rotV * dt;
    const fullTurns = Math.floor(Math.abs(player.rot) / (Math.PI * 2));
    if (fullTurns > flipsThisJump) { flipsThisJump = fullTurns; addSparkle(); }
  }

  // световой след
  trail.push({ x: player.x + PLAYER_W / 2, y: player.y - PLAYER_H / 2, rot: player.rot });
  if (trail.length > 11) trail.shift();

  // ── стены: bounce ──
  if (player.x < 0) {
    player.x = 0; player.vx = -player.vx * WALL_BOUNCE_RETAIN;
    if (Math.abs(player.vx) > 80) { creak(); addBurst(2, player.y - PLAYER_H / 2, 5, 60, 0.5); }
  } else if (player.x + PLAYER_W > VW) {
    player.x = VW - PLAYER_W; player.vx = -player.vx * WALL_BOUNCE_RETAIN;
    if (Math.abs(player.vx) > 80) { creak(); addBurst(VW - 2, player.y - PLAYER_H / 2, 5, 60, 0.5); }
  }

  // ── платформы ──
  player.onGround = false;
  if (player.vy <= 0) {
    for (const p of platforms) {
      const pTop = p.y;
      const wasAbove = (player.y - player.vy * dt) >= pTop;
      const nowAt    = player.y <= pTop && player.y >= pTop - p.h - 4;
      const overlapX = player.x + PLAYER_W > p.x && player.x < p.x + p.w;
      if (overlapX && wasAbove && nowAt) {
        player.y = pTop; player.vy = 0; player.onGround = true;
        player.rot = 0; player.rotV = 0;
        onLand(p);
        break;
      }
    }
  }

  // ── сбор осколков света ──
  const pcx = player.x + PLAYER_W / 2, pcy = player.y - PLAYER_H / 2;
  for (const o of orbs) {
    if (o.taken) continue;
    const dx = o.x - pcx, dy = o.y - pcy;
    const rr = o.r + 14;
    if (dx * dx + dy * dy <= rr * rr) collectOrb(o);
  }

  // ── комбо-таймер ──
  if (combo.floors > 0) {
    combo.timer -= dt;
    if (combo.timer <= 0) endCombo();
  }

  // ── камера ──
  if (time > AUTO_SCROLL_DELAY) {
    const tt = time - AUTO_SCROLL_DELAY;
    autoScroll += (AUTO_SCROLL_BASE * (1 + tt * AUTO_SCROLL_RAMP)) * dt;
  }
  const followCam = Math.max(autoScroll, player.y - VH * (1 - CAM_PLAYER_FRAC));
  cameraY += (followCam - cameraY) * Math.min(1, CAM_FOLLOW_K * dt);

  // ── смерть ──
  if (player.y < cameraY - 30) {
    state = "lose";
    loseSub.textContent = topFloorReached === 0
      ? `ни одного этажа · ${score} очков`
      : `достигнут ${topFloorReached}-й этаж · ${score} очков`;
    loseOv.classList.add("show");
  }
}

function onLand(p) {
  const jumped = p.floor - prevFloor;
  const landPower = 40 + Math.min(120, Math.abs(player.vx) * 0.4);
  addBurst(player.x + PLAYER_W / 2, player.y, Math.min(20, 6 + jumped * 2), landPower, 0.7);
  shake = Math.min(7, shake + 1.2 + jumped * 0.6);

  // ── бонус за флипы ──
  if (flipsThisJump > 0) {
    const flipBonus = flipsThisJump * 30;
    score += flipBonus;
    pushBanner(`${flipsThisJump}× ВРАЩЕНИЕ +${flipBonus}`, 0.9, 1.05, 3.2);
  }
  flipsThisJump = 0;

  // ── точное приземление: по центру уступа (уже уступ → больше очков) ──
  if (!p.ground && jumped >= 1) {
    const landCx = player.x + PLAYER_W / 2;
    const off = Math.abs(landCx - (p.x + p.w / 2));
    if (off < Math.max(7, p.w * 0.16)) {
      perfectStreak++;
      perfectTimer = 4;
      const pf = 50 + perfectStreak * 25 + Math.max(0, Math.round(60 - p.w));
      score += pf;
      ensureAudio();
      chime(Math.min(30, 8 + perfectStreak * 3), 0.3);
      addBurst(landCx, player.y, 10, 90, 0.7);
      pushPopup(landCx, player.y + 14,
                perfectStreak >= 2 ? `ТОЧНО ×${perfectStreak} +${pf}` : `ТОЧНО +${pf}`, true);
      shake = Math.min(8, shake + 1.5);
    } else {
      perfectStreak = 0;
    }
  }

  if (jumped >= COMBO_MIN_JUMP) {
    combo.floors += jumped;
    combo.jumps  += 1;
    combo.timer   = COMBO_TIMEOUT;
    updateComboLabel();
  } else if (jumped <= 1 && combo.floors > 0) {
    endCombo();
  }

  if (p.floor > topFloorReached) {
    topFloorReached = p.floor;
    score += p.floor * 10;
    const stanza = MILESTONE_MAP.get(p.floor);
    if (stanza) { showStanza(stanza); triggerGlitch(); celebrateMilestone(p); }  // веха — строфа + салют
    else if (Math.random() < 0.1) triggerGlitch();          // редкие срывы между вехами
    updateHUD();
  }
  prevFloor = p.floor;

  if (jumped >= 2) thud(0.55 + Math.min(0.45, jumped * 0.08));
  if (p.floor === TOP_FLOOR) onWin();
}

function updateComboLabel() {
  let idx = -1;
  for (let i = COMBO_LABELS.length - 1; i >= 0; i--) {
    if (combo.floors >= COMBO_LABELS[i][0]) { idx = i; break; }
  }
  if (idx > combo.peakIdx) {
    combo.peakIdx = idx;
    const [, text] = COMBO_LABELS[idx];
    pushBanner(`⟨ ${text} ⟩`, 1.4, 1.4 + idx * 0.06, 3.5 + idx);
    if (idx >= 3) triggerGlitch();
  }
  updateHUD();
}

function endCombo() {
  if (combo.floors >= COMBO_MIN_JUMP) {
    const bonus = combo.floors * combo.floors * 5;
    score += bonus;
    if (combo.peakIdx >= 0) {
      const [, text] = COMBO_LABELS[combo.peakIdx];
      pushBanner(`⟨ ${text} ⟩ +${bonus}`, 1.0, 1.3, 4);
    }
  }
  combo = { floors: 0, jumps: 0, timer: 0, peakIdx: -1 };
  updateHUD();
}

function pushBanner(text, ttl, scale, split) {
  comboBanner = { text, ttl, scale, split, age: 0 };
}

// ── осколки: сбор, ценность ×серия, восходящий «дзинь» ─────────────────────
function collectOrb(o) {
  o.taken = true;
  orbsTaken++;
  orbStreak++;
  orbStreakTimer = 1.8;
  const mult   = 1 + (orbStreak - 1) * 0.2;       // подряд собранные множат ценность
  const gained = Math.round(o.value * mult);
  score += gained;
  if (combo.floors > 0) combo.timer = Math.max(combo.timer, 1.4);  // осколок освежает комбо
  ensureAudio();
  chime(Math.min(28, (orbStreak - 1) * 2 + (o.big ? 6 : 0)), o.big ? 0.34 : 0.24);
  addBurst(o.x, o.y, o.big ? 14 : 7, o.big ? 120 : 70, o.big ? 0.9 : 0.6);
  pushPopup(o.x, o.y, orbStreak >= 3 ? `+${gained} ×${orbStreak}` : `+${gained}`, o.big || orbStreak >= 3);
  if (orbEl) orbEl.textContent = `✦ ${orbsTaken}`;
}

// всплывающие очки в мировых координатах (всплывают вверх от точки события)
function pushPopup(x, y, text, big) {
  popups.push({ x, y, text, big: !!big, age: 0, ttl: 0.95 });
}
function updatePopups(dt) {
  for (let i = popups.length - 1; i >= 0; i--) {
    const p = popups[i];
    p.age += dt;
    if (p.age >= p.ttl) { popups.splice(i, 1); continue; }
    p.y += 36 * dt;     // мир-Y вверх = + → текст поднимается
  }
}

// салют на вехе: кольцо света + вспышка экрана + гул
function celebrateMilestone(p) {
  flashT = 1;
  shake = Math.min(10, shake + 4);
  rumble();
  const cx = p.x + p.w / 2;
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * 6.28, sp = 120 + Math.random() * 60;
    particles.push({ x: cx, y: p.y + 10, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
                     life: 0, max: 0.8 + Math.random() * 0.5, size: 1.5 + Math.random() * 2, grav: 60 });
  }
  pushPopup(cx, p.y + 40, `ЯРУС ${p.floor}`, true);
}

function triggerGlitch(word) {
  glitch = { word: word || GLITCH_WORDS[Math.floor(Math.random() * GLITCH_WORDS.length)],
             age: 0, ttl: 1.0 };
}

function onWin() {
  state = "win";
  endCombo();
  markDone("prizma");
  if (winName) winName.textContent = (getPlayerName() || "восходящий").toLowerCase();
  fetch(`${import.meta.env.BASE_URL}poems/prizma.txt`)
    .then(r => r.ok ? r.text() : "")
    .then(t => { winPoem.textContent = t || ""; });
  // финальный фейерверк света
  for (let i = 0; i < 5; i++) {
    setTimeout(() => addBurst(VW / 2 + (Math.random() * 2 - 1) * 80, player.y + 40, 24, 180, 1.2), i * 120);
  }
  setTimeout(() => winOv.classList.add("show"), 700);
}

// ── HUD ──────────────────────────────────────────────────────────────────
function updateHUD() {
  floorEl.textContent = String(topFloorReached);
  // очки докручиваются плавно в update(); здесь только осколки
  if (orbEl) orbEl.textContent = `✦ ${orbsTaken || 0}`;
  if (combo.floors >= COMBO_MIN_JUMP) {
    comboEl.textContent = `×${combo.floors}`;
    comboEl.classList.add("accent");
  } else {
    comboEl.textContent = "—";
    comboEl.classList.remove("accent");
  }
  const wi = Math.min(4, Math.floor((topFloorReached / TOP_FLOOR) * 5));
  if (windEl) windEl.textContent = "▮".repeat(wi + 1) + "▯".repeat(4 - wi) + " " + WIND_LABELS[wi];
}

let stanzaTimer = null;
function showStanza(text) {
  stanzaEl.textContent = text;
  stanzaEl.classList.add("show");
  clearTimeout(stanzaTimer);
  stanzaTimer = setTimeout(hideStanza, 4500);
}
function hideStanza() { stanzaEl.classList.remove("show"); }

// ── частицы / след / искры ────────────────────────────────────────────────
function addBurst(x, y, n, power, lifeScale) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.28, sp = 30 + Math.random() * power;
    particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp + 20,
                     life: 0, max: (0.35 + Math.random() * 0.5) * lifeScale,
                     size: 1 + Math.random() * 2, grav: 240 });
  }
}
function addSparkle() {
  const cx = player.x + PLAYER_W / 2, cy = player.y - PLAYER_H / 2;
  for (let i = 0; i < 4; i++) {
    const a = Math.random() * 6.28, sp = 20 + Math.random() * 50;
    particles.push({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
                     life: 0, max: 0.3 + Math.random() * 0.3, size: 1 + Math.random() * 1.5, grav: 40 });
  }
}
function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life += dt;
    if (p.life >= p.max) { particles.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt; p.vy -= p.grav * dt;
  }
}
function updateAmbient(dt) {
  const dir = Math.sign(Math.sin((time || 0) * 0.45)) || 1;
  const windStrength = Math.min(1, topFloorReached / TOP_FLOOR);
  for (const m of motes) {
    m.y -= m.sp * dt * 0.4;                      // медленный дрейф вниз по миру
    m.x += dir * windStrength * 14 * m.z * dt;
    m.tw += dt * 2;
    if (m.x < -4) m.x = VW + 4; else if (m.x > VW + 4) m.x = -4;
    if (m.y < -4) m.y = VH + 4; else if (m.y > VH + 4) m.y = -4;
  }
}

// ── render ─────────────────────────────────────────────────────────────────
function W2S(y) { return VH - (y - cameraY); }

// текст с призматическим расщеплением (caller задаёт font/align/alpha/transform)
function prismText(text, x, y, split) {
  if (split < 0.6) { ctx.fillStyle = CORE; ctx.fillText(text, x, y); return; }
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = GHOST_B; ctx.fillText(text, x - split, y);
  ctx.fillStyle = GHOST_C; ctx.fillText(text, x + split, y);
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = CORE;    ctx.fillText(text, x, y);
}

function drawShardBody(color, faceted) {
  const w = PLAYER_W / 2, h = PLAYER_H / 2;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -h);
  ctx.lineTo(w * 0.82, -h * 0.18);
  ctx.lineTo(w * 0.5, h);
  ctx.lineTo(-w * 0.5, h);
  ctx.lineTo(-w * 0.82, -h * 0.18);
  ctx.closePath();
  ctx.fill();
  if (faceted) {
    ctx.strokeStyle = "rgba(5,5,7,0.5)"; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -h); ctx.lineTo(0, h);
    ctx.moveTo(-w * 0.82, -h * 0.18); ctx.lineTo(w * 0.82, -h * 0.18);
    ctx.stroke();
  }
}

function drawPlayer() {
  const psy = W2S(player.y);
  const cx = player.x + PLAYER_W / 2, cy = psy - PLAYER_H / 2;

  // световой след
  for (let i = 0; i < trail.length; i++) {
    const tp = trail[i];
    const a = (i / trail.length) * 0.32;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(tp.x, W2S(tp.y));
    ctx.rotate(tp.rot);
    ctx.scale(0.7 + i / trail.length * 0.3, 0.7 + i / trail.length * 0.3);
    drawShardBody("rgba(170,190,255,1)", false);
    ctx.restore();
  }

  // ореол
  const glow = ctx.createRadialGradient(cx, cy, 1, cx, cy, 22);
  glow.addColorStop(0, "rgba(190,205,255,0.45)");
  glow.addColorStop(1, "rgba(190,205,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(cx - 24, cy - 24, 48, 48);

  // призматическое расщепление по скорости и высоте
  const split = Math.min(7, Math.abs(player.vx) / MAX_HSP * 5 + (topFloorReached / TOP_FLOOR) * 3);
  const draw = (ox, color, comp, faceted) => {
    ctx.save();
    ctx.globalCompositeOperation = comp;
    ctx.translate(cx + ox, cy);
    ctx.rotate(player.rot);
    drawShardBody(color, faceted);
    ctx.restore();
  };
  if (split < 0.6) {
    draw(0, CORE, "source-over", true);
  } else {
    draw(-split, GHOST_B, "lighter", false);
    draw(+split, GHOST_C, "lighter", false);
    draw(0, CORE, "source-over", true);
  }
}

function drawBgPagoda(cx, baseY, scale, tiers, bright) {
  ctx.strokeStyle = `rgba(175,190,235,${bright})`;
  ctx.fillStyle   = `rgba(120,140,205,${bright * 0.45})`;
  ctx.lineWidth = 1;
  let w = 58 * scale, y = baseY;
  const th = 15 * scale;
  for (let t = 0; t < tiers; t++) {
    const topW = w * 0.72;
    ctx.beginPath();
    ctx.moveTo(cx - w / 2, y);
    ctx.lineTo(cx - topW / 2, y - th);
    ctx.lineTo(cx + topW / 2, y - th);
    ctx.lineTo(cx + w / 2, y);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // карниз
    ctx.beginPath();
    ctx.moveTo(cx - w / 2 - 4 * scale, y);
    ctx.lineTo(cx, y - th * 0.45);
    ctx.lineTo(cx + w / 2 + 4 * scale, y);
    ctx.stroke();
    y -= th + 3 * scale;
    w = topW;
  }
  ctx.beginPath(); ctx.moveTo(cx, y); ctx.lineTo(cx, y - 9 * scale); ctx.stroke();
}

function drawPagodaTier(p, sy) {
  const cx = p.x + p.w / 2;
  // свечение под ярусом
  const glow = ctx.createRadialGradient(cx, sy, 2, cx, sy, p.w);
  glow.addColorStop(0, "rgba(180,200,255,0.20)");
  glow.addColorStop(1, "rgba(180,200,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(cx - p.w, sy - p.w * 0.55, p.w * 2, p.w * 1.1);

  // плита-ярус
  const grd = ctx.createLinearGradient(0, sy, 0, sy + p.h);
  grd.addColorStop(0, "rgba(234,240,255,0.95)");
  grd.addColorStop(1, "rgba(200,212,245,0.55)");
  ctx.fillStyle = grd;
  ctx.fillRect(p.x, sy, p.w, p.h);

  // фасеточные торцы (кристалл)
  ctx.fillStyle = "rgba(234,240,255,0.9)";
  ctx.beginPath(); ctx.moveTo(p.x, sy); ctx.lineTo(p.x - 6, sy + p.h / 2); ctx.lineTo(p.x, sy + p.h); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(p.x + p.w, sy); ctx.lineTo(p.x + p.w + 6, sy + p.h / 2); ctx.lineTo(p.x + p.w, sy + p.h); ctx.closePath(); ctx.fill();

  // крыша-пагода: два карниза + шпиль
  ctx.strokeStyle = "rgba(234,240,255,0.5)";
  ctx.lineWidth = 1;
  for (let r = 0; r < 2; r++) {
    const ry = sy - 9 - r * 9;
    const ext = 9 - r * 4;
    ctx.beginPath();
    ctx.moveTo(p.x - ext, sy - r * 9);
    ctx.lineTo(cx, ry);
    ctx.lineTo(p.x + p.w + ext, sy - r * 9);
    ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(cx, sy - 27); ctx.lineTo(cx, sy - 34); ctx.stroke();

  // номер этажа в нише
  ctx.fillStyle = "#050507";
  ctx.font = "bold 9px 'JetBrains Mono', monospace";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(String(p.floor), cx, sy + p.h / 2 + 0.5);
}

function drawPlatform(p) {
  const sy = W2S(p.y);
  if (sy < -50 || sy > VH + 60) return;

  if (p.ground) {
    ctx.fillStyle = "rgba(232,236,245,0.14)";
    ctx.fillRect(p.x, sy, p.w, p.h);
    ctx.strokeStyle = "rgba(232,236,245,0.22)";
    ctx.lineWidth = 1;
    for (let gx = p.x + 8; gx < p.x + p.w; gx += 15) {
      ctx.beginPath(); ctx.moveTo(gx, sy); ctx.lineTo(gx - 7, sy + p.h); ctx.stroke();
    }
  } else if (p.milestone) {
    drawPagodaTier(p, sy);
  } else {
    const grd = ctx.createLinearGradient(0, sy - 1, 0, sy + p.h);
    grd.addColorStop(0, "rgba(232,236,245,0.62)");
    grd.addColorStop(1, "rgba(232,236,245,0.12)");
    ctx.fillStyle = grd;
    ctx.fillRect(p.x, sy, p.w, p.h);
    ctx.fillStyle = "rgba(234,240,255,0.85)";
    ctx.beginPath(); ctx.moveTo(p.x, sy); ctx.lineTo(p.x - 5, sy + p.h / 2); ctx.lineTo(p.x, sy + p.h); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(p.x + p.w, sy); ctx.lineTo(p.x + p.w + 5, sy + p.h / 2); ctx.lineTo(p.x + p.w, sy + p.h); ctx.closePath(); ctx.fill();
  }
}

// ── осколки света: пульсирующий призматический ромб + ореол ───────────────
function drawDiamond(cx, cy, r, color, comp) {
  ctx.save();
  ctx.globalCompositeOperation = comp;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx + r * 0.7, cy);
  ctx.lineTo(cx, cy + r);
  ctx.lineTo(cx - r * 0.7, cy);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
function drawOrbs() {
  for (const o of orbs) {
    if (o.taken) continue;
    const baseY = W2S(o.y);
    if (baseY < -20 || baseY > VH + 20) continue;
    const y = baseY + Math.sin(time * 2.2 + o.ph) * 3;          // покачивание
    const pulse = 0.6 + 0.4 * Math.sin(time * 4 + o.ph);
    const R = o.r;
    const glow = ctx.createRadialGradient(o.x, y, 1, o.x, y, R * 3.2);
    glow.addColorStop(0, `rgba(190,210,255,${0.32 * pulse})`);
    glow.addColorStop(1, "rgba(190,210,255,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(o.x - R * 3.2, y - R * 3.2, R * 6.4, R * 6.4);
    const split = 1.4 + pulse * 1.6;
    drawDiamond(o.x - split, y, R, GHOST_B, "lighter");
    drawDiamond(o.x + split, y, R, GHOST_C, "lighter");
    drawDiamond(o.x, y, R, CORE, "source-over");
  }
}
function drawPopups() {
  for (const p of popups) {
    const t = p.age / p.ttl;
    const a = t < 0.12 ? t / 0.12 : 1 - (t - 0.12) / 0.88;
    const sy = W2S(p.y);
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, a));
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    if (p.big) {
      ctx.font = "800 13px 'JetBrains Mono', monospace";
      prismText(p.text, p.x, sy, 2.2);
    } else {
      ctx.font = "700 11px 'JetBrains Mono', monospace";
      ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillText(p.text, p.x + 1, sy + 1);
      ctx.fillStyle = CORE;              ctx.fillText(p.text, p.x, sy);
    }
    ctx.restore();
  }
}

function render() {
  // ── фон: глубокий холодный градиент ──
  const bg = ctx.createLinearGradient(0, 0, 0, VH);
  bg.addColorStop(0, "#070710");
  bg.addColorStop(0.55, "#050509");
  bg.addColorStop(1, "#04040a");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, VW, VH);

  // ── шахты призменного света ──
  for (const s of shafts) {
    const x = s.x + Math.sin(time * s.sp + s.ph) * 18;
    const g = ctx.createLinearGradient(x, 0, x, VH);
    g.addColorStop(0, "rgba(150,172,235,0.055)");
    g.addColorStop(0.5, "rgba(150,172,235,0.018)");
    g.addColorStop(1, "rgba(150,172,235,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - s.w / 2, 0, s.w, VH);
  }

  // ── дальние пагоды (параллакс) ──
  for (const pg of bgPagodas) {
    const screenY = VH - (pg.y - cameraY * pg.depth);
    if (screenY < -220 || screenY > VH + 220) continue;
    drawBgPagoda(pg.x, screenY, pg.scale, pg.tiers, pg.bright);
  }

  // ── парящие пылинки ──
  for (const m of motes) {
    const a = (0.06 + 0.12 * m.z) * (0.6 + 0.4 * Math.sin(m.tw));
    ctx.fillStyle = `rgba(210,222,255,${a})`;
    const sz = m.z < 0.5 ? 1 : 2;
    ctx.fillRect(m.x, m.y, sz, sz);
  }

  // ── ветровые полосы (по высоте) ──
  const windStrength = Math.min(1, topFloorReached / TOP_FLOOR);
  if (windStrength > 0.02) {
    const dir = Math.sign(Math.sin(time * 0.45)) || 1;
    ctx.strokeStyle = `rgba(232,236,245,${0.04 + windStrength * 0.20})`;
    for (const s of windStreaks) {
      const x = ((s.ph + time * s.spd * dir) % (VW + 120)) - 60;
      ctx.lineWidth = s.w;
      ctx.beginPath(); ctx.moveTo(x, s.y); ctx.lineTo(x + s.len * dir, s.y); ctx.stroke();
    }
  }

  // ── тряска применяется к мировым слоям ──
  const shx = shake > 0 ? (Math.random() * 2 - 1) * shake : 0;
  const shy = shake > 0 ? (Math.random() * 2 - 1) * shake : 0;
  ctx.save();
  ctx.translate(shx, shy);

  // линия автопрокрутки — сигнальный красный
  if (time > AUTO_SCROLL_DELAY && state === "play") {
    const danger = (player.y - cameraY) < VH * 0.25;
    ctx.fillStyle = danger ? "rgba(217,106,106,0.6)" : "rgba(217,106,106,0.18)";
    ctx.fillRect(0, VH - 2, VW, 2);
    if (danger) {
      ctx.fillStyle = `rgba(217,106,106,${0.10 + 0.10 * Math.sin(time * 12)})`;
      ctx.fillRect(0, VH - 40, VW, 40);
    }
  }

  // платформы
  for (const p of platforms) drawPlatform(p);

  // осколки света
  drawOrbs();

  // частицы (мировые)
  for (const p of particles) {
    const a = 1 - p.life / p.max;
    ctx.fillStyle = `rgba(232,238,255,${a * 0.9})`;
    const sy = W2S(p.y);
    ctx.fillRect(p.x - p.size / 2, sy - p.size / 2, p.size, p.size);
  }

  // игрок
  if (state !== "win" || time < 1) drawPlayer();

  // всплывающие очки (мировые)
  drawPopups();

  ctx.restore(); // конец тряски

  // ── вспышка вехи (полноэкранная, поверх сцены) ──
  if (flashT > 0) {
    ctx.save();
    ctx.globalAlpha = flashT * 0.5;
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = "rgba(150,180,255,0.6)";
    ctx.fillRect(0, 0, VW, VH);
    ctx.restore();
  }

  // ── баннер комбо ──
  if (comboBanner) {
    const b = comboBanner;
    const t = b.age / b.ttl;
    const ease = t < 0.18 ? t / 0.18 : 1;
    const fade = t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1;
    const scl  = b.scale * (0.7 + 0.4 * ease);
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.translate(VW / 2, VH * 0.4 + (1 - ease) * 18);
    ctx.scale(scl, scl);
    ctx.font = "800 22px 'JetBrains Mono', monospace";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    prismText(b.text, 0, 0, b.split * (0.6 + 0.6 * ease));
    ctx.restore();
  }

  // ── глитч-слово стиха ──
  if (glitch) {
    const t = glitch.age / glitch.ttl;
    const fade = t < 0.15 ? t / 0.15 : (t > 0.65 ? 1 - (t - 0.65) / 0.35 : 1);
    const jitter = Math.sin(glitch.age * 47) * 2;
    const split = 5 + Math.abs(Math.sin(glitch.age * 30)) * 6;
    ctx.save();
    ctx.globalAlpha = fade * 0.92;
    ctx.font = "900 30px 'JetBrains Mono', monospace";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    prismText(`〔${glitch.word}〕`, VW / 2 + jitter, VH * 0.3, split);
    // строчные срезы-разрывы
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = "rgba(150,180,255,0.10)";
    for (let i = 0; i < 3; i++) {
      const yy = VH * 0.3 - 16 + Math.random() * 32;
      ctx.fillRect(VW / 2 - 90, yy, 180, 1);
    }
    ctx.restore();
  }

  // ── подсказка на старте ──
  if (topFloorReached === 0 && time < 4.5 && state === "play") {
    ctx.fillStyle = `rgba(232,236,245,${0.32 + 0.12 * Math.sin(time * 3)})`;
    ctx.font = "9px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText("← → разбег · ПРОБЕЛ прыжок · ✦ собирай · скип = комбо", VW / 2, VH - 18);
  }
}

// ── главный цикл ────────────────────────────────────────────────────────
let prev = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - prev) / 1000);
  prev = now;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

// ── старт ──────────────────────────────────────────────────────────────────
if (!showCompleted("prizma", "призма")) {
  fitCanvas();
  reset();
  requestAnimationFrame(loop);
}

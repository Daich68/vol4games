// ПРИЗМА — Icy Tower по стиху Данилы Кудимова «Призматическая пагода».
// Игрок прыгает вверх по этажам пагоды; высота прыжка зависит от скорости бега.
// Стены отражают, импульс сохраняется. Цель — добраться до 13-го этажа.
// На каждом нечётном этаже всплывает строфа стиха. Ветер усиливается с высотой.
import "../../shared/type.css";
import { bindBackLink, markDone, backToMap, showCompleted } from "../../shared/nav.js";
import { ensureAudio, thud, creak } from "../../shared/audio.js";

bindBackLink();

// ── DOM ────────────────────────────────────────────────────────────────────
const canvas   = document.getElementById("c");
const ctx      = canvas.getContext("2d");
const floorEl  = document.getElementById("floor");
const windEl   = document.getElementById("wind-val");
const stanzaEl = document.getElementById("stanza");
const winOv    = document.getElementById("winOverlay");
const winPoem  = document.getElementById("winPoem");
const loseOv   = document.getElementById("loseOverlay");
const loseSub  = document.getElementById("loseSub");
const windLay  = document.getElementById("wind");

// ── константы мира ─────────────────────────────────────────────────────────
const VW = 360, VH = 640;          // виртуальный размер сцены
const TOP_FLOOR  = 13;
const FLOOR_GAP  = 78;             // расстояние между этажами по Y
const GROUND_Y   = 70;             // мир-Y нулевого «пола»

const PLAYER_W = 14, PLAYER_H = 22;

// физика (мир-Y вверх = +)
const GRAVITY   = 1900;
const ACCEL     = 1900;
const FRICTION  = 1400;
const MAX_HSP   = 360;
const JUMP_BASE = 620;
const JUMP_BONUS_PER_SPEED = 0.55;
const WALL_BOUNCE_RETAIN   = 0.78;

// камера
const CAM_PLAYER_FRAC = 0.55;      // игрок держится на 55% от низа viewport
const CAM_FOLLOW_K    = 6.0;       // скорость лерпа камеры

// ── canvas DPR fit ────────────────────────────────────────────────────────
function fitCanvas() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.clientWidth, h = canvas.clientHeight;
  canvas.width  = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  const sx = w / VW, sy = h / VH;
  const s  = Math.min(sx, sy);
  // центрируем виртуальное поле внутри канваса
  const ox = (w - VW * s) / 2;
  const oy = (h - VH * s) / 2;
  ctx.setTransform(s * dpr, 0, 0, s * dpr, ox * dpr, oy * dpr);
}
window.addEventListener("resize", fitCanvas);

// ── строфы стиха по этажам ─────────────────────────────────────────────────
const STANZAS = {
  1:  "первый этаж. один монах,\nодно священное писание.",
  3:  "три монаха, три сутры.\nкогда дует ветер — шумит.",
  5:  "пять монахов, пять сутр.\nпять золотых подвесок, двадцать таэлей.",
  7:  "семь высоких столов с двадцатью восемью ножками.\nсемь золотых подвесок.",
  9:  "девять монахов, девять писаний.\nдевять цимбал и девять курантов.",
  11: "одиннадцать монахов. одиннадцать сутр.\n⟨ветер⟩ дует.",
  13: "тринадцать этажей на вершине.\nпагода сокровищ ведёт обратный отсчёт.",
};
const WIND_LABELS = ["тихо", "шумит", "громко", "сильнее", "буря"];

// ── состояние ──────────────────────────────────────────────────────────────
let player, platforms, cameraY, prevFloor, topFloorReached;
let keys, state, time, lastStanzaFloor;

function buildTower() {
  platforms = [];
  // ground
  platforms.push({ x: 0, y: GROUND_Y, w: VW, h: 8, floor: 0, milestone: true, ground: true });
  // floors 1..13
  let prevX = VW / 2;
  for (let f = 1; f <= TOP_FLOOR; f++) {
    const odd = f % 2 === 1;
    const w   = odd ? (130 - f * 3) : 70;   // нечётные — шире (этажи-вехи)
    const yW  = GROUND_Y + f * FLOOR_GAP;
    // вешаем по разные стороны от предыдущей, чтобы заставлять разгоняться
    let x;
    const side = (f % 2 === 0) ? -1 : 1;
    x = Math.max(20, Math.min(VW - 20 - w,
      prevX + side * (60 + Math.random() * 80) - w/2));
    platforms.push({ x, y: yW, w, h: 7, floor: f, milestone: odd, ground: false });
    prevX = x + w/2;
  }
}

function reset() {
  player = {
    x: VW / 2 - PLAYER_W/2,
    y: GROUND_Y,
    vx: 0, vy: 0,
    onGround: true,
    dir: 1,
  };
  cameraY = 0;
  prevFloor = 0;
  topFloorReached = 0;
  state = "play";
  time = 0;
  lastStanzaFloor = -1;
  keys = new Set();
  updateFloor();
  updateWind();
  hideStanza();
  winOv.classList.remove("show");
  loseOv.classList.remove("show");
  buildTower();
  rebuildWindStreaks();
}

// ── ввод ───────────────────────────────────────────────────────────────────
const LEFT_KEYS  = new Set(["ArrowLeft",  "KeyA"]);
const RIGHT_KEYS = new Set(["ArrowRight", "KeyD"]);
const JUMP_KEYS  = new Set(["Space", "ArrowUp", "KeyW"]);

addEventListener("keydown", e => {
  ensureAudio();
  if (e.code === "Escape") { backToMap(); return; }
  if (LEFT_KEYS.has(e.code) || RIGHT_KEYS.has(e.code) || JUMP_KEYS.has(e.code)) {
    keys.add(e.code);
    e.preventDefault();
  }
  if (e.code === "Enter" && (state === "win" || state === "lose")) reset();
});
addEventListener("keyup", e => { keys.delete(e.code); });

for (const b of document.querySelectorAll('[data-action="restart"]')) {
  b.addEventListener("click", () => reset());
}

// ── update ─────────────────────────────────────────────────────────────────
function tryJump() {
  if (!player.onGround) return;
  // высота прыжка зависит от модуля скорости (как Icy Tower)
  const sp = Math.abs(player.vx);
  player.vy = JUMP_BASE + sp * JUMP_BONUS_PER_SPEED;
  player.onGround = false;
  thud(0.4 + Math.min(0.6, sp / MAX_HSP * 0.6));
}

function update(dt) {
  if (state !== "play") return;
  time += dt;

  // ── ввод → горизонтальная скорость ──
  const left  = LEFT_KEYS.has("ArrowLeft")  && keys.has("ArrowLeft")  || keys.has("KeyA");
  const right = RIGHT_KEYS.has("ArrowRight") && keys.has("ArrowRight") || keys.has("KeyD");
  const lr = (right ? 1 : 0) - (left ? 1 : 0);

  if (lr !== 0) {
    player.vx += lr * ACCEL * dt;
    player.vx = Math.max(-MAX_HSP, Math.min(MAX_HSP, player.vx));
    player.dir = lr;
  } else {
    const f = FRICTION * dt;
    if (player.vx > 0) player.vx = Math.max(0, player.vx - f);
    else if (player.vx < 0) player.vx = Math.min(0, player.vx + f);
  }

  // прыжок (по нажатию)
  for (const k of keys) if (JUMP_KEYS.has(k)) { tryJump(); keys.delete(k); }

  // ── ветер: горизонтальный дрейф, нарастает с высотой ──
  const windStrength = Math.min(1, topFloorReached / 13);
  const windPush = Math.sin(time * 0.45) * 60 * windStrength;
  player.vx += windPush * dt;

  // ── гравитация и движение ──
  player.vy -= GRAVITY * dt;
  player.x  += player.vx * dt;
  player.y  += player.vy * dt;

  // ── стены: bounce с сохранением части импульса ──
  if (player.x < 0) {
    player.x = 0;
    player.vx = -player.vx * WALL_BOUNCE_RETAIN;
    if (Math.abs(player.vx) > 80) creak();
  } else if (player.x + PLAYER_W > VW) {
    player.x = VW - PLAYER_W;
    player.vx = -player.vx * WALL_BOUNCE_RETAIN;
    if (Math.abs(player.vx) > 80) creak();
  }

  // ── платформы: только при падении (vy <= 0) ──
  player.onGround = false;
  if (player.vy <= 0) {
    for (const p of platforms) {
      const pTop    = p.y;          // мир-Y верхней грани
      const pBottom = p.y - p.h;
      // игрок проходит сквозь платформу сверху вниз?
      const wasAbove = (player.y - player.vy * dt) >= pTop;
      const nowAt    = player.y <= pTop && player.y >= pBottom - 4;
      const overlapX = player.x + PLAYER_W > p.x && player.x < p.x + p.w;
      if (overlapX && wasAbove && nowAt) {
        player.y = pTop;
        player.vy = 0;
        player.onGround = true;
        onLand(p);
        break;
      }
    }
  }

  // ── камера: следит за игроком ──
  const targetCam = Math.max(0, player.y - VH * (1 - CAM_PLAYER_FRAC));
  cameraY += (targetCam - cameraY) * Math.min(1, CAM_FOLLOW_K * dt);

  // ── смерть: упал ниже камеры ──
  if (player.y < cameraY - 30) {
    state = "lose";
    loseSub.textContent = topFloorReached === 0
      ? "ни одного этажа не пройдено"
      : `достигнут ${topFloorReached}-й этаж`;
    loseOv.classList.add("show");
  }
}

function onLand(p) {
  if (p.floor > prevFloor) {
    const jumped = p.floor - prevFloor;
    prevFloor = p.floor;
    if (p.floor > topFloorReached) {
      topFloorReached = p.floor;
      updateFloor();
      updateWind();
      // строфа на нечётных этажах
      if (STANZAS[p.floor]) showStanza(STANZAS[p.floor]);
    }
    if (jumped >= 2) thud(0.5 + jumped * 0.1); // больший удар при перескоке этажей
    if (p.floor === TOP_FLOOR) onWin();
  } else if (p.floor < prevFloor) {
    prevFloor = p.floor;
  }
}

function onWin() {
  state = "win";
  markDone("prizma");
  fetch(`${import.meta.env.BASE_URL}poems/prizma.txt`)
    .then(r => r.ok ? r.text() : "")
    .then(t => { winPoem.textContent = t || ""; });
  setTimeout(() => winOv.classList.add("show"), 400);
}

// ── HUD ────────────────────────────────────────────────────────────────────
function updateFloor() { floorEl.textContent = String(topFloorReached); }
function updateWind() {
  const idx = Math.min(4, Math.floor(topFloorReached / 3));
  windEl.textContent = WIND_LABELS[idx];
  // визуально регулируем плотность ветровых полос
  windLay.style.opacity = String(0.15 + idx * 0.18);
}

let stanzaTimer = null;
function showStanza(text) {
  stanzaEl.textContent = text;
  stanzaEl.classList.add("show");
  clearTimeout(stanzaTimer);
  stanzaTimer = setTimeout(hideStanza, 4500);
}
function hideStanza() { stanzaEl.classList.remove("show"); }

// ── ветровые полосы (DOM-слой) ─────────────────────────────────────────────
function rebuildWindStreaks() {
  windLay.innerHTML = "";
  for (let i = 0; i < 14; i++) {
    const s = document.createElement("div");
    const top = Math.random() * 100;
    const dur = 1.4 + Math.random() * 2.2;
    const del = Math.random() * 3;
    s.style.cssText = `
      position:absolute;left:-30%;top:${top}%;
      width:30%;height:1px;
      background:linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent);
      animation: wind-blow ${dur}s linear ${del}s infinite;
    `;
    windLay.appendChild(s);
  }
}
// keyframes (внедряем 1 раз)
const styleEl = document.createElement("style");
styleEl.textContent = `@keyframes wind-blow { from { transform: translateX(0); } to { transform: translateX(400%); } }`;
document.head.appendChild(styleEl);

// ── render ─────────────────────────────────────────────────────────────────
// преобразование: world-Y → screen-Y. cameraY — низ окна в мире.
function W2S(y) { return VH - (y - cameraY); }

function render() {
  // фон: вертикальный градиент темнее у горизонта
  ctx.fillStyle = "#040408";
  ctx.fillRect(0, 0, VW, VH);

  // тонкие звёзды/искры
  const stars = 24;
  for (let i = 0; i < stars; i++) {
    const sx = ((i * 37) % VW);
    const sy = ((i * 71 + time * 4) % VH);
    ctx.fillStyle = `rgba(255,255,255,${0.05 + (i % 5) * 0.02})`;
    ctx.fillRect(sx, sy, 1, 1);
  }

  // далёкие силуэты пагоды по бокам (декоративные)
  ctx.fillStyle = "rgba(20,16,28,0.7)";
  for (let i = 0; i < 6; i++) {
    const wy = i * FLOOR_GAP - cameraY;
    if (wy < -20 || wy > VH + 20) continue;
    // крыши (треугольники)
    ctx.beginPath();
    ctx.moveTo(8,  VH - wy - 16);
    ctx.lineTo(40, VH - wy - 28);
    ctx.lineTo(72, VH - wy - 16);
    ctx.closePath();
    ctx.fill();
  }

  // платформы
  for (const p of platforms) {
    const sy = W2S(p.y);
    if (sy < -20 || sy > VH + 40) continue;

    // этаж
    if (p.milestone && !p.ground) {
      // нечётный — золотой
      ctx.fillStyle = "rgba(240,216,168,0.92)";
      ctx.fillRect(p.x, sy, p.w, p.h);
      // тонкая верхняя полоска ярче
      ctx.fillStyle = "rgba(255,235,180,0.6)";
      ctx.fillRect(p.x, sy - 1, p.w, 1);
      // ярус-метка крыши пагоды над платформой (для milestone)
      ctx.strokeStyle = "rgba(240,216,168,0.45)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p.x - 6, sy);
      ctx.lineTo(p.x + p.w / 2, sy - 14);
      ctx.lineTo(p.x + p.w + 6, sy);
      ctx.stroke();
      // номер этажа
      ctx.fillStyle = "#040408";
      ctx.font = "bold 9px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(p.floor), p.x + p.w / 2, sy + p.h / 2 + 0.5);
    } else if (p.ground) {
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.fillRect(p.x, sy, p.w, p.h);
    } else {
      // помощник — узкий белый
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.fillRect(p.x, sy, p.w, p.h);
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.font = "8px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(p.floor), p.x + p.w / 2, sy + p.h / 2 + 0.5);
    }
  }

  // игрок
  const psy = W2S(player.y);
  ctx.fillStyle = "#f0d8a8";
  // тело: «人» — простая стилизация
  ctx.fillRect(player.x, psy - PLAYER_H, PLAYER_W, PLAYER_H);
  ctx.fillStyle = "#040408";
  // глаза/полоска
  ctx.fillRect(player.x + 3, psy - PLAYER_H + 6, 2, 2);
  ctx.fillRect(player.x + PLAYER_W - 5, psy - PLAYER_H + 6, 2, 2);
  // пояс
  ctx.fillRect(player.x, psy - PLAYER_H * 0.5, PLAYER_W, 1);

  // HUD-подсказка на старте
  if (topFloorReached === 0 && time < 3) {
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "9px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText("Беги и прыгай — высота от разгона", VW / 2, VH - 16);
  }
}

// ── главный цикл ──────────────────────────────────────────────────────────
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

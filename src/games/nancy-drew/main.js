// НЭНСИ ДРЮ — hidden object по стиху Милены Степанян «Все Смерти Нэнси Дрю».
//
// Одна цельная сцена — старый «теневой короб» детектива: пожелтевшая карта,
// латунные ключи, замок, кинжал, карты, конверт, лупа… Предметы написаны
// процедурным вектором (металл/кость/бумага с направленным светом и
// контактными тенями) и НАМЕРЕННО тонут в общем хламе — их надо высматривать.
//
// Механика (по тех-заданию): улики появляются по одной снизу сцены; кликни
// верный предмет — в блокнот вписывается часть стиха. Шесть улик → шесть
// частей, седьмая (дневник) открывается в финале. «?» в углу — подсказка.
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
const caseNoEl  = document.getElementById("caseNo");
const noteEl    = document.getElementById("notebook");
const hintBtn   = document.getElementById("hintBtn");
const winOv     = document.getElementById("winOverlay");
const winPoem   = document.getElementById("winPoem");
const winStats  = document.getElementById("winStats");

// ── сцена ──────────────────────────────────────────────────────────────────
const VW = 360, VH = 440;
let scale = 1, offX = 0, offY = 0;

function fitCanvas() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.clientWidth, h = canvas.clientHeight;
  canvas.width  = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  const s  = Math.min(w / VW, h / VH);
  const ox = (w - VW * s) / 2;
  const oy = (h - VH * s) / 2;
  ctx.setTransform(s * dpr, 0, 0, s * dpr, ox * dpr, oy * dpr);
  scale = s; offX = ox; offY = oy;
}
window.addEventListener("resize", () => { fitCanvas(); });

// офскрин-кэш статичной сцены (фон + предметы); пересобираем только при находке
const SS = 2;
const oc  = document.createElement("canvas");
oc.width  = VW * SS; oc.height = VH * SS;
const octx = oc.getContext("2d");

// ── улики и привязка к частям стиха ─────────────────────────────────────────
// порядок: яблоко → часть 1 (про яблоки/клыки), … плутон → часть 6 (про Плутон)
const RIDDLES = [
  { answer: "apple", label: "яблоко", part: 0,
    text: "В глазнице — если повезёт,\nбывает, висит в небе на рассвете,\nа третье стукнется о лоб,\nкогда решишь ты отдохнуть под древом." },
  { answer: "fang", label: "клык", part: 1,
    text: "Он рыка друг, охранник языка,\nдля мягкой плоти он как нож опасен.\nБелесый царь улыбки; брат клинка,\nкогда вампир и зверь проголодались." },
  { answer: "key", label: "ключ", part: 2,
    text: "Им бьёт вода. О нём мечтает вор,\nзапутавшись в ворованных отмычках.\nОтвет на все загадки — тоже он\n(для этой точно ты другого не отыщешь)." },
  { answer: "lupa", label: "лупа", part: 3,
    text: "Аксессуар для детектива из стекла,\nс ним бабушки читают, вышивают,\nбожественную кару муравья\nв мультфильмах им же совершают." },
  { answer: "queen", label: "дама пик", part: 4,
    text: "Скажи её имя три раза,\nлюбовно запрячь в рукаве.\nВалет, король, туз и шестёрка —\nкого не хватило тебе?" },
  { answer: "pluto", label: "плутон", part: 5,
    text: "Недр подземного царства ему не хватило —\nон добрался до звёздных высот.\nОко бога и римское позднее имя\nозирают ночью твой сон." },
];

// семь частей стиха (шесть улик + дневник). Заполняют блокнот по мере находок.
const POEM_PARTS = [
  "Большая тема, до глаз не дотронуться;\nсколько в лесах опасности, сколько живых.\nНа яблоках следы твоей обуви,\nпод ногтями — на клыках помады.",
  "Самый высокий этаж — под землёй,\nотказ зеркал, клубок дочерей.",
  "Побочная информация совместного смеха.\nБеспечность привела к гибели детектива.",
  "Ты только посмотри, что пчёлы с тобой сделали.\nУлей на висельничном дереве, подарок брату.",
  "Красный огонь, чёрная ночь, вернись, Шарлотта.\n**Кашель** **Голос** **Вой собак**.",
  "Я знала, что нельзя упускать её из виду.\nОбнаружена девятая планета. Её назвали Плутон.",
  "Дневник убийцы читать интересней:\n«На моё имя снова пришёл странный конверт.\nТёмная фотография Сибиллиного надгробия;\nобрезки неотличимых волос; уродливое чучело…»",
];

// ── расстановка предметов (теневой короб, как в референсе) ──────────────────
// kind — что рисуем; hw/hh — половина хит-бокса; rot/scale — разброс.
// порядок = слои: ранние рисуются ПОД поздними; искомые кладём выше соседей,
// чтобы клик всегда их ловил. Предметы намеренно жмутся и перекрываются.
const ITEMS = [
  // — задний хлам —
  { id:"spider", kind:"spider",  x:300, y: 88, rot: 0,    s:0.8 },
  { id:"ringD",  kind:"ring",    x:306, y: 78, rot: 0,    s:0.82 },
  { id:"vial",   kind:"vial",    x:108, y:150, rot:-0.10, s:0.9 },
  { id:"thimble",kind:"thimble", x: 44, y:230, rot: 0,    s:0.9 },
  { id:"skull",  kind:"skull",   x: 56, y:158, rot:-0.05, s:1.0 },
  { id:"pencil", kind:"pencil",  x:336, y:150, rot: 1.5,  s:1.0 },
  { id:"beads",  kind:"beads",   x:242, y:204, rot: 0.2,  s:1.0 },
  { id:"padlock",kind:"padlock", x:180, y:182, rot: 0,    s:1.05 },
  { id:"env",    kind:"env",     x:262, y:258, rot:-0.06, s:1.05 },
  { id:"compass",kind:"compass", x:300, y:318, rot: 0,    s:0.95 },
  { id:"star",   kind:"star",    x:322, y:300, rot: 0.2,  s:0.85 },
  { id:"candle", kind:"candle",  x: 36, y:330, rot: 0,    s:0.9 },
  { id:"nail",   kind:"nail",    x:288, y:352, rot: 0.8,  s:0.85 },
  // — средний слой: карты, кости, монеты, кинжал —
  { id:"card2",  kind:"card",    x: 58, y:252, rot:-0.35, s:0.95, v:"hearts" },
  { id:"card3",  kind:"card",    x:120, y:336, rot: 0.25, s:0.92, v:"diam" },
  { id:"die",    kind:"die",     x:176, y:300, rot: 0.1,  s:0.95 },
  { id:"die2",   kind:"die",     x:206, y:322, rot: 0.4,  s:0.82 },
  { id:"coin",   kind:"coin",    x:150, y:330, rot: 0,    s:0.9 },
  { id:"coin2",  kind:"coin",    x:226, y:300, rot: 0,    s:0.8 },
  { id:"dagger", kind:"dagger",  x:140, y:248, rot: 0.5,  s:1.0 },
  // — висящие ключи (гроздь) —
  { id:"key2",   kind:"key",     x: 96, y:100, rot: 1.45, s:0.9,  v:1 },
  { id:"key3",   kind:"key",     x:206, y: 96, rot: 1.5,  s:1.05, v:2 },
  { id:"key4",   kind:"key",     x:250, y:112, rot: 1.4,  s:0.9,  v:1 },
  { id:"key",    kind:"key",     x:150, y:108, rot: 1.6,  s:1.0,  v:0 },  // ← искомый ключ
  // — искомые сверху своего окружения —
  { id:"pluto",  kind:"pluto",   x:300, y:152, rot: 0,    s:0.95 },        // ← плутон
  { id:"lupa",   kind:"lupa",    x:316, y:216, rot:-0.5,  s:1.0 },         // ← лупа
  { id:"fang",   kind:"fang",    x:216, y:236, rot: 0.5,  s:1.0 },         // ← клык
  { id:"queen",  kind:"card",    x: 84, y:320, rot:-0.12, s:1.0,  v:"queen" }, // ← дама пик
  { id:"apple",  kind:"apple",   x:250, y:326, rot: 0.05, s:1.05 },        // ← яблоко
];

// половина хит-бокса по виду предмета (для клика/наведения)
const HIT = {
  key:[26,12], ring:[12,12], vial:[10,20], spider:[14,12], pluto:[16,16],
  skull:[18,20], thimble:[11,13], padlock:[19,22], dagger:[10,30], beads:[18,12],
  env:[24,16], lupa:[20,20], pencil:[5,26], fang:[10,16], card:[18,25],
  die:[13,13], coin:[13,13], apple:[18,18], compass:[16,16], star:[16,16],
  candle:[10,24], nail:[6,16],
};

// ── состояние ───────────────────────────────────────────────────────────────
let currentRiddle = 0;
let foundIds      = new Set();
let solvedKinds   = new Set();
let state         = "play";
let hover         = null;
let particles     = [];
let blots         = [];       // чернильные кляксы при ошибке
let shake         = 0;
let typed         = 0, typedTarget = "";
let startT        = 0;
let hintActive    = 0;        // сек, пока подсветка цели горит
let hintCd        = 0;        // кулдаун кнопки «?»
const HINT_CD     = 8;

// ── материалы / свет ─────────────────────────────────────────────────────────
// свет сверху-слева; блики и тени строим вручную, без glow поверх предметов.
function lin(g, x0, y0, x1, y1, stops) {
  const grd = g.createLinearGradient(x0, y0, x1, y1);
  for (const [t, c] of stops) grd.addColorStop(t, c);
  return grd;
}
function rad(g, x, y, r0, r1, stops) {
  const grd = g.createRadialGradient(x, y, r0, x, y, r1);
  for (const [t, c] of stops) grd.addColorStop(t, c);
  return grd;
}
// контактная тень — сажает предмет на доску (рисуется в координатах доски)
function contactShadow(g, x, y, rx, ry, a = 0.42) {
  g.save();
  g.fillStyle = rad(g, x, y + ry * 0.4, 1, Math.max(rx, ry), [
    [0, `rgba(10,6,2,${a})`], [0.6, `rgba(10,6,2,${a * 0.5})`], [1, "rgba(10,6,2,0)"]]);
  g.beginPath();
  g.ellipse(x, y + ry * 0.55, rx * 1.15, ry * 0.6, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

// палитры материалов: [тень, средний, блик]
const M = {
  brass:  ["#4a3010", "#9c7328", "#eccd7e"],
  brass2: ["#3c2810", "#876224", "#d8b364"],
  iron:   ["#1f1c18", "#5b554c", "#aaa392"],
  steel:  ["#23262c", "#6c727c", "#cdd2da"],
  bone:   ["#5a4a30", "#cbb588", "#f4e8cb"],
};

// ── РИСОВАНИЕ ПРЕДМЕТОВ (каждый — вокруг 0,0, контекст уже повёрнут) ─────────
function metalBody(g, path, mat, ax, ay, bx, by) {
  g.fillStyle = lin(g, ax, ay, bx, by, [[0, mat[0]], [0.42, mat[1]], [0.62, mat[2]], [0.8, mat[1]], [1, mat[0]]]);
  path(); g.fill();
}

function drawKey(g, variant = 0) {
  const mat = variant === 2 ? M.iron : M.brass;
  // стержень
  g.save();
  // контур-обводка тёмная для «гравюрности»
  g.lineJoin = "round";
  const shaft = () => { g.beginPath(); roundRect(g, -22, -3.4, 32, 6.8, 3); };
  metalBody(g, shaft, mat, -22, -4, -22, 4);
  // бородка (зубцы)
  g.fillStyle = mat[1];
  g.beginPath();
  roundRect(g, 4, -3, 7, 12, 1.5); g.fill();
  roundRect(g, 12, -3, 4, 8, 1); g.fill();
  // блик на зубцах
  g.fillStyle = mat[2]; g.globalAlpha = 0.5;
  g.fillRect(4, -3, 7, 2); g.globalAlpha = 1;
  // головка (кольцо)
  g.beginPath();
  g.fillStyle = lin(g, -34, -10, -22, 10, [[0, mat[2]], [0.5, mat[1]], [1, mat[0]]]);
  g.arc(-23, 0, 10.5, 0, Math.PI * 2); g.fill();
  // декоративный трилистник на крупном ключе
  if (variant === 0) {
    g.fillStyle = mat[1];
    for (const ang of [-1.1, 1.1, Math.PI]) {
      g.beginPath(); g.arc(-23 + Math.cos(ang) * 11, Math.sin(ang) * 11, 4.6, 0, Math.PI * 2); g.fill();
    }
  }
  // отверстие
  g.fillStyle = "#120c05";
  g.beginPath(); g.arc(-23, 0, 4.6, 0, Math.PI * 2); g.fill();
  // верхний блик кольца
  g.strokeStyle = "rgba(255,240,200,0.5)"; g.lineWidth = 1.2;
  g.beginPath(); g.arc(-23, 0, 8.5, Math.PI * 1.05, Math.PI * 1.7); g.stroke();
  g.restore();
}

function drawRing(g) {
  const mat = M.brass;
  g.fillStyle = lin(g, -12, -12, 12, 12, [[0, mat[2]], [0.5, mat[1]], [1, mat[0]]]);
  g.beginPath(); g.arc(0, 2, 11, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#140d06";
  g.beginPath(); g.arc(0, 2, 6.4, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "rgba(255,238,196,0.5)"; g.lineWidth = 1.1;
  g.beginPath(); g.arc(0, 2, 9, Math.PI * 1.05, Math.PI * 1.75); g.stroke();
  // камень
  g.fillStyle = rad(g, -1, -10, 0.5, 5, [[0, "#dff0ff"], [0.5, "#6fa6c8"], [1, "#274a63"]]);
  g.beginPath(); g.ellipse(0, -10, 4, 5, 0, 0, Math.PI * 2); g.fill();
}

function drawPadlock(g) {
  const mat = M.iron;
  // дужка
  g.strokeStyle = lin(g, -10, -28, 10, -10, [[0, mat[2]], [1, mat[0]]]);
  g.lineWidth = 5; g.lineCap = "round";
  g.beginPath(); g.arc(0, -8, 11, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
  // корпус
  const body = () => { g.beginPath(); roundRect(g, -16, -8, 32, 30, 5); };
  metalBody(g, body, mat, -16, -8, 16, 22);
  // тёмная фаска
  g.strokeStyle = "rgba(8,6,4,0.5)"; g.lineWidth = 1.4; body(); g.stroke();
  // солнце-эмблема
  g.strokeStyle = "rgba(20,14,8,0.55)"; g.lineWidth = 1;
  g.beginPath(); g.arc(0, 3, 5.5, 0, Math.PI * 2); g.stroke();
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    g.beginPath(); g.moveTo(Math.cos(a) * 6.5, 3 + Math.sin(a) * 6.5);
    g.lineTo(Math.cos(a) * 8.5, 3 + Math.sin(a) * 8.5); g.stroke();
  }
  // замочная скважина
  g.fillStyle = "#0c0804";
  g.beginPath(); g.arc(0, 13, 2.2, 0, Math.PI * 2); g.fill();
  g.fillRect(-1, 13, 2, 5);
}

function drawLupa(g) {
  // ручка
  const wood = ["#3a2410", "#7a4e22", "#b07f3e"];
  g.save();
  g.translate(0, 0);
  const handle = () => { g.beginPath(); roundRect(g, -3.5, 10, 7, 22, 3.5); };
  g.fillStyle = lin(g, -3, 10, 3, 10, [[0, wood[0]], [0.5, wood[2]], [1, wood[0]]]);
  handle(); g.fill();
  // ободок
  const mat = M.brass;
  g.fillStyle = lin(g, -16, -16, 16, 16, [[0, mat[2]], [0.5, mat[1]], [1, mat[0]]]);
  g.beginPath(); g.arc(0, -2, 16, 0, Math.PI * 2); g.fill();
  // стекло
  g.fillStyle = rad(g, -5, -7, 1, 16, [[0, "rgba(225,240,255,0.5)"], [0.6, "rgba(150,180,205,0.28)"], [1, "rgba(70,100,125,0.5)"]]);
  g.beginPath(); g.arc(0, -2, 12, 0, Math.PI * 2); g.fill();
  // блик-полумесяц на стекле
  g.strokeStyle = "rgba(255,255,255,0.45)"; g.lineWidth = 2;
  g.beginPath(); g.arc(0, -2, 8.5, Math.PI * 1.05, Math.PI * 1.7); g.stroke();
  // тёмная фаска ободка
  g.strokeStyle = "rgba(20,12,4,0.5)"; g.lineWidth = 1.4;
  g.beginPath(); g.arc(0, -2, 15.5, 0, Math.PI * 2); g.stroke();
  g.restore();
}

function drawCard(g, kind) {
  // основа карты
  g.save();
  const card = () => { g.beginPath(); roundRect(g, -16, -23, 32, 46, 3); };
  g.fillStyle = lin(g, -16, -23, 16, 23, [[0, "#efe2c0"], [0.5, "#e3d2a8"], [1, "#cdb682"]]);
  card(); g.fill();
  g.strokeStyle = "rgba(60,40,20,0.4)"; g.lineWidth = 1; card(); g.stroke();
  const spade = (cx, cy, s, col) => {
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(cx, cy - s);
    g.bezierCurveTo(cx + s, cy - s * 0.1, cx + s * 0.9, cy + s * 0.7, cx, cy + s * 0.5);
    g.bezierCurveTo(cx - s * 0.9, cy + s * 0.7, cx - s, cy - s * 0.1, cx, cy - s);
    g.fill();
    g.fillRect(cx - 1.1, cy + s * 0.2, 2.2, s * 0.6);
    g.beginPath(); g.moveTo(cx - s * 0.5, cy + s * 0.85); g.lineTo(cx + s * 0.5, cy + s * 0.85); g.lineTo(cx, cy + s * 0.35); g.fill();
  };
  const heart = (cx, cy, s, col) => {
    g.fillStyle = col; g.beginPath();
    g.moveTo(cx, cy + s * 0.7);
    g.bezierCurveTo(cx - s * 1.2, cy - s * 0.3, cx - s * 0.4, cy - s, cx, cy - s * 0.35);
    g.bezierCurveTo(cx + s * 0.4, cy - s, cx + s * 1.2, cy - s * 0.3, cx, cy + s * 0.7);
    g.fill();
  };
  const diam = (cx, cy, s, col) => {
    g.fillStyle = col; g.beginPath();
    g.moveTo(cx, cy - s); g.lineTo(cx + s * 0.7, cy); g.lineTo(cx, cy + s); g.lineTo(cx - s * 0.7, cy); g.fill();
  };
  if (kind === "queen") {
    // дама пик: угловые метки + крупная пика + лёгкий «портрет»
    g.fillStyle = "#15110b";
    g.font = "bold 9px 'JetBrains Mono', monospace"; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText("Q", -11, -17); g.fillText("Q", 11, 17);
    spade(-11, -9, 3, "#15110b"); spade(11, 9, 3, "#15110b");
    // корона
    g.fillStyle = "#9a7a32";
    g.beginPath(); g.moveTo(-7, -3); g.lineTo(-7, -7); g.lineTo(-3.5, -4.5); g.lineTo(0, -8);
    g.lineTo(3.5, -4.5); g.lineTo(7, -7); g.lineTo(7, -3); g.closePath(); g.fill();
    // лицо/вуаль
    g.fillStyle = "#d8c191"; g.beginPath(); g.ellipse(0, 3, 6, 8, 0, 0, Math.PI * 2); g.fill();
    spade(0, 8, 6, "#1a140c");
  } else if (kind === "hearts") {
    g.fillStyle = "#9a2418"; g.font = "bold 9px 'JetBrains Mono', monospace"; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText("A", -11, -17);
    heart(0, 0, 8, "#9a2418"); heart(-11, -9, 3, "#9a2418");
  } else {
    g.fillStyle = "#9a2418"; g.font = "bold 9px 'JetBrains Mono', monospace"; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText("9", -11, -17);
    diam(0, 0, 8, "#9a2418"); diam(-11, -9, 3, "#9a2418");
  }
  g.restore();
}

function drawApple(g) {
  // тело — два лепестка
  const red = ["#4a0f0a", "#a52418", "#e06a3a"];
  g.fillStyle = rad(g, -5, -6, 1, 22, [[0, red[2]], [0.4, red[1]], [1, red[0]]]);
  g.beginPath();
  g.moveTo(0, -12);
  g.bezierCurveTo(-16, -16, -18, 12, 0, 16);
  g.bezierCurveTo(18, 12, 16, -16, 0, -12);
  g.fill();
  // ложбинка сверху
  g.fillStyle = "rgba(50,8,6,0.5)";
  g.beginPath(); g.ellipse(0, -11, 3.5, 2, 0, 0, Math.PI * 2); g.fill();
  // черенок
  g.strokeStyle = "#4a3018"; g.lineWidth = 2.4; g.lineCap = "round";
  g.beginPath(); g.moveTo(0, -11); g.lineTo(2, -18); g.stroke();
  // лист
  g.fillStyle = "#4a6a2a";
  g.beginPath(); g.ellipse(7, -16, 6, 3, -0.6, 0, Math.PI * 2); g.fill();
  // блик
  g.fillStyle = "rgba(255,210,170,0.55)";
  g.beginPath(); g.ellipse(-6, -3, 3.5, 6, -0.4, 0, Math.PI * 2); g.fill();
}

function drawFang(g) {
  const mat = M.bone;
  g.fillStyle = lin(g, -8, -14, 6, 14, [[0, mat[2]], [0.5, mat[1]], [1, mat[0]]]);
  g.beginPath();
  g.moveTo(-7, -13);            // корень слева-верх
  g.bezierCurveTo(-9, -2, -5, 8, 0, 14);   // внешняя дуга к острию
  g.bezierCurveTo(3, 6, 5, -4, 6, -13);    // внутренняя
  g.bezierCurveTo(2, -16, -3, -16, -7, -13);
  g.fill();
  // продольная тень
  g.strokeStyle = "rgba(90,70,44,0.45)"; g.lineWidth = 1;
  g.beginPath(); g.moveTo(-1, -10); g.bezierCurveTo(-2, 0, -1, 6, 0.5, 12); g.stroke();
  // блик
  g.strokeStyle = "rgba(255,250,235,0.6)"; g.lineWidth = 1.4;
  g.beginPath(); g.moveTo(-4, -10); g.bezierCurveTo(-5, -2, -3, 6, -1, 11); g.stroke();
}

function drawPluto(g) {
  // тёмная планета + тонкое кольцо (астрономический медальон)
  g.save();
  // кольцо за планетой
  g.strokeStyle = "rgba(180,150,90,0.5)"; g.lineWidth = 2;
  g.beginPath(); g.ellipse(0, 0, 17, 5.5, -0.45, Math.PI * 0.05, Math.PI * 0.95); g.stroke();
  // шар
  g.fillStyle = rad(g, -4, -4, 1, 14, [[0, "#8f8aa0"], [0.45, "#4c4a5c"], [1, "#201f2a"]]);
  g.beginPath(); g.arc(0, 0, 11, 0, Math.PI * 2); g.fill();
  // полосы/кратеры
  g.fillStyle = "rgba(20,18,28,0.5)";
  g.beginPath(); g.ellipse(3, 2, 3, 2, 0.3, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(-4, 4, 2, 1.4, 0, 0, Math.PI * 2); g.fill();
  // кольцо перед планетой
  g.strokeStyle = "rgba(200,168,102,0.7)"; g.lineWidth = 2;
  g.beginPath(); g.ellipse(0, 0, 17, 5.5, -0.45, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
  g.restore();
}

function drawEnv(g) {
  g.save();
  const body = () => { g.beginPath(); roundRect(g, -22, -14, 44, 28, 2); };
  g.fillStyle = lin(g, -22, -14, -22, 14, [[0, "#efe3c2"], [1, "#d6c096"]]);
  body(); g.fill();
  g.strokeStyle = "rgba(70,48,24,0.35)"; g.lineWidth = 1; body(); g.stroke();
  // клапан
  g.fillStyle = "#e3d2a8";
  g.beginPath(); g.moveTo(-22, -14); g.lineTo(0, 4); g.lineTo(22, -14); g.stroke();
  g.strokeStyle = "rgba(70,48,24,0.4)"; g.lineWidth = 1;
  g.beginPath(); g.moveTo(-22, -14); g.lineTo(0, 3); g.lineTo(22, -14); g.stroke();
  g.beginPath(); g.moveTo(-22, 14); g.lineTo(-4, 1); g.moveTo(22, 14); g.lineTo(4, 1); g.stroke();
  // надпись SOLAR
  g.fillStyle = "rgba(40,28,14,0.6)";
  g.font = "7px 'JetBrains Mono', monospace"; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText("SOLAR", 0, 9);
  // сургуч
  g.fillStyle = "#7e1f12"; g.beginPath(); g.arc(0, 3, 3.4, 0, Math.PI * 2); g.fill();
  g.restore();
}

function drawDagger(g) {
  // вертикальный кинжал (острие вниз)
  g.save();
  // клинок
  g.fillStyle = lin(g, -5, 0, 5, 0, [[0, "#3a3e44"], [0.5, "#cfd4dc"], [1, "#5a606a"]]);
  g.beginPath();
  g.moveTo(0, 30); g.lineTo(-5, 4); g.lineTo(5, 4); g.closePath(); g.fill();
  g.strokeStyle = "rgba(255,255,255,0.4)"; g.lineWidth = 1;
  g.beginPath(); g.moveTo(0, 28); g.lineTo(0, 5); g.stroke();
  // гарда
  g.fillStyle = lin(g, -12, 0, 12, 0, [[0, M.brass[0]], [0.5, M.brass[2]], [1, M.brass[0]]]);
  g.beginPath(); roundRect(g, -11, -1, 22, 5, 2); g.fill();
  // рукоять (обмотка)
  g.fillStyle = lin(g, -4, -20, 4, -4, [[0, "#3a2410"], [0.5, "#7a4e22"], [1, "#3a2410"]]);
  g.beginPath(); roundRect(g, -4, -20, 8, 18, 3); g.fill();
  g.strokeStyle = "rgba(20,12,4,0.5)"; g.lineWidth = 0.8;
  for (let i = -18; i < -3; i += 3) { g.beginPath(); g.moveTo(-4, i); g.lineTo(4, i + 2); g.stroke(); }
  // навершие
  g.fillStyle = M.brass[1]; g.beginPath(); g.arc(0, -21, 3.6, 0, Math.PI * 2); g.fill();
  g.restore();
}

function drawDie(g) {
  // красный кубик с белыми точками
  g.save();
  const red = ["#5a120c", "#9e2018", "#c2402c"];
  const body = () => { g.beginPath(); roundRect(g, -12, -12, 24, 24, 4); };
  g.fillStyle = lin(g, -12, -12, 12, 12, [[0, red[2]], [0.5, red[1]], [1, red[0]]]);
  body(); g.fill();
  g.strokeStyle = "rgba(30,6,4,0.5)"; g.lineWidth = 1; body(); g.stroke();
  g.fillStyle = "#f2ead8";
  for (const [dx, dy] of [[-6, -6], [6, -6], [-6, 6], [6, 6], [0, 0]]) {
    g.beginPath(); g.arc(dx, dy, 1.9, 0, Math.PI * 2); g.fill();
  }
  // блик
  g.fillStyle = "rgba(255,200,180,0.3)";
  g.beginPath(); roundRect(g, -10, -10, 8, 8, 2); g.fill();
  g.restore();
}

function drawCoin(g) {
  const mat = M.brass;
  g.fillStyle = lin(g, -12, -12, 12, 12, [[0, mat[2]], [0.5, mat[1]], [1, mat[0]]]);
  g.beginPath(); g.ellipse(0, 0, 12, 11, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "rgba(40,26,8,0.45)"; g.lineWidth = 1.2;
  g.beginPath(); g.ellipse(0, 0, 9, 8.2, 0, 0, Math.PI * 2); g.stroke();
  g.fillStyle = "rgba(40,26,8,0.5)"; g.font = "bold 9px 'JetBrains Mono', monospace";
  g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("★", 0, 1);
  g.strokeStyle = "rgba(255,240,200,0.5)"; g.lineWidth = 1;
  g.beginPath(); g.ellipse(0, 0, 11, 10, 0, Math.PI * 1.05, Math.PI * 1.7); g.stroke();
}

function drawCompass(g) {
  const mat = M.brass;
  g.fillStyle = lin(g, -15, -15, 15, 15, [[0, mat[2]], [0.5, mat[1]], [1, mat[0]]]);
  g.beginPath(); g.arc(0, 0, 15, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#e8dcc0"; g.beginPath(); g.arc(0, 0, 11, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "rgba(40,28,14,0.5)"; g.lineWidth = 1; g.beginPath(); g.arc(0, 0, 11, 0, Math.PI * 2); g.stroke();
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    g.beginPath(); g.moveTo(Math.cos(a) * 8, Math.sin(a) * 8); g.lineTo(Math.cos(a) * 10.5, Math.sin(a) * 10.5); g.stroke();
  }
  // стрелка
  g.fillStyle = "#9a2418"; g.beginPath(); g.moveTo(0, -9); g.lineTo(2.4, 0); g.lineTo(0, 0); g.fill();
  g.fillStyle = "#2a2e34"; g.beginPath(); g.moveTo(0, 9); g.lineTo(-2.4, 0); g.lineTo(0, 0); g.fill();
  g.fillStyle = mat[1]; g.beginPath(); g.arc(0, 0, 1.6, 0, Math.PI * 2); g.fill();
}

function drawStar(g) {
  const mat = ["#4a2c12", "#8a5a2a", "#b8843e"];   // ржавая латунь
  g.fillStyle = lin(g, -14, -14, 14, 14, [[0, mat[2]], [0.5, mat[1]], [1, mat[0]]]);
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5;
    const r = i % 2 ? 6 : 14;
    g[i ? "lineTo" : "moveTo"](Math.cos(a) * r, Math.sin(a) * r);
  }
  g.closePath(); g.fill();
  g.strokeStyle = "rgba(30,16,6,0.5)"; g.lineWidth = 1; g.stroke();
  g.fillStyle = "rgba(20,12,4,0.4)"; g.beginPath(); g.arc(0, 0, 2.4, 0, Math.PI * 2); g.fill();
}

function drawCandle(g) {
  // тело
  g.fillStyle = lin(g, -8, 0, 8, 0, [[0, "#b8a778"], [0.5, "#efe6cc"], [1, "#9c8c60"]]);
  g.beginPath(); roundRect(g, -7, -10, 14, 32, 3); g.fill();
  // потёки
  g.fillStyle = "rgba(255,250,235,0.5)";
  g.beginPath(); g.ellipse(-3, -8, 2, 5, 0, 0, Math.PI * 2); g.fill();
  // фитиль
  g.strokeStyle = "#2a1c0e"; g.lineWidth = 1.4;
  g.beginPath(); g.moveTo(0, -10); g.lineTo(0, -15); g.stroke();
  // пламя
  g.fillStyle = rad(g, 0, -18, 0.5, 7, [[0, "#fff3c0"], [0.5, "#f0a83c"], [1, "rgba(220,90,20,0)"]]);
  g.beginPath(); g.ellipse(0, -18, 4, 7, 0, 0, Math.PI * 2); g.fill();
}

function drawNail(g) {
  g.fillStyle = lin(g, -2, 0, 2, 0, [[0, M.iron[0]], [0.5, M.iron[2]], [1, M.iron[0]]]);
  g.beginPath(); g.moveTo(-2.4, -14); g.lineTo(2.4, -14); g.lineTo(0.6, 14); g.lineTo(-0.6, 14); g.fill();
  g.fillStyle = M.iron[1]; g.beginPath(); g.ellipse(0, -14, 5, 2.4, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "rgba(255,255,255,0.3)"; g.lineWidth = 0.8; g.beginPath(); g.moveTo(-1, -12); g.lineTo(-0.4, 10); g.stroke();
}

function drawThimble(g) {
  g.fillStyle = lin(g, -10, -12, 10, 12, [[0, M.steel[2]], [0.5, M.steel[1]], [1, M.steel[0]]]);
  g.beginPath();
  g.moveTo(-8, 12); g.lineTo(-7, -6); g.quadraticCurveTo(0, -16, 7, -6); g.lineTo(8, 12); g.closePath(); g.fill();
  g.fillStyle = "rgba(20,22,26,0.4)";
  for (let r = -10; r < 6; r += 4) for (let c = -5; c <= 5; c += 3.4) {
    g.beginPath(); g.arc(c, r, 0.9, 0, Math.PI * 2); g.fill();
  }
  g.strokeStyle = "rgba(255,255,255,0.35)"; g.lineWidth = 1; g.beginPath(); g.moveTo(-5, 10); g.lineTo(-4, -6); g.stroke();
}

function drawVial(g) {
  // склянка с жидкостью
  g.fillStyle = "rgba(170,200,210,0.25)";
  g.beginPath(); roundRect(g, -7, -8, 14, 28, 5); g.fill();
  g.fillStyle = lin(g, 0, 6, 0, 20, [[0, "rgba(120,40,120,0.55)"], [1, "rgba(60,20,70,0.7)"]]);
  g.beginPath(); roundRect(g, -6, 6, 12, 13, 4); g.fill();
  // горлышко + пробка
  g.fillStyle = "rgba(190,215,225,0.3)"; g.fillRect(-3.5, -14, 7, 7);
  g.fillStyle = "#6b4a28"; g.beginPath(); roundRect(g, -4, -19, 8, 6, 2); g.fill();
  g.strokeStyle = "rgba(255,255,255,0.4)"; g.lineWidth = 1; g.beginPath(); g.moveTo(-4, -6); g.lineTo(-4, 16); g.stroke();
}

function drawPencil(g) {
  // вертикальный карандаш
  g.fillStyle = lin(g, -4, 0, 4, 0, [[0, "#b8860a"], [0.5, "#f0c040"], [1, "#9a6e08"]]);
  g.beginPath(); roundRect(g, -4, -22, 8, 38, 1); g.fill();
  // грифель
  g.fillStyle = "#e8c060"; g.beginPath(); g.moveTo(-4, -22); g.lineTo(0, -30); g.lineTo(4, -22); g.fill();
  g.fillStyle = "#2a2620"; g.beginPath(); g.moveTo(-1.4, -26); g.lineTo(0, -30); g.lineTo(1.4, -26); g.fill();
  // ластик
  g.fillStyle = "#c08a7a"; g.beginPath(); roundRect(g, -4, 14, 8, 5, 1); g.fill();
  g.fillStyle = "#8a8a8a"; g.fillRect(-4, 12, 8, 2.5);
}

function drawBeads(g) {
  // нить красных бусин по дуге
  for (let i = -3; i <= 3; i++) {
    const x = i * 5.4, y = Math.abs(i) * Math.abs(i) * 0.6 - 3;
    g.fillStyle = rad(g, x - 1, y - 1, 0.5, 3.6, [[0, "#d8604a"], [0.5, "#9e2418"], [1, "#4a0f0a"]]);
    g.beginPath(); g.arc(x, y, 3.2, 0, Math.PI * 2); g.fill();
  }
}

function drawSpider(g) {
  g.strokeStyle = "#1a141c"; g.lineWidth = 1.3; g.lineCap = "round";
  for (let i = 0; i < 4; i++) {
    const a = 0.5 + i * 0.34;
    g.beginPath(); g.moveTo(-2, 0); g.lineTo(-2 - Math.sin(a) * 11, Math.cos(a - 0.5) * 9 - 2); g.stroke();
    g.beginPath(); g.moveTo(2, 0); g.lineTo(2 + Math.sin(a) * 11, Math.cos(a - 0.5) * 9 - 2); g.stroke();
  }
  g.fillStyle = rad(g, -2, -2, 0.5, 8, [[0, "#5a4a62"], [1, "#16101c"]]);
  g.beginPath(); g.ellipse(0, 2, 6, 7, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(0, -6, 3.6, 0, Math.PI * 2); g.fill();
}

function drawSkull(g) {
  const mat = M.bone;
  g.fillStyle = lin(g, -16, -18, 16, 18, [[0, mat[2]], [0.5, mat[1]], [1, mat[0]]]);
  g.beginPath();
  g.moveTo(-15, -2); g.quadraticCurveTo(-16, -20, 0, -20); g.quadraticCurveTo(16, -20, 15, -2);
  g.quadraticCurveTo(14, 8, 7, 9); g.lineTo(6, 16); g.lineTo(-6, 16); g.lineTo(-7, 9);
  g.quadraticCurveTo(-14, 8, -15, -2); g.fill();
  // глазницы
  g.fillStyle = "#120c0a";
  g.beginPath(); g.ellipse(-7, -3, 5, 6, 0.1, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(7, -3, 5, 6, -0.1, 0, Math.PI * 2); g.fill();
  // нос
  g.beginPath(); g.moveTo(0, 1); g.lineTo(-2.4, 7); g.lineTo(2.4, 7); g.fill();
  // зубы
  g.fillStyle = mat[2];
  for (let i = -5; i <= 5; i += 2.6) { g.fillRect(i - 0.8, 9, 1.8, 5); }
  g.strokeStyle = "rgba(90,70,44,0.4)"; g.lineWidth = 0.8; g.beginPath(); g.moveTo(-6, 9); g.lineTo(6, 9); g.stroke();
}

// маршрутизатор рисования
const DRAW = {
  key: drawKey, ring: drawRing, padlock: drawPadlock, lupa: drawLupa, card: drawCard,
  apple: drawApple, fang: drawFang, pluto: drawPluto, env: drawEnv, dagger: drawDagger,
  die: drawDie, coin: drawCoin, compass: drawCompass, star: drawStar, candle: drawCandle,
  nail: drawNail, thimble: drawThimble, vial: drawVial, pencil: drawPencil, beads: drawBeads,
  spider: drawSpider, skull: drawSkull,
};

function roundRect(g, x, y, w, h, r) {
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function drawItem(g, it, alpha = 1) {
  const fn = DRAW[it.kind]; if (!fn) return;
  g.save();
  g.globalAlpha = alpha;
  g.translate(it.x, it.y);
  g.rotate(it.rot || 0);
  const s = it.s || 1; g.scale(s, s);
  fn(g, it.v);
  g.restore();
}

// ── фон-доска (старый теневой короб с картой) ───────────────────────────────
function drawBoard(g) {
  // подложка — тёплый пергамент, светлее к центру
  g.fillStyle = rad(g, VW / 2, VH * 0.42, 20, VW * 0.9, [
    [0, "#b78a4e"], [0.5, "#8a6232"], [1, "#3e2810"]]);
  g.fillRect(0, 0, VW, VH);

  // карта: меридианы-дуги
  g.strokeStyle = "rgba(60,40,18,0.16)"; g.lineWidth = 1;
  for (let i = 0; i <= 6; i++) {
    g.beginPath();
    g.ellipse(VW * 0.3, VH * 0.5, 22 + i * 46, VH * 0.7, 0, 0, Math.PI * 2);
    g.stroke();
  }
  // роза ветров
  g.save();
  g.translate(VW * 0.74, VH * 0.2);
  g.strokeStyle = "rgba(50,32,14,0.2)"; g.lineWidth = 1;
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * 30, Math.sin(a) * 30); g.stroke();
  }
  g.beginPath(); g.arc(0, 0, 30, 0, Math.PI * 2); g.stroke();
  g.fillStyle = "rgba(50,32,14,0.22)";
  g.beginPath(); g.moveTo(0, -30); g.lineTo(4, 0); g.lineTo(0, 4); g.lineTo(-4, 0); g.fill();
  g.restore();

  // пунктирные «маршруты»
  g.strokeStyle = "rgba(40,26,12,0.22)"; g.setLineDash([3, 5]); g.lineWidth = 1;
  g.beginPath(); g.moveTo(20, 360); g.quadraticCurveTo(160, 300, 330, 380); g.stroke();
  g.beginPath(); g.moveTo(40, 60); g.quadraticCurveTo(150, 120, 300, 70); g.stroke();
  g.setLineDash([]);

  // выцветшие буквы/цифры карты
  g.fillStyle = "rgba(50,32,14,0.14)";
  g.textAlign = "center"; g.textBaseline = "middle";
  const marks = [["IX", 60, 250, 14], ["·415·", 250, 380, 10], ["N", VW * 0.74, VH * 0.2 - 20, 9],
                 ["solar", 300, 150, 11], ["XⅢ", 120, 410, 12]];
  for (const [t, x, y, sz] of marks) { g.font = `${sz}px 'JetBrains Mono', monospace`; g.fillText(t, x, y); }

  // пятна/кляксы времени
  for (const [x, y, r, a] of [[90, 120, 36, 0.16], [280, 300, 44, 0.14], [180, 230, 30, 0.1], [40, 380, 28, 0.16]]) {
    g.fillStyle = rad(g, x, y, 1, r, [[0, `rgba(30,18,6,${a})`], [1, "rgba(30,18,6,0)"]]);
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }

  // деревянная рама короба (бевел)
  const fr = 9;
  g.fillStyle = lin(g, 0, 0, fr, fr, [[0, "#3a2614"], [1, "#1c1208"]]);
  g.fillRect(0, 0, VW, fr); g.fillRect(0, 0, fr, VH);
  g.fillStyle = lin(g, VW - fr, VH - fr, VW, VH, [[0, "#241608"], [1, "#0e0904"]]);
  g.fillRect(0, VH - fr, VW, fr); g.fillRect(VW - fr, 0, fr, VH);
  g.strokeStyle = "rgba(150,110,60,0.35)"; g.lineWidth = 1; g.strokeRect(fr, fr, VW - fr * 2, VH - fr * 2);

  // глубокая виньетка короба
  g.fillStyle = rad(g, VW / 2, VH / 2, VH * 0.3, VH * 0.75, [[0, "rgba(0,0,0,0)"], [1, "rgba(0,0,0,0.6)"]]);
  g.fillRect(0, 0, VW, VH);

  // зерно
  g.fillStyle = "rgba(20,12,4,0.5)";
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * VW, y = Math.random() * VH;
    if (Math.random() < 0.5) { g.globalAlpha = Math.random() * 0.06; g.fillRect(x, y, 1, 1); }
  }
  g.globalAlpha = 1;
  g.fillStyle = "rgba(255,230,180,0.5)";
  for (let i = 0; i < 400; i++) {
    g.globalAlpha = Math.random() * 0.05; g.fillRect(Math.random() * VW, Math.random() * VH, 1, 1);
  }
  g.globalAlpha = 1;
}

// собрать статичный кэш (фон + предметы; найденные — призрачно-тусклые)
function buildCache() {
  octx.setTransform(SS, 0, 0, SS, 0, 0);
  octx.clearRect(0, 0, VW, VH);
  drawBoard(octx);
  for (const it of ITEMS) {
    const found = foundIds.has(it.id);
    const hb = HIT[it.kind] || [14, 14];
    if (!found) contactShadow(octx, it.x, it.y + hb[1] * 0.5, hb[0], hb[1], 0.4);
    drawItem(octx, it, found ? 0.16 : 1);
  }
  // ── финальная вуаль: тёплый светофильтр + виньетка поверх ВСЕГО ──
  // связывает предметы и фон в один пыльный тон, гасит блеск — труднее искать.
  octx.fillStyle = "rgba(120,74,28,0.16)";
  octx.fillRect(0, 0, VW, VH);
  octx.fillStyle = rad(octx, VW / 2, VH * 0.46, VH * 0.26, VH * 0.8,
    [[0, "rgba(0,0,0,0)"], [1, "rgba(18,10,2,0.5)"]]);
  octx.fillRect(0, 0, VW, VH);
}

// ── ввод ─────────────────────────────────────────────────────────────────────
function canvasToWorld(e) {
  const rect = canvas.getBoundingClientRect();
  return { x: (e.clientX - rect.left - offX) / scale, y: (e.clientY - rect.top - offY) / scale };
}
function pickItem(x, y) {
  // сверху вниз по массиву наоборот — верхние (позже нарисованные) ловят первыми
  for (let i = ITEMS.length - 1; i >= 0; i--) {
    const it = ITEMS[i];
    if (foundIds.has(it.id)) continue;
    const hb = HIT[it.kind] || [14, 14];
    const s = it.s || 1;
    // переводим клик в локальную (повёрнутую) систему предмета — хитбокс совпадает с наклоном
    const rot = -(it.rot || 0), ca = Math.cos(rot), sa = Math.sin(rot);
    const px = x - it.x, py = y - it.y;
    const lx = (px * ca - py * sa) / (hb[0] * s + 3);
    const ly = (px * sa + py * ca) / (hb[1] * s + 3);
    if (lx * lx + ly * ly <= 1) return it;
  }
  return null;
}

canvas.addEventListener("mousemove", e => {
  if (state !== "play") return;
  const p = canvasToWorld(e); hover = pickItem(p.x, p.y);
  canvas.style.cursor = hover ? "pointer" : "crosshair";
});
canvas.addEventListener("mouseleave", () => { hover = null; });
canvas.addEventListener("touchmove", e => {
  e.preventDefault();
  if (state !== "play") return;
  const t = e.changedTouches[0];
  hover = pickItem(...Object.values(canvasToWorld({ clientX: t.clientX, clientY: t.clientY })));
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
  if (!it) return;
  if (it.kind === RIDDLES[currentRiddle].answer) onCorrect(it);
  else onWrong(p.x, p.y);
});
addEventListener("keydown", e => { if (e.code === "Escape") backToMap(); });

hintBtn.addEventListener("click", () => {
  if (hintCd > 0 || state !== "play") return;
  hintActive = 3.2; hintCd = HINT_CD;
});

// ── реакции ───────────────────────────────────────────────────────────────────
function onCorrect(it) {
  foundIds.add(it.id);
  solvedKinds.add(it.kind);
  thud(0.8);
  ensureAudio(); chime(8, 0.28);
  flash("flash-right");
  spawnDissolve(it);
  hintActive = 0;
  appendNotebook(POEM_PARTS[RIDDLES[currentRiddle].part]);
  buildCache();
  currentRiddle++;
  updateHUD();
  if (currentRiddle >= RIDDLES.length) onWin();
  else showCurrentRiddle();
}
function onWrong(x, y) {
  creak();
  flash("flash-wrong");
  shake = Math.max(shake, 5);
  blots.push({ x, y, r: 0, life: 0, ttl: 0.9 });
}
function flash(cls) {
  riddleEl.classList.add(cls);
  clearTimeout(flash._t);
  flash._t = setTimeout(() => riddleEl.classList.remove(cls), 420);
}

function showCurrentRiddle() {
  if (currentRiddle >= RIDDLES.length) return;
  typedTarget = RIDDLES[currentRiddle].text; typed = 0; riddleEl.textContent = "";
}
function updateHUD() {
  const n = Math.min(currentRiddle + 1, RIDDLES.length);
  if (riddleN) riddleN.textContent = `${n} / ${RIDDLES.length}`;
  if (caseNoEl) caseNoEl.textContent = `досье № ${n}`;
  if (foundN) foundN.textContent = `${foundIds.size} / ${RIDDLES.length}`;
}
function appendNotebook(text) {
  const empty = noteEl.querySelector(".nb-empty");
  if (empty) empty.remove();
  const div = document.createElement("div");
  div.className = "nb-stanza";
  div.textContent = text;
  noteEl.appendChild(div);
  noteEl.scrollTop = noteEl.scrollHeight;
}

function spawnDissolve(it) {
  const hb = HIT[it.kind] || [14, 14];
  for (let i = 0; i < 26; i++) {
    const a = Math.random() * Math.PI * 2, sp = 40 + Math.random() * 90;
    particles.push({ x: it.x, y: it.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 24,
      life: 0, ttl: 0.6 + Math.random() * 0.5, r: 1 + Math.random() * 2,
      col: i % 3 ? "rgba(236,205,126," : "rgba(245,232,200," });
  }
}

function onWin() {
  state = "win";
  markDone("nancy-drew");
  appendNotebook(POEM_PARTS[6]);
  const last = noteEl.lastElementChild; if (last) last.classList.add("nb-final");
  const secs = Math.round((performance.now() - startT) / 1000);
  const mm = Math.floor(secs / 60), ss = secs % 60;
  if (winStats) winStats.textContent = `улик раскрыто ${RIDDLES.length} · время ${mm}:${String(ss).padStart(2, "0")}`;
  fetch(`${import.meta.env.BASE_URL}poems/nancy-drew.txt`).then(r => r.ok ? r.text() : "").then(t => { winPoem.textContent = t || ""; });
  hintBtn.disabled = true;
  setTimeout(() => winOv.classList.add("show"), 900);
}

// ── render ─────────────────────────────────────────────────────────────────────
function render(t) {
  const shx = shake > 0 ? (Math.random() - 0.5) * shake : 0;
  const shy = shake > 0 ? (Math.random() - 0.5) * shake : 0;
  ctx.clearRect(-20, -20, VW + 40, VH + 40);
  ctx.save();
  ctx.translate(shx, shy);

  // статичная сцена
  ctx.drawImage(oc, 0, 0, VW, VH);

  // наведение — лёгкий «подъём» предмета (мягкий тёплый ореол + чуть крупнее)
  if (hover && !foundIds.has(hover.id) && state === "play") {
    ctx.save();
    ctx.shadowColor = "rgba(255,226,150,0.8)"; ctx.shadowBlur = 12;
    drawItem(ctx, { ...hover, s: (hover.s || 1) * 1.05 }, 1);
    ctx.restore();
  }

  // подсказка «?» — прожектор + кольцо + стрелка ПРЯМО на нужный предмет.
  // никакого текста: только пространственное указание на сцене.
  if (hintActive > 0 && state === "play") {
    const tgt = ITEMS.find(it => it.kind === RIDDLES[currentRiddle].answer && !foundIds.has(it.id));
    if (tgt) {
      const hb = HIT[tgt.kind] || [14, 14];
      const R = Math.max(hb[0], hb[1]) * (tgt.s || 1);
      const k = Math.min(1, hintActive);                 // плавное угасание под конец
      // мягкий прожектор: гасим всё, кроме круга у цели
      const spot = ctx.createRadialGradient(tgt.x, tgt.y, R + 4, tgt.x, tgt.y, VH * 0.85);
      spot.addColorStop(0, "rgba(10,6,2,0)");
      spot.addColorStop(0.12, "rgba(10,6,2,0)");
      spot.addColorStop(1, `rgba(10,6,2,${0.62 * k})`);
      ctx.fillStyle = spot; ctx.fillRect(0, 0, VW, VH);
      // пульсирующее кольцо у предмета
      const ph = (t / 700) % 1;
      ctx.strokeStyle = `rgba(255,226,150,${0.85 * (1 - ph) * k})`;
      ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.arc(tgt.x, tgt.y, R + 7 + ph * 16, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = `rgba(255,226,150,${0.9 * k})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(tgt.x, tgt.y, R + 6, 0, Math.PI * 2); ctx.stroke();
      // подпрыгивающая стрелка-указатель сверху
      const bob = Math.sin(t / 170) * 3;
      const ay = tgt.y - R - 16 + bob;
      ctx.fillStyle = `rgba(255,230,156,${0.95 * k})`;
      ctx.beginPath();
      ctx.moveTo(tgt.x, ay + 11);
      ctx.lineTo(tgt.x - 6.5, ay + 1);
      ctx.lineTo(tgt.x + 6.5, ay + 1);
      ctx.closePath(); ctx.fill();
      ctx.fillRect(tgt.x - 2, ay - 7, 4, 9);
    }
  }

  // чернильные кляксы (ошибка)
  for (const b of blots) {
    const a = 1 - b.life / b.ttl;
    ctx.fillStyle = `rgba(40,18,10,${a * 0.5})`;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
  }

  // частицы распада
  for (const p of particles) {
    const a = 1 - p.life / p.ttl;
    ctx.fillStyle = p.col + a + ")";
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.5 + a), 0, Math.PI * 2); ctx.fill();
  }

  ctx.restore();
}

// ── update ─────────────────────────────────────────────────────────────────────
function update(dt) {
  if (shake > 0) shake = Math.max(0, shake - dt * 26);
  if (hintActive > 0) hintActive = Math.max(0, hintActive - dt);
  if (hintCd > 0) {
    hintCd = Math.max(0, hintCd - dt);
    hintBtn.disabled = hintCd > 0 || state !== "play";   // на перезарядке — просто притушена
  }
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]; p.life += dt;
    if (p.life >= p.ttl) { particles.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 150 * dt; p.vx *= 0.96;
  }
  for (let i = blots.length - 1; i >= 0; i--) {
    const b = blots[i]; b.life += dt; b.r += dt * 30;
    if (b.life >= b.ttl) blots.splice(i, 1);
  }
  if (typed < typedTarget.length) {
    typed = Math.min(typedTarget.length, typed + dt * 42);
    riddleEl.textContent = typedTarget.slice(0, typed | 0);
  }
}

// ── главный цикл ──────────────────────────────────────────────────────────────
let prev = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - prev) / 1000); prev = now;
  update(dt); render(now);
  requestAnimationFrame(loop);
}

// ── старт ──────────────────────────────────────────────────────────────────────
if (!showCompleted("nancy-drew", "нэнси дрю")) {
  fitCanvas();
  buildCache();
  startT = performance.now();
  showCurrentRiddle();
  updateHUD();
  requestAnimationFrame(loop);
}

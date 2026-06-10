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
import { osPowerOn, osBindLinks, osTitleCard, osRevealLines } from "../../shared/os.js";

bindBackLink();

// ── DOM ────────────────────────────────────────────────────────────────────
const canvas    = document.getElementById("c");
const ctx       = canvas.getContext("2d");
const riddleEl  = document.getElementById("riddle");
const riddleN   = document.getElementById("riddle-num");
const foundN    = document.getElementById("found-count");
const caseNoEl  = document.getElementById("caseNo");
const hintBtn   = document.getElementById("hintBtn");
const winOv     = document.getElementById("winOverlay");
const winPoem   = document.getElementById("winPoem");
const winStats  = document.getElementById("winStats");
// блокнот: кнопка + всплывающая страница + наводящий тост
const notebookBtn = document.getElementById("notebookBtn");
const nbCountEl   = document.getElementById("nbCount");
const nbOverlay   = document.getElementById("nbOverlay");
const nbTextEl    = document.getElementById("nbText");
const nbCloseBtn  = document.getElementById("nbClose");
const nbNudge     = document.getElementById("nbNudge");

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
// порядок улик — по ТЗ: яблоко, плутон, клык, ключ, лупа, дама пик.
// part = индекс части стиха, которая вписывается в блокнот (стих идёт по порядку).
const RIDDLES = [
  { answer: "apple", label: "яблоко", part: 0,
    text: "В глазнице — если повезёт,\nбывает, висит в небе на рассвете,\nа третье стукнется о лоб,\nкогда решишь ты отдохнуть под древом." },
  { answer: "pluto", label: "плутон", part: 1,
    text: "Недр подземного царства ему не хватило —\nон добрался до звёздных высот.\nОко бога и римское позднее имя\nозирают ночью твой сон." },
  { answer: "fang", label: "клык", part: 2,
    text: "Он рыка друг, охранник языка,\nдля мягкой плоти он как нож опасен.\nБелесый царь улыбки; брат клинка,\nкогда вампир и зверь проголодались." },
  { answer: "key", label: "ключ", part: 3,
    text: "Им бьёт вода. О нём мечтает вор,\nзапутавшись в ворованных отмычках.\nОтвет на все загадки — тоже он\n(для этой точно ты другого не отыщешь)." },
  { answer: "lupa", label: "лупа", part: 4,
    text: "Аксессуар для детектива из стекла,\nс ним бабушки читают, вышивают,\nбожественную кару муравья\nв мультфильмах им же совершают." },
  { answer: "queen", label: "дама пик", part: 5,
    text: "Скажи её имя три раза,\nлюбовно запрячь в рукаве.\nВалет, король, туз и шестёрка —\nкого не хватило тебе?" },
];

// Семь частей стиха «Все Смерти Нэнси Дрю» (Милена Степанян) — записи блокнота.
// Части 1–6 открываются по мере разгадки улик (порядок по ТЗ), седьмая — в финале.
const POEM_PARTS = [
  // 1 — яблоко
  `Больная тема, до глаз не дотронуться; сколько в лесах опасности, сколько живых. На яблоках следы твоей обуви, под ногтями — мыла, на клыках — помады.

Самый высокий этаж — под землёй; отказ зеркал, клубок до нитки. Громкость прощания лучше убавить, не то позовут на помощь.

Вы не похожи на привидений, вы — неудачная вылазка с чужой камерой; отвлекающий манёвр между авантюрным порывом и фатальной ошибкой.

Совершенно дурацкий акростих поэтийного детектива. Есть в этом что-то из детства. До сих пор не уверена, била ли меня няня, выдумка это или воспоминание.`,
  // 2 — плутон
  `Побочная информация совместного смеха. Беспечность привела к гибели детектива.

Ты только посмотри, что пчёлы с тобой сделали. Улей на виселичном дереве, подарок брату.

Нежеланный гость в поместье рыщет; хочешь, чтобы тебя избили, как вора, или вздёрнули, как соглядатая? Что-то опасное в ваших психических пульсациях было всегда.

Я знала, что нельзя упускать её из виду! Обнаружена девятая планета. Её назвали Плутон.`,
  // 3 — клык
  `Красный огонь, чёрная ночь, вернись, Шарлотта. **Кашель** **Голос** **Вой собак**.

Неизвестный: Да ты смотри дальше.

Решили звери ВДРУГ
Собраться вместе в круг.
Кто
ВЫХОДИТ
В
СЕРЕДИНУ,
Называет
ВСЕМ
сВоЁ
имя.
А
ЧЕТВЁРТЫЙ ПО ПОРЯДКУ
Отгадывает загадку.

Мы опоздали, мы долго не могли пошевелиться. Трава оторопела и воспламенилась. Я что-то видела и слышала рычание.`,
  // 4 — ключ
  `Звери собрались в круг. Второй шанс, два слова — ключ к знаниям. Красный огонь, чёрная ночь, Шарлотта, умоляю, вернись.

Ночью на болоте у замка ещё слышны ухмылки утопающей.

Ночью восход к шансу перестаёт быть наигранным, отговорки игриво танцуют, снег парит вверх, время ломает голову; пока падаешь, жених взаперти.

Гнилой пол спит и видит дневной свет, дом не спешит усыпить скрипом; нужное дерево упадёт в нужный момент; считалка отравленных вдохов.`,
  // 5 — лупа
  `Пропал Верховный судья, Мари кричит от ярости. Мне пора идти.

Неизвестный: Ты взгляни.
Неизвестный: Смотри дальше.

Стоп! Я знаю, кто вы! с вариантами ответа. В безнадёжно-запутанное положение трагедии включается детектив-любитель, тощий призрак / демонический почерк. Наблюдение за жизнью пагубно и смертельно.

Посмертные Автоматические стихи, гадание или признание или улики. Поговорим позже. Экран чернеет.`,
  // 6 — дама пик
  `Надежда на месть за сестру сестёр. Шарлотта, вернись. Загробный мир, наказание, коррупция пиковой дамы в неполной колоде.`,
  // 7 — финал: БЛОКНОТ (дневниковые записи из стиха)
  `★ БЛОКНОТ ★

Дневник убийцы читать интересней: «На моё имя снова пришёл странный конверт. Больше не получается внушать себе, что по ошибке: тёмная фотография Сибиллиного надгробия; обрезки неотличимых волос; карта с крестиком на гостинице, в которой я был с ней 23 октября посреди бела дня; уродливое чучело; уродливое чучело¹; и проч».

Дорогой дневник, сегодня я сделала это. Надела повязку на глаза, чтобы получить помощь призрака. Зачем я в пожаре, откуда такая страсть к переодеванию и поиску потайных ходов²? Иногда мои руки становятся руками ребёнка и тянутся к сигнализации, красной кнопке, аварийному молотку, чужим вещам, дневникам. Но я могу быть спокойна³. Обнаружена девятая планета. Её назвали Плутон. Как же долго я уже живу! Мне так везёт! Абразивный персонаж, он вместо помощи шептал что-то про крик земли, что ему не понравилось в Бостоне, что кататься ночью на лодке довольно опасно. Вместо объяснений случившегося, мне твердят: Спроси Мадам Изабеллу. Надо быть осторожней⁴. Мне пора идти.

Я засыпаю, не успев подняться в спальню. На этом берегу озера только я, орнитолог (запереть дверь!) и птицы, которые, чувствую, скоро нападут рывками на вспышку охоты. Предчувствую очередное ОСТОРОЖНО! Решусь под конец ещё написать: не беспокойся! Можешь пробовать заново столько раз, сколько захочешь. Я сделаю вид, что жива. Нэд⁵ и мой психоаналитик считают, это у меня в крови (Великая депрессия прошла мимо семьи отца). Ко времени возвращения он будет стариком.`,
];

// ── расстановка предметов: кабинет детектива, ночь ──────────────────────────
// Сцена по канонам hidden-object: предметы СТОЯТ на поверхностях (полки,
// стол, доска улик, ящик), масштаб растёт к переднему плану, искомые
// замаскированы соседями и светом. Порядок массива = слои отрисовки.
//
// Геометрия сцены (см. drawSceneBack):
//   окно x20..126 y24..146 · доска улик x146..342 y30..152
//   полка A (план y196) · полка B (план y254)
//   стол y300..372 · фасад/ящик y372..440
const ITEMS = [
  // — доска улик: пришпиленный хлам (s ~0.8, дальний план) —
  { id:"spider", kind:"spider",  x:330, y: 46, rot: 0,    s:0.72 },
  { id:"pencil", kind:"pencil",  x:158, y:118, rot: 1.35, s:0.8 },
  { id:"ringD",  kind:"ring",    x:248, y: 52, rot: 0,    s:0.74 },
  // гроздь ключей на гвозде в нижнем правом углу доски
  { id:"key2",   kind:"key",     x:296, y:130, rot: 1.42, s:0.78, v:1 },
  { id:"key3",   kind:"key",     x:316, y:134, rot: 1.58, s:0.86, v:2 },
  { id:"key4",   kind:"key",     x:334, y:128, rot: 1.5,  s:0.74, v:1 },
  // — полка A (баз. y≈196, s ~0.88): череп, свеча, склянка, бусы —
  { id:"skull",  kind:"skull",   x: 52, y:178, rot:-0.04, s:0.88 },
  { id:"candle", kind:"candle",  x:100, y:172, rot: 0,    s:0.85 },
  { id:"vial",   kind:"vial",    x:128, y:178, rot:-0.06, s:0.82 },
  { id:"beads",  kind:"beads",   x:236, y:188, rot: 0.15, s:0.85 },
  { id:"padlock",kind:"padlock", x:282, y:176, rot: 0,    s:0.9 },
  // — полка B (баз. y≈254, s ~0.92): компас, напёрсток, карта-обманка —
  { id:"compass",kind:"compass", x:258, y:240, rot: 0,    s:0.88 },
  { id:"thimble",kind:"thimble", x:300, y:244, rot: 0,    s:0.86 },
  { id:"card2",  kind:"card",    x:218, y:236, rot:-0.2,  s:0.85, v:"hearts" },
  { id:"star",   kind:"star",    x:334, y:240, rot: 0.18, s:0.8 },
  // — стол (y 305..355, s ~1.0): бумаги, кинжал, кости, монеты, конверт —
  { id:"env",    kind:"env",     x: 64, y:318, rot:-0.08, s:1.0 },
  { id:"dagger", kind:"dagger",  x:124, y:316, rot: 1.05, s:1.0 },
  { id:"die",    kind:"die",     x:196, y:312, rot: 0.1,  s:0.92 },
  { id:"die2",   kind:"die",     x:218, y:322, rot: 0.45, s:0.8 },
  { id:"coin",   kind:"coin",    x:168, y:344, rot: 0,    s:0.92 },
  { id:"coin2",  kind:"coin",    x: 96, y:352, rot: 0,    s:0.82 },
  { id:"card3",  kind:"card",    x:236, y:344, rot: 0.3,  s:0.95, v:"diam" },
  { id:"nail",   kind:"nail",    x:282, y:352, rot: 0.85, s:0.9 },
  // — ящик/пол (y 390..428, s ~1.1): передний план —
  { id:"ring2",  kind:"ring",    x:236, y:404, rot: 0,    s:1.05 },
  { id:"coin3",  kind:"coin",    x:296, y:410, rot: 0,    s:1.0 },
  // — искомые: позиция выбирается из вариантов при старте (реиграбельность);
  //   рисуются поверх соседей своей зоны, чтобы клик ловился надёжно —
  { id:"key",    kind:"key",   target:1, v:0 },
  { id:"pluto",  kind:"pluto", target:1 },
  { id:"lupa",   kind:"lupa",  target:1 },
  { id:"fang",   kind:"fang",  target:1 },
  { id:"queen",  kind:"queen", target:1 },
  { id:"apple",  kind:"apple", target:1 },
];

// варианты позиций искомых: при каждом запуске сцена собирается чуть иначе
const TARGET_SPOTS = {
  //              в грозди ключей на доске   |  на столе среди бумаг
  key:   [{ x:316, y:128, rot: 1.5,  s:0.8 }, { x:150, y:340, rot: 0.42, s:1.0 }],
  //              на полке A как глобус      |  на столе у лампы
  pluto: [{ x:182, y:180, rot: 0,    s:0.86 }, { x:258, y:316, rot: 0,    s:0.95 }],
  //              на бумагах стола           |  на полке B у книг
  lupa:  [{ x:142, y:330, rot:-0.5,  s:1.0 },  { x: 64, y:240, rot:-0.45, s:0.88 }],
  //              на полке A у черепа        |  в открытом ящике
  fang:  [{ x: 76, y:188, rot: 0.5,  s:0.85 }, { x:262, y:402, rot: 0.6,  s:1.05 }],
  //              пришпилена на доске улик   |  в раскладе карт на столе
  queen: [{ x:196, y: 64, rot:-0.08, s:0.78 }, { x:222, y:340, rot:-0.16, s:0.95 }],
  //              на столе слева             |  на полке A среди склянок
  apple: [{ x: 58, y:344, rot: 0.05, s:1.0 },  { x:158, y:184, rot: 0.05, s:0.85 }],
};
// выбранная раскладка (фиксируется на партию)
for (const it of ITEMS) {
  if (!it.target) continue;
  const spots = TARGET_SPOTS[it.kind];
  const pick = spots[Math.floor(Math.random() * spots.length)];
  Object.assign(it, pick);
}

// половина хит-бокса по виду предмета (для клика/наведения)
const HIT = {
  key:[26,12], ring:[12,12], vial:[10,20], spider:[14,12], pluto:[16,16],
  skull:[18,20], thimble:[11,13], padlock:[19,22], dagger:[10,30], beads:[18,12],
  env:[24,16], lupa:[20,20], pencil:[5,26], fang:[10,16], card:[18,25],
  queen:[18,25],
  die:[13,13], coin:[13,13], apple:[18,18], compass:[16,16], star:[16,16],
  candle:[10,24], nail:[6,16],
};

// ── состояние ───────────────────────────────────────────────────────────────
let currentRiddle = 0;
let foundIds      = new Set();
let solvedKinds   = new Set();
let collectedParts = [];        // части стиха, открытые в блокнот
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

// ── живая сцена + жанровые механики ──
let flight    = null;         // полёт найденного предмета в блокнот
let glints    = [];           // искры-глинты (авто-подсказка и «?»)
let glintT    = 10;           // таймер до следующего авто-глинта на цели
let stunT     = 0;            // оглушение за клик-спам
let missTimes = [];           // таймстампы промахов (окно для стана)
let tScene    = 0;            // время сцены (анимации)
let lampFlick = 1, lampTarget = 1;   // мерцание лампы (сглаженный шум)
// дождь за окном
const rain = Array.from({ length: 16 }, () => ({
  x: 0, y: Math.random() * 122, sp: 80 + Math.random() * 70,
  len: 7 + Math.random() * 7, dx: Math.random() * 106,
}));
// пыль в конусе лампы
const motes = Array.from({ length: 14 }, () => ({
  x: Math.random(), y: Math.random(),     // нормированные внутри конуса
  sp: 2.5 + Math.random() * 4, ph: Math.random() * 6.28,
}));

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
  queen: g => drawCard(g, "queen"),
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

// ═════════════════════════════════════════════════════════════════════════════
// СЦЕНА: кабинет детектива, ночь.
// Три слоя: drawSceneBack (всё ПОД предметами) → предметы → drawSceneFront
// (окклюдеры: книги, кромка ящика, лист бумаги) → световой пас (лампа+луна),
// который вшивает предметы в общее освещение.
// ═════════════════════════════════════════════════════════════════════════════

// геометрия (общая для рисования и анимаций)
const SCENE = {
  win:   { x: 20, y: 24, w: 106, h: 122 },        // окно
  board: { x: 146, y: 30, w: 196, h: 122 },       // доска улик
  shelfA: 196, shelfB: 254,                       // планки полок (верх)
  deskY: 300, deskFront: 372,                     // стол: задний и передний край
  lamp:  { x: 296, y: 296 },                      // центр абажура лампы
  drawer:{ x: 198, y: 384, w: 134, h: 46 },       // открытый ящик
};

function woodFill(g, x, y, w, h, base, dark, vertical = false) {
  g.fillStyle = vertical
    ? lin(g, x, y, x + w, y, [[0, dark], [0.5, base], [1, dark]])
    : lin(g, x, y, x, y + h, [[0, base], [1, dark]]);
  g.fillRect(x, y, w, h);
  // волокна
  g.strokeStyle = "rgba(0,0,0,0.16)"; g.lineWidth = 0.7;
  const n = Math.floor((vertical ? w : h) / 7);
  for (let i = 1; i < n; i++) {
    g.beginPath();
    if (vertical) { const fx = x + i * 7 + Math.sin(i * 3.1) * 2; g.moveTo(fx, y); g.lineTo(fx + 2, y + h); }
    else { const fy = y + i * 7 + Math.sin(i * 2.7) * 2; g.moveTo(x, fy); g.lineTo(x + w, fy + 2); }
    g.stroke();
  }
}

// книжный ряд: корешки на полке (baseY = верх планки)
function bookRow(g, x, baseY, books) {
  let cx = x;
  for (const [w, h, c, lean] of books) {
    g.save();
    g.translate(cx + w / 2, baseY);
    if (lean) g.rotate(lean);
    g.fillStyle = lin(g, -w / 2, 0, w / 2, 0, [[0, "rgba(0,0,0,0.4)"], [0.25, c], [0.85, c], [1, "rgba(0,0,0,0.3)"]]);
    g.fillRect(-w / 2, -h, w, h);
    g.fillStyle = "rgba(0,0,0,0.3)"; g.fillRect(-w / 2, -h, w, 3);
    g.strokeStyle = "rgba(235,210,160,0.28)"; g.lineWidth = 0.8;
    g.beginPath(); g.moveTo(-w / 2 + 2, -h + 8); g.lineTo(w / 2 - 2, -h + 8); g.stroke();
    g.beginPath(); g.moveTo(-w / 2 + 2, -h * 0.45); g.lineTo(w / 2 - 2, -h * 0.45); g.stroke();
    g.restore();
    cx += w + 1;
  }
  return cx;
}

function drawSceneBack(g) {
  const S = SCENE;

  // ── стена: тёмные обои с вертикальными полосами ──
  g.fillStyle = lin(g, 0, 0, 0, VH, [[0, "#241a14"], [0.5, "#2c2016"], [1, "#17100a"]]);
  g.fillRect(0, 0, VW, VH);
  g.strokeStyle = "rgba(64,46,28,0.35)"; g.lineWidth = 1;
  for (let x = 8; x < VW; x += 22) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 300); g.stroke(); }
  // узор обоев — ромбики между полосами
  g.fillStyle = "rgba(70,50,28,0.22)";
  for (let x = 19; x < VW; x += 22)
    for (let y = 12; y < 290; y += 26) {
      g.beginPath(); g.moveTo(x, y - 3); g.lineTo(x + 3, y); g.lineTo(x, y + 3); g.lineTo(x - 3, y); g.fill();
    }

  // ── окно: ночь, луна, далёкие крыши ──
  const W = S.win;
  // наличник
  g.fillStyle = lin(g, W.x - 8, 0, W.x + W.w + 8, 0, [[0, "#1c1209"], [0.5, "#3c2a16"], [1, "#1c1209"]]);
  g.fillRect(W.x - 8, W.y - 8, W.w + 16, W.h + 20);
  // ночное небо
  g.fillStyle = lin(g, 0, W.y, 0, W.y + W.h, [[0, "#0c1424"], [0.55, "#101a2e"], [1, "#182238"]]);
  g.fillRect(W.x, W.y, W.w, W.h);
  // луна с ореолом (верх-лево)
  g.fillStyle = rad(g, W.x + 28, W.y + 26, 2, 30, [[0, "rgba(200,220,250,0.55)"], [1, "rgba(200,220,250,0)"]]);
  g.fillRect(W.x, W.y, W.w, 60);
  g.fillStyle = "#dde8f8";
  g.beginPath(); g.arc(W.x + 28, W.y + 26, 9, 0, Math.PI * 2); g.fill();
  g.fillStyle = "rgba(170,190,215,0.5)";
  g.beginPath(); g.arc(W.x + 31, W.y + 24, 2.2, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(W.x + 25, W.y + 29, 1.5, 0, Math.PI * 2); g.fill();
  // звёзды
  g.fillStyle = "rgba(210,225,250,0.7)";
  for (const [sx, sy] of [[66, 34], [88, 48], [98, 30], [52, 56], [76, 70]])
    g.fillRect(W.x + sx, W.y + sy, 1.2, 1.2);
  // далёкие крыши/трубы на фоне неба
  g.fillStyle = "#0a0f1c";
  g.beginPath();
  g.moveTo(W.x, W.y + 92);
  g.lineTo(W.x + 18, W.y + 92); g.lineTo(W.x + 18, W.y + 78); g.lineTo(W.x + 24, W.y + 78);
  g.lineTo(W.x + 24, W.y + 88); g.lineTo(W.x + 48, W.y + 88); g.lineTo(W.x + 56, W.y + 72);
  g.lineTo(W.x + 60, W.y + 72); g.lineTo(W.x + 60, W.y + 64); g.lineTo(W.x + 64, W.y + 64);
  g.lineTo(W.x + 64, W.y + 84); g.lineTo(W.x + 88, W.y + 84); g.lineTo(W.x + 88, W.y + 95);
  g.lineTo(W.x + W.w, W.y + 95); g.lineTo(W.x + W.w, W.y + W.h); g.lineTo(W.x, W.y + W.h);
  g.closePath(); g.fill();
  // огни в дальних окнах
  g.fillStyle = "rgba(255,196,110,0.55)";
  for (const [lx, ly] of [[30, 102], [44, 110], [70, 96], [94, 104], [12, 108]])
    g.fillRect(W.x + lx, W.y + ly, 2.6, 3.4);
  // запотевшее стекло — холодная дымка снизу
  g.fillStyle = lin(g, 0, W.y + W.h - 44, 0, W.y + W.h, [[0, "rgba(150,180,220,0)"], [1, "rgba(150,180,220,0.13)"]]);
  g.fillRect(W.x, W.y + W.h - 44, W.w, 44);
  // переплёт рамы
  g.fillStyle = "#241808";
  g.fillRect(W.x + W.w / 2 - 2.5, W.y, 5, W.h);
  g.fillRect(W.x, W.y + W.h / 2 - 2.5, W.w, 5);
  g.strokeStyle = "rgba(120,90,50,0.4)"; g.lineWidth = 1;
  g.strokeRect(W.x + 0.5, W.y + 0.5, W.w - 1, W.h - 1);
  // подоконник
  g.fillStyle = lin(g, 0, W.y + W.h, 0, W.y + W.h + 12, [[0, "#4a3318"], [1, "#241608"]]);
  g.fillRect(W.x - 12, W.y + W.h, W.w + 24, 12);

  // ── доска улик: пробка, фото, нити, булавки ──
  const B = S.board;
  // деревянная рама
  g.fillStyle = lin(g, B.x - 7, 0, B.x + B.w + 7, 0, [[0, "#1e1409"], [0.5, "#412d15"], [1, "#1e1409"]]);
  g.fillRect(B.x - 7, B.y - 7, B.w + 14, B.h + 14);
  // пробка
  g.fillStyle = lin(g, 0, B.y, 0, B.y + B.h, [[0, "#6b4a26"], [1, "#4a3118"]]);
  g.fillRect(B.x, B.y, B.w, B.h);
  // фактура пробки
  for (let i = 0; i < 240; i++) {
    const px = B.x + Math.random() * B.w, py = B.y + Math.random() * B.h;
    g.fillStyle = Math.random() < 0.5 ? "rgba(30,18,8,0.18)" : "rgba(190,140,80,0.10)";
    g.fillRect(px, py, 1.6, 1.2);
  }
  // внутренняя тень рамы
  g.strokeStyle = "rgba(0,0,0,0.45)"; g.lineWidth = 3;
  g.strokeRect(B.x + 1.5, B.y + 1.5, B.w - 3, B.h - 3);

  // пришпиленные бумаги (фото, записка, обрывок карты)
  const pin = (px, py, col = "#a33") => {
    g.fillStyle = "rgba(0,0,0,0.35)"; g.beginPath(); g.arc(px + 1, py + 1.6, 2.6, 0, Math.PI * 2); g.fill();
    g.fillStyle = col; g.beginPath(); g.arc(px, py, 2.6, 0, Math.PI * 2); g.fill();
    g.fillStyle = "rgba(255,255,255,0.5)"; g.beginPath(); g.arc(px - 0.8, py - 0.8, 0.9, 0, Math.PI * 2); g.fill();
  };
  const paper = (px, py, pw, ph, rot, col) => {
    g.save(); g.translate(px, py); g.rotate(rot);
    g.fillStyle = "rgba(0,0,0,0.4)"; g.fillRect(-pw / 2 + 2, -ph / 2 + 3, pw, ph);
    g.fillStyle = col; g.fillRect(-pw / 2, -ph / 2, pw, ph);
    g.restore();
  };
  // фото-карточки (сепия, силуэты)
  paper(176, 62, 34, 42, -0.06, "#c9b794");
  g.save(); g.translate(176, 62); g.rotate(-0.06);
  g.fillStyle = "#7a6649"; g.fillRect(-13, -17, 26, 26);
  g.fillStyle = "#3c3022";
  g.beginPath(); g.arc(0, -8, 5, 0, Math.PI * 2); g.fill();            // голова-силуэт
  g.beginPath(); g.ellipse(0, 3, 8, 6, 0, Math.PI, 0); g.fill();       // плечи
  g.restore();
  paper(228, 86, 36, 30, 0.10, "#cbb892");
  g.save(); g.translate(228, 86); g.rotate(0.10);
  g.fillStyle = "#6e5a40"; g.fillRect(-14, -11, 28, 18);
  g.strokeStyle = "#4a3a26"; g.lineWidth = 1;                          // домик на фото
  g.strokeRect(-8, -6, 9, 8); g.beginPath(); g.moveTo(-9, -6); g.lineTo(-3.5, -10); g.lineTo(2, -6); g.stroke();
  g.restore();
  // записка с каракулями
  paper(286, 70, 38, 44, 0.05, "#d9cba6");
  g.save(); g.translate(286, 70); g.rotate(0.05);
  g.strokeStyle = "rgba(60,40,20,0.55)"; g.lineWidth = 0.9;
  for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(-14, i * 5); g.lineTo(14, i * 5 + (i % 2) * 1.5); g.stroke(); }
  g.strokeStyle = "rgba(150,40,30,0.8)"; g.lineWidth = 1.4;
  g.beginPath(); g.arc(4, -5, 7, 0, Math.PI * 2); g.stroke();          // красный кружок-обводка
  g.restore();
  // обрывок старой карты (отсылка к прежнему «коробу»)
  paper(196, 120, 52, 38, -0.04, "#b69160");
  g.save(); g.translate(196, 120); g.rotate(-0.04);
  g.strokeStyle = "rgba(60,38,16,0.5)"; g.lineWidth = 0.8;
  g.beginPath(); g.ellipse(-6, 0, 14, 10, 0, 0, Math.PI * 2); g.stroke();
  g.setLineDash([2, 3]); g.beginPath(); g.moveTo(-20, 8); g.quadraticCurveTo(0, -6, 22, 4); g.stroke(); g.setLineDash([]);
  g.fillStyle = "rgba(150,40,30,0.85)";
  g.beginPath(); g.moveTo(14, -4); g.lineTo(18, 0); g.moveTo(18, -4); g.lineTo(14, 0); // ✕ метка
  g.save(); g.strokeStyle = "rgba(150,40,30,0.85)"; g.lineWidth = 1.6;
  g.beginPath(); g.moveTo(13, -5); g.lineTo(19, 1); g.moveTo(19, -5); g.lineTo(13, 1); g.stroke(); g.restore();
  g.restore();
  // красные нити между булавками
  g.strokeStyle = "rgba(178,44,32,0.75)"; g.lineWidth = 1.1;
  const thread = (x1, y1, x2, y2, sag = 6) => {
    g.beginPath(); g.moveTo(x1, y1);
    g.quadraticCurveTo((x1 + x2) / 2, Math.max(y1, y2) + sag, x2, y2); g.stroke();
  };
  thread(176, 44, 286, 50, 9);
  thread(176, 44, 228, 78, 7);
  thread(286, 50, 196, 104, 10);
  thread(228, 78, 286, 50, 5);
  // булавки поверх нитей
  pin(176, 44); pin(228, 78, "#3a6"); pin(286, 50); pin(196, 104, "#c92");
  // гвоздь под ключи (нижний правый угол доски)
  g.fillStyle = "#888070"; g.fillRect(314, 112, 3, 6);
  g.fillStyle = "#b8b0a0"; g.beginPath(); g.arc(315.5, 112, 2.4, 0, Math.PI * 2); g.fill();

  // ── стеллаж: две планки ──
  for (const py of [S.shelfA, S.shelfB]) {
    // тень под планкой
    g.fillStyle = lin(g, 0, py + 8, 0, py + 26, [[0, "rgba(0,0,0,0.5)"], [1, "rgba(0,0,0,0)"]]);
    g.fillRect(14, py + 8, VW - 28, 18);
    // планка с торцом
    woodFill(g, 14, py, VW - 28, 8, "#5a3d1e", "#33200e");
    g.fillStyle = "rgba(255,220,160,0.18)"; g.fillRect(14, py, VW - 28, 1.4);
  }
  // боковые стойки стеллажа
  woodFill(g, 8, S.shelfA - 42, 9, S.shelfB - S.shelfA + 58, "#422c14", "#241608", true);
  woodFill(g, VW - 17, S.shelfA - 42, 9, S.shelfB - S.shelfA + 58, "#422c14", "#241608", true);

  // книги на полках (фон для предметов)
  bookRow(g, 150, S.shelfA, [[10, 44, "#5a3030"], [12, 50, "#2e4242"], [9, 40, "#6b5a2c", 0.0],
                             [11, 46, "#46332a"], [8, 38, "#39424e"]]);
  bookRow(g, 96, S.shelfB, [[11, 46, "#463046"], [9, 40, "#2c4434"], [12, 50, "#5c4424"],
                            [10, 42, "#363c50"], [9, 38, "#583232"], [10, 44, "#2f4040"]]);
  // банка на полке A (за клыком) — стеклянный силуэт
  g.save(); g.translate(76, SCENE.shelfA - 1);
  g.fillStyle = "rgba(170,200,210,0.13)";
  g.beginPath(); roundRect(g, -12, -34, 24, 34, 5); g.fill();
  g.fillStyle = "rgba(120,150,160,0.2)"; g.fillRect(-12, -38, 24, 5);
  g.strokeStyle = "rgba(200,230,240,0.22)"; g.lineWidth = 1;
  g.beginPath(); g.moveTo(-8, -30); g.lineTo(-8, -6); g.stroke();
  g.restore();

  // ── стол ──
  // столешница в перспективе (трапеция)
  g.beginPath();
  g.moveTo(26, S.deskY); g.lineTo(VW - 26, S.deskY);
  g.lineTo(VW - 6, S.deskFront); g.lineTo(6, S.deskFront);
  g.closePath();
  g.fillStyle = lin(g, 0, S.deskY, 0, S.deskFront, [[0, "#6e4c24"], [0.5, "#5a3c1c"], [1, "#462c12"]]);
  g.fill();
  // волокна столешницы (расходятся в перспективе)
  g.strokeStyle = "rgba(0,0,0,0.18)"; g.lineWidth = 0.8;
  for (let i = 1; i < 9; i++) {
    const tx = 26 + (VW - 52) * i / 9, bx = 6 + (VW - 12) * i / 9;
    g.beginPath(); g.moveTo(tx, S.deskY); g.lineTo(bx, S.deskFront); g.stroke();
  }
  // задний кант столешницы
  g.fillStyle = "rgba(255,220,160,0.14)"; g.fillRect(26, S.deskY, VW - 52, 1.5);

  // бумаги на столе (под предметами): пара листов
  const sheet = (px, py, pw, ph, rot, col = "#cdbd97") => {
    g.save(); g.translate(px, py); g.rotate(rot);
    g.fillStyle = "rgba(0,0,0,0.3)"; g.fillRect(-pw / 2 + 2, -ph / 2 + 2.5, pw, ph);
    g.fillStyle = col; g.fillRect(-pw / 2, -ph / 2, pw, ph);
    g.strokeStyle = "rgba(70,50,26,0.4)"; g.lineWidth = 0.8;
    for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(-pw / 2 + 4, i * 6); g.lineTo(pw / 2 - 4, i * 6); g.stroke(); }
    g.restore();
  };
  sheet(140, 332, 64, 44, -0.10);
  sheet(180, 344, 58, 40, 0.14, "#c2b08a");
  sheet(60, 330, 48, 38, 0.06);

  // ── лампа (корпус; свет добавит lightPass) ──
  const L = S.lamp;
  // основание на столе
  g.fillStyle = lin(g, L.x - 16, 0, L.x + 16, 0, [[0, "#241a0c"], [0.5, "#5c4724"], [1, "#241a0c"]]);
  g.beginPath(); g.ellipse(L.x + 6, 354, 17, 5.5, 0, 0, Math.PI * 2); g.fill();
  // стойка
  g.strokeStyle = "#3a2c14"; g.lineWidth = 4.5; g.lineCap = "round";
  g.beginPath(); g.moveTo(L.x + 6, 352); g.quadraticCurveTo(L.x + 10, 318, L.x + 2, L.y + 10); g.stroke();
  g.strokeStyle = "#6b5226"; g.lineWidth = 1.6;
  g.beginPath(); g.moveTo(L.x + 5, 350); g.quadraticCurveTo(L.x + 9, 318, L.x + 1, L.y + 10); g.stroke();
  // абажур (конус, зелёное стекло «банкирки»)
  g.beginPath();
  g.moveTo(L.x - 26, L.y + 8); g.lineTo(L.x + 26, L.y + 8);
  g.lineTo(L.x + 14, L.y - 10); g.lineTo(L.x - 14, L.y - 10);
  g.closePath();
  g.fillStyle = lin(g, L.x - 26, 0, L.x + 26, 0, [[0, "#0e2e1a"], [0.45, "#2e6b3c"], [0.6, "#4e9a58"], [1, "#0e2e1a"]]);
  g.fill();
  g.fillStyle = "rgba(255,250,210,0.85)";
  g.beginPath(); g.ellipse(L.x, L.y + 8, 24, 4, 0, 0, Math.PI); g.fill(); // светящийся срез
  g.fillStyle = "#caa84e";
  g.beginPath(); g.arc(L.x, L.y - 11, 3, 0, Math.PI * 2); g.fill();

  // ── фасад стола + открытый ящик ──
  woodFill(g, 0, S.deskFront, VW, VH - S.deskFront, "#3c280f", "#190f05");
  // тень от столешницы на фасаде
  g.fillStyle = lin(g, 0, S.deskFront, 0, S.deskFront + 14, [[0, "rgba(0,0,0,0.55)"], [1, "rgba(0,0,0,0)"]]);
  g.fillRect(0, S.deskFront, VW, 14);
  // закрытый ящик слева (с ручкой)
  g.strokeStyle = "rgba(0,0,0,0.5)"; g.lineWidth = 2;
  g.strokeRect(28, 388, 142, 40);
  g.strokeStyle = "rgba(190,150,90,0.18)"; g.lineWidth = 1;
  g.strokeRect(31, 391, 136, 34);
  g.fillStyle = lin(g, 0, 404, 0, 412, [[0, "#8a6a32"], [1, "#46300f"]]);
  g.beginPath(); g.ellipse(99, 408, 14, 4.4, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#241608"; g.beginPath(); g.ellipse(99, 408, 9, 2.4, 0, 0, Math.PI * 2); g.fill();
  // ОТКРЫТЫЙ ящик справа: корпус выдвинут
  const D = S.drawer;
  // тень под выдвинутым ящиком
  g.fillStyle = "rgba(0,0,0,0.5)";
  g.beginPath(); g.ellipse(D.x + D.w / 2, D.y + D.h + 4, D.w * 0.56, 7, 0, 0, Math.PI * 2); g.fill();
  // внутренность
  g.fillStyle = lin(g, 0, D.y, 0, D.y + D.h, [[0, "#120a04"], [1, "#2e1d0c"]]);
  g.fillRect(D.x, D.y, D.w, D.h);
  // стенки
  g.fillStyle = "#553a1a"; g.fillRect(D.x, D.y, D.w, 5);
  g.fillStyle = "#3c2810"; g.fillRect(D.x, D.y, 5, D.h); g.fillRect(D.x + D.w - 5, D.y, 5, D.h);
  // ткань, свисающая из ящика
  g.fillStyle = "#5e5a6e";
  g.beginPath();
  g.moveTo(D.x + 8, D.y + 6); g.quadraticCurveTo(D.x + 34, D.y + 2, D.x + 52, D.y + 10);
  g.lineTo(D.x + 46, D.y + D.h + 10); g.quadraticCurveTo(D.x + 26, D.y + D.h + 18, D.x + 12, D.y + D.h + 6);
  g.closePath(); g.fill();
  g.strokeStyle = "rgba(255,255,255,0.12)"; g.lineWidth = 1;
  g.beginPath(); g.moveTo(D.x + 18, D.y + 8); g.quadraticCurveTo(D.x + 24, D.y + 26, D.x + 20, D.y + D.h + 4); g.stroke();
  g.beginPath(); g.moveTo(D.x + 34, D.y + 6); g.quadraticCurveTo(D.x + 38, D.y + 22, D.x + 34, D.y + D.h + 6); g.stroke();
}

// окклюдеры — рисуются ПОВЕРХ предметов: частичное перекрытие (канон жанра)
function drawSceneFront(g) {
  const S = SCENE;
  // стопка книг на краю полки B — перекрывает соседей справа
  g.save(); g.translate(40, S.shelfB);
  for (const [bw, bh, c, dy] of [[34, 9, "#4c3322", 0], [30, 8, "#37424a", -9], [32, 8.5, "#5a4426", -17.5]]) {
    g.fillStyle = lin(g, -bw / 2, 0, bw / 2, 0, [[0, "rgba(0,0,0,0.4)"], [0.2, c], [0.9, c], [1, "rgba(0,0,0,0.35)"]]);
    g.fillRect(-bw / 2, dy - bh, bw, bh);
    g.fillStyle = "rgba(230,210,170,0.25)"; g.fillRect(-bw / 2, dy - bh, bw, 1.2);
  }
  g.restore();
  // лист бумаги, наполовину прикрывающий центр стола
  g.save(); g.translate(196, 360); g.rotate(-0.07);
  g.fillStyle = "rgba(0,0,0,0.3)"; g.fillRect(-26 + 2, -16 + 2, 52, 32);
  g.fillStyle = "#d3c29a"; g.fillRect(-26, -16, 52, 32);
  g.strokeStyle = "rgba(70,50,26,0.45)"; g.lineWidth = 0.8;
  for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(-21, i * 7); g.lineTo(21, i * 7 + 1); g.stroke(); }
  g.strokeStyle = "rgba(150,40,30,0.7)"; g.lineWidth = 1.2;
  g.beginPath(); g.arc(8, 2, 6, 0, Math.PI * 2); g.stroke();
  g.restore();
  // передняя кромка открытого ящика — перекрывает низ предметов в ящике
  const D = S.drawer;
  g.fillStyle = lin(g, 0, D.y + D.h, 0, D.y + D.h + 13, [[0, "#5e4220"], [0.5, "#3a2710"], [1, "#1c1106"]]);
  g.fillRect(D.x - 4, D.y + D.h, D.w + 8, 13);
  g.fillStyle = "#241608"; g.beginPath(); g.ellipse(D.x + D.w / 2, D.y + D.h + 6.5, 8, 2.2, 0, 0, Math.PI * 2); g.fill();
}

// световой пас: вшивает предметы в общее освещение сцены
function lightPass(g) {
  const L = SCENE.lamp, W = SCENE.win;
  // 1) общее затемнение к краям (ночь)
  g.globalCompositeOperation = "multiply";
  g.fillStyle = rad(g, L.x - 40, 330, 60, 430, [[0, "#ffffff"], [0.55, "#cdc2b2"], [1, "#6e6474"]]);
  g.fillRect(0, 0, VW, VH);
  // 2) тёплый свет лампы — пятно на столе + общий ореол
  g.globalCompositeOperation = "screen";
  g.fillStyle = rad(g, L.x - 14, L.y + 26, 6, 150, [[0, "rgba(255,196,92,0.34)"], [0.4, "rgba(255,170,70,0.16)"], [1, "rgba(255,160,60,0)"]]);
  g.fillRect(0, 0, VW, VH);
  // конус света вниз-влево на стол
  g.save();
  g.beginPath();
  g.moveTo(L.x - 20, L.y + 6); g.lineTo(L.x + 18, L.y + 6);
  g.lineTo(L.x + 6, 374); g.lineTo(L.x - 150, 374);
  g.closePath(); g.clip();
  g.fillStyle = lin(g, 0, L.y, 0, 376, [[0, "rgba(255,208,110,0.30)"], [1, "rgba(255,190,90,0.05)"]]);
  g.fillRect(0, L.y, VW, 380 - L.y);
  g.restore();
  // 3) холодный лунный столб из окна — на полку и левый край стола
  g.save();
  g.beginPath();
  g.moveTo(W.x + 4, W.y + W.h); g.lineTo(W.x + W.w, W.y + W.h);
  g.lineTo(W.x + W.w - 38, 368); g.lineTo(W.x - 26, 340);
  g.closePath(); g.clip();
  g.fillStyle = lin(g, 0, W.y + W.h, 0, 370, [[0, "rgba(150,182,228,0.14)"], [1, "rgba(150,182,228,0.02)"]]);
  g.fillRect(0, W.y, VW, 380);
  g.restore();
  g.globalCompositeOperation = "source-over";
  // 4) виньетка
  g.fillStyle = rad(g, VW / 2, VH * 0.45, VH * 0.3, VH * 0.85, [[0, "rgba(0,0,0,0)"], [1, "rgba(8,5,2,0.55)"]]);
  g.fillRect(0, 0, VW, VH);
  // 5) зерно плёнки
  for (let i = 0; i < 700; i++) {
    const x = Math.random() * VW, y = Math.random() * VH;
    g.globalAlpha = Math.random() * 0.055;
    g.fillStyle = Math.random() < 0.6 ? "#0a0602" : "#ffe2b0";
    g.fillRect(x, y, 1, 1);
  }
  g.globalAlpha = 1;
}

// собрать статичный кэш: фон → предметы → окклюдеры → свет
function buildCache() {
  octx.setTransform(SS, 0, 0, SS, 0, 0);
  octx.clearRect(0, 0, VW, VH);
  drawSceneBack(octx);
  for (const it of ITEMS) {
    const found = foundIds.has(it.id);
    const hb = HIT[it.kind] || [14, 14];
    if (!found) contactShadow(octx, it.x, it.y + hb[1] * 0.5, hb[0], hb[1], 0.4);
    drawItem(octx, it, found ? 0.14 : 1);
  }
  drawSceneFront(octx);
  lightPass(octx);
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
  if (stunT > 0 || flight) return;   // оглушён за спам / предмет ещё летит в блокнот
  const p = canvasToWorld(e);
  const it = pickItem(p.x, p.y);
  if (!it) return;
  if (it.kind === RIDDLES[currentRiddle].answer) onCorrect(it);
  else onWrong(p.x, p.y);
});
addEventListener("keydown", e => {
  if (e.code !== "Escape") return;
  if (nbOverlay.classList.contains("show")) closeNotebook();
  else backToMap();
});

hintBtn.addEventListener("click", () => {
  if (hintCd > 0 || state !== "play") return;
  hintActive = 3.2; hintCd = HINT_CD;
});

// ── реакции ───────────────────────────────────────────────────────────────────
// центр кнопки блокнота в координатах сцены — туда летит найденный предмет
function notebookAnchor() {
  const r = notebookBtn.getBoundingClientRect();
  const c = canvas.getBoundingClientRect();
  return {
    x: (r.left + r.width / 2 - c.left - offX) / scale,
    y: (r.top + 6 - c.top - offY) / scale,
  };
}

function onCorrect(it) {
  foundIds.add(it.id);
  solvedKinds.add(it.kind);
  thud(0.8);
  ensureAudio(); chime(8, 0.28);
  flash("flash-right");
  spawnDissolve(it);
  hintActive = 0;
  glints.length = 0; glintT = 12 + Math.random() * 6;
  buildCache();                       // предмет «взят» — со сцены исчезает
  // находка летит в блокнот (канон жанра); запись и следующая улика — по прилёте
  const dest = notebookAnchor();
  const part = POEM_PARTS[RIDDLES[currentRiddle].part];
  flight = {
    it: { ...it }, t: 0, dur: 0.78,
    x0: it.x, y0: it.y, x1: dest.x, y1: dest.y,
    cx: (it.x + dest.x) / 2 + 36, cy: Math.min(it.y, dest.y) - 56,
    onArrive() {
      appendNotebook(part);
      chime(12, 0.16);
      currentRiddle++;
      updateHUD();
      if (currentRiddle >= RIDDLES.length) onWin();
      else showCurrentRiddle();
    },
  };
}
function onWrong(x, y) {
  creak();
  flash("flash-wrong");
  shake = Math.max(shake, 5);
  blots.push({ x, y, r: 0, life: 0, ttl: 0.9 });
  // анти-спам: 3 промаха за 2 секунды — курсор «оглушён» (канон жанра)
  const now = performance.now();
  missTimes = missTimes.filter(t => now - t < 2000);
  missTimes.push(now);
  if (missTimes.length >= 3) {
    stunT = 1.4;
    missTimes = [];
    shake = Math.max(shake, 8);
    canvas.style.cursor = "not-allowed";
  }
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
// ── блокнот: кнопка зовёт открыть страницу со всем собранным текстом ──────────
let nudgeT = null;
function appendNotebook(text) {
  collectedParts.push(text);
  if (nbCountEl) nbCountEl.textContent = `${collectedParts.length} / 7`;
  notebookBtn.classList.add("has-new");      // мигаем — есть свежая запись
  showNudge();
}
function showNudge() {
  if (!nbNudge) return;
  nbNudge.classList.add("show");
  clearTimeout(nudgeT);
  nudgeT = setTimeout(() => nbNudge.classList.remove("show"), 4000);
}
function renderNotebook() {
  if (!nbTextEl) return;
  if (collectedParts.length === 0) {
    nbTextEl.innerHTML = `<span class="nb-empty">страница пуста — разгадай улику на сцене</span>`;
    return;
  }
  nbTextEl.innerHTML = "";
  collectedParts.forEach((p, i) => {
    const d = document.createElement("div");
    d.className = "nb-stanza" + (i === 6 ? " nb-final" : "");
    d.style.animationDelay = (i * 0.07) + "s";
    d.textContent = p;
    nbTextEl.appendChild(d);
  });
}
function openNotebook() {
  renderNotebook();
  nbOverlay.classList.add("show");
  notebookBtn.classList.remove("has-new");
  if (nbNudge) nbNudge.classList.remove("show");
}
function closeNotebook() { nbOverlay.classList.remove("show"); }

notebookBtn.addEventListener("click", openNotebook);
if (nbCloseBtn) nbCloseBtn.addEventListener("click", closeNotebook);
nbOverlay.addEventListener("click", e => { if (e.target === nbOverlay) closeNotebook(); });

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
  appendNotebook(POEM_PARTS[6]);              // часть 7 — дневник — вписывается в финале
  const secs = Math.round((performance.now() - startT) / 1000);
  const mm = Math.floor(secs / 60), ss = secs % 60;
  if (winStats) winStats.textContent = `улик раскрыто ${RIDDLES.length} · время ${mm}:${String(ss).padStart(2, "0")}`;
  if (winPoem) winPoem.textContent = collectedParts.join("\n\n");
  hintBtn.disabled = true;
  // открываем блокнот сразу — последняя запись должна быть видна
  setTimeout(() => { openNotebook(); buildCache(); }, 400);
  // win-оверлей — после того как прочли блокнот, задержка больше;
  // стих проявляется построчным каскадом вместе с показом оверлея
  setTimeout(() => { if (winPoem) osRevealLines(winPoem); winOv.classList.add("show"); }, 4200);
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

  // ── живая сцена ──
  // дождь за стеклом
  const W = SCENE.win;
  ctx.save();
  ctx.beginPath(); ctx.rect(W.x, W.y, W.w, W.h); ctx.clip();
  ctx.strokeStyle = "rgba(168,198,235,0.30)"; ctx.lineWidth = 1;
  for (const d of rain) {
    ctx.beginPath();
    ctx.moveTo(W.x + d.dx, W.y + d.y);
    ctx.lineTo(W.x + d.dx - 2.2, W.y + d.y + d.len);
    ctx.stroke();
  }
  ctx.restore();
  // мерцание лампы — дышащий тёплый ореол поверх statik-света
  const L = SCENE.lamp;
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const fa = 0.12 * lampFlick;
  const fg = ctx.createRadialGradient(L.x - 12, L.y + 22, 4, L.x - 12, L.y + 22, 130);
  fg.addColorStop(0, `rgba(255,200,100,${fa})`);
  fg.addColorStop(1, "rgba(255,200,100,0)");
  ctx.fillStyle = fg;
  ctx.fillRect(L.x - 150, L.y - 20, 290, 180);
  ctx.restore();
  // пыль в конусе света (дрейфует вверх, мерцает)
  for (const m of motes) {
    const mx = L.x - 18 - m.x * 120 * (0.35 + m.y * 0.65);
    const my = L.y + 12 + m.y * (370 - L.y - 14);
    const ma = 0.22 * (0.5 + 0.5 * Math.sin(tScene * m.sp * 0.45 + m.ph)) * (1 - m.y * 0.5) * lampFlick;
    ctx.fillStyle = `rgba(255,224,160,${ma})`;
    ctx.fillRect(mx, my, 1.4, 1.4);
  }

  // наведение — лёгкий «подъём» предмета (мягкий тёплый ореол + чуть крупнее)
  if (hover && !foundIds.has(hover.id) && state === "play") {
    ctx.save();
    ctx.shadowColor = "rgba(255,226,150,0.8)"; ctx.shadowBlur = 12;
    drawItem(ctx, { ...hover, s: (hover.s || 1) * 1.05 }, 1);
    ctx.restore();
  }

  // искры-глинты (авто-намёк на искомый предмет; чаще во время «?»)
  for (const gl of glints) {
    const k = gl.life / gl.ttl;
    const a = Math.sin(k * Math.PI);
    const r = 2.5 + a * 5;
    ctx.save();
    ctx.translate(gl.x, gl.y); ctx.rotate(k * 1.3);
    ctx.strokeStyle = `rgba(255,240,190,${0.92 * a})`;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(-r, 0); ctx.lineTo(r, 0);
    ctx.moveTo(0, -r); ctx.lineTo(0, r);
    ctx.stroke();
    ctx.fillStyle = `rgba(255,255,235,${0.8 * a})`;
    ctx.beginPath(); ctx.arc(0, 0, 1.3 + a, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // полёт найденного предмета в блокнот (квадратичная кривая, сжатие)
  if (flight) {
    const p = Math.min(1, flight.t / flight.dur);
    const e2 = p * p * (3 - 2 * p);          // smoothstep
    const u = 1 - e2;
    const fx = u * u * flight.x0 + 2 * u * e2 * flight.cx + e2 * e2 * flight.x1;
    const fy = u * u * flight.y0 + 2 * u * e2 * flight.cy + e2 * e2 * flight.y1;
    ctx.save();
    ctx.shadowColor = "rgba(255,220,140,0.9)"; ctx.shadowBlur = 14;
    drawItem(ctx, { ...flight.it, x: fx, y: fy, s: (flight.it.s || 1) * (1 - e2 * 0.66) }, 1 - e2 * 0.2);
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

  // оглушение за клик-спам: сцена на миг «уплывает» в темноту
  if (stunT > 0) {
    ctx.fillStyle = `rgba(8,4,2,${0.30 * Math.min(1, stunT)})`;
    ctx.fillRect(0, 0, VW, VH);
  }

  ctx.restore();
}

// ── update ─────────────────────────────────────────────────────────────────────
function update(dt) {
  tScene += dt;
  if (shake > 0) shake = Math.max(0, shake - dt * 26);
  if (hintActive > 0) hintActive = Math.max(0, hintActive - dt);
  if (hintCd > 0) {
    hintCd = Math.max(0, hintCd - dt);
    hintBtn.disabled = hintCd > 0 || state !== "play";   // на перезарядке — просто притушена
  }
  // оглушение
  if (stunT > 0) {
    stunT = Math.max(0, stunT - dt);
    if (stunT === 0) canvas.style.cursor = "crosshair";
  }
  // дождь
  const W = SCENE.win;
  for (const d of rain) {
    d.y += d.sp * dt;
    if (d.y > W.h) { d.y = -d.len; d.dx = Math.random() * W.w; }
  }
  // мерцание лампы: сглаженный случайный шум
  if (Math.random() < dt * 1.6) lampTarget = 0.72 + Math.random() * 0.34;
  lampFlick += (lampTarget - lampFlick) * Math.min(1, dt * 9);
  // пыль дрейфует вверх вдоль конуса
  for (const m of motes) {
    m.y -= dt * 0.018 * m.sp;
    if (m.y < 0) { m.y = 1; m.x = Math.random(); }
  }
  // во время «?» цель осыпается искрами
  if (hintActive > 0 && state === "play" && Math.random() < dt * 5) {
    const tgt = ITEMS.find(it => it.kind === RIDDLES[currentRiddle].answer && !foundIds.has(it.id));
    if (tgt) {
      const hb = HIT[tgt.kind] || [14, 14];
      glints.push({
        x: tgt.x + (Math.random() - 0.5) * hb[0] * 1.6,
        y: tgt.y + (Math.random() - 0.5) * hb[1] * 1.6,
        life: 0, ttl: 0.7,
      });
    }
  }
  // авто-глинт: сцена сама изредка подмигивает искомым предметом
  glintT -= dt;
  if (glintT <= 0 && state === "play" && !flight) {
    const tgt = ITEMS.find(it => it.kind === RIDDLES[currentRiddle].answer && !foundIds.has(it.id));
    if (tgt) {
      const hb = HIT[tgt.kind] || [14, 14];
      glints.push({
        x: tgt.x + (Math.random() - 0.5) * hb[0],
        y: tgt.y - hb[1] * 0.4 - Math.random() * 6,
        life: 0, ttl: 0.95,
      });
    }
    glintT = 11 + Math.random() * 8;
  }
  for (let i = glints.length - 1; i >= 0; i--) {
    const gl = glints[i]; gl.life += dt;
    if (gl.life >= gl.ttl) glints.splice(i, 1);
  }
  // полёт находки в блокнот
  if (flight) {
    flight.t += dt;
    // хвост из тёплых искр
    if (Math.random() < 0.55) {
      const p = Math.min(1, flight.t / flight.dur);
      const e2 = p * p * (3 - 2 * p), u = 1 - e2;
      particles.push({
        x: u * u * flight.x0 + 2 * u * e2 * flight.cx + e2 * e2 * flight.x1,
        y: u * u * flight.y0 + 2 * u * e2 * flight.cy + e2 * e2 * flight.y1,
        vx: (Math.random() - 0.5) * 30, vy: (Math.random() - 0.5) * 20,
        life: 0, ttl: 0.4 + Math.random() * 0.3, r: 0.8 + Math.random() * 1.4,
        col: "rgba(255,224,150,",
      });
    }
    if (flight.t >= flight.dur) { const f = flight; flight = null; f.onArrive(); }
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

// dev-хуки: снять кадр / протикать логику при скрытом окне (rAF спит)
if (import.meta.env.DEV) {
  window.__snap = () => { render(performance.now()); return canvas.toDataURL("image/jpeg", 0.72); };
  window.__tick = (dt = 0.1) => update(dt);
  window.__state = () => ({ riddle: currentRiddle, found: foundIds.size, flight: !!flight, parts: collectedParts.length });
}

// ── старт ──────────────────────────────────────────────────────────────────────
osPowerOn();
osBindLinks();
if (!showCompleted("nancy-drew", "нэнси дрю")) {
  osTitleCard({ index: "02", title: "нэнси дрю", poem: "все смерти нэнси дрю", author: "милена степанян" });
  fitCanvas();
  buildCache();
  startT = performance.now();
  showCurrentRiddle();
  updateHUD();
  requestAnimationFrame(loop);
}

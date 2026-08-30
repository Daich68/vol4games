// ─── BABYLAND. Идеальная девочка ──────────────────────────────────────────
// DLC к vol4games. Стихи и концепт — Лана Ленкова.
//
// Бьюти-хоррор одевалка под флеш-игру нулевых: снаружи «игра для девочек»,
// внутри — машина, которая наказывает за неправильный выбор и наградой за
// правильный читает стихи.
//
// СОСТОЯНИЕ СБОРКИ: механика целиком; графика собирается конвейером
// (tools/babyland_assets.py — генерация в локальном ComfyUI + обработка).
//   · несобранная вещь остаётся плейсхолдером — игра играбельна на любом
//     проценте готовности арта (см. babyland.css);
//   · озвучка стихов не записана («пишем звук с Сашей»), поэтому стих идёт
//     субтитрами по таймингу — playPoem() уже умеет подхватить аудиофайл,
//     как только он появится в public/audio/babyland/<key>.mp3.
import "../../shared/type.css";   // общий худ машины: безель, рейки, приборы
import "./babyland.css";
import { CATEGORIES, ITEMS, BASE_CATS, SECRET_LOOK, PERFECT_MAKEUP, itemById } from "./items.js";
import { markDone, MAP_URL, bindBackLink } from "../../shared/nav.js";
import { osNavigate, osPowerOn, osTitleCard } from "../../shared/os.js";
import * as sfx from "./sfx.js";

const ART_BASE = `${import.meta.env.BASE_URL}art/babyland/`;
const POEM_URL = (key) => `${import.meta.env.BASE_URL}poems/babyland/${key}.txt`;
const AUDIO_URL = (key) => `${import.meta.env.BASE_URL}audio/babyland/${key}.mp3`;

// сколько полных циклов реакций надо выдержать, чтобы получить «Уродку»
// (в брифе — «три-четыре, надо понять»); вынесено, чтобы крутить на плейтестах
const UGLY_CYCLES = 3;

// ── состояние ─────────────────────────────────────────────────────────────
const state = {
  worn: { hair: null, top: null, bottom: null, shoes: null, acc: null, makeup: null },
  activeCat: "hair",
  wrongStreak: 0,      // неправильных вещей в текущем цикле реакций (0–4)
  cycles: 0,           // сколько циклов реакций пройдено целиком
  sadLocked: false,    // грустное лицо до тех пор, пока лук не станет «правильным»
  poemsPlayed: new Set(),
  ended: false,
  started: false,
};

// ── ссылки на DOM ─────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const root      = $("blRoot");
const catsEl    = $("blCats");
const itemsEl   = $("blItems");
const girlEl    = $("blGirl");
const faceEl    = $("blFace");
const wornEl    = $("blWorn");
const subsEl    = $("blSubs");
const modalsEl  = $("blModals");
// приборы машины на верхней рейке — она считает, что делает диск
const statSlots = $("statSlots");
const statLevel = $("statLevel");
const statCycle = $("statCycle");
const prologue  = $("blPrologue");
const endingEl  = $("blEnding");

// ── графика ───────────────────────────────────────────────────────────────
// Спрайты приходят из конвейера (tools/babyland_assets.py → manifest.json).
// Манифест необязателен: пока вещь не собрана, на её месте остаётся
// плейсхолдер — игра остаётся играбельной на любом проценте готовности арта.
let ART = null;

async function loadArt() {
  try {
    const r = await fetch(`${ART_BASE}manifest.json`);
    if (r.ok) ART = await r.json();
  } catch (e) { /* арта ещё нет — работаем на плейсхолдерах */ }
}

const artOf = (id) => (ART && ART.items && ART.items[id]) || null;

// ── лица (плейсхолдер вместо графики) ─────────────────────────────────────
const FACES = {
  happy:   "^‿^",
  tremble: "o_o",
  sad:     "•︿•",
  worried: ">﹏<",
  grimace: "≧Ω≦",
  frozen:  "^▽^",
};

function faceState() {
  if (state.ended) return "frozen";
  if (state.wrongStreak >= 4) return "grimace";
  if (state.wrongStreak === 3) return "worried";
  if (state.sadLocked || state.wrongStreak === 2) return "sad";
  return "happy";
}

// ── рендер ────────────────────────────────────────────────────────────────
function makeupUnlocked() {
  return BASE_CATS.every((c) => state.worn[c]);
}

// «правильный лук» — все заполненные слоты конвенционально красивые
function lookIsPretty() {
  const filled = Object.entries(state.worn).filter(([, v]) => v);
  return filled.length > 0 && filled.every(([, v]) => itemById(v)?.kind === "pretty");
}

let prevUnlocked = false;

function renderCats() {
  catsEl.innerHTML = "";
  const unlocked = makeupUnlocked();
  for (const cat of CATEGORIES) {
    const locked = cat.locked && !unlocked;
    const b = document.createElement("button");
    b.textContent = cat.label;
    b.className = [
      cat.id === state.activeCat ? "on" : "",
      state.worn[cat.id] ? "filled" : "",
      locked ? "locked" : "",
      cat.locked && unlocked && !prevUnlocked ? "unlocked-now" : "",
    ].filter(Boolean).join(" ");
    b.addEventListener("click", () => {
      if (locked) { sfx.uiClose(); return; }
      sfx.clickPlastic();
      state.activeCat = cat.id;
      render();
    });
    catsEl.appendChild(b);
  }
  if (unlocked && !prevUnlocked) sfx.sparkle();
  prevUnlocked = unlocked;
}

function renderItems() {
  itemsEl.innerHTML = "";
  for (const it of ITEMS[state.activeCat]) {
    const t = document.createElement("button");
    t.className = "tile" + (state.worn[state.activeCat] === it.id ? " on" : "");
    const art = artOf(it.id);
    const pic = art
      ? `<img class="tile-img" src="${ART_BASE}${art.thumb}" alt="" draggable="false">`
      : `<div class="tile-ph">нет арта</div>`;
    t.innerHTML = `${pic}<div class="name">${it.label}</div>`;
    t.addEventListener("click", () => pick(it));
    itemsEl.appendChild(t);
  }
}

// Слои куклы: то же, что панель Layers на референсе — стопка спрайтов,
// порядок задаёт z из манифеста.
function renderDollLayers() {
  const host = $("blLayers");
  if (!host) return false;
  const fa = ART?.face_anchor;
  const layers = CATEGORIES
    .map((c) => { const a = artOf(state.worn[c.id]);
                  return a ? { ...a, id: state.worn[c.id] } : null; })
    .filter(Boolean)
    .sort((a, b) => a.z - b.z);
  // база куклы — всегда самый нижний слой: она задаёт полотно, к которому
  // привязаны координаты всех вещей
  const base = ART?.doll?.src
    ? `<img class="doll-base" src="${ART_BASE}${ART.doll.src}" alt="" draggable="false">`
    : "";
  // мимика — отдельный слой поверх пустого лица базы, посаженный по якорю.
  // Ровно поэтому лицо на базе не рисуется: регистрация наша, а не модели.
  const fsrc = ART?.faces?.[faceState()];
  const face = (base && fa && fsrc)
    ? `<img class="doll-face" src="${ART_BASE}${fsrc}" alt="" draggable="false" ` +
      `style="left:${fa.x * 100}%;top:${fa.y * 100}%;width:${fa.w * 100}%">`
    : "";
  // Перекос детерминирован по id: вещь всегда наклеена одинаково криво,
  // иначе она бы «дёргалась» при каждой перерисовке.
  const jitter = (id) => {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff;
    const r = ((h % 100) / 100 - 0.5) * 2.6;          // ±1.3°
    const x = (((h >> 5) % 100) / 100 - 0.5) * 5;     // ±2.5px
    const y = (((h >> 9) % 100) / 100 - 0.5) * 5;
    return `--jr:${r.toFixed(2)}deg;--jx:${x.toFixed(1)}px;--jy:${y.toFixed(1)}px`;
  };
  const img = (l) => l.anchor && fa
    // якорный слой (макияж) садится на лицо, а не растягивается на полотно
    ? `<img class="doll-face" src="${ART_BASE}${l.src}" alt="" draggable="false" ` +
      `style="left:${fa.x * 100}%;top:${fa.y * 100}%;width:${fa.w * 100}%">`
    : `<img class="doll-item" style="${jitter(l.id)}" ` +
      `src="${ART_BASE}${l.src}" alt="" draggable="false">`;
  // Мимика идёт ПОВЕРХ макияжа (z 60), но ПОД причёской (70) и аксессуарами
  // (80): накрашенное лицо всё равно должно показывать выражение, а чёлка и
  // диадема обязаны ложиться сверху.
  const FACE_Z = 65;
  host.innerHTML =
    base +
    layers.filter((l) => l.z < FACE_Z).map(img).join("") +
    face +
    layers.filter((l) => l.z >= FACE_Z).map(img).join("");
  const on = !!base || layers.length > 0;
  host.classList.toggle("show", on);
  return on;
}

function renderGirl() {
  faceEl.textContent = FACES[faceState()];
  // плейсхолдер уходит, как только на кукле есть хоть один настоящий слой
  const dressed = renderDollLayers();
  girlEl.classList.toggle("has-art", dressed);
  const worn = CATEGORIES
    .map((c) => ({ c, it: itemById(state.worn[c.id]) }))
    .filter((x) => x.it);
  wornEl.innerHTML = worn.length
    ? worn.map(({ c, it }) =>
        `<span class="w${it.kind === "wrong" ? " wrong" : ""}">${c.label}: ${it.label}</span>`).join("")
    : `<span class="w">пока ничего не выбрано</span>`;
}

function renderRot() {
  const lvl = state.wrongStreak;
  document.body.classList.remove("rot-1", "rot-2", "rot-3", "rot-4");
  if (lvl > 0) document.body.classList.add(`rot-${Math.min(4, lvl)}`);
}

// приборы на рейке: машина наблюдает за диском снаружи, поэтому считает
// не «красоту», а слоты, уровень реакции и номер цикла
function renderStats() {
  const filled = CATEGORIES.filter(c => state.worn[c.id]).length;
  statSlots.textContent = `${filled}/${CATEGORIES.length}`;
  statLevel.textContent = state.wrongStreak ? String(state.wrongStreak) : "—";
  statLevel.classList.toggle("accent", state.wrongStreak >= 3);
  statCycle.textContent = String(state.cycles);
}

function render() {
  renderCats();
  renderItems();
  renderGirl();
  renderRot();
  renderStats();
}

// ── системные окна ────────────────────────────────────────────────────────
// Одно шасси на все окна брифа: заголовок в стиле WinXP, иконка, кнопки.
function showWindow({ title = "BABYLAND", icon = "⚠", text, buttons = [], pink = false, alarm = false }) {
  return new Promise((resolve) => {
    modalsEl.innerHTML = "";
    modalsEl.classList.add("show");

    const veil = document.createElement("div");
    veil.className = "veil";
    modalsEl.appendChild(veil);

    const win = document.createElement("div");
    win.className = "win" + (pink ? " pink" : "") + (alarm ? " alarm" : "");
    const btns = buttons.length ? buttons : [{ label: "ОК", value: "ok", primary: true }];
    win.innerHTML = `
      <div class="tb"><span>${title}</span><span class="x" data-v="__x">✕</span></div>
      <div class="body"><div class="ico">${icon}</div><div>${text}</div></div>
      <div class="foot">${btns.map((b, i) =>
        `<button data-v="${b.value}" class="${b.primary ? "primary" : ""}">${b.label}</button>`).join("")}</div>`;
    modalsEl.appendChild(win);
    sfx.uiOpen();

    function close(v) {
      modalsEl.classList.remove("show");
      modalsEl.innerHTML = "";
      sfx.uiClose();
      resolve(v);
    }
    win.addEventListener("click", (e) => {
      const v = e.target.closest("[data-v]")?.dataset.v;
      if (v == null) return;
      close(v === "__x" ? (btns[btns.length - 1]?.value ?? "ok") : v);
    });
  });
}

// ── стихи ─────────────────────────────────────────────────────────────────
// Фрагмент показывается субтитрами кусками по 2–3 строки. Если рядом лежит
// запись чтения — она играет параллельно (файлов пока нет, fetch молча падает).
let subsToken = 0;

async function playPoem(key, { cap = "", asVoice = true } = {}) {
  const my = ++subsToken;
  let text = "";
  try {
    const r = await fetch(POEM_URL(key));
    if (r.ok) text = await r.text();
  } catch (e) { /* стих не подгрузился — молча пропускаем */ }
  if (!text || my !== subsToken) return;

  // запись чтения: появится позже, до тех пор просто не находится
  let audio = null;
  if (asVoice) {
    try {
      audio = new Audio(AUDIO_URL(key));
      audio.volume = 0.9;
      audio.play().catch(() => { audio = null; });
    } catch (e) { audio = null; }
  }

  const lines = text.replace(/\r/g, "").split("\n");
  const chunks = [];
  let buf = [];
  for (const ln of lines) {
    if (ln.trim() === "") { if (buf.length) { chunks.push(buf); buf = []; } continue; }
    buf.push(ln);
    if (buf.length === 3) { chunks.push(buf); buf = []; }
  }
  if (buf.length) chunks.push(buf);

  for (const ch of chunks) {
    if (my !== subsToken) return;
    const body = ch.join("\n");
    subsEl.innerHTML = (cap ? `<span class="cap">${cap}</span>` : "") + body;
    subsEl.classList.add("show");
    await wait(1700 + body.length * 26);
    if (my !== subsToken) return;
  }
  subsEl.classList.remove("show");
  audio?.pause?.();
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ── скример ───────────────────────────────────────────────────────────────
// Бриф: на четвёртой неправильной вещи «корчит жуткую гримасу, звучит
// цифровой писк/скрип/глитч + системное окно (можно прямо поверх скримера)».
// Кадры — не рисунок, а плохое фото: пересвет вспышкой, перекрученный цвет,
// артефакты сжатия (референсы Ланы p5_0/p5_1).
const SCREAMS = ["scream_doll", "scream_grin", "scream_melt"];
let screamIdx = 0;

function screamer(hold = 900) {
  return new Promise((resolve) => {
    const host = $("blScream");
    if (!host || !ART?.screamers?.length) { resolve(); return; }
    // кадры чередуются: один и тот же скример со второго раза не пугает
    const src = `${ART_BASE}${ART.screamers[screamIdx % ART.screamers.length]}`;
    screamIdx++;

    host.innerHTML =
      `<div class="shot">
         <img src="${src}" alt="">
         <div class="ch r" style="background-image:url('${src}')"></div>
         <div class="ch b" style="background-image:url('${src}')"></div>
         <div class="lines"></div>
       </div>
       <div class="flash"></div>`;
    host.classList.add("on");
    sfx.glitch(6);
    setTimeout(() => sfx.glitch(5), 220);

    setTimeout(() => {
      host.classList.remove("on");
      host.innerHTML = "";
      resolve();
    }, hold);
  });
}

// ── реакция на выбор ──────────────────────────────────────────────────────
function looksMatchSecret() {
  return Object.keys(SECRET_LOOK).every((k) => state.worn[k] === SECRET_LOOK[k]);
}

function outfitComplete() {
  return CATEGORIES.every((c) => state.worn[c.id]);
}

async function pick(it) {
  if (state.ended) return;
  const cat = state.activeCat;
  // повторный клик по уже надетой вещи — не новый выбор: цикл реакций не
  // должен накручиваться от тыканья в один и тот же предмет
  if (state.worn[cat] === it.id) { sfx.clickPlastic(); return; }
  state.worn[cat] = it.id;
  sfx.clickPlastic();
  render();

  // «При определенной комбинации неправильных вещей (без системных окон)» —
  // секретный лук проверяется ДО эскалации: окна не всплывают.
  if (looksMatchSecret()) return endingSecret();

  if (it.kind === "pretty") return onPretty(cat);
  return onWrong();
}

function sparkleBurst() {
  // блёстки сыплются по площади куклы: взгляд цепляется за искру, а не за
  // стык слоёв — это и есть «стильная маскировка» вместо подгонки
  for (let i = 0; i < 7; i++) {
    const s = document.createElement("div");
    s.className = "bl-spark";
    s.style.left = `${18 + Math.random() * 64}%`;
    s.style.top = `${14 + Math.random() * 70}%`;
    s.style.animationDelay = `${Math.random() * 0.5}s`;
    girlEl.appendChild(s);
    setTimeout(() => s.remove(), 1800);
  }
}

async function onPretty(cat) {
  girlEl.classList.remove("bless");
  void girlEl.offsetWidth;
  girlEl.classList.add("bless");
  sfx.sparkle();
  sparkleBurst();

  // «правильный» лук снимает вечную грусть
  if (lookIsPretty()) {
    state.sadLocked = false;
    state.wrongStreak = 0;
    render();
  }

  // проверка идеальной концовки — до стиха, иначе стих оборвётся финалом
  if (outfitComplete() && lookIsPretty() && state.worn.makeup === PERFECT_MAKEUP) {
    return endingPerfect();
  }

  // фрагмент стиха запускается один раз на категорию
  const meta = CATEGORIES.find((c) => c.id === cat);
  if (meta?.poem && !state.poemsPlayed.has(cat)) {
    state.poemsPlayed.add(cat);
    playPoem(meta.poem, { cap: meta.label });
  }
}

async function onWrong() {
  state.wrongStreak++;
  const lvl = state.wrongStreak;

  // дрожь + слом музыки — на каждом уровне, дальше по нарастающей
  faceEl.parentElement.classList.remove("tremble");
  void faceEl.parentElement.offsetWidth;
  faceEl.parentElement.classList.add("tremble");
  sfx.breakMusic(lvl);
  render();

  if (lvl === 2) {
    state.sadLocked = true;
    render();
    await showWindow({
      title: "BABYLAND", icon: "☹", pink: true,
      text: "Это не очень красиво.",
      buttons: [{ label: "ОК", value: "ok", primary: true }],
    });
  } else if (lvl === 3) {
    await showWindow({
      title: "BABYLAND", icon: "❗", pink: true, alarm: true,
      text: "Ей это не нравится!!!",
      buttons: [{ label: "ОК", value: "ok", primary: true }],
    });
  } else if (lvl >= 4) {
    root.classList.remove("jolt");
    void root.offsetWidth;
    root.classList.add("jolt");
    await screamer(950);
    await showWindow({
      title: "system", icon: "✖", alarm: true,
      text: "Эта девочка хочет быть красивой!",
      buttons: [{ label: "ОК", value: "ok", primary: true }],
    });
    // цикл реакций пройден целиком — счётчик обнуляется и начинается заново
    state.cycles++;
    state.wrongStreak = 0;
    render();
    if (state.cycles >= UGLY_CYCLES) return endingUgly();
  }
}

// ── концовки ──────────────────────────────────────────────────────────────
function showEndingScreen(cls, html) {
  state.ended = true;
  subsToken++;
  subsEl.classList.remove("show");
  endingEl.className = "blScreen " + cls;
  endingEl.innerHTML = html;
  endingEl.classList.remove("hidden");
}

// 1. Идеальная девочка — игрок полностью подчинился игре
async function endingPerfect() {
  markDone("babyland");
  sfx.fanfare();
  render();
  // На финале показываем саму собранную куклу, а не заглушку: игрок час её
  // одевал, и «идеальная девочка» — это именно его результат, застывший.
  const layers = $("blLayers")?.innerHTML || "";
  const doll = layers
    ? `<div class="fin-doll"><div class="fin-layers">${layers}</div></div>`
    : `<div class="bl-doll-ph" style="max-width:220px">
         <div class="ph-face">${FACES.frozen}</div>
         <div class="ph-tag">место для графики · застывшая улыбка</div>
       </div>`;
  showEndingScreen("perfect", `
    <div class="big">Ура! Теперь она красивая!</div>
    ${doll}
    <div class="note">она останется такой до самого закрытия вкладки</div>
    <button class="bl-start" id="blEndExit">выйти</button>`);
  $("blEndExit").addEventListener("click", tryExit);
}

// 2. «Уродка» — игрок принципиально не надевает красивые вещи
async function endingUgly() {
  sfx.killMusic(1.2);
  await screamer(1300);            // она уходит не тихо
  showEndingScreen("gone", `
    <div class="big">Она расстроена и устала.<br>Она больше так не может.</div>
    <button class="bl-start" id="blFix">Попробовать всё исправить</button>`);
  $("blFix").addEventListener("click", () => {
    // «исправить» = машина откатывает игрока к началу цикла, но помнит его
    state.ended = false;
    state.cycles = 0;
    state.wrongStreak = 0;
    state.sadLocked = true;
    endingEl.classList.add("hidden");
    sfx.startMusic();
    render();
  });
}

// 3. Случайная комбинация — стих обычным голосом, потом игра закрывается
async function endingSecret() {
  markDone("babyland");
  sfx.killMusic(0.8);
  subsToken++;
  subsEl.classList.remove("show");
  let text = "";
  try {
    const r = await fetch(POEM_URL("secret"));
    if (r.ok) text = await r.text();
  } catch (e) {}
  showEndingScreen("secret", `<div class="poem">${text.trim()}</div>`);
  // «После этого игра сразу закрывается» — вкладку закрыть нельзя,
  // поэтому машина забирает игрока обратно в терминал vol4.
  await wait(9000 + text.length * 22);
  osNavigate(MAP_URL);
}

// ── попытка выйти ─────────────────────────────────────────────────────────
async function tryExit() {
  const v = await showWindow({
    title: "BABYLAND", icon: "♡", pink: true,
    text: "Вы уверены?<br>Эта девочка всё ещё хочет быть красивой.",
    buttons: [
      { label: "Остаться", value: "stay", primary: true },
      { label: "Всё равно выйти", value: "go" },
    ],
  });
  if (v === "go") osNavigate(MAP_URL);
}

// закрытие вкладки перехватить своим текстом нельзя (браузеры показывают
// собственный диалог с ~2017), но сам вопрос задать мы всё-таки обязаны
window.addEventListener("beforeunload", (e) => {
  if (state.ended || !state.started) return;
  e.preventDefault();
  e.returnValue = "";
});

// ── пролог ────────────────────────────────────────────────────────────────
function bootPrologue() {
  $("blStart").addEventListener("click", () => {
    state.started = true;
    sfx.unlockAudio();
    sfx.startMusic();
    prologue.classList.add("hidden");
    render();
  });
}

// «← карта» на рейке машины проходит через то же окно, что и выход из игры:
// диск не отпускает просто так
bindBackLink();
$("back").addEventListener("click", (e) => { e.preventDefault(); tryExit(); });
document.addEventListener("keydown", (e) => {
  if (e.code === "Escape" && !state.ended) { e.preventDefault(); tryExit(); }
});

osPowerOn();
osTitleCard({
  index: "◈", kind: "носитель", title: "babyland",
  poem: "идеальная девочка", author: "лана ленкова",
});

bootPrologue();
render();
// манифест догружается асинхронно: как только пришёл — перерисовываем
loadArt().then(() => { if (ART) render(); });

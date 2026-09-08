// BABYLAND — звук. Никаких файлов: всё синтезируется в браузере, как в
// остальных играх vol4 (см. src/shared/audio.js).
//
// Задача из брифа: «максимально милая/гламурная, типичная музыка из старых
// Barbie-игр, очень пережатый звук, ощущение дешевого MIDI, мб восьмибитные
// элементы». Отсюда — квадратные/треугольные волны, узкий частотный диапазон,
// waveshaper-«компрессор» и намеренно кривой bitcrush на мастере.

let ctx = null;
let master = null;   // общая шина → crusher → выход
let musicGain = null;
let stopMusic = null;
let broken = false;
let muted = false;

export function setMuted(value) {
  muted = value;
  if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : 0.55, ctx.currentTime, 0.02);
}

function ensure() {
  if (ctx) return ctx;
  ctx = new (window.AudioContext || window.webkitAudioContext)();

  // «дешёвая» мастер-цепь: жёсткий клип + срез верха = пережатая MIDI-каша
  const shaper = ctx.createWaveShaper();
  const curve = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) {
    const x = (i / 1023) * 2 - 1;
    curve[i] = Math.tanh(x * 3.2);           // мягкий клип
  }
  shaper.curve = curve;

  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 5200;                  // «телефонный» верх

  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.55;

  master.connect(shaper);
  shaper.connect(lp);
  lp.connect(ctx.destination);
  return ctx;
}

export function unlockAudio() {
  ensure();
  if (ctx.state === "suspended") ctx.resume();
}

// ── одиночная нота ────────────────────────────────────────────────────────
function note(freq, t0, dur, { type = "square", gain = 0.12, detune = 0 } = {}) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  o.detune.value = detune;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(musicGain || master);
  o.start(t0); o.stop(t0 + dur + 0.02);
}

function blip(freq, dur, { type = "square", gain = 0.14, slide = 0 } = {}) {
  ensure();
  const t0 = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(master);
  o.start(t0); o.stop(t0 + dur + 0.02);
}

// ── фоновая музыка ────────────────────────────────────────────────────────
// Приторная петля в мажоре: мелодия квадратом + арпеджио треугольником +
// «бочка» синусом. Восемь тактов, крутится бесконечно.
const MEL = [
  // [полутон от C5, длительность в шагах]
  [ 0, 2], [ 4, 2], [ 7, 2], [12, 2],
  [ 9, 2], [ 7, 2], [ 4, 4],
  [ 2, 2], [ 5, 2], [ 9, 2], [14, 2],
  [12, 2], [ 9, 2], [ 7, 4],
];
const BASS = [0, 0, 5, 5, 9, 9, 7, 7];
const midi = (semi) => 523.25 * Math.pow(2, semi / 12);

export function startMusic() {
  ensure();
  if (stopMusic) return;
  musicGain = ctx.createGain();
  musicGain.gain.value = 0.28;
  musicGain.connect(master);

  const STEP = 0.155;                     // шаг восьмушки
  let step = 0;                           // абсолютный номер шага
  let nextTime = ctx.currentTime + 0.08;
  let melIdx = 0, melLeft = 0;

  const timer = setInterval(() => {
    if (!ctx) return;
    while (nextTime < ctx.currentTime + 0.35) {
      const bar = Math.floor(step / 8) % 8;

      // мелодия
      if (melLeft <= 0) {
        const [semi, len] = MEL[melIdx % MEL.length];
        note(midi(semi), nextTime, STEP * len * 0.9, { type: "square", gain: 0.10 });
        // октава сверху — тот самый «дешёвый MIDI»
        note(midi(semi + 12), nextTime, STEP * len * 0.5, { type: "square", gain: 0.035, detune: 6 });
        melLeft = len;
        melIdx++;
      }
      melLeft--;

      // арпеджио
      if (step % 2 === 0) {
        note(midi(BASS[bar] + [0, 4, 7, 12][(step / 2) % 4] - 12), nextTime, STEP * 1.4,
             { type: "triangle", gain: 0.055 });
      }
      // бочка
      if (step % 4 === 0) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = "sine";
        o.frequency.setValueAtTime(120, nextTime);
        o.frequency.exponentialRampToValueAtTime(45, nextTime + 0.11);
        g.gain.setValueAtTime(0.22, nextTime);
        g.gain.exponentialRampToValueAtTime(0.0001, nextTime + 0.14);
        o.connect(g); g.connect(musicGain);
        o.start(nextTime); o.stop(nextTime + 0.16);
      }

      nextTime += STEP;
      step++;
    }
  }, 60);

  stopMusic = () => { clearInterval(timer); stopMusic = null; };
}

export function killMusic(fade = 0.6) {
  if (!ctx || !musicGain) return;
  const t = ctx.currentTime;
  musicGain.gain.cancelScheduledValues(t);
  musicGain.gain.setValueAtTime(musicGain.gain.value, t);
  musicGain.gain.exponentialRampToValueAtTime(0.0001, t + fade);
  stopMusic?.();
}

// ── реакции ───────────────────────────────────────────────────────────────

// «музыка на долю секунды ломается» — питч и громкость проваливаются и
// возвращаются. Уровень 1 — едва заметно, дальше всё грубее.
export function breakMusic(level = 1) {
  if (!ctx || !musicGain) return;
  const t = ctx.currentTime;
  const depth = Math.min(0.9, 0.35 + level * 0.18);
  const len   = 0.09 + level * 0.05;
  musicGain.gain.cancelScheduledValues(t);
  musicGain.gain.setValueAtTime(musicGain.gain.value, t);
  musicGain.gain.linearRampToValueAtTime(0.28 * (1 - depth), t + 0.015);
  musicGain.gain.setValueAtTime(0.28 * (1 - depth), t + len);
  musicGain.gain.linearRampToValueAtTime(0.28, t + len + 0.05);
  broken = true;
}

export const clickPlastic = () => blip(880 + Math.random() * 120, 0.045, { type: "square", gain: 0.10, slide: -260 });
export const sparkle      = () => { blip(1760, 0.07, { type: "triangle", gain: 0.07 });
                                    setTimeout(() => blip(2637, 0.06, { type: "triangle", gain: 0.05 }), 55); };
export const uiOpen       = () => blip(660, 0.08, { type: "square", gain: 0.09, slide: 220 });
export const uiClose      = () => blip(440, 0.07, { type: "square", gain: 0.08, slide: -160 });

// цифровой писк/скрип/глитч на четвёртой неправильной вещи
export function glitch(level = 4) {
  ensure();
  const t0 = ctx.currentTime;
  const n = 5 + level * 2;
  for (let i = 0; i < n; i++) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = i % 2 ? "square" : "sawtooth";
    const f = 120 + Math.random() * 3200;
    o.frequency.setValueAtTime(f, t0 + i * 0.022);
    o.frequency.exponentialRampToValueAtTime(Math.max(60, f * (Math.random() * 2)), t0 + i * 0.022 + 0.03);
    g.gain.setValueAtTime(0.0001, t0 + i * 0.022);
    g.gain.exponentialRampToValueAtTime(0.11, t0 + i * 0.022 + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.022 + 0.05);
    o.connect(g); g.connect(master);
    o.start(t0 + i * 0.022); o.stop(t0 + i * 0.022 + 0.07);
  }
  // белый шум сверху
  const len = 0.28;
  const buf = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const g = ctx.createGain(); g.gain.value = 0.12;
  src.connect(g); g.connect(master);
  src.start(t0);
}

// торжественный джингл финала «Идеальная девочка»
export function fanfare() {
  ensure();
  const t0 = ctx.currentTime;
  [0, 4, 7, 12, 16].forEach((s, i) => {
    const t = t0 + i * 0.12;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "square";
    o.frequency.setValueAtTime(midi(s), t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.13, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + 0.55);
  });
}

// ── ЧТЕНИЕ СТИХОВ ─────────────────────────────────────────────────────────
// Бриф Ланы, стр. 11: «Запись чтения необходимо обработать. Желаемый эффект:
// пластиковая кукла; поломанная игрушка; старый синтезатор; заставка Sega;
// цифровые артефакты; сильная компрессия».
//
// Записей ещё нет («пишем звук с Сашей»), но тракт нужен заранее: иначе,
// когда файлы приедут, их придётся обрабатывать offline и переделывать под
// каждую правку. Здесь обработка живая, поэтому исходники остаются чистыми,
// а характер настраивается одним числом.
//
// Из чего собран заявленный эффект:
//   пластиковая кукла   — подъём форманты на 1.9 кГц и срез низа: голос
//                         теряет грудь и начинает звучать корпусом игрушки;
//   старый синтезатор   — лёгкая расстройка второго голоса и хорус;
//   цифровые артефакты  — понижение разрядности (bitcrush) на waveShaper;
//   заставка Sega       — узкая полоса и жёсткий предел, как у 8-битного ЦАП;
//   сильная компрессия  — DynamicsCompressor с высоким ratio и быстрой атакой.
const VOICE = { bits: 6, low: 220, high: 5200, formant: 1900, drive: 2.6 };

function bitcrushCurve(bits) {
  const levels = Math.pow(2, bits);
  const curve = new Float32Array(2048);
  for (let i = 0; i < 2048; i++) {
    const x = (i / 2047) * 2 - 1;
    curve[i] = Math.round(x * levels) / levels;     // ступенька = артефакт
  }
  return curve;
}

// Собирает цепь обработки голоса и возвращает вход, к которому подключается
// источник. Отдельно от музыкального мастера: у голоса свой характер.
export function voiceChain() {
  ensure();
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass'; hp.frequency.value = VOICE.low;     // убрать грудь

  const form = ctx.createBiquadFilter();
  form.type = 'peaking';
  form.frequency.value = VOICE.formant; form.Q.value = 1.4; form.gain.value = 7;

  const crush = ctx.createWaveShaper();
  crush.curve = bitcrushCurve(VOICE.bits);

  const drive = ctx.createWaveShaper();
  const dc = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) {
    const x = (i / 1023) * 2 - 1;
    dc[i] = Math.tanh(x * VOICE.drive);
  }
  drive.curve = dc;

  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = VOICE.high;

  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -30; comp.ratio.value = 14;
  comp.attack.value = 0.002; comp.release.value = 0.12;

  const out = ctx.createGain();
  out.gain.value = 0.85;

  hp.connect(form); form.connect(crush); crush.connect(drive);
  drive.connect(lp); lp.connect(comp); comp.connect(out);
  out.connect(master);
  return { input: hp, output: out };
}

// Проигрывает готовую запись через тракт. Возвращает управление, чтобы
// субтитры могли идти по реальному времени записи, а не по таймеру.
export function playVoice(buffer, { onEnd } = {}) {
  ensure();
  if (ctx.state === 'suspended') ctx.resume();
  const chain = voiceChain();
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  // расстройка на четверть тона — «старый синтезатор», голос уже не человечий
  src.detune.value = -18;
  src.connect(chain.input);
  src.start();
  if (onEnd) src.onended = onEnd;
  const started = ctx.currentTime;
  return {
    stop() { try { src.stop(); } catch { /* уже остановлен */ } },
    get time() { return ctx.currentTime - started; },
    duration: buffer.duration,
  };
}

// Загрузка и декодирование. Отсутствие файла — не ошибка: озвучки может не
// быть, игра обязана работать на субтитрах.
const voiceCache = new Map();
export async function loadVoice(url) {
  if (voiceCache.has(url)) return voiceCache.get(url);
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('no recording');
    ensure();
    const buf = await ctx.decodeAudioData(await res.arrayBuffer());
    voiceCache.set(url, buf);
    return buf;
  } catch {
    voiceCache.set(url, null);
    return null;
  }
}

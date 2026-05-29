// Небольшая звуковая библиотека на WebAudio. Без файлов — всё синтезируется.
// AudioContext должен быть запущен по жесту пользователя — отсюда ensureAudio().

let ctx = null;

export function ensureAudio() {
  if (!ctx) {
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch (e) { ctx = null; }
  }
  if (ctx && ctx.state === "suspended") ctx.resume();
}

function getCtx() { return ctx; }

// Глухой "БУХ" — посадка блока, удар тяжёлого предмета.
export function thud(intensity = 1) {
  const c = getCtx(); if (!c) return;
  const t0 = c.currentTime;
  const o = c.createOscillator();
  o.type = "sine";
  o.frequency.setValueAtTime(90, t0);
  o.frequency.exponentialRampToValueAtTime(38, t0 + 0.22);
  const g = c.createGain();
  g.gain.setValueAtTime(0.45 * intensity, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.32);
  o.connect(g).connect(c.destination);
  o.start(t0); o.stop(t0 + 0.35);

  // вспышка шума поверх — пыль/щебень
  const buf = c.createBuffer(1, 4410, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / 1500);
  const s = c.createBufferSource();
  s.buffer = buf;
  const ng = c.createGain();
  ng.gain.setValueAtTime(0.18 * intensity, t0);
  ng.gain.exponentialRampToValueAtTime(0.001, t0 + 0.18);
  const filt = c.createBiquadFilter();
  filt.type = "lowpass"; filt.frequency.value = 1200;
  s.connect(filt).connect(ng).connect(c.destination);
  s.start(t0);
}

// Скрип крана / ржавого металла — бэндпасс над пилообразной.
export function creak() {
  const c = getCtx(); if (!c) return;
  const t0 = c.currentTime;
  const o = c.createOscillator();
  o.type = "sawtooth";
  o.frequency.setValueAtTime(180 + Math.random() * 70, t0);
  o.frequency.linearRampToValueAtTime(120 + Math.random() * 60, t0 + 0.45);
  const g = c.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(0.035, t0 + 0.05);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.5);
  const filt = c.createBiquadFilter();
  filt.type = "bandpass"; filt.frequency.value = 700; filt.Q.value = 4;
  o.connect(filt).connect(g).connect(c.destination);
  o.start(t0); o.stop(t0 + 0.55);
}

// Светлый «дзинь» — колокольная нота при матче. semis сдвигает высоту
// (для нарастающих каскадов), vol — громкость. Триангл + октавный обертон.
export function chime(semis = 0, vol = 0.22) {
  const c = getCtx(); if (!c) return;
  const t0 = c.currentTime;
  const base = 523.25 * Math.pow(2, semis / 12);   // от C5 вверх
  for (let i = 0; i < 2; i++) {
    const o = c.createOscillator();
    o.type = i === 0 ? "triangle" : "sine";
    o.frequency.setValueAtTime(base * (i === 0 ? 1 : 2), t0);
    const g = c.createGain();
    const v = vol * (i === 0 ? 1 : 0.4);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(v, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + 0.5);
    o.connect(g).connect(c.destination);
    o.start(t0); o.stop(t0 + 0.55);
  }
}

// Гул обвала — длинный затухающий лоупасс-шум.
export function rumble() {
  const c = getCtx(); if (!c) return;
  const t0 = c.currentTime;
  const buf = c.createBuffer(1, c.sampleRate * 1.4, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const s = c.createBufferSource();
  s.buffer = buf;
  const g = c.createGain();
  g.gain.setValueAtTime(0.5, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + 1.4);
  const filt = c.createBiquadFilter();
  filt.type = "lowpass"; filt.frequency.value = 400;
  s.connect(filt).connect(g).connect(c.destination);
  s.start(t0);
}

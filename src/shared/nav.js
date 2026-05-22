// Навигация и состояние прогресса между картой и играми.
// Используем import.meta.env.BASE_URL чтобы корректно работало
// при деплое на под-путь (например /vol4/).

export const MAP_URL = import.meta.env.BASE_URL || "/";

export function backToMap() {
  location.href = MAP_URL;
}

// Привязать любой <a id="back"> к корректному URL карты.
export function bindBackLink(selector = "#back") {
  const el = document.querySelector(selector);
  if (el) el.href = MAP_URL;
}

const KEY = (game) => `vol4_${game}_done`;

export function markDone(game) {
  if (!game) return;
  try { localStorage.setItem(KEY(game), "true"); } catch (e) { /* private mode */ }
}

export function isDone(game) {
  if (!game) return false;
  try { return localStorage.getItem(KEY(game)) === "true"; }
  catch (e) { return false; }
}

export function clearDone(game) {
  try { localStorage.removeItem(KEY(game)); } catch (e) {}
}

// Показывает экран «уже пройдено» поверх UI игры.
// Возвращает true если игра пройдена (чтобы можно было пропустить инициализацию).
export function showCompleted(game, title = "") {
  if (!isDone(game)) return false;
  const ui = document.getElementById("ui") || document.body;
  const d  = document.createElement("div");
  d.style.cssText = [
    "position:absolute;inset:0",
    "display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px",
    "pointer-events:auto",
  ].join(";");
  d.innerHTML = `
    <div class="t-label" style="color:var(--c-accent,#f0d8a8)">пройдено</div>
    <div class="t-display" style="font-size:clamp(22px,4vw,36px);letter-spacing:0.24em;font-weight:300;text-transform:uppercase;color:rgba(255,255,255,0.9)">${title}</div>
    <a href="${MAP_URL}" class="t-btn" style="margin-top:10px;pointer-events:auto;text-decoration:none">← карта</a>
  `;
  ui.appendChild(d);
  return true;
}

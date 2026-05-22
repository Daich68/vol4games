import "./type.css";
// Общий splash «скоро» для незаконченных игр.
// Печатает в #ui большой serif-less заголовок + мета. Использует общую
// типографическую систему (.t-display / .t-label / .t-hint).
export function mountSoon({ title, author = "—", meta = "" }) {
  const ui = document.getElementById("ui");
  if (!ui) return;

  const wrap = document.createElement("div");
  wrap.id = "soon";
  wrap.style.cssText = `
    position: absolute; left: 50%; top: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    display: flex; flex-direction: column; gap: 18px;
    align-items: center;
  `;
  wrap.innerHTML = `
    <div class="t-label">vol4 · скоро</div>
    <div class="t-display">${title}</div>
    <div class="t-hint">${author}</div>
    <div class="t-hint arrow">${meta}</div>
  `;
  ui.appendChild(wrap);
}

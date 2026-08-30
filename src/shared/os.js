// ─── VOL4/OS — общий слой «машины» ───────────────────────────────────────
// Весь проект — один фосфорный терминал, в котором стихи — процессы.
// Этот модуль даёт страницам общую физику машины:
//   · CRT power on/off — переходы между страницами через кинескоп
//   · osTitleCard      — титульный кадр процесса при входе в игру
//   · osRevealLines    — построчное проявление текста (финальные стихи)
import "./os.css";

// ── CRT-оверлей ──────────────────────────────────────────────────────────
// Страницы кладут #crtFx статично в HTML (класс .boot = шторки закрыты до
// первой отрисовки). Если его нет — создаём на лету (открытое состояние).
function crt() {
  let el = document.getElementById("crtFx");
  if (!el) {
    el = document.createElement("div");
    el.id = "crtFx";
    el.innerHTML = `<div class="crt-top"></div><div class="crt-bot"></div><div class="crt-line"></div>`;
    document.body.appendChild(el);
  }
  return el;
}

// Включение кинескопа: вызывается при загрузке страницы.
// No-op, если шторки не были закрыты (#crtFx без .boot) — так карта
// включается только при возврате из игры, а не поверх прелоудера.
export function osPowerOn() {
  const el = crt();
  if (!el.classList.contains("boot")) return;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    el.classList.add("on");
    el.classList.remove("boot");
    setTimeout(() => el.classList.remove("on"), 700);
  }));
}

// Выключение кинескопа → переход. Повторные вызовы глушатся.
let leaving = false;
export function osNavigate(url) {
  if (leaving) return;
  leaving = true;
  const el = crt();
  el.classList.remove("on");
  el.classList.add("off");
  setTimeout(() => { location.href = url; }, 430);
}

// Перехват внутренних ссылок (`← карта`, оверлеи, меню уровней):
// вместо мгновенного перехода — через выключение кинескопа.
export function osBindLinks() {
  document.addEventListener("click", (e) => {
    const a = e.target.closest && e.target.closest("a[href]");
    if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
    let url;
    try { url = new URL(a.href, location.href); } catch { return; }
    if (url.origin !== location.origin) return;
    e.preventDefault();
    osNavigate(a.href);
  });
}

// ── титульный кадр процесса ──────────────────────────────────────────────
// Полноэкранный опенинг: `NN · процесс` / ИМЯ / стих · автор / `запуск`.
// Сам растворяется через `hold` мс; тап или любая клавиша — скип.
// Ввод во время кадра не доходит до игры (capture + stopPropagation).
// kind — чем машина считает то, что запускает: свой «процесс» или чужой
// «носитель» (DLC). Меняется только подпись, кадр тот же.
export function osTitleCard({ index = "", title, author = "", poem = "", hold = 2300, kind = "процесс" } = {}) {
  const el = document.createElement("div");
  el.id = "osTitle";
  const meta = index ? `${index} · ${kind}` : kind;
  const sub = [poem && `«${poem}»`, author && `<b>${author}</b>`].filter(Boolean).join(" · ");
  el.innerHTML = `
    <div class="ost-meta">${meta}</div>
    <div class="ost-name">${title}</div>
    ${sub ? `<div class="ost-sub">${sub}</div>` : ""}
    <div class="ost-run">процесс запущен</div>`;
  document.body.appendChild(el);

  let gone = false;
  function dismiss() {
    if (gone) return;
    gone = true;
    el.classList.add("hide");
    window.removeEventListener("keydown", onKey, true);
    setTimeout(() => el.remove(), 600);
  }
  function onKey(e) {
    // ESC отдаём странице (выход на карту), остальное — скип кадра
    if (e.code === "Escape") { dismiss(); return; }
    e.stopPropagation();
    dismiss();
  }
  // pointerdown в bubble-фазе на самом кадре: гасим, чтобы тап-скип
  // не долетел до глобальных обработчиков игры (сталагмит роняет блок)
  el.addEventListener("pointerdown", (e) => { e.stopPropagation(); dismiss(); });
  el.addEventListener("click",       (e) => { e.stopPropagation(); });
  window.addEventListener("keydown", onKey, true);
  setTimeout(dismiss, hold);
  return dismiss;
}

// ── построчное проявление текста ─────────────────────────────────────────
// Режет текст элемента по \n на .os-line-спаны с каскадной задержкой.
// Вызывать после установки textContent/innerHTML и ПЕРЕД показом блока.
export function osRevealLines(el, { step = 120, delay = 250 } = {}) {
  if (!el) return;
  const text = el.textContent;
  el.textContent = "";
  const lines = text.split("\n");
  lines.forEach((line, i) => {
    const span = document.createElement("span");
    span.className = "os-line";
    span.textContent = line === "" ? " " : line;
    span.style.transitionDelay = `${delay + i * step}ms`;
    el.appendChild(span);
  });
  // класс на родителе запускает каскад после вставки в DOM
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("os-reveal")));
}

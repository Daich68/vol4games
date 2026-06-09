// vol4games — клиент таблицы лидеров.
//
// Offline-first: всегда пишет/читает локальную копию в localStorage и
// параллельно синхронит с сервером (/api/scores). Если бэкенд не настроен
// (нет KV) или нет сети — игра не ломается, показывается локальный топ.

import { getPlayerName } from "./nav.js";

export const LB_GAMES = {
  birds:  { title: "птицы",  metric: "очки" },
  prizma: { title: "призма", metric: "очки" },
};

const API = `${import.meta.env.BASE_URL}api/scores`.replace(/\/{2,}/g, "/");
const LKEY = (game) => `vol4_lb_${game}`;
const CAP = 50;

// ── локальная копия ──────────────────────────────────────────────────────────
function readLocal(game) {
  try {
    const arr = JSON.parse(localStorage.getItem(LKEY(game)) || "[]");
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
function writeLocal(game, list) {
  try { localStorage.setItem(LKEY(game), JSON.stringify(list.slice(0, CAP))); } catch {}
}
// слить запись (имя+рекорд), оставить лучший балл за именем, отсортировать
function mergeLocal(game, entries) {
  const map = new Map();
  for (const e of readLocal(game)) map.set(e.name, e.score);
  for (const e of entries) {
    const prev = map.get(e.name);
    if (prev == null || e.score > prev) map.set(e.name, e.score);
  }
  const list = [...map].map(([name, score]) => ({ name, score }))
    .sort((a, b) => b.score - a.score);
  writeLocal(game, list);
  return list;
}
function localView(game, name) {
  const list = readLocal(game);
  const idx = name ? list.findIndex(e => e.name === name) : -1;
  return {
    source: "local",
    top: list.slice(0, 12),
    total: list.length,
    best: idx >= 0 ? list[idx].score : null,
    rank: idx >= 0 ? idx + 1 : null,
  };
}

// ── сетевой слой (никогда не бросает) ────────────────────────────────────────
async function apiGet(game, limit) {
  try {
    const res = await fetch(`${API}?game=${encodeURIComponent(game)}&limit=${limit}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    if (!(res.headers.get("content-type") || "").includes("application/json")) return null;
    const data = await res.json();
    return data && data.ok ? data : null;
  } catch { return null; }
}
async function apiPost(payload) {
  try {
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    if (!(res.headers.get("content-type") || "").includes("application/json")) return null;
    const data = await res.json();
    return data && data.ok ? data : null;
  } catch { return null; }
}

// ── публичный API ────────────────────────────────────────────────────────────

// Сдать результат. Возвращает {source, top, total, best, rank, name}.
// Локальную копию обновляет всегда; сервер — если доступен.
export async function submitScore(game, score) {
  if (!LB_GAMES[game]) return { source: "local", top: [], total: 0, best: null, rank: null };
  const name = (getPlayerName() || "детектив").slice(0, 16);
  const s = Math.max(0, Math.floor(Number(score) || 0));

  mergeLocal(game, [{ name, score: s }]);

  const data = await apiPost({ game, name, score: s });
  if (data) {
    mergeLocal(game, data.top || []);
    return { source: "server", name, top: data.top || [], total: data.total || 0, best: data.best, rank: data.rank };
  }
  return { ...localView(game, name), name };
}

// Получить топ. Возвращает {source, top, total, best, rank}.
export async function fetchTop(game, limit = 12) {
  if (!LB_GAMES[game]) return { source: "local", top: [], total: 0, best: null, rank: null };
  const name = getPlayerName() || "";
  const data = await apiGet(game, limit);
  if (data) {
    mergeLocal(game, data.top || []);
    const idx = name ? (data.top || []).findIndex(e => e.name === name) : -1;
    return {
      source: "server",
      top: data.top || [],
      total: data.total || 0,
      best: idx >= 0 ? data.top[idx].score : (localView(game, name).best),
      rank: idx >= 0 ? idx + 1 : null,
    };
  }
  return localView(game, name);
}

// vol4games — серверная таблица лидеров.
//
// Хранилище: Redis (Upstash / Vercel KV) через REST — без npm-зависимостей,
// общается обычным fetch. Каждая игра — это отсортированное множество
// `lb:<game>`, где член = имя игрока, вес = лучший результат. ZADD ... GT
// держит за игроком только его рекорд.
//
// Переменные окружения (любая пара — Vercel KV или Upstash напрямую):
//   KV_REST_API_URL  / KV_REST_API_TOKEN
//   UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
// Без них API отвечает 503 — клиент молча падает на локальную таблицу.

const GAMES = {
  birds:  { title: "птицы",  metric: "очки" },
  prizma: { title: "призма", metric: "очки" },
};

const MAX_NAME = 16;
const MAX_SCORE = 100_000_000;
const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 50;

const REST_URL =
  process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const REST_TOKEN =
  process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";

const configured = () => Boolean(REST_URL && REST_TOKEN);

// ── Redis REST ───────────────────────────────────────────────────────────────
async function redisPipeline(commands) {
  const res = await fetch(`${REST_URL}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REST_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands),
  });
  if (!res.ok) throw new Error(`redis ${res.status}: ${await res.text()}`);
  const out = await res.json();           // [{result}, {error}, …]
  return out.map(x => {
    if (x && x.error) throw new Error(`redis: ${x.error}`);
    return x ? x.result : null;
  });
}

// ── валидация ──────────────────────────────────────────────────────────────
function cleanName(raw) {
  const s = String(raw == null ? "" : raw)
    .replace(/[\x00-\x1F\x7F]/g, "")   // управляющие символы
    .trim()
    .slice(0, MAX_NAME)
    .trim();
  return s || "детектив";
}
function cleanScore(raw) {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.min(MAX_SCORE, n);
}

// ── формат ответа ──────────────────────────────────────────────────────────
function parseZRange(flat) {
  // [member, score, member, score, …] → [{name, score}]
  const out = [];
  for (let i = 0; i + 1 < flat.length; i += 2) {
    out.push({ name: flat[i], score: Number(flat[i + 1]) });
  }
  return out;
}

function safeJSON(s) { try { return JSON.parse(s); } catch { return {}; } }

// ── handler ──────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();

  if (!configured()) {
    return res.status(503).json({ ok: false, error: "storage_unconfigured" });
  }

  try {
    // ── GET: топ по игре ──
    if (req.method === "GET") {
      const game = String(req.query.game || "");
      if (!GAMES[game]) return res.status(400).json({ ok: false, error: "unknown_game" });
      let limit = parseInt(req.query.limit, 10);
      if (!Number.isFinite(limit)) limit = DEFAULT_LIMIT;
      limit = Math.max(1, Math.min(MAX_LIMIT, limit));

      const key = `lb:${game}`;
      const [flat, total] = await redisPipeline([
        ["ZRANGE", key, "0", String(limit - 1), "REV", "WITHSCORES"],
        ["ZCARD", key],
      ]);
      return res.status(200).json({
        ok: true,
        game,
        meta: GAMES[game],
        total: Number(total) || 0,
        top: parseZRange(flat || []),
      });
    }

    // ── POST: сдать результат ──
    if (req.method === "POST") {
      const body = typeof req.body === "string" ? safeJSON(req.body) : (req.body || {});
      const game = String(body.game || "");
      if (!GAMES[game]) return res.status(400).json({ ok: false, error: "unknown_game" });

      const name = cleanName(body.name);
      const score = cleanScore(body.score);
      if (score == null) return res.status(400).json({ ok: false, error: "bad_score" });

      const key = `lb:${game}`;
      // ZADD GT — обновит вес только если новый рекорд выше прежнего.
      const [, best, rank, total, flat] = await redisPipeline([
        ["ZADD", key, "GT", "CH", String(score), name],
        ["ZSCORE", key, name],
        ["ZREVRANK", key, name],
        ["ZCARD", key],
        ["ZRANGE", key, "0", String(DEFAULT_LIMIT - 1), "REV", "WITHSCORES"],
      ]);

      return res.status(200).json({
        ok: true,
        game,
        name,
        submitted: score,
        best: best == null ? score : Number(best),
        rank: rank == null ? null : Number(rank) + 1,   // 1-based
        total: Number(total) || 0,
        top: parseZRange(flat || []),
      });
    }

    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "storage_error", detail: String(err && err.message || err) });
  }
}

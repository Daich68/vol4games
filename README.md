# vol4games

Серия из 4 браузерных мини-игр-стихов. Главный экран — карта с нодами, по которой бегает герой; каждая нода — отдельная игра, переработанная под конкретное стихотворение современного поэта.

## Запуск

```bash
npm install
npm run dev      # dev-сервер с HMR на http://localhost:5173
npm run build    # статичная сборка в dist/
npm run preview  # посмотреть собранную версию локально
```

## Структура

```
vol4/
├── index.html                       # карта (entry 1)
├── games/
│   └── stalagmit/index.html         # игра 1 (entry 2)
├── src/
│   ├── shared/                      # общий код между играми
│   │   ├── rng.js                   # детерминированный псевдо-рандом
│   │   ├── audio.js                 # WebAudio: thud, creak, rumble
│   │   └── nav.js                   # навигация и localStorage прогресса
│   ├── map/main.js                  # логика карты
│   └── games/
│       └── stalagmit/main.js        # логика "Сталагмита"
├── public/
│   └── poems/
│       └── stalagmit.txt            # стих, грузится fetch-ом
├── vite.config.js                   # MPA: каждая игра — свой entry
└── package.json
```

Каждая новая игра — это:
1. Папка `games/<slug>/index.html` (тонкая обёртка с `<script type="module" src="/src/games/<slug>/main.js">`).
2. Логика в `src/games/<slug>/main.js`.
3. Стих в `public/poems/<slug>.txt`.
4. Запись в `rollupOptions.input` в `vite.config.js`.
5. Слот для ноды в `NODES` массиве `src/map/main.js`.

## Стек

- **Vite 5** (multi-page) — dev-сервер + статичная сборка.
- **Vanilla JS + Canvas / SVG** — без фреймворка. Каждая игра может выбрать свой подход (canvas, SVG, DOM, WebGL, Phaser…), общий код только в `src/shared/`.
- **WebAudio API** — звук синтезируется в браузере, без аудиофайлов.

## Прогресс

Завершение игры сохраняется в `localStorage` ключом `vol4_<slug>_done`. Пройденные ноды на карте подсвечиваются жёлтым.

## Таблица лидеров

Серверный список рекордов по очковым играм (**птицы**, **призма**). Имя игрока
вводится на прелоудере карты (`localStorage["vol4_player"]`), панель открывается
кнопкой **«L · рекорды»** на карте.

```
api/scores.js              # serverless-функция (Vercel): GET топ / POST результат
src/shared/leaderboard.js  # клиент: submitScore() / fetchTop(), offline-first
src/map/main.js            # панель рекордов на карте
```

- **Хранилище** — Redis через REST (Upstash / Vercel KV), без npm-зависимостей.
  Каждая игра — отсортированное множество `lb:<game>`: член = имя, вес = рекорд
  (`ZADD … GT` хранит только лучший балл игрока).
- **Offline-first** — клиент всегда пишет локальную копию и синхронит с сервером.
  Если KV не подключён или нет сети, показывается локальный топ, игра не ломается
  (в подвале панели — индикатор `● сервер` / `● локально`).

### Подключение хранилища (один раз)

1. Vercel → проект → **Storage** → **Create** → **KV (Upstash Redis)** → **Connect**.
   Переменные `KV_REST_API_URL` / `KV_REST_API_TOKEN` подставятся автоматически.
2. **Redeploy**. Готово — рекорды станут общими.

Локально функции поднимаются через `vercel dev` (env из `.env.local`, см.
`.env.example`); обычный `npm run dev` работает на локальном фолбэке.

### Добавить игру в таблицу

1. `GAMES` в `api/scores.js` и `LB_GAMES` в `src/shared/leaderboard.js`.
2. Вкладка `.lp-tab` в `index.html`.
3. `submitScore("<slug>", score)` в `onWin`/гейм-овере игры.

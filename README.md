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

## Игры

- **Сталагмит** (Али Алиев, "ул. Подмосковный проезд, 8") — Tower Bloxx с блоками-хрущёвками, 20 этажей до финала.
- TBD × 3.

## Прогресс

Завершение игры сохраняется в `localStorage` ключом `vol4_<slug>_done`. Пройденные ноды на карте подсвечиваются жёлтым.

# Local verification — 2026-09-08

Chromium / WebGL 2 / SwiftShader, local Vite at http://127.0.0.1:5173/games/babyland/.

`npm.cmd run build`: successful, 50 modules transformed. BABYLAND is included in dist. Vite warns about the shared Three.js chunk (512.12 kB raw / 130.43 kB gzip); this is a warning, not a failed build.

`node C:/Users/daich/Documents/vol4games-backups/check-three-babyland.mjs`:

```text
DRESSED renderer: Three.js, meshes: 94, triangles: 84183
PERFECT Ура! Теперь она красивая!
WRONG repeat guard, 3 cycles, ending, restart PASS
SECRET PASS
390: overflow false, badImages 0
320: overflow false, badImages 0
844: overflow false, badImages 0
PAGE ERRORS []
```

Perfect and disappearance screens were reached by actual clicks. Secret combination reached its terminal state and displayed the secret poem; the full timed automatic return after reading was not waited out. Desktop 1440×1000 and viewport emulations 390×844, 320×640, 844×390 were captured. These are not physical-device tests.

`node C:/Users/daich/Documents/vol4games-backups/check-three-controls.mjs`:

```text
55 distinct mesh/material thumbnails PASS
geometry disposal 82 -> 82
rotation / zoom / mute / exit / keyboard / reduced-motion PASS
```

Mute control state and wiring checked; no claim of a human listening test. Missing favicon discovered in this pass and fixed; later full gameplay run had no console error lines.

`node C:/Users/daich/Documents/vol4games-backups/check-three-visual.mjs`:

```text
10 mixed outfits rendered []
```

All ten combinations visually inspected. Fixed compressed accessory cards, small facial features, dark face fill, camera framing depending on frame rate, and pants coverage. Two affected trouser outfits recaptured after the last coverage adjustment.

Tastemaker: contrast matrix passed for intended text pairings; motion audit passed. Static scanner's two medium findings are the heart glyphs requested by the PDF's Flash-game aesthetic. Project style lock and pending-review decision log written; no personal profile promoted.

No production deployment. Prior removed raster/GLB assets remain removed. Four-poem map counters unchanged. Models are procedural and stylized; no claim of GPT-Image generation in this Three.js pass. Poet voice recordings and the shared diary remain unimplemented.

---

# Проверка — 2026-09-08, второй проход

После переработки подачи (рабочий стол из окон), добавления двух шкал обратной
связи, давления временем, анкеты и тракта озвучки. Прогон в Chromium/WebGL2,
дев-сервер и продакшен-сборка.

## Сверка с брифом

`PYTHONUTF8=1 python tools/check_brief.py` — расхождений нет:

```text
количества       8/12/8/8/15/4 сходятся
формулировки     13 из 13 дословно
светлотный зазор 0.236 (минимум 0.12)
z-порядок        нарушений потолка z=40 нет
концовки         три вызова с условиями
стихи            7 файлов, расхождений с PDF нет
```

## Что проверено поведением, а не чтением кода

**Проигрыш достижим.** До правки: 26 ходов давали `wrong=4, cycles=1`, финал
недостижим. После: 24 секунды без действий игрока подняли `wrong` 7→10 и
`cycles` 1→2, затем `cycles=3`, девочка растворилась, экран «Она расстроена и
устала.» Победный путь: шкала блаженства 1→6, гипермакияж даёт «Ура! Теперь она
красивая!». Секретная: шесть вещей найдены, на последней проверка срабатывает до
реакции, поэтому системного окна нет, статус «Машина молчит.», идут только
субтитры, экрана концовки нет.

**Уменьшенное движение.** С подменённым `matchMedia` четвёртая реакция подавляет
скример, но системное окно открывается, ужас нарастает, статус обновляется.

**Приглушение музыки под стих.** Замер `musicLevel()`: база 0.28 → под стихом
0.09 → слом музыки во время стиха оставляет 0.09 → после 0.28.

**Связка с картой.** При `vol4_babyland_done=true` счётчик держит `0/4`, арка не
появляется, строка меню отмечена ✓ отдельно от четырёх стихов.

**Доступность.** 19 фокусируемых элементов, все с именами; `alt` у всех
изображений; живые области `look` и `status`; окно реакции подписано,
фокус входит и возвращается.

**Продакшен.** `vite preview` на собранной версии: сцена, стихи, листинг,
спутники, дневничок, шкала блаженства — консоль чистая. Игра 44 КБ (18.5 gzip),
Three.js 512 КБ общий с картой.

## Чего этот проход не проверял

Звук на слух — только уровнями. Реальные мобильные GPU. Записи чтения стихов
(их нет). Общая лента анкет (нужен бэкенд).

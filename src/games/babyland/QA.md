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

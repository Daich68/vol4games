# BABYLAND / Three.js

Run from the repository root with `npm.cmd run dev -- --open false`, then open `/games/babyland/`. Production entry restored in vite.config.js. No map counters changed.

The source brief is Lana Lenkova's 12-page PDF. This build implements the six wardrobe categories and 55 gameplay entries, cyclic wrong-choice reactions, makeup unlock after five categories, repeated-item guard, perfect / disappearance / secret endings, subtitle poems, synthesized music, mute, exit confirmation, rotation and close-up camera.

- `items.js`: original item ids and gameplay classification, recovered from commit 50417d6.
- `doll.js`: new procedural body and garment geometry; shared rig coordinates, not image layers. Garment forms are stylized, with simplified details.
- `face.js`: head and canvas face helpers adapted from the archived procedural experiment; enlarged features. No third-party GLB or donor model used.
- `scene.js`: lighting, shadows, camera, pointer rotation, thumbnails from actual meshes, geometry disposal, WebGL error handling.
- `main.js`: game state, poems and UI; native dialogs provide keyboard focus handling.
- `sfx.js`: recovered browser synthesis, with mute and music-stop lifecycle fixes.

Audio readings are not recorded: poems currently appear as subtitles. No shared diary/backend. Closing a browser tab cannot display an arbitrary custom in-game dialog; the in-game map/escape action shows the brief's exit confirmation.

Local QA scripts and screenshots: `C:/Users/daich/Documents/vol4games-backups/check-three-babyland.mjs` and `check-three-visual.mjs`. The first exercises three endings, makeup lock, repeated click, restart, and 1440/390/320/844px layouts. The second renders ten deterministic mixed outfits. Tests use real Chromium WebGL with SwiftShader; this is not a physical mobile GPU performance benchmark.

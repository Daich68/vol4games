# BABYLAND: generated assets, 2026-09-08

Reference: Lana Lenkova PDF, page 2, and user screenshot `Screenshot 2026-09-08 105952.png`.
Visual direction: 2000s cosmetic packaging, dusty raspberry plastic, silver bevels, upper-left pearl highlights.

`ui-prompts.json` records the built-in GPT Image prompts. Originals are stored in `ui-source/`; runtime copies are in `public/art/babyland/ui/`.
The panel uses CSS nine-slice borders (48/512) in `src/games/babyland/cosmetic-ui.css`; six category icons are reused by category buttons.
Text and interaction remain HTML. The existing outer bezel and DLC counting remain unchanged.

Rebuild these UI assets and the first three clothing layers with `python tools/babyland_ui_assets.py`.
Clothing sources are retained in `wardrobe-source/`. Runtime clothing is RGBA 596×1200, baked offline. Alpha dust below 32 is ignored for bounds; thumbnail crops are independent from sprite placement.
The grey hoodie uses a generated green-background source with deterministic matting because the first generation painted a checkerboard into RGB.

Current wardrobe coverage: top_ruffles, bot_tutu, top_hoodie_baggy. Four existing makeup SVGs and five expression SVGs remain. The rest of the wardrobe is not generated yet.
This is an incremental art pass, not a completed 55-item migration. The older `babyland_assets.py build` is still a legacy pipeline and must not be used to overwrite this manifest until migrated.

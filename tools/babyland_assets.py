#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
BABYLAND — конвейер графики.

Задача не «нарисовать 55 вещей», а собрать 55 вещей из 55 разных источников
так, чтобы они читались как ОДИН набор. Ключевая мысль конвейера: цельность
даёт не одинаковость источников, а общий грейд в конце. Поэтому этапы такие:

    raw/  →  cut  →  fit  →  grade  →  public/art/babyland/  →  sheet
             ↑        ↑        ↑
        отделить   посадить  привести
        от фона    в слот    к одному виду

Этапы гоняются по отдельности — арт правится итеративно, и пересобирать всё
из-за одной вещи не нужно.

    python tools/babyland_assets.py status         что есть, чего нет
    python tools/babyland_assets.py build          cut+fit+grade+manifest
    python tools/babyland_assets.py build --only top_ruffles
    python tools/babyland_assets.py sheet          контактный лист на просмотр
    python tools/babyland_assets.py queries        список запросов для поиска

Вход:  art/babyland/raw/<item-id>.(png|jpg|jpeg|webp)  — картинка «как нашлась»
Выход: public/art/babyland/items/<item-id>.png + manifest.json

Зависимости: pillow, numpy, opencv-python (уже стоят).
"""

import argparse
import json
import os
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance, ImageOps

try:
    import cv2
except ImportError:                                     # cv2 нужен только для GrabCut
    cv2 = None

ROOT      = Path(__file__).resolve().parent.parent
CATALOG   = ROOT / "art" / "babyland" / "catalog.json"
RAW_DIR   = ROOT / "art" / "babyland" / "raw"
WORK_DIR  = ROOT / "art" / "babyland" / "work"
OUT_DIR   = ROOT / "public" / "art" / "babyland"
ITEMS_DIR = OUT_DIR / "items"
RAW_EXT   = (".png", ".jpg", ".jpeg", ".webp", ".bmp")


def load_catalog():
    if not CATALOG.exists():
        sys.exit(f"нет каталога: {CATALOG}")
    return json.loads(CATALOG.read_text(encoding="utf-8"))


def find_raw(item_id):
    for ext in RAW_EXT:
        p = RAW_DIR / f"{item_id}{ext}"
        if p.exists():
            return p
    return None


# ── 0. TRIM: снять рамку ──────────────────────────────────────────────────
# Реальные исходники — часто скриншоты: тёмные поля, скруглённые углы, рамка
# приложения. Оценка фона по углам на них ломается (угол — это рамка, а не
# фон), поэтому рамку снимаем ДО матирования: срезаем краевые ряды, которые
# сами по себе однотонные и не похожи на середину кадра.
def trim_border(img: Image.Image, max_frac=0.25) -> Image.Image:
    a = np.asarray(img.convert("RGB")).astype(np.float32)
    h, w = a.shape[:2]
    top, bot, left, right = 0, h, 0, w

    def uniform(line):
        return float(line.std(axis=0).mean()) < 6.0

    lim_v, lim_h = int(h * max_frac), int(w * max_frac)
    while top < lim_v and uniform(a[top, left:right]):
        top += 1
    while bot > h - lim_v and uniform(a[bot - 1, left:right]):
        bot -= 1
    while left < lim_h and uniform(a[top:bot, left]):
        left += 1
    while right > w - lim_h and uniform(a[top:bot, right - 1]):
        right -= 1

    if (bot - top) < h * 0.4 or (right - left) < w * 0.4:
        return img                                   # срезали слишком много — не трогаем
    return img.crop((left, top, right, bot))


# ── 1. CUT: отделить вещь от фона ─────────────────────────────────────────
# Референсы Ланы — продуктовые снимки на светлом фоне, и для них цветовая
# дистанция от фона работает чище нейросетевого матирования: у неё нет
# «мыла» по краю и она детерминирована. GrabCut остаётся запасным путём для
# снимков со сложным фоном (флаг --grabcut).
def cut_flood(img: Image.Image, tol=14) -> Image.Image:
    """Матирование заливкой от краёв кадра.

    Нужно там, где цветовая дистанция бессильна: белый манекен на светло-сером
    фоне — разница почти нулевая, и порог либо съедает ноги, либо не убирает
    фон. Но студийный фон это гладкая растяжка, а у предмета есть контур,
    поэтому заливка от рамки растекается по фону и останавливается на объекте.
    """
    if cv2 is None:
        sys.exit("для заливки нужен opencv-python")
    rgb = np.asarray(img.convert("RGB"))[:, :, ::-1].copy()
    h, w = rgb.shape[:2]
    ff = np.zeros((h + 2, w + 2), np.uint8)
    flags = 4 | cv2.FLOODFILL_MASK_ONLY | (255 << 8)
    seeds = [(1, 1), (w - 2, 1), (1, h - 2), (w - 2, h - 2),
             (w // 2, 1), (w // 2, h - 2), (1, h // 2), (w - 2, h // 2)]
    work = rgb.copy()
    for sx, sy in seeds:
        cv2.floodFill(work, ff, (sx, sy), 0,
                      (tol,) * 3, (tol,) * 3, flags)
    bg = ff[1:-1, 1:-1] > 0
    alpha = np.where(bg, 0, 255).astype(np.uint8)

    kern = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    alpha = cv2.morphologyEx(alpha, cv2.MORPH_OPEN, kern, iterations=1)
    alpha = cv2.morphologyEx(alpha, cv2.MORPH_CLOSE, kern, iterations=3)
    n, lab, stats, _ = cv2.connectedComponentsWithStats((alpha > 128).astype(np.uint8), 8)
    if n > 1:
        biggest = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
        alpha = np.where(lab == biggest, 255, 0).astype(np.uint8)
    alpha = cv2.GaussianBlur(alpha, (3, 3), 0)

    out = img.convert("RGBA")
    out.putalpha(Image.fromarray(alpha))
    return out


def cut(img: Image.Image, use_grabcut=False) -> Image.Image:
    img = img.convert("RGB")
    a = np.asarray(img).astype(np.float32)
    h, w = a.shape[:2]

    if use_grabcut:
        if cv2 is None:
            sys.exit("для --grabcut нужен opencv-python")
        mask = np.zeros((h, w), np.uint8)
        rect = (int(w * 0.04), int(h * 0.04), int(w * 0.92), int(h * 0.92))
        bgd, fgd = np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64)
        cv2.grabCut(np.asarray(img)[:, :, ::-1].copy(), mask, rect, bgd, fgd, 5,
                    cv2.GC_INIT_WITH_RECT)
        alpha = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
    else:
        # фон оцениваем по всему краевому кольцу, а не по четырём углам:
        # у продуктового снимка вещь в центре, край — гарантированно фон
        k = max(3, min(h, w) // 40)
        ring = np.concatenate([
            a[:k, :].reshape(-1, 3), a[-k:, :].reshape(-1, 3),
            a[:, :k].reshape(-1, 3), a[:, -k:].reshape(-1, 3),
        ])
        bg = np.median(ring, axis=0)
        # порог считаем по разбросу ТОЛЬКО той части кольца, что близка к
        # медиане: иначе случайный тёмный угол раздувает порог до бесконечности
        rd = np.linalg.norm(ring - bg, axis=1)
        near = rd[rd < max(30.0, float(np.percentile(rd, 60)))]
        spread = float(np.percentile(near, 92)) if near.size else 8.0
        thr = float(np.clip(spread * 2.4, 16.0, 46.0))
        dist = np.linalg.norm(a - bg, axis=2)
        alpha = np.clip((dist - thr) / max(thr * 0.6, 1.0), 0, 1)
        alpha = (alpha * 255).astype(np.uint8)

        if cv2 is not None:
            # добиваем дыры и мусор: закрытие → крупнейшая связная область
            kern = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
            solid = (alpha > 90).astype(np.uint8)
            solid = cv2.morphologyEx(solid, cv2.MORPH_CLOSE, kern, iterations=2)
            n, lab, stats, _ = cv2.connectedComponentsWithStats(solid, 8)
            if n > 1:
                biggest = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
                keep = (lab == biggest).astype(np.uint8)
                keep = cv2.morphologyEx(keep, cv2.MORPH_CLOSE, kern, iterations=3)
                alpha = (alpha * keep).astype(np.uint8)
            alpha = cv2.GaussianBlur(alpha, (3, 3), 0)

    out = img.convert("RGBA")
    out.putalpha(Image.fromarray(alpha))
    return out


def coverage(rgba: Image.Image) -> float:
    return float((np.asarray(rgba.getchannel("A")) > 40).mean())


def cut_auto(img: Image.Image, prefer=None, verbose=""):
    """Матирует, сам выбирая метод по правдоподобию результата.

    Ни один метод не универсален: цветовая дистанция чище всех на предмете,
    снятом на белом, но слепнет на белом предмете (манекен на светлом фоне —
    ноги просто исчезают). Заливка от краёв берёт гладкий студийный фон, но
    течёт внутрь, если контур слабый. GrabCut почти всегда что-то вернёт, но
    грубее. Поэтому пробуем по очереди и берём первый правдоподобный: предмет
    должен занимать от 6 до 88 процентов кадра.
    """
    tries = []
    if prefer == "flood":
        tries = [("заливка", lambda: cut_flood(img)), ("дистанция", lambda: cut(img)),
                 ("grabcut", lambda: cut(img, use_grabcut=True))]
    elif prefer == "grabcut":
        tries = [("grabcut", lambda: cut(img, use_grabcut=True)), ("дистанция", lambda: cut(img))]
    else:
        tries = [("дистанция", lambda: cut(img)), ("заливка", lambda: cut_flood(img)),
                 ("grabcut", lambda: cut(img, use_grabcut=True))]

    best, best_name, best_cov = None, "", -1.0
    for name, fn in tries:
        try:
            r = fn()
        except SystemExit:
            raise
        except Exception:
            continue
        cov = coverage(r)
        if 0.06 <= cov <= 0.88:
            return r, name
        # запоминаем наименее безумный на случай, если ни один не подойдёт
        score = -abs(cov - 0.35)
        if score > best_cov:
            best, best_name, best_cov = r, name, score
    if verbose:
        print(f"   ! {verbose}: ни один метод матирования не дал правдоподобный "
              f"силуэт, взят «{best_name}»")
    return best, best_name


# ── 2. FIT: посадить на риг ───────────────────────────────────────────────
# Как у всех, кто делал одевалки (LPC, Spine): позицией владеет РИГ, а не вещь.
# Вещь объявляет не координаты, а между какими двумя ЛИНИЯМИ ТЕЛА она живёт —
# топ shoulder→waist, юбка waist→knee, туфли ankle→sole. Дальше масштаб и
# место считаются сами.
#
# Почему это работает без поштучной подгонки: у вещи, снятой ПЛОСКО, верхний
# край и есть линия плеч, а нижний — подол. Поэтому регистрация по умолчанию
# [0, 1] (весь bbox) верна для большинства предметов.
#
# И главное: топ до waist и юбка от waist встречаются на одной линии — стык
# получается по построению, а не угадыванием. Ровно этого не хватало версии,
# которая впихивала bbox в прямоугольник слота.
def fit(rgba: Image.Image, doll, slot_name, it) -> Image.Image:
    bbox = rgba.getbbox()
    if bbox:
        rgba = rgba.crop(bbox)

    W, H = doll["w"], doll["h"]
    rig  = doll["rig"]
    slot = doll["slots"][slot_name]
    cfg  = it.get("fit", {})

    # 1. МАСШТАБ по ширине тела. У плоской раскладки ширина предсказуема
    #    (плечи плюс рукава), высота — нет: она зависит от того, как вещь
    #    разложили. Поэтому масштабируем по ширине, а не по высоте.
    w_ref = it.get("w_ref", slot.get("w_ref", "shoulder"))
    w_k   = it.get("w_k",   slot.get("w_k", 1.0))
    target_w = rig["widths"][w_ref] * w_k * W * cfg.get("scale", 1.0)
    k = target_w / rgba.width
    new = rgba.resize((max(1, int(rgba.width * k)), max(1, int(rgba.height * k))),
                      Image.LANCZOS)

    # 2. ВЕРТИКАЛЬ: вещь цепляется одним краем за линию тела. Подол топа и
    #    пояс юбки цепляются за одну и ту же линию waist — значит встречаются
    #    по построению, а не подбором чисел.
    line, edge = it.get("anchor", slot.get("anchor", ["waist", "top"]))
    y = rig["lines"][line] * H
    cy = (y - new.height) if edge == "bottom" else y

    canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    cx = rig["center_x"] * W - new.width / 2 + cfg.get("dx", 0.0) * W
    canvas.alpha_composite(new, (int(round(cx)), int(round(cy + cfg.get("dy", 0.0) * H))))
    return canvas


# ── 3. GRADE: привести 55 источников к одному виду ────────────────────────
# Это главный этап. Бриф просит «немного сломанную цифровую эстетику», и она
# же решает инженерную задачу: постеризация + дизер + пережатие делают снимки
# из разных студий одинаково дешёвыми, а розовый/обесцвеченный тон закрепляет
# различие pretty/wrong, которое в референсах уже есть (розовое против ч/б).
def grade(rgba: Image.Image, g, kind: str) -> Image.Image:
    alpha = rgba.getchannel("A")
    rgb = rgba.convert("RGB")

    sat = g["saturate"].get(kind, 1.0)
    rgb = ImageEnhance.Color(rgb).enhance(sat)

    tint = g["tint"].get(kind)
    amt = g["tint_amount"].get(kind, 0.0)
    if tint and amt:
        layer = Image.new("RGB", rgb.size, tuple(tint))
        rgb = Image.blend(rgb, layer, amt)

    bits = int(g.get("posterize", 0))
    if bits:
        rgb = ImageOps.posterize(rgb, max(1, min(8, bits)))

    if g.get("dither"):
        # честный дизер: через палитру, а не шумом поверх
        rgb = rgb.convert("P", palette=Image.ADAPTIVE, colors=64,
                          dither=Image.FLOYDSTEINBERG).convert("RGB")

    q = int(g.get("jpeg_quality", 0))
    if q:
        import io
        buf = io.BytesIO()
        rgb.save(buf, "JPEG", quality=q)
        buf.seek(0)
        rgb = Image.open(buf).convert("RGB")

    out = rgb.convert("RGBA")
    out.putalpha(alpha)                       # альфу грейд не трогает
    return out


# ── команды ───────────────────────────────────────────────────────────────
def cmd_status(cat, args):
    have = miss = 0
    by_cat = {}
    for it in cat["items"]:
        ok = find_raw(it["id"]) is not None
        by_cat.setdefault(it["cat"], []).append((it["id"], ok))
        have, miss = have + ok, miss + (not ok)
    for c, rows in by_cat.items():
        n = sum(1 for _, ok in rows if ok)
        print(f"{c:8} {n}/{len(rows)}")
        for iid, ok in rows:
            if not ok:
                print(f"         · нет исходника: {iid}")
    print(f"\nвсего: {have} есть, {miss} нет  (raw → {RAW_DIR})")


def cmd_queries(cat, args):
    for it in cat["items"]:
        mark = " " if find_raw(it["id"]) else "×"
        print(f"{mark} {it['id']:22} [{it['kind']:6}] {it['query']}")


def cmd_build(cat, args):
    ITEMS_DIR.mkdir(parents=True, exist_ok=True)
    WORK_DIR.mkdir(parents=True, exist_ok=True)
    doll, g = cat["doll"], cat["grade"]

    manifest = {"doll": {"w": doll["w"], "h": doll["h"]},
                "slots": doll["z"],
                "items": {}}

    # ── мимика ────────────────────────────────────────────────────────────
    # Пять выражений нарисованы руками (art/babyland/faces/*.svg): пять
    # генераций дали бы пять разных девочек. Копируем их в сборку и кладём в
    # манифест якорь — раньше build пересобирал манифест с нуля и стирал их.
    faces_src = ROOT / "art" / "babyland" / "faces"
    if faces_src.exists():
        faces_out = OUT_DIR / "faces"
        faces_out.mkdir(parents=True, exist_ok=True)
        faces = {}
        for f in sorted(faces_src.glob("*.svg")):
            (faces_out / f.name).write_bytes(f.read_bytes())
            faces[f.stem] = f"faces/{f.name}"
        if faces:
            manifest["faces"] = faces
            anchor = (cat.get("generation") or {}).get("face_anchor")
            if anchor:
                manifest["face_anchor"] = anchor
            print(f"мимика: {len(faces)} выражений")

    # ── база куклы ────────────────────────────────────────────────────────
    # Она не «предмет»: не садится в слот, а ЗАДАЁТ полотно, к которому
    # привязаны все остальные слои. Поэтому её просто вписываем в полотно
    # целиком и гоняем через тот же грейд, что и вещи, — иначе кукла будет
    # выглядеть чище своей одежды и стык будет виден.
    doll_src = ROOT / "art" / "babyland" / "doll" / "base.png"
    if doll_src.exists() and not args.only:
        d, _ = cut_auto(trim_border(Image.open(doll_src)),
                        prefer=doll.get("matte"), verbose="база куклы")
        bb = d.getbbox()
        if bb:
            d = d.crop(bb)
        k = min(doll["w"] / d.width, doll["h"] / d.height)
        d = d.resize((max(1, int(d.width * k)), max(1, int(d.height * k))), Image.LANCZOS)
        canvas = Image.new("RGBA", (doll["w"], doll["h"]), (0, 0, 0, 0))
        canvas.alpha_composite(d, ((doll["w"] - d.width) // 2, (doll["h"] - d.height) // 2))
        graded = grade(canvas, g, "doll")
        (OUT_DIR / "doll").mkdir(parents=True, exist_ok=True)
        graded.save(OUT_DIR / "doll" / "base.png")
        print("кукла: база собрана")

    built = skipped = 0
    for it in cat["items"]:
        if args.only and it["id"] not in args.only:
            continue
        raw = find_raw(it["id"])
        if raw is None:
            skipped += 1
            continue

        img = trim_border(Image.open(raw))
        rgba, method = cut_auto(img, prefer="grabcut" if args.grabcut else it.get("matte"),
                                verbose=it["id"])
        if args.debug:
            rgba.save(WORK_DIR / f"{it['id']}.cut.png")
        placed = fit(rgba, doll, it["slot"], it)
        final = grade(placed, g, it["kind"])
        final.save(ITEMS_DIR / f"{it['id']}.png")

        # превью для плитки в гардеробе — обрезаем по вещи, а не по кукле
        bb = final.getbbox()
        thumb = final.crop(bb) if bb else final
        thumb.thumbnail((256, 256), Image.LANCZOS)
        thumb.save(ITEMS_DIR / f"{it['id']}.thumb.png")
        built += 1

    # манифест дописывается, а не перезаписывается: --only не должен
    # выкидывать из игры всё, что собрано раньше
    mf = OUT_DIR / "manifest.json"
    if mf.exists():
        try:
            manifest["items"] = json.loads(mf.read_text(encoding="utf-8")).get("items", {})
        except Exception:
            pass
    # ── макияж ────────────────────────────────────────────────────────────
    # Он не предмет на теле, а накладка на ЛИЦО, поэтому не генерируется и не
    # садится в коробку слота: рисуется руками в тех же координатах, что и
    # мимика, и позиционируется тем же якорем.
    # Правило, выведенное на практике: модель уверенно рисует ОТДЕЛИМЫЕ вещи
    # (одежда, обувь, сумки) и проваливает всё, что часть тела — лицо, макияж,
    # волосы приезжают портретом с чужим лицом. Поэтому такие слои рисованные.
    #   makeup — по якорю лица, поверх мимики (помада перекрывает губы);
    #   hair   — на полное полотно, поверх мимики (чёлка ложится на лоб).
    DRAWN = [("makeup", "makeup", doll["z"]["makeup"], True)]
    for folder, slot, z, anchored in DRAWN:
        src = ROOT / "art" / "babyland" / folder
        if not src.exists():
            continue
        dst = OUT_DIR / folder
        dst.mkdir(parents=True, exist_ok=True)
        n = 0
        for f in sorted(src.glob("*.svg")):
            (dst / f.name).write_bytes(f.read_bytes())
            entry = {"slot": slot, "z": z,
                     "src": f"{folder}/{f.name}", "thumb": f"{folder}/{f.name}"}
            if anchored:
                entry["anchor"] = True
            manifest["items"][f.stem] = entry
            n += 1
        if n:
            print(f"{folder}: {n} рисованных")

    # ── скримеры ──────────────────────────────────────────────────────────
    # Референс — не студийный хоррор, а ПЛОХОЕ фото: пережимаем до каши через
    # даунсэмпл и низкое качество JPEG. Дешевизна пугает сильнее качества.
    sc_src = ROOT / "art" / "babyland" / "screamers"
    if sc_src.exists():
        sc_out = OUT_DIR / "screamers"
        sc_out.mkdir(parents=True, exist_ok=True)
        shots = []
        for f in sorted(sc_src.glob("*.png")):
            im = Image.open(f).convert("RGB")
            w, h = im.size
            small = im.resize((max(1, w // 4), max(1, h // 4)), Image.BILINEAR)
            im = small.resize((w, h), Image.NEAREST)          # обратно — блоками
            im = ImageEnhance.Color(im).enhance(1.35)
            im = ImageEnhance.Contrast(im).enhance(1.25)
            out = sc_out / f"{f.stem}.jpg"
            im.save(out, "JPEG", quality=28)                   # каша артефактов
            shots.append(f"screamers/{out.name}")
        if shots:
            manifest["screamers"] = shots
            print(f"скримеры: {len(shots)} кадров (пережаты)")

    drawn_cats = {"makeup"}
    for it in cat["items"]:
        if it["cat"] in drawn_cats:
            continue                              # уже положены выше
        if (ITEMS_DIR / f"{it['id']}.png").exists():
            manifest["items"][it["id"]] = {
                "slot": it["slot"], "z": doll["z"][it["slot"]],
                "src": f"items/{it['id']}.png",
                "thumb": f"items/{it['id']}.thumb.png",
            }
    # база куклы: нарисованный SVG имеет приоритет над сгенерированным PNG —
    # только он гарантирует лысую голову, пустое лицо и точные якоря слотов
    svg_src = ROOT / "art" / "babyland" / "doll" / "base.svg"
    if svg_src.exists() and doll.get("base", "svg") == "svg":
        (OUT_DIR / "doll").mkdir(parents=True, exist_ok=True)
        (OUT_DIR / "doll" / "base.svg").write_bytes(svg_src.read_bytes())
        manifest["doll"]["src"] = "doll/base.svg"
    elif (OUT_DIR / "doll" / "base.png").exists():
        manifest["doll"]["src"] = "doll/base.png"
    mf.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"собрано: {built}, без исходника: {skipped} → {OUT_DIR}")


def cmd_sheet(cat, args):
    """Контактный лист: всё, что собрано, одной картинкой — выбирать по картинке
    удобнее, чем по списку имён."""
    from PIL import ImageDraw
    # рисованные слои (SVG) в лист не попадали — а это 12 из 55 предметов
    mf = OUT_DIR / "manifest.json"
    have = set()
    if mf.exists():
        have = set(json.loads(mf.read_text(encoding="utf-8")).get("items", {}))
    rows = [it for it in cat["items"]
            if (ITEMS_DIR / f"{it['id']}.thumb.png").exists() or it["id"] in have]
    if not rows:
        sys.exit("нечего показывать — сначала build")
    cols, cell = 8, 180
    w = cols * cell
    h = ((len(rows) + cols - 1) // cols) * (cell + 22)
    sheet = Image.new("RGB", (w, h), (24, 22, 28))
    d = ImageDraw.Draw(sheet)
    for i, it in enumerate(rows):
        x, y = (i % cols) * cell, (i // cols) * (cell + 22)
        tp = ITEMS_DIR / f"{it['id']}.thumb.png"
        if not tp.exists():
            # SVG-слой: PIL его не читает, помечаем клетку словом
            d.rectangle([x + 4, y + 4, x + cell - 4, y + cell - 4],
                        fill=(250, 236, 245) if it["kind"] == "pretty" else (232, 234, 238))
            d.text((x + 14, y + cell // 2 - 4), "рисованный SVG", fill=(120, 100, 115))
            d.text((x + 8, y + cell - 2), f"{it['id']}", fill=(190, 190, 200))
            continue
        th = Image.open(tp).convert("RGBA")
        th.thumbnail((cell - 16, cell - 16), Image.LANCZOS)
        bg = (250, 236, 245) if it["kind"] == "pretty" else (232, 234, 238)
        d.rectangle([x + 4, y + 4, x + cell - 4, y + cell - 4], fill=bg)
        sheet.paste(th, (x + (cell - th.width) // 2, y + (cell - th.height) // 2), th)
        d.text((x + 8, y + cell - 2), f"{it['id']}", fill=(190, 190, 200))
    out = ROOT / "art" / "babyland" / "contact-sheet.png"
    sheet.save(out)
    print(f"контактный лист: {out}  ({len(rows)} шт.)")


# ── ГЕНЕРАЦИЯ: локальный ComfyUI ──────────────────────────────────────────
# На машине из image-моделей нет ничего — в ComfyUI лежат только видеомодели.
# Но Wan 2.2 TI2V-5B прекрасно отдаёт ОДИН кадр (length=1), а один кадр — это
# и есть картинка. Так генерация не требует ни одной новой загрузки.
#
#   python tools/babyland_assets.py gen --doll
#   python tools/babyland_assets.py gen --only top_ruffles bot_tutu
#
# Результат ложится в raw/, дальше его подхватывает обычный build.
COMFY = os.environ.get("COMFY_URL", "http://127.0.0.1:8188")
WAN = {
    "unet": "Wan2.2-TI2V-5B-Q8_0.gguf",
    "clip": "umt5_xxl_fp8_e4m3fn_scaled.safetensors",
    "vae":  "wan2.2_vae.safetensors",
}
NEGATIVE = ("photo, photorealistic, 3d render, text, watermark, logo, signature, "
            "blurry, low quality, jpeg artifacts, extra limbs, deformed hands, "
            "multiple people, collage, cropped, frame, border")


def comfy_graph(prompt, width, height, seed, steps=25, cfg=5.0, shift=8.0, prefix="babyland/x"):
    return {
        "1":  {"class_type": "UnetLoaderGGUF", "inputs": {"unet_name": WAN["unet"]}},
        "2":  {"class_type": "CLIPLoader", "inputs": {"clip_name": WAN["clip"], "type": "wan"}},
        "3":  {"class_type": "VAELoader", "inputs": {"vae_name": WAN["vae"]}},
        "4":  {"class_type": "CLIPTextEncode", "inputs": {"text": prompt,   "clip": ["2", 0]}},
        "5":  {"class_type": "CLIPTextEncode", "inputs": {"text": NEGATIVE, "clip": ["2", 0]}},
        # length=1 — тот самый «один кадр вместо видео»
        "6":  {"class_type": "Wan22ImageToVideoLatent",
               "inputs": {"vae": ["3", 0], "width": width, "height": height,
                          "length": 1, "batch_size": 1}},
        "7":  {"class_type": "ModelSamplingSD3", "inputs": {"model": ["1", 0], "shift": shift}},
        "8":  {"class_type": "KSampler",
               "inputs": {"model": ["7", 0], "positive": ["4", 0], "negative": ["5", 0],
                          "latent_image": ["6", 0], "seed": seed, "steps": steps, "cfg": cfg,
                          "sampler_name": "euler", "scheduler": "simple", "denoise": 1.0}},
        "9":  {"class_type": "VAEDecode", "inputs": {"samples": ["8", 0], "vae": ["3", 0]}},
        "10": {"class_type": "SaveImage", "inputs": {"images": ["9", 0], "filename_prefix": prefix}},
    }


SDXL_CKPT = "sd_xl_base_1.0.safetensors"


def comfy_graph_sdxl(prompt, negative, width, height, seed,
                     steps=30, cfg=7.0, prefix="babyland/x"):
    """Граф на обычной image-модели. Wan (видеомодель с length=1) технически
    работает, но стилем не управляется: одни и те же слова кидают её из
    контурной раскраски в залитый блоб. SDXL держит style-промпт предсказуемо,
    а для плоской векторной куклы важна именно управляемость."""
    return {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": SDXL_CKPT}},
        "2": {"class_type": "CLIPTextEncode", "inputs": {"text": prompt,   "clip": ["1", 1]}},
        "3": {"class_type": "CLIPTextEncode", "inputs": {"text": negative, "clip": ["1", 1]}},
        "4": {"class_type": "EmptyLatentImage",
              "inputs": {"width": width, "height": height, "batch_size": 1}},
        "5": {"class_type": "KSampler",
              "inputs": {"model": ["1", 0], "positive": ["2", 0], "negative": ["3", 0],
                         "latent_image": ["4", 0], "seed": seed, "steps": steps, "cfg": cfg,
                         "sampler_name": "dpmpp_2m", "scheduler": "karras", "denoise": 1.0}},
        "6": {"class_type": "VAEDecode", "inputs": {"samples": ["5", 0], "vae": ["1", 2]}},
        "7": {"class_type": "SaveImage", "inputs": {"images": ["6", 0], "filename_prefix": prefix}},
    }


def comfy_run(graph, dest: Path, timeout=900):
    """Ставит задачу в очередь, ждёт, забирает картинку в dest."""
    import urllib.request, urllib.parse, uuid, time
    def post(path, payload):
        req = urllib.request.Request(f"{COMFY}{path}",
                                     data=json.dumps(payload).encode(),
                                     headers={"Content-Type": "application/json"})
        return json.loads(urllib.request.urlopen(req, timeout=60).read())
    def get(path):
        return json.loads(urllib.request.urlopen(f"{COMFY}{path}", timeout=60).read())

    try:
        pid = post("/prompt", {"prompt": graph, "client_id": uuid.uuid4().hex})["prompt_id"]
    except Exception as e:
        sys.exit(f"ComfyUI недоступен ({COMFY}): {e}. "
                 f"Запусти run_wan_lowvram.bat в ComfyUI_windows_portable")

    t0 = time.time()
    while time.time() - t0 < timeout:
        h = get(f"/history/{pid}")
        if pid in h:
            outs = h[pid].get("outputs", {})
            for node in outs.values():
                for im in node.get("images", []):
                    q = urllib.parse.urlencode({"filename": im["filename"],
                                                "subfolder": im.get("subfolder", ""),
                                                "type": im.get("type", "output")})
                    data = urllib.request.urlopen(f"{COMFY}/view?{q}", timeout=120).read()
                    dest.parent.mkdir(parents=True, exist_ok=True)
                    dest.write_bytes(data)
                    return dest
            status = h[pid].get("status", {})
            if status.get("status_str") == "error":
                sys.exit(f"ComfyUI вернул ошибку: {json.dumps(status)[:400]}")
            break
        time.sleep(2)
    sys.exit("генерация не дождалась результата")


def cmd_gen(cat, args):
    import random
    g = cat.get("generation") or sys.exit("в каталоге нет раздела generation")
    seed = args.seed if args.seed is not None else random.randint(1, 2**31)
    backend = args.model or g.get("provider", "sdxl")

    def build(prompt, neg_extra, w, h, prefix):
        neg = NEGATIVE + ((", " + neg_extra) if neg_extra else "")
        if backend == "sdxl":
            return comfy_graph_sdxl(prompt, neg, w, h, seed,
                                    steps=args.steps or 30, prefix=prefix)
        gr = comfy_graph(prompt, w, h, seed, steps=args.steps or 25, prefix=prefix)
        gr["5"]["inputs"]["text"] = neg
        return gr

    if args.screamers:
        sc = cat.get("screamers") or sys.exit("в каталоге нет раздела screamers")
        w, h = (int(x) for x in sc.get("size", "832x1216").split("x"))
        dest_dir = ROOT / "art" / "babyland" / "screamers"
        for name, prompt in sc["shots"].items():
            dest = dest_dir / f"{name}.png"
            if dest.exists() and not args.force:
                print(f"· {name} уже есть, пропуск"); continue
            print(f"· {name} · {w}x{h} · seed {seed}")
            comfy_run(comfy_graph_sdxl(prompt, sc.get("negative", ""), w, h, seed,
                                       steps=args.steps or 28,
                                       prefix=f"babyland/{name}"), dest)
            seed += 1
        print(f"→ {dest_dir}")
        return

    if args.doll:
        key = "doll_size_sdxl" if backend == "sdxl" else "doll_size"
        w, h = (int(x) for x in g.get(key, "832x1216").split("x"))
        dest = ROOT / "art" / "babyland" / "doll" / "base.png"
        print(f"кукла · {backend} · {w}x{h} · seed {seed}")
        # у куклы свои запреты: дубли тела и волосы (волосы — отдельный слот)
        comfy_run(build(g["doll_prompt"], g.get("doll_negative_extra"), w, h,
                        "babyland/doll"), dest)
        print(f"→ {dest}")
        return

    ids = args.only or [it["id"] for it in cat["items"]]
    w, h = (int(x) for x in g.get("item_size", "1024x1024").split("x"))
    DRAWN_CATS = {"makeup"}                  # рисуется руками (ложится на лицо)
    for it in cat["items"]:
        if it["id"] not in ids or it["cat"] in DRAWN_CATS:
            continue
        dest = RAW_DIR / f"{it['id']}.png"
        if dest.exists() and not args.force:
            print(f"· {it['id']} уже есть, пропуск (--force чтобы перегенерить)")
            continue
        print(f"· {it['id']} · {backend} · seed {seed}")
        neg = g.get("negative_extra", "")
        if it["cat"] == "hair" and g.get("hair_negative"):
            neg = neg + ", " + g["hair_negative"]     # у париков свои запреты
        comfy_run(build(it["prompt"], neg, w, h, f"babyland/{it['id']}"), dest)
        seed += 1
    print("готово. дальше: build")


# ── RIG: измерить линии тела по самой базе ────────────────────────────────
# Риг нельзя держать на глазок: сменилась база — поехали все 55 вещей. Линии
# и ширины вычисляются из профиля силуэта, поэтому после любой перегенерации
# базы достаточно одной команды.
#
#   python tools/babyland_assets.py rig          измерить и записать в каталог
#   python tools/babyland_assets.py rig --debug  + картинка с разметкой
def measure_rig(alpha: np.ndarray):
    """alpha: маска базы (H x W). Возвращает линии и ширины в долях полотна.

    Ширина ряда считается не как общее число пикселей, а как ДЛИНА
    ЦЕНТРАЛЬНОГО СПЛОШНОГО УЧАСТКА. С опущенными руками общий счёт врёт:
    «самый широкий ряд» оказывается линией кистей, а не плеч. Центральный
    участок — это торс и ноги, руки в него не попадают, как только отходят
    от корпуса.
    """
    H, W = alpha.shape
    mask = alpha > 128

    cols = np.nonzero(mask.any(axis=0))[0]
    cx_px = int((cols[0] + cols[-1]) / 2) if cols.size else W // 2

    def central_run(y):
        row = mask[y]
        if not row[cx_px]:
            near = np.nonzero(row)[0]
            if near.size == 0:
                return 0
            cxx = int(near[np.argmin(np.abs(near - cx_px))])
        else:
            cxx = cx_px
        l = cxx
        while l > 0 and row[l - 1]:
            l -= 1
        r = cxx
        while r < W - 1 and row[r + 1]:
            r += 1
        return r - l + 1

    rows_all = mask.sum(axis=1).astype(float)
    solid = np.nonzero(rows_all > W * 0.006)[0]
    if solid.size == 0:
        sys.exit("силуэт базы не найден")
    top, bot = int(solid[0]), int(solid[-1])

    # подставка: у самого низа общая ширина скачком больше, чем у щиколоток
    tail_from = int(bot - (bot - top) * 0.10)
    narrow = np.percentile(rows_all[top:bot][rows_all[top:bot] > 0], 20)
    over = np.nonzero(rows_all[tail_from:bot + 1] > narrow * 2.6)[0]
    if over.size:
        bot = tail_from + int(over[0]) - 1

    rows = np.array([central_run(y) for y in range(H)], dtype=float)
    L = bot - top
    def win(a, b):
        return slice(top + int(L * a), top + int(L * b))
    def amin(sl): return int(np.argmin(rows[sl]) + sl.start)
    def amax(sl): return int(np.argmax(rows[sl]) + sl.start)

    neck = amin(win(0.08, 0.24))
    # плечи — не «самый широкий ряд», а САМЫЙ РЕЗКИЙ СКАЧОК ширины под шеей:
    # переход шея→плечи это ступенька, и она видна даже когда руки опущены
    lo, hi = neck + 2, top + int(L * 0.34)
    d = np.diff(rows[lo:hi]) if hi > lo + 2 else np.array([0.0])
    shoulder = lo + int(np.argmax(d)) + 1

    waist = amin(win(0.34, 0.52))
    hip   = amax(win(0.50, 0.66))
    ankle = amin(win(0.88, 0.995))
    chin  = int(top + (neck - top) * 0.88)
    eye   = int(top + (neck - top) * 0.55)
    knee  = int(hip + (ankle - hip) * 0.52)

    lines = {"head_top": top, "eye_line": eye, "chin": chin, "neck": neck,
             "shoulder": shoulder,
             "chest": int(shoulder + (waist - shoulder) * 0.45),
             "waist": waist, "hip": hip, "knee": knee, "ankle": ankle, "sole": bot}

    def width_at(y, band=6):
        a, b = max(0, y - band), min(H, y + band + 1)
        return float(np.median(rows[a:b])) / W

    widths = {"head": width_at(eye), "shoulder": width_at(shoulder + 6),
              "chest": width_at(lines["chest"]), "waist": width_at(waist),
              "hip": width_at(hip),
              # ступни: тут нужна ПОЛНАЯ ширина ряда — обе ноги, а не одна
              "foot": float(np.median(rows_all[max(0, bot - 14):bot])) / W}

    return ({k: round(v / H, 4) for k, v in lines.items()},
            {k: round(v, 4) for k, v in widths.items()},
            round(cx_px / W, 4))


def cmd_rig(cat, args):
    doll = cat["doll"]
    src = ROOT / "art" / "babyland" / "doll" / "base.png"
    if not src.exists():
        sys.exit(f"нет базы: {src}")
    rgba, _ = cut_auto(trim_border(Image.open(src)), prefer=cat["doll"].get("matte"),
                       verbose="база куклы")
    bb = rgba.getbbox()
    if bb:
        rgba = rgba.crop(bb)
    k = min(doll["w"] / rgba.width, doll["h"] / rgba.height)
    rgba = rgba.resize((max(1, int(rgba.width * k)), max(1, int(rgba.height * k))),
                       Image.LANCZOS)
    canvas = Image.new("RGBA", (doll["w"], doll["h"]), (0, 0, 0, 0))
    canvas.alpha_composite(rgba, ((doll["w"] - rgba.width) // 2,
                                  (doll["h"] - rgba.height) // 2))

    alpha = np.asarray(canvas.getchannel("A"))
    lines, widths, cx = measure_rig(alpha)
    doll["rig"] = {"center_x": cx, "lines": lines, "widths": widths}
    CATALOG.write_text(json.dumps(cat, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"осевая: {cx}")
    for k2, v in lines.items():
        print(f"  {k2:9} {v:.4f}  →  y={round(v * doll['h'])}")
    print("ширины:", {k2: round(v, 3) for k2, v in widths.items()})

    if args.debug:
        from PIL import ImageDraw
        vis = Image.new("RGB", canvas.size, (18, 16, 20))
        vis.paste(canvas, (0, 0), canvas)
        d = ImageDraw.Draw(vis)
        for k2, v in lines.items():
            y = v * doll["h"]
            d.line([(0, y), (doll["w"], y)], fill=(255, 90, 170), width=2)
            d.text((6, y + 2), k2, fill=(255, 190, 220))
        out = ROOT / "art" / "babyland" / "rig-debug.png"
        vis.save(out)
        print(f"разметка: {out}")


def main():
    ap = argparse.ArgumentParser(description="BABYLAND — конвейер графики")
    ap.add_argument("cmd", choices=["status", "build", "sheet", "queries", "gen", "rig"])
    ap.add_argument("--only", nargs="*", help="только эти id")
    ap.add_argument("--grabcut", action="store_true", help="матирование GrabCut (сложный фон)")
    ap.add_argument("--debug", action="store_true", help="сохранять промежуточные вырезы в work/")
    ap.add_argument("--doll", action="store_true", help="gen: сгенерировать базу куклы")
    ap.add_argument("--screamers", action="store_true", help="gen: кадры скримеров")
    ap.add_argument("--seed", type=int, help="gen: фиксированный seed")
    ap.add_argument("--steps", type=int, help="gen: шагов сэмплера")
    ap.add_argument("--model", choices=["sdxl", "wan"], help="gen: чем генерить")
    ap.add_argument("--force", action="store_true", help="gen: перегенерить поверх существующего")
    args = ap.parse_args()
    cat = load_catalog()
    {"status": cmd_status, "build": cmd_build, "sheet": cmd_sheet,
     "queries": cmd_queries, "gen": cmd_gen, "rig": cmd_rig}[args.cmd](cat, args)


if __name__ == "__main__":
    main()

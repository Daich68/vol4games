#!/usr/bin/env python3
"""Сверка BABYLAND с брифом Ланы Ленковой.

Зачем: бриф — единственный источник правды по этой игре, но он PDF, и его
легко «помнить неправильно». Дважды подряд игра расходилась с ним незаметно
(пропавший проигрыш, чужая палитра, вольные подписи). Этот скрипт делает
расхождение видимым за секунду.

Проверяет то, что можно проверить машинно:
  1. количества предметов по категориям;
  2. дословность семи стихов;
  3. дословность системных формулировок;
  4. светлотный зазор между «красивым» и «неправильным» — он геймплейный
     сигнал, а дуотон оставляет от цвета только светлоту.

Запуск:  PYTHONUTF8=1 python tools/check_brief.py
Кириллица на этой машине падает без PYTHONUTF8=1.
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
PDF = pathlib.Path(
    r"C:\Users\daich\Downloads\Telegram Desktop\веб-альманах Лана Ленкова.pdf"
)

# Количества заданы Ланой на стр. 4.
COUNTS = {"hair": 8, "top": 12, "bottom": 8, "shoes": 8, "acc": 15, "makeup": 4}

# Формулировки, которые бриф задаёт дословно.
PHRASES = [
    ("пролог, приветствие", "Добро пожаловать в BABYLAND"),
    ("пролог, призыв", "Сделай эту девочку красивой"),
    ("реакция 2", "Это не очень красиво"),
    ("реакция 3", "Ей это не нравится!!!"),
    ("реакция 4", "Эта девочка хочет быть красивой"),
    ("концовка «идеальная»", "Ура! Теперь она красивая!"),
    ("концовка «уродка», 1", "Она расстроена и устала"),
    ("концовка «уродка», 2", "Она больше так не может"),
    ("кнопка рестарта", "Попробовать всё исправить"),
    ("выход, вопрос", "Вы уверены?"),
    ("выход, довод", "Эта девочка всё ещё хочет быть красивой"),
    ("выход, кнопка 1", "Остаться"),
    ("выход, кнопка 2", "Всё равно выйти"),
]

# Минимальный зазор по относительной яркости. Ниже 0.12 после обесцвечивания
# «красивое» и «неправильное» перестают различаться на глаз.
MIN_GAP = 0.12

fails = []


def say(ok, text):
    print(f"  {'✓' if ok else '✗'} {text}")
    if not ok:
        fails.append(text)


def norm(t):
    return re.sub(r"\s+", " ", t).strip().lower()


def luminance(hex_color):
    h = hex_color.lstrip("#")
    parts = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    lin = [c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4 for c in parts]
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]


def check_counts():
    print("\nКоличества предметов (бриф, стр. 4)")
    src = (ROOT / "src/games/babyland/items.js").read_text(encoding="utf-8")
    for cat, want in COUNTS.items():
        block = re.search(rf"\b{cat}:\s*\[(.*?)\n\s*\]", src, re.S)
        got = len(re.findall(r"^\s*[PW]\(", block.group(1), re.M)) if block else 0
        say(got == want, f"{cat:7} {got}/{want}")


def check_poems(pages):
    print("\nСтихи дословно (бриф, стр. 7–12)")
    haystack = norm(" ".join(pages))
    for path in sorted((ROOT / "public/poems/babyland").glob("*.txt")):
        lines = [
            l for l in path.read_text(encoding="utf-8").split("\n")
            if l.strip() and "<…>" not in l and "<...>" not in l
        ]
        missing = [l for l in lines if norm(l)[:45] not in haystack]
        say(not missing, f"{path.name:18} строк {len(lines)}, расхождений {len(missing)}")
        for line in missing[:3]:
            print(f"      ✗ {line[:70]}")


def check_phrases():
    print("\nСистемные формулировки дословно")
    src = (
        (ROOT / "games/babyland/index.html").read_text(encoding="utf-8")
        + (ROOT / "src/games/babyland/main.js").read_text(encoding="utf-8")
    )
    for label, text in PHRASES:
        say(text in src, f"{label:24} «{text[:40]}»")


def check_contrast():
    print("\nСветлотный зазор «красивое / неправильное»")
    src = (ROOT / "src/games/babyland/doll.js").read_text(encoding="utf-8")

    def palette(name):
        m = re.search(rf"const {name} = \[(.*?)\];", src, re.S)
        return re.findall(r"#[0-9a-fA-F]{6}", m.group(1)) if m else []

    pinks, darks = palette("pinks"), palette("darks")
    if not pinks or not darks:
        say(False, "палитры не найдены в doll.js")
        return
    gap = min(map(luminance, pinks)) - max(map(luminance, darks))
    say(gap >= MIN_GAP, f"зазор {gap:.3f} (минимум {MIN_GAP})")



# Слои диска обязаны уходить под безель (z40) и рейки (z41) машины: розовое
# живёт строго ВНУТРИ безеля, иначе диск перестаёт быть вставленным в машину
# и становится просто страницей. Единственное исключение — скример: бриф
# разрешает ему накрыть приборы.
# Кому позволено быть выше безеля и почему:
#   .os-bezel / .os-rail — сама машина;
#   #scream              — бриф разрешает скримеру накрыть приборы;
#   body::after          — растр уровня экрана, не содержимое диска.
Z_ALLOWED_ABOVE = {".os-bezel", ".os-rail", "#scream", "body::after"}
Z_CEILING = 40


def check_z_order():
    print("\nZ-порядок: слои диска под безелем машины")
    css = (ROOT / "src/games/babyland/room.css").read_text(encoding="utf-8")
    # правило вида «селектор { … z-index:N … }»
    bad = []
    for m in re.finditer(r"([^{}]+)\{([^{}]*)\}", css):
        sel, body = m.group(1).strip(), m.group(2)
        z = re.search(r"z-index:\s*(\d+)", body)
        if not z:
            continue
        value = int(z.group(1))
        if value < Z_CEILING:
            continue
        if any(a in sel for a in Z_ALLOWED_ABOVE):
            continue
        bad.append(f"{sel.splitlines()[-1].strip()[:40]} z-index:{value}")
    say(not bad, f"нарушений потолка z={Z_CEILING}: {len(bad)}")
    for b in bad:
        print(f"      ✗ {b}")


# Три концовки заданы брифом на стр. 7. Проверяем, что каждая вызывается и что
# у каждой есть своё условие: «идеальная» — все красивые плюс гипермакияж,
# «уродка» — три цикла реакций, секретная — точная комбинация.
ENDINGS = [
    ("идеальная", "finish('perfect')", "PERFECT_MAKEUP|mk_hyper"),
    ("уродка", "finish('gone')", r"cycles\s*>=\s*3"),
    ("секретная", "finish('secret')", "SECRET_LOOK"),
]


def check_endings():
    print("\nТри концовки достижимы (бриф, стр. 7)")
    src = (ROOT / "src/games/babyland/main.js").read_text(encoding="utf-8")
    for name, call, cond in ENDINGS:
        has_call = call in src
        has_cond = bool(re.search(cond, src))
        say(has_call and has_cond,
            f"{name:11} вызов {'есть' if has_call else 'НЕТ'}, условие {'есть' if has_cond else 'НЕТ'}")


def main():
    print("BABYLAND — сверка с брифом")
    check_counts()
    check_phrases()
    check_contrast()
    check_z_order()
    check_endings()

    if PDF.exists():
        try:
            import fitz
            doc = fitz.open(PDF)
            check_poems([doc[i].get_text() for i in range(6, len(doc))])
        except ImportError:
            print("\nСтихи: пропущены — нет PyMuPDF (pip install pymupdf)")
    else:
        print(f"\nСтихи: пропущены — брифа нет по пути {PDF}")

    print()
    if fails:
        print(f"РАСХОЖДЕНИЙ: {len(fails)}")
        return 1
    print("Расхождений с брифом нет.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

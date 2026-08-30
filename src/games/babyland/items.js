// BABYLAND — каталог предметов.
// ГРАФИКИ ПОКА НЕТ: предмет здесь — только данные. Каждый предмет когда-нибудь
// получит спрайт/слой куклы, но механика (реакции, концовки, стихи) уже целиком
// висит на этих данных и рисовки не ждёт.
//
//   kind: "pretty" — конвенционально «красивое» (розовое, кукольное);
//   kind: "wrong"  — всё, что не соответствует ожидаемой эстетике.
//
// Количества заданы Ланой: волосы 8, верх 12, низ 8, обувь 8, аксессуары 15,
// макияж 4 — итого 55.

export const CATEGORIES = [
  { id: "hair",   label: "прическа",   poem: "hair"        },
  { id: "top",    label: "верх",       poem: "top"         },
  { id: "bottom", label: "низ",        poem: "bottom"      },
  { id: "shoes",  label: "обувь",      poem: "shoes"       },
  { id: "acc",    label: "аксессуары", poem: "accessories" },
  // макияж открывается, когда подобраны остальные категории
  { id: "makeup", label: "макияж",     poem: "makeup", locked: true },
];

const P = (id, label) => ({ id, label, kind: "pretty" });
const W = (id, label) => ({ id, label, kind: "wrong"  });

export const ITEMS = {
  hair: [
    P("hair_blonde_curls",  "блонд, локоны"),
    P("hair_blonde_bows",   "блонд с бантами"),
    P("hair_twin_tails",    "два хвостика"),
    P("hair_tiara",         "каре с диадемой"),
    W("hair_pixie",         "короткая стрижка"),
    W("hair_dark_bob",      "тёмное каре"),
    W("hair_messy_bun",     "растрёпанный пучок"),
    W("hair_shaved_side",   "выбритый висок"),
  ],
  top: [
    P("top_straps_bows",    "топ на бретельках с бантами"),
    P("top_ruffles",        "кофточка с рюшами"),
    P("top_bandeau_rhine",  "бандо со стразами"),
    P("top_hearts_blouse",  "блузка с сердечками"),
    P("top_crop_glitter",   "кроп-топ с блёстками"),
    P("top_bolero",         "розовое болеро"),
    W("top_hoodie_baggy",   "мешковатое худи"),
    W("top_tee_oversize",   "футболка оверсайз"),
    W("top_track_jacket",   "спортивная кофта"),
    W("top_mens_shirt",     "мужская рубашка"),
    W("top_turtleneck",     "чёрная водолазка"),
    W("top_worn_windbrk",   "потёртая ветровка"),
  ],
  bottom: [
    P("bot_mini_ruffles",   "мини-юбка с рюшами"),
    P("bot_tutu",           "юбка-пачка"),
    P("bot_shorts_bow",     "шорты с бантом"),
    P("bot_lace_skirt",     "юбка с кружевом"),
    W("bot_baggy_jeans",    "мешковатые джинсы"),
    W("bot_sweatpants",     "спортивные штаны"),
    W("bot_cargo_shorts",   "карго-шорты"),
    W("bot_long_dark",      "длинная тёмная юбка"),
  ],
  shoes: [
    P("sh_platform",        "босоножки на платформе"),
    P("sh_heels",           "туфли на каблуках"),
    P("sh_white_boots",     "белые сапожки"),
    P("sh_ballet_bow",      "балетки с бантом"),
    W("sh_sneakers",        "кроссовки"),
    W("sh_keds",            "кеды"),
    W("sh_heavy_boots",     "тяжёлые ботинки"),
    W("sh_slippers",        "тапочки"),
  ],
  acc: [
    P("acc_pearls",         "жемчужное ожерелье"),
    P("acc_bag_bow",        "сумочка с бантом"),
    P("acc_tiara",          "диадема"),
    P("acc_pearl_earrings", "серьги-жемчужины"),
    P("acc_gloves",         "розовые перчатки"),
    P("acc_bracelet",       "браслет со стразами"),
    P("acc_choker_bow",     "бант на шею"),
    P("acc_fairy_wings",    "крылышки феи"),
    W("acc_backpack",       "рюкзак"),
    W("acc_headphones",     "наушники"),
    W("acc_glasses",        "очки"),
    W("acc_cap",            "кепка"),
    W("acc_plaster",        "пластырь на щеке"),
    W("acc_wrench",         "разводной ключ"),
    W("acc_eyepatch",       "повязка на глаз"),
  ],
  makeup: [
    W("mk_natural",         "лёгкий естественный"),
    W("mk_nude",            "нюдовый"),
    W("mk_evening",         "вечерний"),
    // единственный вариант, при котором персонаж полностью успокаивается
    P("mk_hyper",           "гипертрофированный"),
  ],
};

// Тот самый макияж, на котором игра засчитывается пройденной (концовка 1).
export const PERFECT_MAKEUP = "mk_hyper";

// ── секретная комбинация (концовка 3) ────────────────────────────────────
// «При определенной комбинации неправильных вещей (без системных окон)
//  звучит обычным голосом стихотворение». Комбинация проверяется ДО эскалации
//  реакций: если лук совпал — окно не всплывает, машина просто читает стих.
export const SECRET_LOOK = {
  hair:   "hair_shaved_side",
  top:    "top_turtleneck",
  bottom: "bot_long_dark",
  shoes:  "sh_heavy_boots",
  acc:    "acc_eyepatch",
  makeup: "mk_evening",
};

// ── справочники ───────────────────────────────────────────────────────────
const BY_ID = new Map();
for (const cat of Object.keys(ITEMS)) {
  for (const it of ITEMS[cat]) BY_ID.set(it.id, { ...it, cat });
}

export const itemById = (id) => (id ? BY_ID.get(id) : null);
export const isPretty = (id) => itemById(id)?.kind === "pretty";
export const isWrong  = (id) => itemById(id)?.kind === "wrong";

// Категории, которые нужно заполнить, чтобы открылся макияж.
export const BASE_CATS = ["hair", "top", "bottom", "shoes", "acc"];

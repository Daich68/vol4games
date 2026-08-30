// ─── ИГГДРАСИЛЬ: цифровое дерево в центре карты ──────────────────────────
// Мировое древо машины: по стволу вверх течёт то, что она прочитала.
// Растёт из тех же материалов, что монументы (тёмный камень + холодный белый
// + кристалл), чтобы принадлежать этому миру, а не быть вставкой.
//
// Ветвление рекурсивное: каждый сегмент порождает 2–3 дочерних, отклоняя
// направление и укорачиваясь. На концах — светящиеся узлы: у цифрового
// дерева вместо листьев данные.
import * as THREE from "three";

const UP = new THREE.Vector3(0, 1, 0);
const R = (a, b) => a + Math.random() * (b - a);

export const TREE = { x: 0, z: 0, r: 1.6, h: 0, flatR: 9.0 };

// Четыре главных сука — по числу стихов машины. Сук загорается, когда его
// стих прочитан: дерево это не декорация, а ПАМЯТЬ — видно, сколько машина
// уже прочла, не глядя на счётчик.
export const BOUGHS = ["birds", "stalagmit", "nancy-drew", "prizma"];

// Прошлые выпуски альманаха висят на дереве плодами. vol4 — это сам мир, в
// котором игрок стоит, поэтому его среди плодов нет: он ещё растёт.
export const FRUITS = [
  { id: "vol-1", label: "vol 1", url: "https://vol-1.web-almanac.com/" },
  { id: "vol-2", label: "vol 2", url: "https://vol-2.web-almanac.com/" },
  { id: "vol-3", label: "vol 3", url: "https://vol-3.web-almanac.com/" },
];

export function createYggdrasil({ scene, obstacles, isDone = () => false }) {
  const group = new THREE.Group();
  const tips = [];
  const boughs = [];          // { game, mats[], tips[], lit }
  const rings = [];           // приборные кольца в основании
  const fruits = [];          // прошлые выпуски альманаха
  let motes = null, glow = null, crownRing = null;

  const barkMat = new THREE.MeshStandardMaterial({
    color: 0x7a7f9c, roughness: 0.72, metalness: 0.2,
    emissive: 0x232a44, emissiveIntensity: 1.5, flatShading: true,
  });
  const limbMat = new THREE.MeshStandardMaterial({
    color: 0xa8b0cc, roughness: 0.45, metalness: 0.35,
    emissive: 0x4a63b0, emissiveIntensity: 2.0, flatShading: true,
  });
  const tipMat = new THREE.MeshStandardMaterial({
    color: 0xb4ccee, roughness: 0.12, metalness: 0.3,
    emissive: 0x6f9cff, emissiveIntensity: 2.6, flatShading: true,
  });

  // сегмент ветви: конус от точки `from` вдоль `dir`
  function limb(from, dir, len, r0, r1, mat) {
    const geo = new THREE.CylinderGeometry(r1, r0, len, 6, 1, true);
    geo.translate(0, len / 2, 0);                  // низ цилиндра — в начало
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(from);
    m.quaternion.setFromUnitVectors(UP, dir.clone().normalize());
    group.add(m);
    return from.clone().addScaledVector(dir, len);
  }

  function grow(from, dir, len, rad, depth, bough) {
    // у каждого сука свои материалы — иначе не зажечь его отдельно
    const mats = bough ? bough.mats : null;
    const end = limb(from, dir, len, rad, rad * 0.66,
                     depth > 3 ? (mats ? mats.bark : barkMat)
                               : (mats ? mats.limb : limbMat));
    if (end.y > TREE.h) TREE.h = end.y;

    if (depth === 0) {
      const tip = new THREE.Mesh(new THREE.OctahedronGeometry(R(0.10, 0.19), 0),
                                 mats ? mats.tip : tipMat);
      tip.position.copy(end);
      group.add(tip);
      const rec = { mesh: tip, ph: R(0, 6.28), spd: R(0.7, 1.6), y: end.y, baseY: end.y };
      tips.push(rec);
      if (bough) bough.tips.push(rec);
      return;
    }

    const kids = depth >= 3 ? 2 + (Math.random() < 0.7 ? 1 : 0)
                            : 2 + (Math.random() < 0.35 ? 1 : 0);
    for (let i = 0; i < kids; i++) {
      // отклоняем: наклон от родительского направления + разворот вокруг ствола
      // чем ближе к стволу, тем шире развод: так крона не собирается
      // шапкой на макушке, а спускается по бокам
      const tilt = R(0.34, 0.70) + (5 - depth) * 0.05;
      const spin = (i / kids) * Math.PI * 2 + R(-0.5, 0.5);
      const axis = new THREE.Vector3(Math.cos(spin), 0, Math.sin(spin)).normalize();
      const nd = dir.clone().applyAxisAngle(axis, tilt);
      nd.y = Math.max(0.12, nd.y);                 // ветви не растут вниз
      grow(end, nd.normalize(), len * R(0.66, 0.80), rad * 0.58, depth - 1, bough);
    }
  }

  // ── ствол: сегменты с лёгким изгибом, дальше крона ──
  {
    let pos = new THREE.Vector3(0, -0.4, 0);
    let dir = new THREE.Vector3(0, 1, 0);
    let rad = 0.92;
    for (let i = 0; i < 2; i++) {
      pos = limb(pos, dir, 1.9, rad, rad * 0.86, barkMat);
      rad *= 0.86;
      dir = dir.applyAxisAngle(
        new THREE.Vector3(Math.cos(i * 2.1), 0, Math.sin(i * 2.1)), 0.07).normalize();
    }
    // ── четыре сука, по одному на стих ──
    BOUGHS.forEach((game, i) => {
      const b = {
        game, tips: [],
        mats: {
          bark: barkMat.clone(), limb: limbMat.clone(), tip: tipMat.clone(),
        },
      };
      boughs.push(b);
      const a = (i / BOUGHS.length) * Math.PI * 2 + 0.4;
      const axis = new THREE.Vector3(Math.cos(a), 0, Math.sin(a)).normalize();
      const nd = dir.clone().applyAxisAngle(axis, 0.46).normalize();
      grow(pos, nd, 2.7, rad * 0.78, 4, b);
    });
  }

  // ── корни: те же ветви, наружу и вниз, наполовину в земле ──
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + R(-0.3, 0.3);
    const dir = new THREE.Vector3(Math.cos(a), -0.42, Math.sin(a)).normalize();
    let pos = new THREE.Vector3(0, 0.25, 0), rad = 0.36;
    for (let k = 0; k < 3; k++) {
      pos = limb(pos, dir, R(1.0, 1.7), rad, rad * 0.7, barkMat);
      rad *= 0.7;
      dir.applyAxisAngle(UP, R(-0.35, 0.35));
      dir.y = Math.min(-0.10, dir.y + 0.10);
      dir.normalize();
    }
  }

  // ── сок данных: частицы текут вверх по стволу и расходятся по кроне ──
  {
    const N = 620;
    const seed = [];
    for (let i = 0; i < N; i++) {
      seed.push({ ph: Math.random(), spd: R(0.05, 0.16),
                  a: Math.random() * Math.PI * 2, r: R(0.05, 0.55) });
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    motes = new THREE.Points(g, new THREE.PointsMaterial({
      color: 0xcfe0ff, size: 0.13, sizeAttenuation: true,
      transparent: true, opacity: 0.6, depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    motes.userData.seed = seed;
    group.add(motes);
  }

  // ── плоды: прошлые выпуски альманаха ─────────────────────────────────
  // Висят на концах ветвей, разнесённые по кругу и по высоте, чтобы не
  // слипались. Светятся ярче узлов-данных: выпуск — это плод, а не листок.
  {
    const fruitMat = new THREE.MeshStandardMaterial({
      color: 0xe8ecf5, roughness: 0.18, metalness: 0.45,
      emissive: 0x9fc0ff, emissiveIntensity: 2.2, flatShading: true,
    });
    const stemMat = new THREE.MeshBasicMaterial({
      color: 0x9aa8d0, transparent: true, opacity: 0.55,
    });

    // выбираем концы ветвей, разведённые по углу: иначе все плоды окажутся
    // на одной стороне кроны
    // Плоды разводим ПО СЕКТОРАМ, а не по индексу в списке: концы ветвей
    // распределены по углу неравномерно, и выбор по индексу сажал два плода
    // рядом, а третий прятал вглубь кроны — «vol 2 нету».
    // В каждом секторе берём самый ВНЕШНИЙ конец: у плода возле ствола игрок
    // упрётся в ствол-препятствие раньше, чем подойдёт.
    const all = tips.map((tp) => ({
      tp,
      a: Math.atan2(tp.mesh.position.z, tp.mesh.position.x),
      y: tp.mesh.position.y,
      rad: Math.hypot(tp.mesh.position.x, tp.mesh.position.z),
    }));
    const picked = [];
    for (let k = 0; k < FRUITS.length; k++) {
      const from = -Math.PI + (k / FRUITS.length) * Math.PI * 2;
      const to   = -Math.PI + ((k + 1) / FRUITS.length) * Math.PI * 2;
      const inSector = all.filter((c) => c.a >= from && c.a < to &&
                                         c.y > TREE.h * 0.30 &&
                                         !picked.includes(c));
      const pool = inSector.length ? inSector : all.filter((c) => !picked.includes(c));
      if (!pool.length) continue;
      // самый дальний от ствола в секторе — его видно и до него можно дойти
      pool.sort((x, y2) => y2.rad - x.rad);
      picked.push(pool[0]);
    }

    FRUITS.forEach((f, k) => {
      const pick = picked[k];
      if (!pick) return;
      const at = pick.tp.mesh.position;

      const g = new THREE.Group();
      g.position.set(at.x, at.y, at.z);

      // черенок вниз от ветви
      const stemLen = 0.5;
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.022, 0.022, stemLen, 4), stemMat);
      stem.position.y = -stemLen / 2;
      g.add(stem);

      const body = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.30, 0), fruitMat.clone());
      body.position.y = -stemLen - 0.26;
      g.add(body);

      // ореол — плод должно быть видно среди узлов кроны
      const halo = new THREE.Mesh(
        new THREE.SphereGeometry(0.62, 16, 12),
        new THREE.MeshBasicMaterial({
          color: 0x9fc0ff, transparent: true, opacity: 0.14,
          depthWrite: false, blending: THREE.AdditiveBlending,
        }));
      halo.position.copy(body.position);
      g.add(halo);

      group.add(g);
      fruits.push({
        ...f, group: g, body, halo, mat: body.material,
        ph: R(0, 6.28),
        // мировая позиция плода — для подписи и для проверки близости
        world: new THREE.Vector3(TREE.x + at.x, at.y - stemLen - 0.26, TREE.z + at.z),
        near: 0,
      });
    });
  }

  // ── приборная обвязка: машина всё меряет ─────────────────────────────
  // Кольца, деления и обод — тот же язык, что у постаментов монументов и
  // колец нод. Без них дерево выглядит гостем из другого проекта.
  {
    const rimMat = new THREE.MeshBasicMaterial({
      color: 0xe8ecf5, side: THREE.DoubleSide, transparent: true, opacity: 0.85,
    });
    const dimMat = new THREE.MeshBasicMaterial({
      color: 0x7d8dc0, side: THREE.DoubleSide, transparent: true, opacity: 0.35,
    });

    // обод у корней — как золотая кайма постамента у монументов
    const rim = new THREE.Mesh(new THREE.TorusGeometry(3.15, 0.055, 6, 96), rimMat);
    rim.rotation.x = Math.PI / 2; rim.position.y = 0.06;
    group.add(rim);
    rings.push({ mesh: rim, mat: rimMat, base: 0.85, spin: 0.05 });

    // измерительные кольца дальше — считываются как шкала
    for (const [rad, op] of [[5.0, 0.30], [6.7, 0.18]]) {
      const m = dimMat.clone(); m.opacity = op;
      const r = new THREE.Mesh(new THREE.TorusGeometry(rad, 0.025, 4, 128), m);
      r.rotation.x = Math.PI / 2; r.position.y = 0.03;
      group.add(r);
      rings.push({ mesh: r, mat: m, base: op, spin: 0 });
    }

    // деления по внешнему кольцу: каждые 15 градусов, каждое четвёртое длиннее
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const long = i % 4 === 0;
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.02, long ? 0.42 : 0.20),
        long ? rimMat : dimMat);
      m.position.set(Math.cos(a) * 6.7, 0.035, Math.sin(a) * 6.7);
      m.rotation.y = -a;
      group.add(m);
    }
  }

  // ── кольцо кроны: наклонный обод, медленно вращается вокруг дерева ────
  {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xdfe8ff, side: THREE.DoubleSide, transparent: true, opacity: 0.5,
    });
    crownRing = new THREE.Mesh(new THREE.TorusGeometry(4.6, 0.035, 5, 128), mat);
    crownRing.rotation.set(Math.PI / 2 - 0.42, 0, 0.16);
    crownRing.position.y = 7.4;
    group.add(crownRing);
  }

  // ── свет в основании: дерево стоит на светлом пятне ──
  {
    const mat = new THREE.ShaderMaterial({
      uniforms: { col: { value: new THREE.Color(0x8fb4ff) }, intensity: { value: 0.35 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 col; uniform float intensity; varying vec2 vUv;
        void main(){ float d = length(vUv - 0.5) * 2.0;
                     float a = pow(1.0 - smoothstep(0.0, 1.0, d), 1.7);
                     gl_FragColor = vec4(col, a * intensity); }`,
      transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    glow = new THREE.Mesh(new THREE.CircleGeometry(7.5, 64), mat);
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.004;
    group.add(glow);
  }

  group.position.set(TREE.x, 0, TREE.z);
  scene.add(group);
  obstacles.push({ x: TREE.x, z: TREE.z, r: TREE.r });   // сквозь ствол не пройти

  // Близость героя: 0 далеко, 1 вплотную. От неё зависит и поведение дерева,
  // и кадр — мир должен ЗАМЕЧАТЬ подход, а не стоять декорацией.
  let near = 0;

  // сук разгорается, когда его стих прочитан — состояние читается один раз
  // и потом только доводится плавно, чтобы зажигание было видно как событие
  for (const b of boughs) { b.lit = 0; b.want = isDone(b.game) ? 1 : 0; }

  function update(t, dt, heroPos) {
    const d = Math.hypot(heroPos.x - TREE.x, heroPos.z - TREE.z);
    const want = 1 - Math.min(1, Math.max(0, (d - 3.5) / 9.0));
    near += (want - near) * Math.min(1, dt * 2.4);

    // ── четыре сука: прочитанный стих светится, непрочитанный тлеет ──
    for (const b of boughs) {
      b.lit += (b.want - b.lit) * Math.min(1, dt * 1.2);
      const k = 0.22 + b.lit * 0.78;
      b.mats.bark.emissiveIntensity = 0.5 + k * 1.6;
      b.mats.limb.emissiveIntensity = 0.6 + k * 2.2;
      b.mats.tip.emissiveIntensity  = 0.7 + k * 2.6 + near * 0.6;
    }

    // приборные кольца оживают при подходе; обод ещё и медленно ползёт
    for (const r of rings) {
      r.mat.opacity = r.base * (0.55 + near * 0.75);
      if (r.spin) r.mesh.rotation.z = t * r.spin;
    }
    if (crownRing) {
      crownRing.rotation.z = 0.16 + t * 0.045;
      crownRing.material.opacity = 0.28 + near * 0.42;
    }

    // узлы кроны дышат; вблизи разгораются и идут волной снизу вверх
    for (const tp of tips) {
      const pulse = 0.5 + 0.5 * Math.sin(t * tp.spd + tp.ph);
      const wave  = 0.5 + 0.5 * Math.sin(t * 2.2 - tp.y * 0.55);
      tp.mesh.scale.setScalar(0.62 + pulse * 0.30 + near * wave * 0.85);
      tp.mesh.rotation.y = t * tp.spd * 0.6;
      tp.mesh.position.y = tp.baseY + Math.sin(t * 0.8 + tp.ph) * 0.06;
    }

    if (motes) {
      const pa = motes.geometry.attributes.position;
      const seed = motes.userData.seed;
      const H = Math.max(4, TREE.h);
      for (let i = 0; i < seed.length; i++) {
        const sd = seed[i];
        const k = (sd.ph + t * sd.spd * (1 + near * 1.6)) % 1;
        // низ — узкой струёй по стволу, выше расходится по кроне
        const spread = 0.25 + Math.pow(k, 2.2) * 6.4;
        const a = sd.a + k * 2.2;
        pa.setXYZ(i, Math.cos(a) * sd.r * spread, k * H, Math.sin(a) * sd.r * spread);
      }
      pa.needsUpdate = true;
      motes.material.opacity = 0.45 + near * 0.5;
    }

    // плоды покачиваются и разгораются, когда игрок подходит к своему плоду
    for (const f of fruits) {
      const fd = Math.hypot(heroPos.x - f.world.x, heroPos.z - f.world.z);
      const fw = 1 - Math.min(1, Math.max(0, (fd - 1.8) / 4.0));
      f.near += (fw - f.near) * Math.min(1, dt * 3.0);
      const sway = Math.sin(t * 0.6 + f.ph) * 0.05;
      f.group.rotation.z = sway;
      f.body.rotation.y = t * 0.35 + f.ph;
      f.mat.emissiveIntensity = 1.6 + f.near * 2.6 + Math.sin(t * 1.3 + f.ph) * 0.25;
      const hs = 1 + f.near * 0.5;
      f.halo.scale.setScalar(hs);
      f.halo.material.opacity = 0.10 + f.near * 0.30;
    }

    if (glow) {
      glow.material.uniforms.intensity.value =
        0.30 + near * 0.55 + Math.sin(t * 0.7) * 0.05;
    }
    return near;
  }

  return { group, update, fruits, get near() { return near; } };
}

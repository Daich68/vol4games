import "../shared/type.css";
// Карта vol4games — Three.js, halftone post-process. Псевдо-3D через сетку точек.
import * as THREE from "three";
import { EffectComposer }     from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass }         from "three/examples/jsm/postprocessing/RenderPass.js";
import { OutputPass }         from "three/examples/jsm/postprocessing/OutputPass.js";
import { isDone, clearAllProgress } from "../shared/nav.js";
import { createHero, HERO_FIELD_RADIUS_PX } from "../shared/hero.js";
import { createHalftonePass } from "../shared/halftone.js";
import { createYggdrasil, TREE } from "./yggdrasil.js";
import { osPowerOn, osBindLinks, osNavigate } from "../shared/os.js";

// VOL4/OS: включение кинескопа при возврате из игры (boot-класс ставит
// прелоудер-скрипт) и выходы в игры через выключение (ссылки меню уровней)
osPowerOn();
osBindLinks();

// прогресс машины в заголовке: vol4://карта · N/4
{
  const n = ["birds", "stalagmit", "nancy-drew", "prizma"].filter(isDone).length;
  const titleEl = document.getElementById("title");
  if (titleEl && n > 0) {
    titleEl.innerHTML = `vol4:<span class="dim">//</span>карта <span class="dim">· ${n}/4</span>`;
  }
}

const W = () => window.innerWidth;
const H = () => window.innerHeight;

// ── renderer ──────────────────────────────────────────────────────────────
const canvas = document.getElementById("c");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });
renderer.setPixelRatio(1); // halftone выглядит чище в 1:1
renderer.setSize(W(), H());
renderer.toneMapping = THREE.NoToneMapping; // линейный — для чистого халфтона

// ── scene ─────────────────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

// ── камера: лёгкая псевдо-изометрия ──────────────────────────────────────
const camera = new THREE.PerspectiveCamera(34, W() / H(), 0.1, 100);
const CAM_BASE = new THREE.Vector3(0, 14, 11);
camera.position.copy(CAM_BASE);
camera.lookAt(0, 0, 0);

// ── post composer ────────────────────────────────────────────────────────
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const halftonePass = createHalftonePass(W(), H());
composer.addPass(halftonePass);
composer.addPass(new OutputPass());

// ── узлы карты ───────────────────────────────────────────────────────────
// Хаб-разброс: n1 — стартовая точка возле центра, остальные разбросаны
// по углам игрового поля (X ±22, Z ±15). От n1 во все стороны тянутся
// дотовые тропы — игрок просто идёт по светящемуся пути и приходит к ноде.
const NODES = [
  { id: "n1", x:  -2.4, z:  3.0,  label: "СТАЛАГМИТ", sub: "али алиев · tower bloxx",        game: "stalagmit"  },
  { id: "n2", x: -16.0, z: -6.5,  label: "НЭНСИ ДРЮ", sub: "милена степанян · hidden object", game: "nancy-drew" },
  { id: "n3", x:  15.0, z: -8.0,  label: "ПТИЦЫ",     sub: "лиза хереш · match-3",            game: "birds"      },
  { id: "n4", x:  12.5, z:  10.0, label: "ПРИЗМА",    sub: "данила кудимов · icy tower",      game: "prizma"     },
  // DLC — не стих машины, а чужой диск, который в неё вставили. В счёт 4/4
  // не идёт: ни в заголовке, ни в центоне, ни в условии появления арки.
  { id: "n5", x:  -9.0, z:  -12.0, label: "BABYLAND",  sub: "лана ленкова · дополнение",       game: "babyland", dlc: true },
];
// n1 — хаб; n2-n3 даёт внешнюю дугу, чтобы пути не пересекались крестом.
const EDGES = [["n1","n2"],["n1","n3"],["n1","n4"],["n2","n3"],["n1","n5"]];
const nodeById = id => NODES.find(n => n.id === id);

// ── рандомизация позиций нод (каждую загрузку новая раскладка) ─────────────
// n1 садится ближе к центру (стартовая), остальные разбрасываются с
// гарантированным минимальным расстоянием друг от друга.
(function randomizeNodes() {
  // арка-выход стоит в (0,-13), в центре растёт Иггдрасиль — держим ноды
  // на расстоянии и от них
  const placed = [{ x: 0, z: -13 }, { x: 0, z: 0 }];
  const BX = 18, BZ = 11, MIN_DIST = 11;
  NODES.forEach((n, i) => {
    let tries = 0, x, z;
    do {
      if (i === 0) {                       // старт — рядом с деревом, но не в нём
        const a = Math.random() * Math.PI * 2;
        const r = 7.5 + Math.random() * 2.5;
        x = Math.cos(a) * r;
        z = Math.sin(a) * r * 0.62;
      } else {
        x = (Math.random() * 2 - 1) * BX;
        z = (Math.random() * 2 - 1) * BZ;
      }
      tries++;
    } while (tries < 300 && placed.some(p => Math.hypot(p.x - x, p.z - z) < MIN_DIST));
    n.x = x; n.z = z;
    placed.push({ x, z });
  });
})();

// ── рельеф ландшафта ──────────────────────────────────────────────────────
// fBm из синусоид — несколько октав, без внешних зависимостей.
function terrainH(x, z) {
  let h = 0;
  h += Math.sin(x * 0.160 + z * 0.110 + 0.50) * 2.2;
  h += Math.sin(x * 0.370 + z * 0.280 + 1.70) * 1.1;
  h += Math.sin(x * 0.710 + z * 0.600 + 3.10) * 0.55;
  h += Math.sin(x * 1.330 + z * 1.170 + 0.90) * 0.27;
  h += Math.cos(x * 0.220 + z * 0.430 + 2.30) * 1.7;
  h += Math.cos(x * 0.540 + z * 0.250 + 0.80) * 0.85;
  h += Math.cos(x * 1.100 + z * 0.880 + 4.20) * 0.42;
  h += Math.sin(x * 0.095 + z * 0.073 + 3.80) * 3.4; // длинная фоновая волна
  h -= 2.8; // смещение: большинство рельефа ниже нулевого уровня

  // ровная площадка под Иггдрасилем: корни не должны висеть над ямой
  {
    const d = Math.hypot(x, z);
    if (d < 9.0) {
      const s2 = 1 - d / 9.0;
      h *= (1 - s2 * s2 * (3 - 2 * s2));
    }
  }

  // выравниваем рядом с нодами — диски и герой не должны «тонуть» в холмах
  const FLAT_R = 6.5;
  for (const { x: nx, z: nz } of NODES) {
    const d = Math.hypot(x - nx, z - nz);
    if (d < FLAT_R) {
      const s = 1 - d / FLAT_R;
      const smooth = s * s * (3 - 2 * s);
      h *= (1 - smooth);
    }
  }
  return h;
}

{
  // плоскость покрывает всё игровое поле + запас
  const geo = new THREE.PlaneGeometry(90, 68, 160, 120);
  geo.rotateX(-Math.PI / 2);
  const pa = geo.attributes.position;
  const ca = new Float32Array(pa.count * 3);
  let yMin = Infinity, yMax = -Infinity;

  // первый проход — вычисляем высоты и диапазон
  const ys = new Float32Array(pa.count);
  for (let i = 0; i < pa.count; i++) {
    const y = terrainH(pa.getX(i), pa.getZ(i));
    ys[i] = y;
    if (y < yMin) yMin = y;
    if (y > yMax) yMax = y;
  }
  const yRange = yMax - yMin || 1;

  // второй проход — применяем высоты и назначаем цвет по высоте
  for (let i = 0; i < pa.count; i++) {
    pa.setY(i, ys[i]);
    const t = Math.max(0, Math.min(1, (ys[i] - yMin) / yRange));
    // тень в долинах → светлая вершина (чуть светлее — фон должен читаться)
    ca[i * 3]     = 0.024 + t * 0.052;
    ca[i * 3 + 1] = 0.022 + t * 0.044;
    ca[i * 3 + 2] = 0.048 + t * 0.100;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(ca, 3));
  geo.computeVertexNormals();

  scene.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true })));

  // рассеянный холодный фон
  scene.add(new THREE.AmbientLight(0x1e2030, 1));
  // основной направленный — синий с левого бока (объекты ловят блик)
  const sun = new THREE.DirectionalLight(0x6070c8, 9.0);
  sun.position.set(-12, 22, 4);
  scene.add(sun);
  // контровый заполняющий — с противоположной стороны, чуть фиолетовый
  const fill = new THREE.DirectionalLight(0x3a2c5e, 5.0);
  fill.position.set(14, 10, -12);
  scene.add(fill);
}

// ── монументы: пафосные структуры, рандомизируются каждую загрузку ─────────
const obstacles  = []; // { x, z, r } — окружности для коллизий с героем
const animatedOb = []; // парящие/вращающиеся элементы — обновляются в loop

{
  // ── палитра проекта: тёмный камень + холодный белый #e8ecf5 + кристалл ──
  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0x6e6e88, roughness: 0.80, metalness: 0.14,
    emissive: 0x12121e, emissiveIntensity: 0.6, flatShading: true,
  });
  const stoneDark = new THREE.MeshStandardMaterial({
    color: 0x3c3c4e, roughness: 0.9, metalness: 0.06, flatShading: true,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xe8ecf5, roughness: 0.22, metalness: 0.7,
    emissive: 0xb0b8d0, emissiveIntensity: 2.6, flatShading: true,
  });
  const crystMat = new THREE.MeshStandardMaterial({
    color: 0xb4ccee, roughness: 0.14, metalness: 0.3,
    emissive: 0x5878c8, emissiveIntensity: 2.4, flatShading: true,
  });

  const R = (a, b) => a + Math.random() * (b - a);

  // основание-постамент: гранёный диск с золотой каймой
  function pedestal(grp, scale, sides) {
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(scale * 0.95, scale * 1.15, scale * 0.32, sides), stoneDark);
    base.position.y = scale * 0.16;
    grp.add(base);
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(scale * 0.98, scale * 0.05, 6, sides * 2), goldMat);
    rim.position.y = scale * 0.32; rim.rotation.x = Math.PI / 2;
    grp.add(rim);
  }

  // парящий гранёный сердечник + регистрация анимации
  function floatingCore(grp, scale, y, mat, sizeF) {
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(scale * sizeF, 0), mat);
    core.position.y = y;
    grp.add(core);
    animatedOb.push({ mesh: core, spin: R(0.4, 0.9) * (Math.random() < 0.5 ? -1 : 1),
                      amp: scale * R(0.18, 0.35), spd: R(0.8, 1.4), baseY: y, ph: R(0, 6.28) });
    return core;
  }

  // 1 ── ОБЕЛИСК: гранёный шпиль с золотым пирамидионом
  function makeObelisk(scale) {
    const grp = new THREE.Group();
    pedestal(grp, scale, 4);
    const h = scale * R(3.4, 5.2), w = scale * R(0.42, 0.6);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.55, w, h, 4), stoneMat);
    shaft.position.y = scale * 0.32 + h / 2; shaft.rotation.y = Math.PI / 4;
    grp.add(shaft);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(w * 0.6, w * 1.3, 4), goldMat);
    cap.position.y = scale * 0.32 + h + w * 0.55; cap.rotation.y = Math.PI / 4;
    grp.add(cap);
    grp.userData.r = scale * 1.15; // = радиус постамента (видимое основание)
    return grp;
  }

  // 2 ── МЕГАЛИТЫ: кольцо наклонных плит вокруг парящего золотого ядра
  function makeMegaliths(scale) {
    const grp = new THREE.Group();
    const n = 3 + Math.floor(Math.random() * 3);
    const ring = scale * R(1.2, 1.8);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + R(-0.25, 0.25);
      const h = scale * R(1.8, 3.2);
      const slab = new THREE.Mesh(new THREE.BoxGeometry(scale * 0.55, h, scale * 0.3), stoneDark);
      slab.position.set(Math.cos(a) * ring, h / 2, Math.sin(a) * ring);
      slab.rotation.y = -a + R(-0.2, 0.2);
      slab.rotation.z = R(-0.12, 0.12);
      grp.add(slab);
    }
    floatingCore(grp, scale, scale * R(1.2, 1.7), goldMat, 0.45);
    grp.userData.r = ring + scale * 0.3; // охватывает кольцо плит
    return grp;
  }

  // 3 ── КРИСТАЛЬНЫЙ АЛТАРЬ: пучок светящихся шпилей на постаменте
  function makeCrystalAltar(scale) {
    const grp = new THREE.Group();
    pedestal(grp, scale, 6);
    const shards = 4 + Math.floor(Math.random() * 4);
    for (let i = 0; i < shards; i++) {
      const h = scale * R(1.6, 3.0), rad = scale * R(0.14, 0.24);
      const c = new THREE.Mesh(new THREE.ConeGeometry(rad, h, 4 + (Math.random() < 0.5 ? 0 : 1)), crystMat);
      const a = Math.random() * Math.PI * 2, rr = Math.random() * scale * 0.55;
      c.position.set(Math.cos(a) * rr, scale * 0.32 + h / 2, Math.sin(a) * rr);
      c.rotation.set(R(-0.4, 0.4), Math.random() * 3.14, R(-0.4, 0.4));
      grp.add(c);
    }
    grp.userData.r = scale * 1.15; // = радиус постамента (видимое основание)
    return grp;
  }

  // 4 ── ПАРЯЩИЙ МОНУМЕНТ: колонна, золотое кольцо, левитирующий кристалл
  function makeFloatingMonument(scale) {
    const grp = new THREE.Group();
    pedestal(grp, scale, 6);
    const col = new THREE.Mesh(
      new THREE.CylinderGeometry(scale * 0.45, scale * 0.62, scale * 1.5, 6), stoneMat);
    col.position.y = scale * 0.32 + scale * 0.75;
    grp.add(col);
    const band = new THREE.Mesh(new THREE.TorusGeometry(scale * 0.6, scale * 0.07, 8, 20), goldMat);
    band.position.y = scale * 0.32 + scale * 1.55; band.rotation.x = Math.PI / 2;
    grp.add(band);
    floatingCore(grp, scale, scale * R(2.6, 3.2), crystMat, 0.55);
    grp.userData.r = scale * 1.15; // = радиус постамента (видимое основание)
    return grp;
  }

  const BUILDERS = [makeObelisk, makeMegaliths, makeCrystalAltar, makeFloatingMonument];

  const TARGET = 18;
  let attempts = 0;
  while (obstacles.length < TARGET && attempts < 900) {
    attempts++;
    const x = (Math.random() * 2 - 1) * 20;
    const z = (Math.random() * 2 - 1) * 13;

    // не у нод (включая старт n1) и не вплотную к другим монументам
    let ok = true;
    if (Math.hypot(x, z) < 10.0) continue;           // центр занят деревом
    for (const n of NODES) if (Math.hypot(x - n.x, z - n.z) < 5.0) { ok = false; break; }
    if (!ok) continue;
    for (const o of obstacles) if (Math.hypot(x - o.x, z - o.z) < 4.2) { ok = false; break; }
    if (!ok) continue;

    const scale = R(0.7, 1.25);
    const obj   = BUILDERS[Math.floor(Math.random() * BUILDERS.length)](scale);
    obj.position.set(x, terrainH(x, z) - 0.1, z);
    obj.rotation.y = Math.random() * Math.PI * 2;
    scene.add(obj);
    obstacles.push({ x, z, r: obj.userData.r ?? scale });
  }
}

// Иггдрасиль в центре карты. Ставится после монументов: ему нужен массив
// препятствий, чтобы вписать в него ствол.
const yggdrasil = createYggdrasil({ scene, obstacles, isDone });

// анимация парящих элементов монументов
function updateObstacles(t) {
  for (const a of animatedOb) {
    a.mesh.rotation.y = t * a.spin;
    a.mesh.rotation.x = t * a.spin * 0.4;
    a.mesh.position.y = a.baseY + Math.sin(t * a.spd + a.ph) * a.amp;
  }
}

// ── DLC-нода: огромное розовое сердце с аурой ─────────────────────────────
// Чужой диск обязан быть видно с другого конца карты и обязан читаться как
// НЕ-vol4: холодная машина светит белым и дышит синусом, BABYLAND — розовым
// и бьётся. Отсюда сердцебиение вместо пульса и вся аура на аддитивном
// блендинге: халфтон цвет сохраняет, так что розовые точки доезжают до экрана.
const DLC_PINK   = new THREE.Color(0xff6fb2);
const DLC_PINK_L = new THREE.Color(0xffc4e2);

// lub-dub: два удара и пауза. Синус тут читался бы как «дыхание» монумента,
// а нужно именно сердце.
function heartbeat(t, period = 1.15) {
  const p = (t % period) / period;
  const g = (c, w) => Math.exp(-Math.pow((p - c) / w, 2));
  return g(0.06, 0.045) + 0.62 * g(0.27, 0.055);
}

function buildHeartGeo(height) {
  const sh = new THREE.Shape();
  sh.moveTo(25, 25);
  sh.bezierCurveTo(25, 25, 20,  0,   0,  0);
  sh.bezierCurveTo(-30, 0, -30, 35, -30, 35);
  sh.bezierCurveTo(-30, 55, -10, 77, 25, 95);
  sh.bezierCurveTo(60, 77, 80, 55, 80, 35);
  sh.bezierCurveTo(80, 35, 80,  0,  50,  0);
  sh.bezierCurveTo(35,  0, 25, 25,  25, 25);
  const geo = new THREE.ExtrudeGeometry(sh, {
    depth: 17, curveSegments: 26,
    bevelEnabled: true, bevelSegments: 5, bevelSize: 7, bevelThickness: 6,
  });
  geo.center();
  // в исходной раскладке остриё смотрит вверх — разворачиваем в плоскости,
  // чтобы не портить winding зеркалом по Y
  geo.rotateZ(Math.PI);
  const k = height / 95;
  geo.scale(k, k, k);
  return geo;
}

// радиальное свечение: используется и как лужа на полу, и как ореол за сердцем
// hole > 0 делает из заливки кольцо: сплошной градиент топит силуэт сердца,
// а нужно, чтобы аура светила ВОКРУГ него, оставляя середину под сердце
function auraMaterial(color, intensity, power, hole = 0.0) {
  return new THREE.ShaderMaterial({
    uniforms: {
      col:       { value: color.clone() },
      intensity: { value: intensity },
      power:     { value: power },
      hole:      { value: hole },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `
      uniform vec3 col; uniform float intensity; uniform float power; uniform float hole;
      varying vec2 vUv;
      void main(){
        float d = length(vUv - 0.5) * 2.0;
        float a = pow(1.0 - smoothstep(0.0, 1.0, d), power);
        a *= smoothstep(hole, hole + 0.30, d);
        gl_FragColor = vec4(col, a * intensity);
      }`,
    transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
}

const HEART_H = 2.7;   // высота сердца в единицах мира — оно должно быть огромным
const HEART_Y = 1.75;  // на какой высоте парит

function buildDlcAura(g) {
  const d = {};

  // 1. широкая розовая лужа света под нодой — её видно раньше самого сердца
  d.poolMat = auraMaterial(DLC_PINK, 0.34, 2.3);
  const pool = new THREE.Mesh(new THREE.CircleGeometry(3.4, 64), d.poolMat);
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.0015;
  g.add(pool);

  // 2. кольца-волны: расходятся от ноды на каждом ударе
  d.ripples = [0, 0.34, 0.67].map((phase) => {
    const mat = new THREE.MeshBasicMaterial({
      color: DLC_PINK_L.clone(), side: THREE.DoubleSide,
      transparent: true, opacity: 0, depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const m = new THREE.Mesh(new THREE.RingGeometry(0.94, 1.0, 96), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.004;
    g.add(m);
    return { m, mat, phase };
  });

  // 3. ореол за сердцем — билборд, всегда лицом к камере
  d.haloMat = auraMaterial(DLC_PINK, 0.42, 1.5, 0.58);
  d.halo = new THREE.Mesh(new THREE.PlaneGeometry(6.6, 6.6), d.haloMat);
  d.halo.position.y = HEART_Y;
  g.add(d.halo);

  // 4. само сердце
  d.heartMat = new THREE.MeshStandardMaterial({
    color: 0xff5aa8, roughness: 0.34, metalness: 0.16,
    emissive: new THREE.Color(0xd93b86), emissiveIntensity: 1.15,
    flatShading: false,
  });
  d.heart = new THREE.Mesh(buildHeartGeo(HEART_H), d.heartMat);
  d.heart.position.y = HEART_Y;
  // камера смотрит сверху под ~52°: без наклона сердце читается как пятно
  d.heart.rotation.x = -0.48;
  g.add(d.heart);

  // 5. искры, всплывающие вокруг сердца
  const N = 70;
  d.sparkData = [];
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    d.sparkData.push({
      a: Math.random() * Math.PI * 2,
      r: 1.7 + Math.random() * 1.7,
      spd: 0.16 + Math.random() * 0.26,
      ph: Math.random(),
      sway: 0.25 + Math.random() * 0.5,
    });
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  d.sparkMat = new THREE.PointsMaterial({
    color: 0xffd4ea, size: 0.115, sizeAttenuation: true,
    transparent: true, opacity: 0.9, depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  d.sparks = new THREE.Points(sg, d.sparkMat);
  g.add(d.sparks);

  return d;
}

function updateDlcAura(d, t, isActive, done) {
  const beat = heartbeat(t);
  const near = isActive ? 1 : 0;

  // сердце: удар в масштабе + лёгкое покачивание, чтобы читался объём
  const s = 1 + beat * (0.13 + near * 0.06);
  d.heart.scale.set(s, s * (1 - beat * 0.04), s);
  d.heart.position.y = HEART_Y + Math.sin(t * 0.7) * 0.16;
  d.heart.rotation.y = Math.sin(t * 0.45) * 0.42;
  d.heart.rotation.z = Math.sin(t * 0.33) * 0.06;
  d.heartMat.emissiveIntensity = (done ? 0.8 : 1.15) + beat * 1.05 + near * 0.35;

  // ореол дышит вместе с ударом и всегда смотрит в камеру
  d.halo.position.y = d.heart.position.y;
  d.halo.lookAt(camera.position);
  const hs = 1 + beat * 0.16 + near * 0.08;
  d.halo.scale.set(hs, hs, 1);
  d.haloMat.uniforms.intensity.value = (done ? 0.3 : 0.42) + beat * 0.30 + near * 0.16;

  // лужа под нодой
  d.poolMat.uniforms.intensity.value = (done ? 0.24 : 0.32) + beat * 0.22 + near * 0.14;

  // волны: каждая живёт свой цикл, на пике удара рождается новая
  for (const rp of d.ripples) {
    const k = ((t / 2.3) + rp.phase) % 1;          // 0→1 за цикл
    const sc = 0.55 + k * 3.6;
    rp.m.scale.set(sc, sc, 1);
    rp.mat.opacity = (1 - k) * (1 - k) * (0.55 + near * 0.3);
  }

  // искры: детерминированный подъём по t, без накопления состояния
  const pa = d.sparks.geometry.attributes.position;
  for (let i = 0; i < d.sparkData.length; i++) {
    const p = d.sparkData[i];
    const k = (t * p.spd + p.ph) % 1;
    const ang = p.a + t * p.sway * 0.35;
    const rr = p.r * (1 - k * 0.35);
    pa.setXYZ(i, Math.cos(ang) * rr, 0.05 + k * 4.4, Math.sin(ang) * rr);
  }
  pa.needsUpdate = true;
  d.sparkMat.opacity = (0.55 + beat * 0.4) * (done ? 0.6 : 1);
}

// светящийся диск на полу + кольцо. MeshBasic, без освещения.
const nodeObjs = {};
NODES.forEach(n => {
  const g = new THREE.Group();
  g.position.set(n.x, 0, n.z);

  // мягкое свечение под нодой (большой полупрозрачный диск)
  const glowGeo = new THREE.CircleGeometry(0.95, 48);
  const glowMat = new THREE.ShaderMaterial({
    uniforms: { col: { value: new THREE.Color(0xffffff) }, intensity: { value: 0.6 } },
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform vec3 col;
      uniform float intensity;
      varying vec2 vUv;
      void main() {
        float d = length(vUv - 0.5) * 2.0;
        float a = pow(1.0 - smoothstep(0.0, 1.0, d), 1.5);
        gl_FragColor = vec4(col, a * intensity);
      }
    `,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.001;
  g.add(glow);

  // основное кольцо
  const ringGeo = new THREE.RingGeometry(0.32, 0.42, 64);
  const ringMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(n.game ? 0xffffff : 0x444466), side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  g.add(ring);

  // ядро (точка по центру)
  const coreGeo = new THREE.CircleGeometry(0.12, 32);
  const coreMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(n.game ? 0xffffff : 0x333355), side: THREE.DoubleSide,
  });
  const core = new THREE.Mesh(coreGeo, coreMat);
  core.rotation.x = -Math.PI / 2;
  core.position.y = 0.002;
  g.add(core);

  scene.add(g);
  nodeObjs[n.id] = { g, ring, ringMat, core, coreMat, glowMat, n };
  if (n.dlc) nodeObjs[n.id].dlc = buildDlcAura(g);
});

// ── АРКА-ВЫХОД ────────────────────────────────────────────────────────────
// Появляется, когда прочитаны все четыре стиха: врата света со ступенями
// у дальнего края карты. Дойти + ENTER/тап → новый сеанс (сброс + рестарт).
const GAMES_ALL    = ["birds", "stalagmit", "prizma", "nancy-drew"];
const allGamesDone = () => GAMES_ALL.every(g => isDone(g));
const EXIT = { id: "exit", x: 0, z: -13 };

const exitObj = (function buildExit() {
  const g = new THREE.Group();
  g.position.set(EXIT.x, 0, EXIT.z);
  g.visible = allGamesDone();

  // свечение под вратами
  const glowMat = new THREE.ShaderMaterial({
    uniforms: { col: { value: new THREE.Color(0xdfe8ff) }, intensity: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 col; uniform float intensity; varying vec2 vUv;
      void main(){ float d=length(vUv-0.5)*2.0; float a=pow(1.0-smoothstep(0.0,1.0,d),1.6); gl_FragColor=vec4(col,a*intensity); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const glow = new THREE.Mesh(new THREE.CircleGeometry(2.7, 48), glowMat);
  glow.rotation.x = -Math.PI / 2; glow.position.y = 0.002;
  g.add(glow);

  // ВРАТА: две стойки + полу-арочная перемычка (читается как арка сверху)
  const beam = () => new THREE.MeshBasicMaterial({ color: 0xffffff,
    transparent: true, blending: THREE.AdditiveBlending, opacity: 0.9 });
  const parts = [];
  const postGeo = new THREE.BoxGeometry(0.2, 1.7, 0.2);
  for (const px of [-1.2, 1.2]) {
    const m = beam();
    const post = new THREE.Mesh(postGeo, m);
    post.position.set(px, 0.85, 0); g.add(post); parts.push(m);
  }
  const archMat = beam();                                       // полу-тор сверху
  const arch = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.1, 12, 64, Math.PI), archMat);
  arch.position.set(0, 1.7, 0);
  g.add(arch); parts.push(archMat);
  // «замковый камень» — точка на вершине арки
  const keyMat = beam();
  const keystone = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 16), keyMat);
  keystone.position.set(0, 2.9, 0); g.add(keystone); parts.push(keyMat);

  // порог — мягкая светящаяся завеса между стойками
  const thrMat = new THREE.MeshBasicMaterial({ color: 0xaec6ff, transparent: true,
    opacity: 0, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const thr = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 2.6), thrMat);
  thr.position.set(0, 1.3, -0.04); g.add(thr);

  // ступени, поднимающиеся к вратам со стороны героя
  const steps = [];
  for (let i = 0; i < 3; i++) {
    const m = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true,
      blending: THREE.AdditiveBlending, opacity: 0 });
    const step = new THREE.Mesh(new THREE.BoxGeometry(2.7 - i * 0.55, 0.07, 0.4), m);
    step.position.set(0, 0.05 + i * 0.18, 2.0 - i * 0.62);
    g.add(step); steps.push(m);
  }

  scene.add(g);
  return { g, parts, glowMat, thrMat, steps, flare: 0 };
})();

function updateExit(t) {
  const on = allGamesDone();
  exitObj.g.visible = on;
  if (!on) return;
  exitObj.g.position.y = Math.sin(t * 0.8) * 0.04;
  const pulse = 0.7 + 0.3 * Math.sin(t * 1.6);
  const fl = exitObj.flare;                                   // буст при варпе
  exitObj.glowMat.uniforms.intensity.value = 0.55 + 0.35 * pulse + fl * 3;
  exitObj.parts.forEach(m => { m.opacity = Math.min(1, 0.72 + 0.22 * pulse + fl); });
  exitObj.thrMat.opacity = 0.12 + 0.07 * Math.sin(t * 0.9) + fl * 0.85;
  exitObj.g.scale.setScalar(1 + fl * 0.5);                    // врата «вдыхают» героя
  exitObj.steps.forEach((m, i) => { m.opacity = 0.2 + 0.12 * Math.sin(t * 1.4 - i * 0.7); });
}

function updateNodes(t, activeId) {
  for (const o of Object.values(nodeObjs)) {
    const { g, ring, ringMat, core, coreMat, glowMat, n } = o;
    const isActive = n.id === activeId;
    const done     = isDone(n.game);
    const hasGame  = !!n.game;

    g.position.y = Math.sin(t * 1.0 + n.x * 0.55) * 0.05;
    ring.rotation.z = -t * 0.18;

    const pulse = 0.85 + 0.15 * Math.sin(t * 1.9 + n.z * 0.5);

    // ── DLC: своя палитра и свой ритм, машина этот узел не считает своим ──
    if (o.dlc) {
      updateDlcAura(o.dlc, t, isActive, done);
      const b = 0.55 + heartbeat(t) * 0.45 + (isActive ? 0.25 : 0);
      ringMat.color.copy(DLC_PINK_L).multiplyScalar(Math.min(1.25, b));
      coreMat.color.copy(DLC_PINK).multiplyScalar(Math.min(1.35, b * 1.1));
      glowMat.uniforms.col.value.copy(DLC_PINK);
      glowMat.uniforms.intensity.value = (done ? 0.5 : 0.75) * b;
      continue;
    }

    if (done) {
      // пройдено — холодный белый, ровное свечение (без пульса)
      ringMat.color.setRGB(0.82, 0.88, 1.0);
      coreMat.color.setRGB(0.9, 0.94, 1.0);
      glowMat.uniforms.col.value.setRGB(0.82, 0.88, 1.0);
      glowMat.uniforms.intensity.value = 0.6;
    } else if (isActive) {
      ringMat.color.setRGB(pulse, pulse, pulse);
      coreMat.color.setRGB(pulse, pulse, pulse);
      glowMat.uniforms.col.value.setRGB(1, 1, 1);
      glowMat.uniforms.intensity.value = 1.0 * pulse;
    } else if (hasGame) {
      const v = 0.7 * pulse;
      ringMat.color.setRGB(v, v, v);
      coreMat.color.setRGB(v * 0.7, v * 0.7, v * 0.7);
      glowMat.uniforms.col.value.setRGB(0.7, 0.78, 1.0);
      glowMat.uniforms.intensity.value = 0.45 * pulse;
    } else {
      ringMat.color.setRGB(0.2, 0.2, 0.28);
      coreMat.color.setRGB(0.1, 0.1, 0.15);
      glowMat.uniforms.intensity.value = 0.0;
    }
  }
}

// ── рёбра + частицы ──────────────────────────────────────────────────────
const edgeSystems = [];

EDGES.forEach(([a, b]) => {
  const A = nodeById(a), B = nodeById(b);
  const mx = (A.x+B.x)/2, mz = (A.z+B.z)/2;
  const dx = B.x-A.x,    dz = B.z-A.z;
  const len = Math.hypot(dx, dz);
  const s = ((A.x*13 + B.z*7) % 100) / 100 - 0.5;
  const off = s * len * 0.34;
  const cx = mx + (-dz/len)*off, cz = mz + (dx/len)*off;

  const curve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(A.x, 0, A.z),
    new THREE.Vector3(cx,  0, cz),
    new THREE.Vector3(B.x, 0, B.z),
  );

  // путь как series точек разной яркости (sparse dotted line)
  const COUNT = 80;
  const positions = new Float32Array(COUNT * 3);
  const sizes     = new Float32Array(COUNT);
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  pGeo.setAttribute("size",     new THREE.BufferAttribute(sizes,     1));

  // Камера показывает лишь ~±5 единиц вокруг героя, так что «увидеть сердце
  // издалека» невозможно by design. Зато тропа к диску может вести к нему
  // цветом: ребро, упирающееся в DLC-ноду, разогревается из белого в розовый.
  const toDlc = !!(A.dlc || B.dlc);
  const dlcAtEnd = !!B.dlc;                     // куда именно ведёт градиент
  const tint = new Float32Array(COUNT);
  pGeo.setAttribute("tint", new THREE.BufferAttribute(tint, 1));

  const pMat = new THREE.ShaderMaterial({
    uniforms: {
      col:   { value: new THREE.Color(0xffffff) },
      col2:  { value: DLC_PINK.clone() },
      boost: { value: 1.0 },
    },
    vertexShader: `
      attribute float size;
      attribute float tint;
      varying float vAlpha;
      varying float vTint;
      void main() {
        vAlpha = size;
        vTint  = tint;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = (3.0 + size * 6.0) * (60.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform vec3 col;
      uniform vec3 col2;
      uniform float boost;
      varying float vAlpha;
      varying float vTint;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float a = 1.0 - smoothstep(0.2, 1.0, d);
        if (a < 0.01) discard;
        vec3 c = mix(col, col2, vTint);
        gl_FragColor = vec4(c, a * vAlpha * mix(1.0, boost, vTint));
      }
    `,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  scene.add(new THREE.Points(pGeo, pMat));

  // фиксированные t (равномерно вдоль кривой)
  const ts = Array.from({ length: COUNT }, (_, i) => i / (COUNT - 1));

  // градиент подмешивается только у той половины тропы, что упирается в диск
  if (toDlc) {
    for (let i = 0; i < COUNT; i++) {
      const k = i / (COUNT - 1);
      tint[i] = Math.pow(dlcAtEnd ? k : 1 - k, 0.8);   // розовеет рано — это указатель, а не финальный акцент
    }
    pGeo.attributes.tint.needsUpdate = true;
  }

  edgeSystems.push({ curve, pGeo, positions, sizes, ts, flowOffset: 0, mat: pMat, toDlc });
});

function updateEdges(t) {
  for (const e of edgeSystems) {
    e.flowOffset = (t * 0.15) % 1;
    for (let i = 0; i < e.ts.length; i++) {
      const tt = e.ts[i];
      const pt = e.curve.getPoint(tt);
      e.positions[i*3]   = pt.x;
      e.positions[i*3+1] = 0.012;
      e.positions[i*3+2] = pt.z;
      // волна по кривой — модуляция размера через флоу
      const wave = Math.sin((tt - e.flowOffset) * Math.PI * 6.0);
      const fade = Math.sin(tt * Math.PI); // у концов угасание
      e.sizes[i] = Math.max(0.15, 0.5 + 0.5 * wave) * fade;
    }
    e.pGeo.attributes.position.needsUpdate = true;
    e.pGeo.attributes.size.needsUpdate     = true;
    // розовый конец тропы разгорается в такт сердцу — дорожка «зовёт»
    if (e.toDlc) e.mat.uniforms.boost.value = 1.15 + heartbeat(t) * 1.25;
  }
}

// ── герой ────────────────────────────────────────────────────────────────
// общий модуль — тот же объект будет использоваться во всех играх
const startN = nodeById("n1");
const hero   = createHero({ scene });
hero.setPosition(startN.x, startN.z);

// ── labels ───────────────────────────────────────────────────────────────
const uiEl = document.getElementById("ui");
const labelEls = {};
NODES.forEach(n => {
  const el = document.createElement("div");
  el.className = "nlabel" + (n.game ? " has-game" : "") + (n.dlc ? " dlc" : "");
  if (isDone(n.game)) el.classList.add("done");
  el.innerHTML = `<span class="title">${n.label}</span><span class="sub">${n.sub || ""}</span>`;
  uiEl.appendChild(el);
  labelEls[n.id] = el;
});

// метка дерева — тем же прибором, что и ноды: машина подписывает всё,
// на что смотрит. Показывает, сколько стихов она уже прочла.
const treeLabel = document.createElement("div");
{
  const n = ["birds", "stalagmit", "nancy-drew", "prizma"].filter(isDone).length;
  treeLabel.className = "nlabel has-game tree";
  treeLabel.innerHTML =
    `<span class="title">ДРЕВО</span><span class="sub">память · ${n}/4</span>`;
  uiEl.appendChild(treeLabel);
}

// подписи плодов — прошлые выпуски альманаха, висящие на дереве
const fruitLabels = yggdrasil.fruits.map((f) => {
  // Именно <a>, а не div: window.open режут блокировщики popup'ов, а клик по
  // ссылке — нет. Подпись плода и ЕСТЬ кнопка «открыть выпуск».
  const el = document.createElement("a");
  el.className = "nlabel fruit";
  el.href = f.url;
  el.target = "_blank";
  el.rel = "noopener noreferrer";
  el.innerHTML = `<span class="title">${f.label}</span><span class="sub">выпуск ↗</span>`;
  // osBindLinks пропускает внешние ссылки сам, но клик не должен долетать
  // до карты и трогать ходьбу
  el.addEventListener("pointerdown", (e) => e.stopPropagation());
  uiEl.appendChild(el);
  return el;
});

const promptEl = document.getElementById("prompt");

function updateLabels(activeId) {
  // подпись дерева висит у основания ствола и проявляется при подходе
  {
    const v = new THREE.Vector3(TREE.x, 1.3, TREE.z).project(camera);
    treeLabel.style.left = `${(v.x + 1) / 2 * W()}px`;
    treeLabel.style.top  = `${(-v.y + 1) / 2 * H()}px`;
    treeLabel.style.transform = "translate(-50%, 0)";
    treeLabel.style.opacity = (0.12 + yggdrasil.near * 0.88).toFixed(2);
    treeLabel.classList.toggle("near", yggdrasil.near > 0.55);
  }

  yggdrasil.fruits.forEach((f, i) => {
    const el = fruitLabels[i];
    const v = f.world.clone().project(camera);
    el.style.left = `${(v.x + 1) / 2 * W()}px`;
    el.style.top  = `${(-v.y + 1) / 2 * H()}px`;
    el.style.transform = "translate(-50%, -140%)";
    // Видны, как только игрок подошёл к дереву: искать плоды глазами по кроне —
    // работа, а не интерфейс. У самого плода подпись ярче и кликабельна.
    const vis = Math.max(yggdrasil.near * 0.9, f.near);
    el.style.opacity = vis.toFixed(2);
    el.style.pointerEvents = vis > 0.25 ? "auto" : "none";
    el.classList.toggle("near", f.near > 0.45);
  });

  for (const n of NODES) {
    const el  = labelEls[n.id];
    const vec = new THREE.Vector3(n.x, 0.55, n.z).project(camera);
    el.style.left      = `${(vec.x + 1) / 2 * W()}px`;
    el.style.top       = `${(-vec.y + 1) / 2 * H()}px`;
    el.style.transform = "translate(-50%, 0)";
    el.classList.toggle("near", n.id === activeId);
  }
}

// ── ввод ─────────────────────────────────────────────────────────────────
const heroPos  = new THREE.Vector3(startN.x, 0, startN.z);
const keys     = new Set();
let activeNode = null;
let isMoving   = false;
let teleport   = null; // { t, dur, nodeId, game } во время анимации перехода

let activeFruit = null;   // плод под игроком — прошлый выпуск альманаха
let promptKey   = "";     // что показано в промпте: перерисовываем при смене

const MOVE_CODES  = new Set(["KeyW","KeyA","KeyS","KeyD","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"]);
const ENTER_CODES = new Set(["Enter","KeyE","Space"]);

window.addEventListener("keydown", e => {
  if (document.body.classList.contains("preloading")) return; // прелоудер активен
  if (teleport) return; // ввод заблокирован во время телепорта
  // Shift+R — сброс всего прогресса (для отладки/повторной игры)
  if (e.shiftKey && e.code === "KeyR") {
    clearAllProgress();
    location.reload();
    return;
  }
  if (MOVE_CODES.has(e.code))  { keys.add(e.code); e.preventDefault(); }
  if (ENTER_CODES.has(e.code)) {
    if (activeFruit) {
      // кликаем ту же ссылку, что видит игрок: один путь вместо двух, и
      // блокировщик popup'ов его не режет
      const i = yggdrasil.fruits.indexOf(activeFruit);
      if (i >= 0) fruitLabels[i].click();
      return;
    }
    if (activeNode) enterNode(activeNode);
  }
});
window.addEventListener("keyup",  e => keys.delete(e.code));
window.addEventListener("blur",   () => keys.clear());

// ── мобильный тач-джойстик ────────────────────────────────────────────────
const IS_TOUCH = "ontouchstart" in window;
let touchJoy   = null;   // { id, sx, sy, dx, dz, moved }

if (IS_TOUCH) {
  const joyRing = document.getElementById("joy-ring");
  const joyDot  = document.getElementById("joy-dot");
  const MAX_JOY = 52;

  canvas.addEventListener("touchstart", e => {
    if (document.body.classList.contains("preloading") || teleport) return;
    e.preventDefault();
    const t = e.changedTouches[0];
    touchJoy = { id: t.identifier, sx: t.clientX, sy: t.clientY, dx: 0, dz: 0, moved: false };
    if (joyRing) { joyRing.style.left = t.clientX + "px"; joyRing.style.top = t.clientY + "px"; joyRing.classList.add("active"); }
  }, { passive: false });

  canvas.addEventListener("touchmove", e => {
    e.preventDefault();
    if (!touchJoy) return;
    const t = [...e.changedTouches].find(x => x.identifier === touchJoy.id);
    if (!t) return;
    const ddx = t.clientX - touchJoy.sx;
    const ddy = t.clientY - touchJoy.sy;
    if (Math.hypot(ddx, ddy) > 12) touchJoy.moved = true;
    touchJoy.dx = Math.max(-1, Math.min(1, ddx / MAX_JOY));
    touchJoy.dz = Math.max(-1, Math.min(1, ddy / MAX_JOY));
    if (joyDot) {
      const px = touchJoy.dx * 22, py = touchJoy.dz * 22;
      joyDot.style.transform = `translate(calc(-50% + ${px}px), calc(-50% + ${py}px))`;
    }
  }, { passive: false });

  canvas.addEventListener("touchend", e => {
    e.preventDefault();
    if (touchJoy && !touchJoy.moved && activeNode) enterNode(activeNode);
    touchJoy = null;
    if (joyRing) joyRing.classList.remove("active");
    if (joyDot)  joyDot.style.transform = "translate(-50%, -50%)";
  }, { passive: false });

  // обновить подсказку
  const hintEl = document.getElementById("hint");
  if (hintEl) hintEl.innerHTML = "свайп · двигаться";
}

function dirFromKeys() {
  let dx = 0, dz = 0;
  if (keys.has("KeyW") || keys.has("ArrowUp"))    dz -= 1;
  if (keys.has("KeyS") || keys.has("ArrowDown"))  dz += 1;
  if (keys.has("KeyA") || keys.has("ArrowLeft"))  dx -= 1;
  if (keys.has("KeyD") || keys.has("ArrowRight")) dx += 1;
  if (touchJoy?.moved) { dx += touchJoy.dx; dz += touchJoy.dz; }
  if (!dx && !dz) return { dx:0, dz:0, moving:false };
  const l = Math.hypot(dx, dz);
  return { dx:dx/l, dz:dz/l, moving:true };
}

function enterNode(id) {
  if (teleport) return;
  if (id === "exit") {                       // войти в арку → новый сеанс
    if (!allGamesDone()) return;
    teleport = { t: 0, dur: 1.35, exit: true };
    keys.clear();
    promptEl.classList.remove("show");
    return;
  }
  const n = nodeById(id);
  if (!n?.game) return;
  if (isDone(n.game)) return; // пройдено — вход заблокирован
  teleport = { t: 0, dur: 1.15, nodeId: id, game: n.game };
  keys.clear();
  promptEl.classList.remove("show");
}

// ── телепорт ─────────────────────────────────────────────────────────────
// Анимация: герой сжимается в точку и подсасывается к ноде, кольцо ноды
// расцветает, а difference-поле халфтона раздувается до размеров экрана —
// мир «выворачивается наизнанку», после чего грузится игра.
function updateTeleport(dt) {
  if (!teleport) return;
  teleport.t += dt;
  const p = Math.min(1, teleport.t / teleport.dur);

  const easeIn  = p * p * p;                    // 0→1, медленно→быстро
  const easeOut = 1 - Math.pow(1 - p, 3);       // 0→1, быстро→медленно

  // ── варп в арку: герой входит во врата → новый сеанс ──
  if (teleport.exit) {
    const sx = heroPos.x + (EXIT.x - heroPos.x) * easeOut;
    const sz = heroPos.z + (EXIT.z - heroPos.z) * easeOut;
    hero.setPosition(sx, sz);
    hero.group.scale.setScalar(Math.max(0.001, 1 - easeIn));
    hero.group.position.y = easeOut * 1.2;        // поднимается в проём врат
    exitObj.flare = easeOut;                       // врата вспыхивают (см. updateExit)

    const sp = hero.getScreenPos(camera, W(), H(), 0.25);
    halftonePass.uniforms.heroPos.value.set(sp.x, sp.y);
    const maxR = Math.hypot(W(), H()) * 1.15;
    halftonePass.uniforms.heroFieldR.value =
      HERO_FIELD_RADIUS_PX + (maxR - HERO_FIELD_RADIUS_PX) * easeIn;

    if (p >= 1) {
      clearAllProgress();                          // новый сеанс с чистого листа
      osNavigate(import.meta.env.BASE_URL || "/"); // рестарт через кинескоп
    }
    return;
  }

  const n = nodeById(teleport.nodeId);

  // герой плывёт к ноде и сжимается
  const sx = heroPos.x + (n.x - heroPos.x) * easeOut;
  const sz = heroPos.z + (n.z - heroPos.z) * easeOut;
  hero.setPosition(sx, sz);

  const scale = Math.max(0.001, 1 - easeIn);
  hero.group.scale.setScalar(scale);
  hero.group.position.y = easeIn * 0.55;        // приподнимается перед схлопыванием

  // активная нода разгорается
  const o = nodeObjs[teleport.nodeId];
  const flare = 1 + easeOut * 3.2;
  o.glowMat.uniforms.col.value.setRGB(1, 1, 1);
  o.glowMat.uniforms.intensity.value = flare;
  o.ringMat.color.setRGB(1, 1, 1);
  o.ring.scale.setScalar(1 + easeOut * 1.8);
  o.core.scale.setScalar(1 + easeOut * 4.5);

  // difference-поле халфтона раздувается на весь экран
  const sp = hero.getScreenPos(camera, W(), H(), 0.25);
  halftonePass.uniforms.heroPos.value.set(sp.x, sp.y);
  const maxR = Math.hypot(W(), H()) * 1.15;
  halftonePass.uniforms.heroFieldR.value =
    HERO_FIELD_RADIUS_PX + (maxR - HERO_FIELD_RADIUS_PX) * easeIn;

  if (p >= 1) {
    location.href = `${import.meta.env.BASE_URL}games/${teleport.game}/`;
  }
}

// ── камера: следит за героем + кинематика в покое ─────────────────────────
const camTarget = new THREE.Vector3(0, 0, 0);
const camPos    = camera.position.clone();
let   idleTime  = 0;

// Насколько кадр «поднят» к дереву: 0 обычная карта, 1 подошли вплотную.
// Считаем отдельно от yggdrasil.near, потому что кадр обязан реагировать
// плавнее самого дерева — иначе камера дёргается на каждом шаге.
let camTreeLift = 0;

function updateCamera(dt) {
  // камера ведёт героя 1:1 — карта большая, парallax-плавание тут не работает.
  const lookAt = new THREE.Vector3(heroPos.x, 0, heroPos.z);
  camTarget.lerp(lookAt, isMoving ? 0.12 : 0.05);

  // Подход к Иггдрасилю: камера отъезжает и задирается, чтобы в кадр вошла
  // крона. Дерево высотой под 15 единиц иначе просто не помещается — игрок
  // видел бы только корни.
  camTreeLift += (yggdrasil.near - camTreeLift) * Math.min(1, dt * 1.6);

  let swX = 0, swY = 0, swZ = 0;
  if (idleTime > 1.5) {
    const s = idleTime - 1.5;
    swX = Math.sin(s * 0.13) * 1.4;
    swZ = Math.cos(s * 0.085) * 0.7;
    swY = Math.sin(s * 0.06) * 0.35;
  }

  const L = camTreeLift;
  // Отъезжаем не по мировой оси, а ПО НАПРАВЛЕНИЮ ОТ ДЕРЕВА К ГЕРОЮ: игрок
  // подходит с любой стороны, и только так дерево остаётся в кадре.
  let ox = camTarget.x - TREE.x, oz = camTarget.z - TREE.z;
  const ol = Math.hypot(ox, oz) || 1;
  ox /= ol; oz /= ol;

  const target = new THREE.Vector3(
    camTarget.x + CAM_BASE.x + swX + ox * L * 7.5,
    CAM_BASE.y + swY + L * 9.0,                  // и заметно выше
    camTarget.z + CAM_BASE.z + swZ + oz * L * 7.5,
  );
  camPos.lerp(target, isMoving ? 0.06 : 0.025);
  camera.position.copy(camPos);
  // точка взгляда переезжает на ствол и ползёт вверх — кадр «смотрит на
  // дерево», а не просто отодвигается от героя
  camera.lookAt(
    camTarget.x + (TREE.x - camTarget.x) * L * 0.8,
    L * 6.4,
    camTarget.z + (TREE.z - camTarget.z) * L * 0.8 - 0.4,
  );
}

// ── hero update ──────────────────────────────────────────────────────────
const SPEED   = 6.0;
const ACT_RAD = 0.75;

function updateHero(dt) {
  if (teleport) { isMoving = false; idleTime = 0; return; }
  const { dx, dz, moving } = dirFromKeys();
  isMoving = moving;

  if (moving) {
    let nx = Math.max(-22, Math.min(22, heroPos.x + dx * SPEED * dt));
    let nz = Math.max(-15, Math.min(15, heroPos.z + dz * SPEED * dt));
    // выталкивание из препятствий (круговая коллизия)
    const HERO_R = 0.55;
    for (const o of obstacles) {
      const ox = nx - o.x, oz = nz - o.z;
      const dd = Math.hypot(ox, oz);
      const minD = o.r + HERO_R;
      if (dd < minD && dd > 1e-4) {
        const push = minD - dd;
        nx += (ox / dd) * push;
        nz += (oz / dd) * push;
      }
    }
    heroPos.x = Math.max(-22, Math.min(22, nx));
    heroPos.z = Math.max(-15, Math.min(15, nz));
    idleTime = 0;
  } else {
    idleTime += dt;
  }

  // делегируем позицию и анимацию модулю — он сам разберётся
  // с дыханием, бобингом и поворотом по направлению.
  hero.setPosition(heroPos.x, heroPos.z);
  hero.update(dt, { moving, dx, dz });

  // Плод перебивает ноду: если игрок стоит под выпуском, он хочет открыть
  // выпуск, а не запустить игру.
  const FRUIT_RAD = 2.0;
  activeFruit = null;
  {
    let best = FRUIT_RAD;
    for (const f of yggdrasil.fruits) {
      const d = Math.hypot(f.world.x - heroPos.x, f.world.z - heroPos.z);
      if (d < best) { best = d; activeFruit = f; }
    }
  }

  let nearId = null, nearDist = ACT_RAD;
  for (const n of NODES) {
    const d = Math.hypot(n.x - heroPos.x, n.z - heroPos.z);
    if (d < nearDist) { nearId = n.id; nearDist = d; }
  }
  // открытые врата перебивают ноды (у них больший радиус активации)
  if (allGamesDone() && Math.hypot(EXIT.x - heroPos.x, EXIT.z - heroPos.z) < 1.7) {
    nearId = "exit";
  }
  // плод перебивает ноду: стоя под выпуском игрок хочет открыть выпуск
  const key = activeFruit ? "fruit:" + activeFruit.id : "node:" + nearId;
  if (activeFruit) {
    if (key !== promptKey) {
      promptKey = key;
      promptEl.textContent =
        (IS_TOUCH ? "тап · открыть " : "enter · открыть ") + activeFruit.label;
      promptEl.classList.remove("done");
      promptEl.classList.add("show");
    }
    activeNode = null;
  } else if (key !== promptKey) {
    promptKey = key;
    activeNode = nearId;
    if (nearId === "exit") {
      promptEl.textContent = IS_TOUCH ? "тап · новый сеанс" : "enter · новый сеанс";
      promptEl.classList.remove("done");
      promptEl.classList.add("show");
    } else {
      const near = nearId ? nodeById(nearId) : null;
      const hasGame = !!(near?.game);
      promptEl.classList.toggle("show", hasGame);
      if (hasGame) {
        const done = isDone(near.game);
        // DLC — не процесс машины, а носитель: и подписан он как носитель
        promptEl.textContent = done
          ? (near.dlc ? "диск прочитан" : "процесс завершён")
          : (near.dlc ? `вставить диск ${near.label.toLowerCase()}`
                      : `запустить ${near.label.toLowerCase()}`);
        promptEl.classList.toggle("done", done);
      }
    }
  }
}

// ── resize ───────────────────────────────────────────────────────────────
window.addEventListener("resize", () => {
  renderer.setSize(W(), H());
  composer.setSize(W(), H());
  camera.aspect = W() / H();
  camera.updateProjectionMatrix();
  halftonePass.uniforms.resolution.value.set(W(), H());
});

// ── loop ─────────────────────────────────────────────────────────────────
let prev = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - prev) / 1000);
  prev = now;
  const t = now / 1000;

  updateHero(dt);
  updateEdges(t);
  updateObstacles(t);
  updateNodes(t, activeNode);
  updateExit(t);
  yggdrasil.update(t, dt, heroPos);
  updateCamera(dt);
  if (import.meta.env.DEV) {
    // дев-хук рядом с __vol4_resetProgress: позиция героя и близость дерева
    window.__vol4 = { x: heroPos.x, z: heroPos.z, tree: TREE,
                      near: +yggdrasil.near.toFixed(3),
                      fruits: yggdrasil.fruits.map(f => ({ id: f.id,
                        x: +f.world.x.toFixed(2), z: +f.world.z.toFixed(2),
                        near: +f.near.toFixed(2) })),
                      prompt: promptEl.textContent };
  }
  updateLabels(activeNode);

  if (teleport) {
    updateTeleport(dt);
  } else {
    // передаём позицию героя в halftone-шейдер для difference-поля
    const sp = hero.getScreenPos(camera, W(), H(), 0.45);
    halftonePass.uniforms.heroPos.value.set(sp.x, sp.y);
    halftonePass.uniforms.heroFieldR.value = HERO_FIELD_RADIUS_PX;
  }

  composer.render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// ── ФИНАЛ: машина дочитала четыре стиха и дописывает пятый ─────────────────
// Центон: по строке-цитате из каждого стиха, собранные в один текст. Машина
// (VOL4/OS), прочитав четыре голоса, становится автором закрывающей строфы.
const COMPLETABLE = ["birds", "stalagmit", "prizma", "nancy-drew"];

const CENTO = [
  { txt: "Пагода сокровищ ведёт обратный отсчёт",        src: "призма"    },
  { txt: "самый высокий этаж — под землёй,",             src: "нэнси дрю" },
  { txt: "крик невольных свидетелей несезонной смерти",  src: "птицы"     },
  { txt: "напоминает нам о тех, что ничего нет.",        src: "сталагмит" },
];

(function finaleController() {
  const finale = document.getElementById("finale");
  if (!finale || !COMPLETABLE.every(g => isDone(g))) return;

  // на пройденной карте нижний хинт ведёт к арке (ENTER снова имеет смысл)
  const hintEl = document.getElementById("hint");
  if (hintEl) hintEl.innerHTML = `<kbd>WASD</kbd> к арке <kbd>ENTER</kbd> новый сеанс`;

  const host    = document.getElementById("finCento");
  const dismiss = document.getElementById("finDismiss");
  let timers = [];
  const T = (fn, ms) => timers.push(setTimeout(fn, ms));
  const clearT = () => { timers.forEach(clearTimeout); timers = []; };

  function buildCento() {
    host.innerHTML = "";
    for (const l of CENTO) {
      const row = document.createElement("div");
      row.className = "fin-line";
      row.innerHTML = `<span class="txt">${l.txt}</span><span class="src">${l.src}</span>`;
      host.appendChild(row);
    }
    return [...host.children];
  }

  let running = false;   // секвенция идёт (фазы 1–2)
  let dead    = false;   // машина выключена (фаза 4)

  function start() {
    clearT();
    dead = false;
    const lines = buildCento();
    finale.className = "show";
    finale.setAttribute("aria-hidden", "false");
    running = true;
    requestAnimationFrame(() => finale.classList.add("phase1"));   // схождение лучей
    T(() => {                                                       // пятый текст
      finale.classList.remove("phase1");
      finale.classList.add("phase2");
      lines.forEach((el, i) => T(() => el.classList.add("in"), 700 + i * 1200));
      T(() => {
        finale.classList.add("signed");
        // дать строке «ничего нет» осесть, затем машина гаснет сама,
        // если зритель не выключил её раньше
        T(powerDown, 7000);
      }, 700 + lines.length * 1200 + 500);
    }, 3700);
  }

  function skip() {                       // показать текст сразу (нетерпеливым)
    clearT();
    finale.classList.remove("phase1");
    finale.classList.add("phase2");
    [...host.children].forEach(el => el.classList.add("in"));
    finale.classList.add("signed");
    T(powerDown, 7000);
  }

  // машина выключается: кинескоп схлопывается в точку → чернота → эпитафия
  function powerDown() {
    clearT();
    running = false;
    finale.classList.remove("phase1", "phase2", "signed");
    finale.classList.add("off");
    T(() => { finale.classList.add("dead"); dead = true; }, 1150);
  }

  // вернуться к карте (мягкое закрытие без выключения)
  function close() {
    clearT();
    running = false; dead = false;
    finale.classList.remove("show");
    finale.setAttribute("aria-hidden", "true");
    T(() => { finale.className = ""; }, 950);
  }

  finale.addEventListener("click", () => {
    if (dead) return;                                  // на чёрном — только кнопки
    if (finale.classList.contains("signed")) powerDown();
    else if (running) skip();
  });
  dismiss?.addEventListener("click", e => { e.stopPropagation(); powerDown(); });
  document.getElementById("finBack")?.addEventListener("click", e => { e.stopPropagation(); close(); });
  document.getElementById("finRestart")?.addEventListener("click", e => {
    e.stopPropagation();
    clearAllProgress();                                // сбрасываем прогресс игр
    osNavigate(location.pathname);                     // перезапуск через кинескоп
  });

  document.addEventListener("keydown", e => {
    // F — пересмотреть финал, когда он закрыт/выключен
    if (e.code === "KeyF" && !running && !finale.classList.contains("show")) {
      e.preventDefault(); start(); return;
    }
    if (!finale.classList.contains("show") || dead) return;
    if (e.code === "Escape" || e.code === "Enter" || e.code === "Space") {
      e.preventDefault();
      if (finale.classList.contains("signed")) powerDown();
      else if (running) skip();
    }
  });

  // дать карте включиться из кинескопа, затем запустить финал
  setTimeout(start, 1300);
})();

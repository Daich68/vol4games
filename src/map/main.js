import "../shared/type.css";
// Карта vol4games — Three.js, halftone post-process. Псевдо-3D через сетку точек.
import * as THREE from "three";
import { EffectComposer }     from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass }         from "three/examples/jsm/postprocessing/RenderPass.js";
import { OutputPass }         from "three/examples/jsm/postprocessing/OutputPass.js";
import { isDone }             from "../shared/nav.js";
import { createHero, HERO_FIELD_RADIUS_PX } from "../shared/hero.js";
import { createHalftonePass } from "../shared/halftone.js";

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
  { id: "n3", x:  15.0, z: -8.0,  label: "ПТИЦЫ",     sub: "match-3",                         game: "birds"      },
  { id: "n4", x:  12.5, z:  10.0, label: "ПРИЗМА",    sub: "данила кудимов · icy tower",      game: "prizma"     },
];
// n1 — хаб; n2-n3 даёт внешнюю дугу, чтобы пути не пересекались крестом.
const EDGES = [["n1","n2"],["n1","n3"],["n1","n4"],["n2","n3"]];
const nodeById = id => NODES.find(n => n.id === id);

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
});

function updateNodes(t, activeId) {
  for (const o of Object.values(nodeObjs)) {
    const { g, ring, ringMat, core, coreMat, glowMat, n } = o;
    const isActive = n.id === activeId;
    const done     = isDone(n.game);
    const hasGame  = !!n.game;

    g.position.y = Math.sin(t * 1.0 + n.x * 0.55) * 0.05;
    ring.rotation.z = -t * 0.18;

    const pulse = 0.85 + 0.15 * Math.sin(t * 1.9 + n.z * 0.5);

    if (done) {
      ringMat.color.setRGB(1.0, 0.78, 0.32);
      coreMat.color.setRGB(1.0, 0.85, 0.45);
      glowMat.uniforms.col.value.setRGB(1.0, 0.78, 0.32);
      glowMat.uniforms.intensity.value = 0.7 * pulse;
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

  const pMat = new THREE.ShaderMaterial({
    uniforms: { col: { value: new THREE.Color(0xffffff) } },
    vertexShader: `
      attribute float size;
      varying float vAlpha;
      void main() {
        vAlpha = size;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = (3.0 + size * 6.0) * (60.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform vec3 col;
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float a = 1.0 - smoothstep(0.2, 1.0, d);
        if (a < 0.01) discard;
        gl_FragColor = vec4(col, a * vAlpha);
      }
    `,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  scene.add(new THREE.Points(pGeo, pMat));

  // фиксированные t (равномерно вдоль кривой)
  const ts = Array.from({ length: COUNT }, (_, i) => i / (COUNT - 1));
  edgeSystems.push({ curve, pGeo, positions, sizes, ts, flowOffset: 0 });
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
  el.className = "nlabel" + (n.game ? " has-game" : "");
  if (isDone(n.game)) el.classList.add("done");
  el.innerHTML = `<span class="title">${n.label}</span><span class="sub">${n.sub || ""}</span>`;
  uiEl.appendChild(el);
  labelEls[n.id] = el;
});

const promptEl = document.getElementById("prompt");

function updateLabels(activeId) {
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

const MOVE_CODES  = new Set(["KeyW","KeyA","KeyS","KeyD","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"]);
const ENTER_CODES = new Set(["Enter","KeyE","Space"]);

window.addEventListener("keydown", e => {
  if (teleport) return; // ввод заблокирован во время телепорта
  if (MOVE_CODES.has(e.code))  { keys.add(e.code); e.preventDefault(); }
  if (ENTER_CODES.has(e.code) && activeNode) enterNode(activeNode);
});
window.addEventListener("keyup",  e => keys.delete(e.code));
window.addEventListener("blur",   () => keys.clear());

function dirFromKeys() {
  let dx = 0, dz = 0;
  if (keys.has("KeyW") || keys.has("ArrowUp"))    dz -= 1;
  if (keys.has("KeyS") || keys.has("ArrowDown"))  dz += 1;
  if (keys.has("KeyA") || keys.has("ArrowLeft"))  dx -= 1;
  if (keys.has("KeyD") || keys.has("ArrowRight")) dx += 1;
  if (!dx && !dz) return { dx:0, dz:0, moving:false };
  const l = Math.hypot(dx, dz);
  return { dx:dx/l, dz:dz/l, moving:true };
}

function enterNode(id) {
  const n = nodeById(id);
  if (!n?.game || teleport) return;
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

function updateCamera(dt) {
  // камера ведёт героя 1:1 — карта большая, парallax-плавание тут не работает.
  const lookAt = new THREE.Vector3(heroPos.x, 0, heroPos.z);
  camTarget.lerp(lookAt, isMoving ? 0.12 : 0.05);

  let swX = 0, swY = 0, swZ = 0;
  if (idleTime > 1.5) {
    const s = idleTime - 1.5;
    swX = Math.sin(s * 0.13) * 1.4;
    swZ = Math.cos(s * 0.085) * 0.7;
    swY = Math.sin(s * 0.06) * 0.35;
  }

  const target = new THREE.Vector3(
    camTarget.x + CAM_BASE.x + swX,
    CAM_BASE.y + swY,
    camTarget.z + CAM_BASE.z + swZ,
  );
  camPos.lerp(target, isMoving ? 0.06 : 0.025);
  camera.position.copy(camPos);
  camera.lookAt(camTarget.x, 0, camTarget.z - 0.4);
}

// ── hero update ──────────────────────────────────────────────────────────
const SPEED   = 6.0;
const ACT_RAD = 0.75;

function updateHero(dt) {
  if (teleport) { isMoving = false; idleTime = 0; return; }
  const { dx, dz, moving } = dirFromKeys();
  isMoving = moving;

  if (moving) {
    heroPos.x = Math.max(-22, Math.min(22, heroPos.x + dx * SPEED * dt));
    heroPos.z = Math.max(-15, Math.min(15, heroPos.z + dz * SPEED * dt));
    idleTime = 0;
  } else {
    idleTime += dt;
  }

  // делегируем позицию и анимацию модулю — он сам разберётся
  // с дыханием, бобингом и поворотом по направлению.
  hero.setPosition(heroPos.x, heroPos.z);
  hero.update(dt, { moving, dx, dz });

  let nearId = null, nearDist = ACT_RAD;
  for (const n of NODES) {
    const d = Math.hypot(n.x - heroPos.x, n.z - heroPos.z);
    if (d < nearDist) { nearId = n.id; nearDist = d; }
  }
  if (nearId !== activeNode) {
    activeNode = nearId;
    const near = nearId ? nodeById(nearId) : null;
    const hasGame = !!(near?.game);
    promptEl.classList.toggle("show", hasGame);
    if (hasGame) {
      const done = isDone(near.game);
      promptEl.textContent = done ? "пройдено" : "enter войти";
      promptEl.classList.toggle("done", done);
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
  updateNodes(t, activeNode);
  updateCamera(dt);
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

// ── проверка финала: все доступные игры пройдены ──────────────────────────
const COMPLETABLE = ["birds", "stalagmit", "prizma"];
if (COMPLETABLE.every(g => isDone(g))) {
  document.getElementById("allDoneOverlay")?.classList.add("show");
}

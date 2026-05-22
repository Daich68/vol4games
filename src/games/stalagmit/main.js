// СТАЛАГМИТ — Tower Bloxx с блоками-хрущёвками. Three.js + halftone.
// Стих: Али Алиев, "ул. Подмосковный проезд, 8".
//
// Основная механика крана — настоящий маятник: пивот сверху, на тросе
// длины L болтается блок. Угол θ(t) = AMP·sin(ω·t). При дропе у блока
// есть угловая скорость → горизонтальная и вертикальная компоненты
// начальной скорости. Чем дальше от центра качания, тем медленнее блок.
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass }     from "three/examples/jsm/postprocessing/RenderPass.js";
import { OutputPass }     from "three/examples/jsm/postprocessing/OutputPass.js";

import { ensureAudio, thud, creak, rumble }  from "../../shared/audio.js";
import { backToMap, markDone, bindBackLink, showCompleted } from "../../shared/nav.js";
import { createHalftonePass }                from "../../shared/halftone.js";

bindBackLink();

// ── canvas / sizing ──────────────────────────────────────────────────────
const canvas = document.getElementById("c");
function CW() { return canvas.clientWidth; }
function CH() { return canvas.clientHeight; }

// ── константы геймплея ───────────────────────────────────────────────────
const BLOCK_W       = 1.4;
const BLOCK_H       = 0.85;
const BLOCK_D       = 0.7;
const GOAL          = 10;
const GRAVITY       = -22;
const MIN_OVERLAP   = 0.18;

// маятник
const PIVOT_ABOVE   = 4.2;       // насколько пивот выше топа стека
const ROPE_LEN      = 2.4;
const SWING_AMP_0   = 0.85;      // радиан, ~49°
const OMEGA_0       = 1.35;      // нач. угловая скорость качания
const OMEGA_MAX     = 3.4;
const OMEGA_STEP    = 0.10;

// мир
const WORLD_HALF_H  = 7.5;       // полу-высота видимой сцены в world units

// ── renderer ─────────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.setPixelRatio(1);
renderer.toneMapping = THREE.NoToneMapping;
renderer.setSize(CW(), CH(), false);

// ── scene ────────────────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

// ── камера: орто 3/4 (псевдо-изометрия) ─────────────────────────────────
let camera;
function makeCamera() {
  const aspect = CW() / CH();
  const halfW = WORLD_HALF_H * aspect;
  camera = new THREE.OrthographicCamera(-halfW, halfW, WORLD_HALF_H, -WORLD_HALF_H, -50, 50);
  // Лёгкий 3/4-ракурс: чуть смещаем камеру по X и сверху, смотрим в центр.
  // Орто без перспективы, но за счёт смещения видим переднюю+правую грани блоков.
  camera.position.set(2.5, WORLD_HALF_H * 0.6, 8);
  camera.lookAt(0, WORLD_HALF_H * 0.6 - 1.2, 0);
}
makeCamera();

// ── post-processing ──────────────────────────────────────────────────────
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);
const halftonePass = createHalftonePass(CW(), CH());
// в этой сцене героя нет — поле выключено (heroFieldR = 0)
halftonePass.uniforms.heroFieldR.value = 0;
composer.addPass(halftonePass);
composer.addPass(new OutputPass());

// ── материал блока: монохромная хрущёвка ─────────────────────────────────
function buildingMaterial(seed) {
  return new THREE.ShaderMaterial({
    uniforms: { seed: { value: seed } },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      void main() {
        vUv = uv;
        vNormal = normal;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float seed;
      varying vec2 vUv;
      varying vec3 vNormal;

      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9, 78.2)) + seed) * 43758.5); }

      void main() {
        // верх / низ
        if (vNormal.y > 0.5)  { gl_FragColor = vec4(vec3(0.50), 1.0); return; }
        if (vNormal.y < -0.5) { gl_FragColor = vec4(vec3(0.18), 1.0); return; }

        // правая боковая грань — чуть светлее, со швами панелей
        if (vNormal.x > 0.5) {
          float seam = step(0.96, fract(vUv.x * 3.0));
          gl_FragColor = vec4(vec3(0.36 - seam * 0.10), 1.0);
          return;
        }
        // левая (видна редко)
        if (vNormal.x < -0.5) {
          gl_FragColor = vec4(vec3(0.22), 1.0); return;
        }
        // тыл
        if (vNormal.z < -0.5) { gl_FragColor = vec4(vec3(0.20), 1.0); return; }

        // фронтальная грань — фасад с окнами
        vec3 bodyCol = vec3(0.42);
        // вертикальный градиент: нижние этажи чуть темнее
        bodyCol *= mix(0.85, 1.05, vUv.y);
        // лёгкие потёки/полосы
        float streak = step(0.96, fract(vUv.x * 8.0 + hash(vec2(floor(vUv.x*8.0), 0.0)) * 0.3));
        bodyCol *= mix(1.0, 0.78, streak * 0.6);
        // межэтажные швы
        float seamY = step(0.96, fract(vUv.y * 5.0));
        float seamX = step(0.96, fract(vUv.x * 4.0));
        bodyCol *= (seamY + seamX > 0.5) ? 0.72 : 1.0;

        // окна 4×5
        vec2 cell = vec2(0.25, 0.20);
        vec2 frac = fract(vUv / cell);
        vec2 cellId = floor(vUv / cell);
        bool inWindow = frac.x > 0.18 && frac.x < 0.82 && frac.y > 0.24 && frac.y < 0.78;
        float lit = step(0.80, hash(cellId));

        vec3 col = bodyCol;
        if (inWindow) col = mix(vec3(0.04), vec3(0.92), lit);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

// ── земля — еле различимая полоса у горизонта ────────────────────────────
{
  const groundMat = new THREE.MeshBasicMaterial({ color: 0x070710 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 1.4), groundMat);
  ground.position.y = -0.7;
  scene.add(ground);

  // тонкая линия горизонта
  const horizon = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-20, 0, 0), new THREE.Vector3(20, 0, 0),
    ]),
    new THREE.LineBasicMaterial({ color: 0x252530 }),
  );
  scene.add(horizon);
}

// ── звёзды-точки в небе ─────────────────────────────────────────────────
{
  const COUNT = 60;
  const positions = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i++) {
    positions[i*3]   = (Math.random() - 0.5) * 16;
    positions[i*3+1] = 4 + Math.random() * 30;
    positions[i*3+2] = -3 - Math.random() * 4;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  scene.add(new THREE.Points(geo,
    new THREE.PointsMaterial({ color: 0x303040, size: 0.05, sizeAttenuation: true })
  ));
}

// ── стек-группа: все уложенные блоки — одна группа, наклон = шатание ────
const stackGroup = new THREE.Group();
scene.add(stackGroup);

// пружинная физика шатания
let wobbleAngle  = 0;   // текущий угол наклона (рад)
let wobbleVel    = 0;   // угловая скорость
let wobbleTarget = 0;   // целевой угол (зависит от центра масс)

const WOBBLE_SPRING = 6.5;  // жёсткость пружины возврата к вертикали
const WOBBLE_DAMP   = 2.8;  // демпфирование
const WOBBLE_TOPPLE = 0.44; // ~25° — башня падает

// пересчёт целевого угла по центру масс стека
function recalcWobble() {
  if (stack.length < 2) { wobbleTarget = 0; return; }
  const totalW = stack.reduce((s, b) => s + b.w, 0);
  const comX   = stack.reduce((s, b) => s + b.x * b.w, 0) / totalW;
  // чем выше башня — тем сильнее та же смещённость COM раскачивает
  wobbleTarget = Math.max(-0.48, Math.min(0.48, comX * stackTop * 0.022));
}

function updateWobble(dt) {
  if (state !== "playing") return;
  const spring = -WOBBLE_SPRING * (wobbleAngle - wobbleTarget);
  wobbleVel += (spring - WOBBLE_DAMP * wobbleVel) * dt;
  wobbleAngle += wobbleVel * dt;
  if (Math.abs(wobbleAngle) >= WOBBLE_TOPPLE) { triggerCollapse(); return; }
  stackGroup.rotation.z = wobbleAngle;
}

// ── кран: балка + пивот + тросс + крюк ───────────────────────────────────
const craneGroup = new THREE.Group();
scene.add(craneGroup);

// горизонтальная балка крана (тонкая)
const beam = new THREE.Mesh(
  new THREE.BoxGeometry(3.4, 0.08, 0.12),
  new THREE.MeshBasicMaterial({ color: 0x6c6c78 }),
);
beam.position.y = 0.08;
craneGroup.add(beam);

// тонкие диагональные распорки (создают ощущение конструкции)
const braceMat = new THREE.LineBasicMaterial({ color: 0x404049 });
const braceGeo = new THREE.BufferGeometry().setFromPoints([
  new THREE.Vector3(-1.7, 0.04, 0), new THREE.Vector3(0, 0.6, 0),
  new THREE.Vector3( 1.7, 0.04, 0), new THREE.Vector3(0, 0.6, 0),
]);
craneGroup.add(new THREE.LineSegments(braceGeo, braceMat));

// пивот (точка крепления тросса)
const pivot = new THREE.Mesh(
  new THREE.CircleGeometry(0.07, 16),
  new THREE.MeshBasicMaterial({ color: 0xaaaaaa }),
);
pivot.position.set(0, 0, 0.01);
craneGroup.add(pivot);

// тросс: BufferGeometry на 2 точки, обновляем каждый кадр
const ropeGeo = new THREE.BufferGeometry();
ropeGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
const rope = new THREE.Line(ropeGeo,
  new THREE.LineBasicMaterial({ color: 0x9a9aa4, transparent: true, opacity: 0.85 })
);
craneGroup.add(rope);

// крюк
const hook = new THREE.Mesh(
  new THREE.CircleGeometry(0.06, 12),
  new THREE.MeshBasicMaterial({ color: 0xb8b8c0 }),
);
craneGroup.add(hook);

// ── состояние ────────────────────────────────────────────────────────────
let stack;
let stackTop;
let craneT;
let craneOmega;
let block;
let dropped;
let state;
let collapseStart;
let collapseBodies;
let scraps;
let lastCraneCosSign;
let cameraShake = 0;

function reset() {
  if (stack) for (const b of stack) scene.remove(b.mesh);
  if (collapseBodies) for (const b of collapseBodies) scene.remove(b.mesh);
  if (scraps) for (const s of scraps) scene.remove(s.mesh);
  if (block?.mesh) scene.remove(block.mesh);

  stackGroup.clear();
  stackGroup.rotation.z = 0;
  wobbleAngle = 0; wobbleVel = 0; wobbleTarget = 0;

  stack = [];
  stackTop = 0;
  craneT = 0;
  craneOmega = OMEGA_0;
  dropped = 0;
  state = "playing";
  collapseStart = 0;
  collapseBodies = [];
  scraps = [];
  lastCraneCosSign = 1;
  cameraShake = 0;

  spawnBlock();
  updateCounter();
  setStatus("");
  poemEl.classList.remove("show");
}

function spawnBlock() {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(BLOCK_W, BLOCK_H, BLOCK_D),
    buildingMaterial(Math.random()),
  );
  scene.add(mesh);
  block = {
    mesh, w: BLOCK_W,
    x: 0, y: stackTop + PIVOT_ABOVE - ROPE_LEN, // под пивотом
    vx: 0, vy: 0,
    angle: 0, angleVel: 0,
    falling: false,
  };
}

// ── ввод ─────────────────────────────────────────────────────────────────
function tryDrop() {
  if (state !== "playing" || !block || block.falling) return;
  // снимаем блок с тросса — у него есть скорость от качания маятника
  // dx/dt = L * cos(θ) * dθ/dt   (касательная вдоль X)
  // dy/dt = L * sin(θ) * dθ/dt   (вертикальная компонента — мала вблизи θ=0)
  const a = block.angle, av = block.angleVel;
  block.vx =  ROPE_LEN * Math.cos(a) * av;
  block.vy =  ROPE_LEN * Math.sin(a) * av;
  block.falling = true;
}
function onPrimary() {
  ensureAudio();
  if (state === "playing") tryDrop();
  else if (state === "finale") backToMap();
  else if (state === "gameover") reset();
}
addEventListener("keydown", e => {
  ensureAudio();
  if (e.code === "Escape") { backToMap(); return; }
  if (e.code === "Space" || e.code === "Enter") { onPrimary(); e.preventDefault(); }
  if (e.code === "KeyR" && state === "gameover") reset();
});
addEventListener("click", onPrimary);

// ── update ───────────────────────────────────────────────────────────────
function update(dt) {
  // позиция пивота (двигается вверх с башней)
  const pivotX = 0;
  const pivotY = stackTop + PIVOT_ABOVE;

  if (state === "playing" && block) {
    if (!block.falling) {
      // маятник: угол и угл. скорость как у синусоиды
      craneT += dt * craneOmega;
      block.angle    = SWING_AMP_0 * Math.sin(craneT);
      block.angleVel = SWING_AMP_0 * craneOmega * Math.cos(craneT);

      // блок висит на тросе
      block.x = pivotX + ROPE_LEN * Math.sin(block.angle);
      block.y = pivotY - ROPE_LEN * Math.cos(block.angle);
      block.mesh.position.set(block.x, block.y, 0);
      // блок наклоняется вместе с тросом, но не полностью — груз стремится вертикально
      block.mesh.rotation.z = -block.angle * 0.45;

      // скрип на крайних точках (cos меняет знак на экстремумах)
      const cs = Math.sign(Math.cos(craneT)) || 1;
      if (cs !== lastCraneCosSign) { creak(); lastCraneCosSign = cs; }
    } else {
      // свободное падение
      block.vy += GRAVITY * dt;
      block.x  += block.vx * dt;
      block.y  += block.vy * dt;
      block.mesh.position.set(block.x, block.y, 0);
      // плавно выпрямляется в полёте
      block.mesh.rotation.z = THREE.MathUtils.lerp(block.mesh.rotation.z, 0, Math.min(1, dt * 4));

      if (block.y - BLOCK_H/2 <= stackTop) onLand();
    }
  }

  // позиционируем кран
  craneGroup.position.set(pivotX, pivotY, 0);
  // тросс: от пивота до верха блока (только пока он на тросе)
  const ropeArr = ropeGeo.attributes.position.array;
  ropeArr[0] = 0; ropeArr[1] = 0; ropeArr[2] = 0;
  if (block && !block.falling) {
    const bx = block.x - pivotX;
    const by = block.y - pivotY + BLOCK_H/2;
    ropeArr[3] = bx; ropeArr[4] = by; ropeArr[5] = 0;
    hook.position.set(bx, by, 0.01);
    hook.visible = true;
    rope.visible = true;
  } else {
    rope.visible = false;
    hook.visible = false;
  }
  ropeGeo.attributes.position.needsUpdate = true;

  // обрезки
  for (const s of scraps) {
    s.vy += GRAVITY * dt;
    s.mesh.position.x += s.vx * dt;
    s.mesh.position.y += s.vy * dt;
    s.rot += s.vrot * dt;
    s.mesh.rotation.z = s.rot;
  }
  scraps = scraps.filter(s => {
    if (s.mesh.position.y < -8) { scene.remove(s.mesh); return false; }
    return true;
  });

  updateWobble(dt);

  if (state === "collapsing") {
    for (const b of collapseBodies) {
      b.vy += GRAVITY * 0.7 * dt;
      b.mesh.position.x += b.vx * dt;
      b.mesh.position.y += b.vy * dt;
      b.rot += b.vrot * dt;
      b.mesh.rotation.z = b.rot;
    }
    if (performance.now() - collapseStart > 2400) {
      state = "gameover";
      setStatus(`БАШНЯ ОБРУШИЛАСЬ<span class="sub">построено: ${dropped} из ${GOAL}<br>[ ENTER / R ] заново · [ ESC ] на карту</span>`);
    }
  }

  cameraShake *= Math.pow(0.001, dt); // быстрое затухание
}

function onLand() {
  if (stack.length === 0) {
    block.mesh.position.y = stackTop + BLOCK_H/2;
    block.mesh.rotation.z = 0;
    stack.push({ x: block.x, y: block.mesh.position.y, w: BLOCK_W, mesh: block.mesh });
    placeOK();
    return;
  }

  const prev = stack[stack.length - 1];
  const newL = block.x - block.w/2;
  const newR = block.x + block.w/2;
  const prevL = prev.x - prev.w/2;
  const prevR = prev.x + prev.w/2;
  const left  = Math.max(newL, prevL);
  const right = Math.min(newR, prevR);
  const overlap = right - left;

  if (overlap < MIN_OVERLAP) {
    triggerCollapse();
    return;
  }

  // обрезки
  if (newL < prevL) {
    const overhang = prevL - newL;
    scraps.push(makeScrap(newL + overhang/2, stackTop + BLOCK_H/2, overhang, BLOCK_H, -1.8));
  }
  if (newR > prevR) {
    const overhang = newR - prevR;
    scraps.push(makeScrap(newR - overhang/2, stackTop + BLOCK_H/2, overhang, BLOCK_H, 1.8));
  }

  const trimmedX = (left + right) / 2;
  block.mesh.position.set(trimmedX, stackTop + BLOCK_H/2, 0);
  block.mesh.rotation.z = 0;
  block.mesh.scale.x = overlap / BLOCK_W;
  stack.push({ x: trimmedX, y: block.mesh.position.y, w: overlap, mesh: block.mesh });
  placeOK();
}

function makeScrap(x, y, w, h, vx) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, BLOCK_D),
    new THREE.MeshBasicMaterial({ color: 0x35353e }),
  );
  mesh.position.set(x, y, 0);
  scene.add(mesh);
  return { mesh, vx, vy: 1.2, rot: 0, vrot: (Math.random() - 0.5) * 4 };
}

function placeOK() {
  thud(Math.min(1, 0.6 + dropped * 0.02));
  cameraShake = 0.18;
  // переносим меш из сцены в stackGroup (мировые координаты совпадают пока rotation=0 у группы)
  const lastBlock = stack[stack.length - 1];
  scene.remove(lastBlock.mesh);
  stackGroup.add(lastBlock.mesh);
  stackTop += BLOCK_H;
  dropped++;
  craneOmega = Math.min(OMEGA_MAX, craneOmega + OMEGA_STEP);
  recalcWobble();
  // импульс шатания от смещения приземления
  wobbleVel += lastBlock.x * 0.12;
  block = null;
  updateCounter();
  if (dropped >= GOAL) {
    state = "finale";
    markDone("stalagmit");
    showPoem();
  } else {
    spawnBlock();
  }
}

function triggerCollapse() {
  rumble();
  cameraShake = 0.55;
  state = "collapsing";
  collapseStart = performance.now();

  // возвращаем блоки из stackGroup в сцену с мировыми координатами
  const wp = new THREE.Vector3();
  collapseBodies = stack.map(b => {
    b.mesh.getWorldPosition(wp);
    stackGroup.remove(b.mesh);
    scene.add(b.mesh);
    b.mesh.position.copy(wp);
    b.mesh.rotation.z += wobbleAngle; // учитываем накопленный наклон
    const lean = wobbleAngle > 0 ? 1.5 : -1.5;
    return {
      mesh: b.mesh,
      vx: (Math.random() - 0.5) * 3.5 + lean,
      vy: 1.5 + Math.random() * 2.5,
      rot: b.mesh.rotation.z,
      vrot: (Math.random() - 0.5) * 3.5,
    };
  });
  stackGroup.clear();
  stackGroup.rotation.z = 0;
  wobbleAngle = 0; wobbleVel = 0; wobbleTarget = 0;

  if (block?.mesh) {
    collapseBodies.push({
      mesh: block.mesh, vx: 0, vy: -block.vy * 0.3,
      rot: 0, vrot: (Math.random() - 0.5) * 4,
    });
  }
  stack = [];
  block = null;
}

// ── камера: следит за топом стека, лёгкий дрейф в покое ──────────────────
let camIdleT = 0;
function updateCamera(dt) {
  const desiredY = Math.max(WORLD_HALF_H * 0.6, stackTop + PIVOT_ABOVE * 0.5);
  // плавный лерп
  const camY = THREE.MathUtils.lerp(camera.position.y, desiredY, Math.min(1, dt * 2.2));

  // лёгкий cinematic drift по X (3/4 ракурс качается)
  camIdleT += dt;
  const driftX = 2.5 + Math.sin(camIdleT * 0.15) * 0.18;
  const shakeX = (Math.random() - 0.5) * cameraShake;
  const shakeY = (Math.random() - 0.5) * cameraShake;

  camera.position.set(driftX + shakeX, camY + shakeY, 8);
  camera.lookAt(0, camY - 1.2, 0);
}

// ── HUD / финал ──────────────────────────────────────────────────────────
const counterEl = document.getElementById("counter");
const statusEl  = document.getElementById("status");
const poemEl    = document.getElementById("poem");

function updateCounter() {
  counterEl.textContent =
    `${String(dropped).padStart(3, "0")} / ${String(GOAL).padStart(3, "0")}`;
}
function setStatus(html) {
  if (!html) { statusEl.classList.remove("show"); return; }
  statusEl.innerHTML = html;
  statusEl.classList.add("show");
}

let POEM_TEXT = "";
fetch(`${import.meta.env.BASE_URL}poems/stalagmit.txt`)
  .then(r => r.ok ? r.text() : "")
  .then(t => { POEM_TEXT = t; });

function showPoem() {
  const lines = POEM_TEXT.split("\n");
  let body = POEM_TEXT, sig = "";
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].includes("—")) {
      sig = lines[i].trim();
      body = lines.slice(0, i).join("\n").trimEnd();
      break;
    }
  }
  poemEl.innerHTML = `${body}<span class="sig">${sig}</span>`;
  setTimeout(() => poemEl.classList.add("show"), 600);
  setTimeout(() => setStatus(`<span class="sub">[ ENTER / CLICK ] вернуться на карту</span>`), 8500);
}

// ── resize ───────────────────────────────────────────────────────────────
function resize() {
  renderer.setSize(CW(), CH(), false);
  composer.setSize(CW(), CH());
  const aspect = CW() / CH();
  const halfW = WORLD_HALF_H * aspect;
  camera.left = -halfW; camera.right = halfW;
  camera.top = WORLD_HALF_H; camera.bottom = -WORLD_HALF_H;
  camera.updateProjectionMatrix();
  halftonePass.uniforms.resolution.value.set(CW(), CH());
}
window.addEventListener("resize", resize);

// ── loop ─────────────────────────────────────────────────────────────────
let prev = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - prev) / 1000);
  prev = now;

  update(dt);
  updateCamera(dt);

  composer.render();
  requestAnimationFrame(loop);
}

if (!showCompleted("stalagmit", "сталагмит")) {
  reset();
  requestAnimationFrame(loop);
}

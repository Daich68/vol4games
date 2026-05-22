// vol4 hero — единый персонаж для карты и всех игр.
// "Бесполый низкодетализированный" — голова-сфера + тело-капсула,
// тёплый кремовый цвет чтобы отстраиваться от холодно-белых нод/путей.
import * as THREE from "three";

// тёплая кремовая палитра — отличает героя от холодных бело-голубых элементов
const HERO_COLOR = new THREE.Color(1.0, 0.92, 0.78);
const HALO_COLOR = new THREE.Color(1.0, 0.88, 0.62);

// размеры в world units. Увеличены так, чтобы фигура занимала
// ~7-8 dot-cells в высоту при grid=6px — герой явно выделяется.
const BODY_RADIUS = 0.095;
const BODY_LENGTH = 0.36;
const BODY_Y      = 0.30;
const HEAD_RADIUS = 0.135;
const HEAD_Y      = 0.66;
const HALO_RADIUS = 0.95;
// радиус difference-поля вокруг героя в screen px (используется halftone-шейдером)
export const HERO_FIELD_RADIUS_PX = 110;

const haloVS = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const haloFS = `
  uniform vec3 col;
  uniform float intensity;
  varying vec2 vUv;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float a = pow(1.0 - smoothstep(0.0, 1.0, d), 1.6);
    gl_FragColor = vec4(col, a * intensity);
  }
`;

/**
 * Создаёт героя в указанной сцене.
 * @param {THREE.Scene} scene
 * @returns {{
 *   group: THREE.Group,
 *   setPosition: (x: number, z: number) => void,
 *   getPosition: () => {x: number, z: number},
 *   update: (dt: number, state: {moving: boolean, dx?: number, dz?: number}) => void,
 *   setColor: (color: THREE.ColorRepresentation) => void,
 *   dispose: () => void,
 * }}
 */
export function createHero({ scene }) {
  const group = new THREE.Group();

  // тело — тонкая вертикальная капсула
  const bodyGeo = new THREE.CapsuleGeometry(BODY_RADIUS, BODY_LENGTH, 4, 10);
  const bodyMat = new THREE.MeshBasicMaterial({ color: HERO_COLOR.clone() });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = BODY_Y;
  group.add(body);

  // голова — отдельная сфера сверху. Силуэт читается как буква 'i'.
  const headGeo = new THREE.SphereGeometry(HEAD_RADIUS, 14, 12);
  const headMat = new THREE.MeshBasicMaterial({ color: HERO_COLOR.clone() });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.y = HEAD_Y;
  group.add(head);

  // ореол под ногами — мягкое тёплое пятно, выдаёт героя в халфтоне
  const haloMat = new THREE.ShaderMaterial({
    uniforms: {
      col:       { value: HALO_COLOR.clone() },
      intensity: { value: 0.85 },
    },
    vertexShader: haloVS,
    fragmentShader: haloFS,
    transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const halo = new THREE.Mesh(new THREE.CircleGeometry(HALO_RADIUS, 36), haloMat);
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = 0.005;
  group.add(halo);

  // тонкое внутреннее ядро головы — мерцает (показывает «жив»)
  const coreGeo = new THREE.SphereGeometry(HEAD_RADIUS * 0.45, 8, 6);
  const coreMat = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0.6,
  });
  const core = new THREE.Mesh(coreGeo, coreMat);
  core.position.y = HEAD_Y;
  group.add(core);

  scene.add(group);

  // ── анимация ───────────────────────────────────────────────────────────
  let bobPhase    = 0;   // ходьба
  let breathPhase = 0;   // дыхание в покое
  let blinkPhase  = 0;   // мерцание ядра
  let facingY     = 0;   // куда повёрнут
  let leanZ       = 0;   // лёгкий наклон вперёд при ходьбе
  let haloPulse   = 0;

  function update(dt, { moving, dx = 0, dz = 0 } = {}) {
    breathPhase += dt * 1.4;
    blinkPhase  += dt * 2.6;
    haloPulse   += dt * 1.8;

    const breath = Math.sin(breathPhase) * 0.014;

    // ядро головы дышит ярче — крошечный «глазок»
    coreMat.opacity = 0.45 + 0.25 * Math.sin(blinkPhase);

    // ореол слегка пульсирует
    haloMat.uniforms.intensity.value = 0.75 + 0.15 * Math.sin(haloPulse);

    if (moving) {
      bobPhase += dt * 11;
      const bob = Math.abs(Math.sin(bobPhase)) * 0.04;

      // повернуться по направлению движения (только Y-rot)
      const targetY = Math.atan2(dx, dz);
      // shortest-arc lerp
      let diff = targetY - facingY;
      while (diff >  Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      facingY += diff * Math.min(1, dt * 12);

      // наклон вперёд во время хода
      leanZ = THREE.MathUtils.lerp(leanZ, -0.16, Math.min(1, dt * 6));

      group.rotation.y = facingY;
      group.rotation.x = leanZ;
      group.position.y = bob + breath;

      // голова чуть отстаёт по фазе — «болтается»
      head.position.y = HEAD_Y + Math.sin(bobPhase * 0.5 + 1.4) * 0.012;
    } else {
      bobPhase = 0;
      // выпрямиться
      leanZ = THREE.MathUtils.lerp(leanZ, 0, Math.min(1, dt * 8));
      group.rotation.x = leanZ;
      group.position.y = breath;
      head.position.y  = HEAD_Y;
    }
  }

  function setPosition(x, z) {
    group.position.x = x;
    group.position.z = z;
  }

  function getPosition() {
    return { x: group.position.x, z: group.position.z };
  }

  function setColor(c) {
    const col = new THREE.Color(c);
    bodyMat.color.copy(col);
    headMat.color.copy(col);
    haloMat.uniforms.col.value.copy(col);
  }

  function dispose() {
    scene.remove(group);
    bodyGeo.dispose(); bodyMat.dispose();
    headGeo.dispose(); headMat.dispose();
    coreGeo.dispose(); coreMat.dispose();
    halo.geometry.dispose(); haloMat.dispose();
  }

  // Спроецировать центр героя в координаты gl_FragCoord (origin bottom-left).
  // Используется halftone-шейдером для difference-поля.
  const _projVec = new THREE.Vector3();
  function getScreenPos(camera, w, h, yOffset = 0.4) {
    _projVec.copy(group.position);
    _projVec.y += yOffset;
    _projVec.project(camera);
    return {
      x: (_projVec.x + 1) * 0.5 * w,
      y: (_projVec.y + 1) * 0.5 * h,
    };
  }

  return { group, setPosition, getPosition, update, setColor, getScreenPos, dispose };
}

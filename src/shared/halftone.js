// Общий halftone post-processing pass для карты и всех игр.
// Конвертирует рендер сцены в сетку точек разного размера по яркости.
//
// Бонус: вокруг героя есть "difference field" — кольцевая зона, в которой
// цвета точек инвертируются (1.0 - col). Создаёт эффект негатива вокруг
// персонажа, выделяет его на фоне халфтона.
import * as THREE from "three";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";

const halftoneShader = {
  uniforms: {
    tDiffuse:    { value: null },
    resolution:  { value: new THREE.Vector2(1, 1) },
    gridSize:    { value: 6.0  }, // px на ячейку
    minRadius:   { value: 0.45 }, // baseline-точки
    maxRadius:   { value: 2.5  }, // максимум при яркой сцене
    boost:       { value: 1.6  }, // насколько раздуваем яркость до радиуса
    dimCol:      { value: new THREE.Color(0x14141c) },
    // difference-зона вокруг героя
    heroPos:     { value: new THREE.Vector2(-9999, -9999) },
    heroFieldR:  { value: 0.0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec2  resolution;
    uniform float gridSize;
    uniform float minRadius;
    uniform float maxRadius;
    uniform float boost;
    uniform vec3  dimCol;
    uniform vec2  heroPos;
    uniform float heroFieldR;
    varying vec2 vUv;

    void main() {
      vec2 px         = gl_FragCoord.xy;
      vec2 cellId     = floor(px / gridSize);
      vec2 cellCenter = (cellId + 0.5) * gridSize;
      vec2 cellUv     = cellCenter / resolution;

      vec3 col = texture2D(tDiffuse, cellUv).rgb;
      float lum = dot(col, vec3(0.299, 0.587, 0.114));
      lum = pow(lum, 0.65);
      lum = clamp(lum * boost, 0.0, 1.0);

      float r    = mix(minRadius, maxRadius, lum);
      float dist = length(px - cellCenter);
      float aa   = 0.6;
      float a    = 1.0 - smoothstep(r - aa, r + aa, dist);

      vec3 dotCol = mix(dimCol, col + vec3(0.10), smoothstep(0.05, 0.55, lum));

      // difference-поле вокруг героя — инвертируем цвет точки
      if (heroFieldR > 0.5) {
        float dh = length(px - heroPos);
        float fieldMask = 1.0 - smoothstep(heroFieldR * 0.55, heroFieldR, dh);
        // дополнительное расширение точки внутри поля — создаёт «дыхание»
        float fieldRadius = mix(r, r * 1.35, fieldMask);
        a = 1.0 - smoothstep(fieldRadius - aa, fieldRadius + aa, dist);
        // Прямая инверсия (1-col) верна для холодной монохромной палитры, но
        // насыщенный цвет она уводит по тону: розовая нода DLC становилась
        // зелёной. Для насыщенных пикселей инвертируем ЯРКОСТЬ, сохраняя тон;
        // для обесцвеченных (вся остальная сцена) поведение прежнее.
        float mx  = max(max(dotCol.r, dotCol.g), dotCol.b);
        float mn  = min(min(dotCol.r, dotCol.g), dotCol.b);
        float sat = (mx - mn) / max(mx, 0.001);
        float l   = dot(dotCol, vec3(0.299, 0.587, 0.114));
        vec3 invFull = vec3(1.0) - dotCol;
        vec3 invHue  = dotCol * ((1.0 - l) / max(l, 0.001));
        vec3 inv = mix(invFull, invHue, smoothstep(0.05, 0.28, sat));
        dotCol = mix(dotCol, inv, fieldMask);
      }

      gl_FragColor = vec4(dotCol * a, 1.0);
    }
  `,
};

export function createHalftonePass(width, height) {
  const pass = new ShaderPass(halftoneShader);
  pass.uniforms.resolution.value.set(width, height);
  return pass;
}

// Утилита: спроецировать 3D-точку в координаты gl_FragCoord (origin bottom-left).
export function projectToScreenPx(point3, camera, width, height, target) {
  target.copy(point3).project(camera);
  return new THREE.Vector2(
    (target.x + 1) * 0.5 * width,
    (target.y + 1) * 0.5 * height,  // gl_FragCoord: y вверх от низа
  );
}

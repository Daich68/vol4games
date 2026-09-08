import * as THREE from "three";
const HEIGHT = 3.4;
const FEATURES = [
  // [x,y,z] точка на единичной сфере, сила, радиус влияния.
  // Сила — в тех же долях роста, что и радиусы головы (~0.058), поэтому
  // значения ДОЛЖНЫ быть в разы меньше: нос силой 0.075 оказался бы больше
  // самой головы. Держим черты в пределах 5–20% радиуса.
  { at: [0.00,  0.18,  0.94], amp:  0.0055, r: 0.50 },  // надбровные дуги
  { at: [0.00, -0.04,  1.00], amp:  0.0115, r: 0.17 },  // спинка носа
  { at: [0.00, -0.13,  0.99], amp:  0.0060, r: 0.10 },  // кончик носа
  { at: [0.55, -0.16,  0.70], amp:  0.0050, r: 0.40 },  // скула правая
  { at: [-0.55,-0.16,  0.70], amp:  0.0050, r: 0.40 },  // скула левая
  { at: [0.00, -0.42,  0.93], amp:  0.0042, r: 0.22 },  // губы
  { at: [0.00, -0.76,  0.68], amp:  0.0060, r: 0.30 },  // подбородок
  { at: [0.36,  0.02,  0.90], amp: -0.0040, r: 0.20 },  // глазница правая
  { at: [-0.36, 0.02,  0.90], amp: -0.0040, r: 0.20 },  // глазница левая
  { at: [0.00,  0.50, -0.60], amp:  0.0075, r: 0.65 },  // затылок
];

export function buildHead({ rx = 0.058, ry = 0.072, rz = 0.062, seg = 28 } = {}) {
  const g = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.8));
  const pos = g.attributes.position;
  const uv = [];
  const v = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = v.clone().normalize();

    let disp = 0;
    for (const f of FEATURES) {
      const d = n.distanceTo(new THREE.Vector3(...f.at));
      if (d < f.r) {
        const k = 1 - d / f.r;              // мягкое спадание к краю влияния
        disp += f.amp * k * k * (3 - 2 * k);
      }
    }

    // сужение к подбородку: без него голова остаётся шаром
    const jaw = n.y < 0 ? 1 - Math.pow(-n.y, 1.7) * 0.42 : 1;
    const rxx = (rx * jaw + disp) * HEIGHT;
    const ryy = (ry + disp * 0.5) * HEIGHT;
    const rzz = (rz * (n.y < 0 ? jaw * 0.96 + 0.04 : 1) + disp) * HEIGHT;

    pos.setXYZ(i, n.x * rxx, n.y * ryy, n.z * rzz);
    // Плоская проекция спереди дала бы лицо и на затылке — оно бы дублировалось
    // зеркально. Поэтому атлас 2:1: фас в левой половине, затылок в правой,
    // где просто кожа. Шов приходится на силуэт и его закрывают волосы.
    const front = n.z > 0;
    const u = front ? (0.5 + n.x * 0.62) * 0.5 : 0.78;
    uv.push(u, 0.5 + n.y * 0.58);
  }
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

// глаз — отдельная сфера, чтобы был объём и блик, как в референсах
export function buildEye(r = 0.0125) {
  return new THREE.SphereGeometry(r * HEIGHT, 14, 10);
}

// ── ЛИЦО ТЕКСТУРОЙ ───────────────────────────────────────────────────────
// В играх этой эпохи лицо не моделировали — его рисовали. Это и удобно:
// мимика и макияж становятся сменой текстуры, а не геометрии, и ложатся
// точно, потому что рисуются в одних координатах.
//
// Атлас 2:1. Левая половина — фас, правая — кожа затылка.
export const EXPRESSIONS = ["happy", "sad", "worried", "grimace", "frozen"];

const SKIN = "#f4d3b8";

export function faceTexture({ expression = "happy", makeup = null,
                              skin = SKIN, size = 512 } = {}) {
  const cv = document.createElement("canvas");
  cv.width = size * 2; cv.height = size;
  const x = cv.getContext("2d");

  x.fillStyle = skin;
  x.fillRect(0, 0, cv.width, cv.height);

  // всё рисуем в системе левой половины: центр лица (S/2, S/2)
  const S = size, cx = S * 0.5, cy = S * 0.5;
  const eyeY = cy - S * 0.045, eyeDX = S * 0.21;
  const mouthY = cy + S * 0.26;

  // мягкая тень по краям лица — объём, которого нет в геометрии
  const vig = x.createRadialGradient(cx, cy, S * 0.16, cx, cy, S * 0.52);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(120,70,60,0.04)");
  x.fillStyle = vig; x.fillRect(0, 0, S, S);

  // румянец
  const blush = makeup && makeup.blush;
  for (const s of [-1, 1]) {
    const g = x.createRadialGradient(cx + s * S * 0.20, cy + S * 0.09, 2,
                                     cx + s * S * 0.20, cy + S * 0.09, S * 0.11);
    g.addColorStop(0, blush || "rgba(233,140,150,0.28)");
    g.addColorStop(1, "rgba(233,140,150,0)");
    x.fillStyle = g;
    x.fillRect(cx + s * S * 0.20 - S * 0.12, cy - S * 0.03, S * 0.24, S * 0.24);
  }

  // тени на веках — макияж
  if (makeup && makeup.shadow) {
    for (const s of [-1, 1]) {
      x.save();
      x.translate(cx + s * eyeDX, eyeY - S * 0.022);
      x.scale(1, 0.62);
      const g = x.createRadialGradient(0, 0, 2, 0, 0, S * 0.12);
      g.addColorStop(0, makeup.shadow);
      g.addColorStop(1, "rgba(0,0,0,0)");
      x.fillStyle = g;
      x.beginPath(); x.arc(0, 0, S * 0.12, 0, 7); x.fill();
      x.restore();
    }
  }

  // ── глаза ──
  const lash = (makeup && makeup.lash) || 1;
  // Раскрытие века. У гримасы оно САМОЕ большое: на обоих референсах Ланы
  // (бриф, стр. 5, «гримаса типа того») глаза широко раскрыты и пялятся,
  // белок виден вокруг радужки. Зажмуренный крест читался бы мультяшной
  // болью, а нужен неподвижный взгляд куклы.
  const shape = { happy: 1.0, sad: 0.72, worried: 1.12, grimace: 1.5, frozen: 1.05 }[expression] ?? 1;
  for (const s of [-1, 1]) {
    const ex = cx + s * eyeDX;
    // белок
    x.save(); x.translate(ex, eyeY); x.scale(1, shape * 0.72);
    x.fillStyle = "#fdfcfa";
    x.beginPath(); x.arc(0, 0, S * 0.083, 0, 7); x.fill();
    x.restore();
    // радужка и зрачок
    // Радужка у гримасы мельче и выше: белок, видимый вокруг и снизу, —
    // то самое, от чего лицо перестаёт быть живым.
    const grim = expression === "grimace";
    const irisR = S * 0.044 * (expression === "worried" ? 0.72 : grim ? 0.62 : 1);
    const irisY = eyeY + S * (grim ? -0.020 : 0.004);
    x.fillStyle = (makeup && makeup.iris) || "#6b4a3a";
    x.beginPath(); x.arc(ex, irisY, irisR, 0, 7); x.fill();
    x.fillStyle = "#241b20";
    x.beginPath(); x.arc(ex, irisY, irisR * 0.48, 0, 7); x.fill();
    x.fillStyle = "rgba(255,255,255,0.92)";
    x.beginPath(); x.arc(ex - irisR * 0.34, irisY - irisR * 0.36, irisR * 0.26, 0, 7); x.fill();
    // верхняя линия ресниц — по ней читается «кукольность»
    x.strokeStyle = "#2c2027"; x.lineWidth = S * 0.011 * lash; x.lineCap = "round";
    x.beginPath();
    x.ellipse(ex, eyeY, S * 0.083, S * 0.083 * shape * 0.72, 0, Math.PI * 1.06, Math.PI * 1.94);
    x.stroke();
    // сами ресницы наружу
    for (let k = 0; k < 3; k++) {
      const a = Math.PI * (1.15 + k * 0.22);
      const px = ex + Math.cos(a) * S * 0.083, py = eyeY + Math.sin(a) * S * 0.083 * shape * 0.72;
      x.beginPath(); x.moveTo(px, py);
      x.lineTo(px + s * S * 0.020 * lash, py - S * 0.016 * lash);
      x.lineWidth = S * 0.007 * lash; x.stroke();
    }
    // бровь
    x.strokeStyle = "#59413a"; x.lineWidth = S * 0.012; x.beginPath();
    const browY = eyeY - S * (grim ? 0.175 : 0.13) + (expression === "sad" ? S * 0.012 : 0);
    if (grim) { x.strokeStyle = "#2a1c22"; x.lineWidth = S * 0.015; }
    const tilt = expression === "sad" ? -S * 0.018 : expression === "worried" ? -S * 0.026 : 0;
    x.moveTo(ex - s * S * 0.078, browY - tilt * s * 0);
    x.quadraticCurveTo(ex, browY - S * (grim ? 0.040 : 0.016) + (tilt * -1), ex + s * S * 0.076, browY + (s === 1 ? 0 : 0) + (tilt ? -tilt : 0));
    x.stroke();
  }

  // ── нос ──
  x.strokeStyle = "rgba(150,100,88,0.45)"; x.lineWidth = S * 0.008; x.lineCap = "round";
  x.beginPath();
  x.moveTo(cx - S * 0.012, mouthY - S * 0.070);
  x.quadraticCurveTo(cx - S * 0.020, mouthY - S * 0.083, cx - S * 0.004, mouthY - S * 0.078);
  x.stroke();

  // ── губы ──
  const lipFill = (makeup && makeup.lip) || "#c9707a";
  const w = S * (expression === "frozen" ? 0.15 : expression === "grimace" ? 0.165 : 0.11) * ((makeup && makeup.lipWide) || 1);
  const h = S * (expression === "grimace" ? 0.075 : 0.026);
  const up = expression === "sad" ? -1 : 1;
  x.fillStyle = lipFill;
  x.beginPath();
  x.moveTo(cx - w, mouthY);
  x.quadraticCurveTo(cx, mouthY - h * 0.9 * up, cx + w, mouthY);
  x.quadraticCurveTo(cx, mouthY + h * 1.5 * up, cx - w, mouthY);
  x.fill();
  if (expression === "grimace") {                    // зубы
    x.fillStyle = "#f4f0ea";
    x.fillRect(cx - w * 0.78, mouthY - h * 0.1, w * 1.56, h * 0.5);
    x.strokeStyle = lipFill; x.lineWidth = S * 0.004;
    for (let k = -3; k <= 3; k++) {
      x.beginPath(); x.moveTo(cx + k * w * 0.22, mouthY - h * 0.1);
      x.lineTo(cx + k * w * 0.22, mouthY + h * 0.4); x.stroke();
    }
  } else {                                            // блик на губе
    x.fillStyle = "rgba(255,255,255,0.35)";
    x.beginPath(); x.ellipse(cx - w * 0.25, mouthY - h * 0.25, w * 0.22, h * 0.22, 0, 0, 7); x.fill();
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;      // без мипмапов — вид эпохи
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

// наборы макияжа из брифа: три «неправильных» и один гипертрофированный
export const MAKEUP = {
  mk_natural: { lip: "#d08a86", shadow: "rgba(200,160,140,0.35)", lash: 1.0 },
  mk_nude:    { lip: "#cfa48c", shadow: "rgba(210,180,160,0.25)", lash: 0.9 },
  mk_evening: { lip: "#8e2740", shadow: "rgba(80,60,80,0.75)", lash: 1.4 },
  mk_hyper:   { lip: "#ff2e86", shadow: "rgba(255,95,176,0.85)", lash: 2.4,
                blush: "rgba(255,120,190,0.55)", lipWide: 1.45 },
};

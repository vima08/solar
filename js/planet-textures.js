import * as THREE from "three";

const WIDTH = 1024;
const HEIGHT = 512;

function canvasTexture(draw) {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext("2d");
  draw(context);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function fill(context, color) {
  context.fillStyle = color;
  context.fillRect(0, 0, WIDTH, HEIGHT);
}

function seededRandom(seed) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function speckles(context, seed, colors, count, maxRadius = 12) {
  const random = seededRandom(seed);
  for (let index = 0; index < count; index += 1) {
    context.globalAlpha = 0.15 + random() * 0.35;
    context.fillStyle = colors[Math.floor(random() * colors.length)];
    context.beginPath();
    context.arc(
      random() * WIDTH,
      random() * HEIGHT,
      1 + random() * maxRadius,
      0,
      Math.PI * 2,
    );
    context.fill();
  }
  context.globalAlpha = 1;
}

function rockyTexture(base, colors, seed) {
  return canvasTexture((context) => {
    fill(context, base);
    speckles(context, seed, colors, 420, 18);
    speckles(context, seed + 1, ["#17120f"], 55, 7);
  });
}

function bandedTexture(base, bands, spot = null) {
  return canvasTexture((context) => {
    fill(context, base);
    bands.forEach(([y, height, color]) => {
      context.fillStyle = color;
      context.fillRect(0, y, WIDTH, height);
    });

    const random = seededRandom(81);
    context.globalAlpha = 0.2;
    for (let index = 0; index < 90; index += 1) {
      context.strokeStyle = index % 2 ? "#fff4d6" : "#4c3027";
      context.lineWidth = 2 + random() * 7;
      const y = random() * HEIGHT;
      context.beginPath();
      context.moveTo(0, y);
      for (let x = 0; x <= WIDTH; x += 80) {
        context.lineTo(x, y + Math.sin(x * 0.025 + random() * 4) * 7);
      }
      context.stroke();
    }
    context.globalAlpha = 1;

    if (spot) {
      context.save();
      context.translate(spot.x, spot.y);
      context.scale(1.85, 0.72);
      const gradient = context.createRadialGradient(-8, -5, 6, 0, 0, 55);
      gradient.addColorStop(0, "#f1a06f");
      gradient.addColorStop(0.55, "#b54f36");
      gradient.addColorStop(1, "#713329");
      context.fillStyle = gradient;
      context.beginPath();
      context.arc(0, 0, 55, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = "rgba(255, 210, 163, .65)";
      context.lineWidth = 7;
      context.beginPath();
      context.arc(-3, 0, 38, 0.2, Math.PI * 1.85);
      context.stroke();
      context.restore();
    }
  });
}

function earthTexture() {
  return canvasTexture((context) => {
    const ocean = context.createLinearGradient(0, 0, 0, HEIGHT);
    ocean.addColorStop(0, "#174c91");
    ocean.addColorStop(0.5, "#167ac1");
    ocean.addColorStop(1, "#123f78");
    context.fillStyle = ocean;
    context.fillRect(0, 0, WIDTH, HEIGHT);

    const continents = [
      [[90, 110], [160, 75], [235, 100], [260, 160], [225, 205], [190, 190], [155, 235], [105, 200], [75, 145]],
      [[225, 225], [275, 245], [300, 315], [270, 410], [235, 370], [210, 285]],
      [[490, 105], [575, 70], [690, 95], [770, 135], [820, 185], [760, 225], [680, 205], [625, 245], [555, 205], [505, 160]],
      [[545, 210], [625, 220], [660, 290], [620, 385], [570, 350], [535, 275]],
      [[815, 330], [890, 310], [930, 360], [900, 410], [830, 400]],
    ];
    continents.forEach((points) => {
      context.beginPath();
      points.forEach(([x, y], index) =>
        index ? context.lineTo(x, y) : context.moveTo(x, y),
      );
      context.closePath();
      context.fillStyle = "#4e9a4a";
      context.fill();
      context.strokeStyle = "#b5aa65";
      context.lineWidth = 7;
      context.stroke();
    });
    speckles(context, 42, ["#245d31", "#b1a45e"], 150, 8);

    context.globalAlpha = 0.55;
    context.strokeStyle = "#ffffff";
    context.lineWidth = 10;
    for (let y = 55; y < HEIGHT; y += 115) {
      context.beginPath();
      context.moveTo(0, y);
      for (let x = 0; x <= WIDTH; x += 70) {
        context.lineTo(x, y + Math.sin(x * 0.018 + y) * 10);
      }
      context.stroke();
    }
    context.globalAlpha = 1;
  });
}

const textureFactories = {
  mercury: () => rockyTexture("#8b8983", ["#c2bbb0", "#5f5c58"], 1),
  venus: () => bandedTexture("#c9893d", [[80, 35, "#f0c778"], [210, 48, "#9e632f"], [370, 32, "#edb862"]]),
  earth: earthTexture,
  mars: () => rockyTexture("#a8452d", ["#dd7950", "#68291f", "#c39a72"], 4),
  jupiter: () => bandedTexture("#d2a477", [[55, 30, "#f0ddbd"], [115, 48, "#9f624b"], [205, 22, "#f4e5c7"], [275, 55, "#b77654"], [385, 28, "#efe0c2"]], { x: 720, y: 326 }),
  saturn: () => bandedTexture("#d9c98f", [[105, 22, "#a99867"], [190, 14, "#f0e2ac"], [315, 28, "#b7a46f"]]),
  uranus: () => bandedTexture("#72cbd2", [[175, 12, "#a8e5e4"], [350, 10, "#58adb8"]]),
  neptune: () => bandedTexture("#3159bc", [[120, 20, "#567bd2"], [335, 14, "#9ab5ef"]]),
};

const textures = new Map();

export function getPlanetTexture(id) {
  if (!textures.has(id)) {
    textures.set(id, textureFactories[id]?.() ?? null);
  }
  return textures.get(id);
}

import * as THREE from "three";

import { STAR_COUNT, STAR_FIELD_RADIUS } from "../core/constants.js";

/*
    Генерирует красивое звездное небо.

    Используется несколько цветов звезд,
    разные размеры,
    небольшая концентрация возле плоскости
    Млечного Пути.
*/

export function createStars() {
  const group = new THREE.Group();

  //----------------------------------------------------
  // Основное звездное поле
  //----------------------------------------------------

  const geometry = new THREE.BufferGeometry();

  const positions = [];
  const colors = [];
  const sizes = [];
  const phases = [];
  const speeds = [];

  const colorChoices = [
    new THREE.Color(0xffffff), // белые

    new THREE.Color(0xfff4d6), // желтые

    new THREE.Color(0xcfe8ff), // голубые

    new THREE.Color(0xffd0d0), // красные

    new THREE.Color(0xdde6ff), // холодные белые
  ];

  for (let i = 0; i < STAR_COUNT; i++) {
    // равномерное распределение внутри сферы

    const radius = STAR_FIELD_RADIUS * Math.cbrt(Math.random());

    const theta = Math.random() * Math.PI * 2;

    const phi = Math.acos(2 * Math.random() - 1);

    let x = radius * Math.sin(phi) * Math.cos(theta);

    let y = radius * Math.cos(phi);

    let z = radius * Math.sin(phi) * Math.sin(theta);

    //------------------------------------------------
    // Формируем Млечный Путь:
    // часть звезд притягиваем к плоскости XZ
    //------------------------------------------------

    if (Math.random() < 0.45) {
      y *= 0.15;
    }

    positions.push(x, y, z);

    const color = colorChoices[Math.floor(Math.random() * colorChoices.length)];

    colors.push(color.r, color.g, color.b);

    sizes.push(0.6 + Math.random() * 2.2);
    phases.push(Math.random() * Math.PI * 2);
    speeds.push(0.35 + Math.random() * 1.25);
  }

  geometry.setAttribute(
    "position",

    new THREE.Float32BufferAttribute(positions, 3),
  );

  geometry.setAttribute("phase", new THREE.Float32BufferAttribute(phases, 1));
  geometry.setAttribute("speed", new THREE.Float32BufferAttribute(speeds, 1));

  geometry.setAttribute(
    "color",

    new THREE.Float32BufferAttribute(colors, 3),
  );

  geometry.setAttribute(
    "size",

    new THREE.Float32BufferAttribute(sizes, 1),
  );

  //----------------------------------------------------
  // Материал со своим шейдером
  //----------------------------------------------------

  const material = new THREE.ShaderMaterial({
    vertexColors: true,

    transparent: true,

    depthWrite: false,

    blending: THREE.AdditiveBlending,

    uniforms: {
      time: { value: 0 },
    },

    vertexShader: `

attribute float size;
attribute float phase;
attribute float speed;

varying vec3 vColor;

uniform float time;

void main(){

    vColor = color;

    vec4 mvPosition =
        modelViewMatrix *
        vec4(position,1.0);

    float pulse =
        sin(time * speed + phase);

    gl_PointSize =
        size *
        (1.0 + pulse*0.25);

    gl_PointSize *=
        (300.0 / -mvPosition.z);

    gl_Position =
        projectionMatrix *
        mvPosition;

}

`,

    fragmentShader: `

varying vec3 vColor;

void main(){

    vec2 uv =
        gl_PointCoord - 0.5;

    float d =
        length(uv);

    float alpha =
        smoothstep(
            0.5,
            0.0,
            d
        );

    alpha *= alpha;

    gl_FragColor =
        vec4(vColor, alpha);

}

`,
  });

  const stars = new THREE.Points(geometry, material);

  group.add(stars);

  //----------------------------------------------------
  // Несколько сверхярких звезд
  //----------------------------------------------------

  const brightGeometry = new THREE.BufferGeometry();

  const brightPositions = [];

  for (let i = 0; i < 140; i++) {
    const r = STAR_FIELD_RADIUS * (0.4 + Math.random() * 0.6);

    const theta = Math.random() * Math.PI * 2;

    const phi = Math.acos(2 * Math.random() - 1);

    brightPositions.push(
      r * Math.sin(phi) * Math.cos(theta),

      r * Math.cos(phi),

      r * Math.sin(phi) * Math.sin(theta),
    );
  }

  brightGeometry.setAttribute(
    "position",

    new THREE.Float32BufferAttribute(
      brightPositions,

      3,
    ),
  );

  const brightMaterial = new THREE.PointsMaterial({
    color: 0xffffff,

    size: 7,

    transparent: true,

    opacity: 0.9,

    blending: THREE.AdditiveBlending,

    depthWrite: false,
  });

  group.add(
    new THREE.Points(
      brightGeometry,

      brightMaterial,
    ),
  );

  //----------------------------------------------------
  // Метод обновления
  //----------------------------------------------------

  group.update = function (time) {
    material.uniforms.time.value = time.elapsed;

    stars.rotation.y = time.elapsed * 0.003;
  };

  return group;
}

export const PLANET_RADIUS_SCALE = 0.7;
export const ORBIT_SCALE = 1;
export const SYSTEM_SCALE = 10;
export const COMET_ORBIT_X = 86 * SYSTEM_SCALE;
export const COMET_ORBIT_Z = 49 * SYSTEM_SCALE;
export const ORBIT_SPEED_SCALE = 0.12;
export const ROTATION_SPEED_SCALE = 1;

export const CAMERA_FOV = 45;
export const CAMERA_NEAR = 0.1;
export const CAMERA_FAR = 10000;
export const CAMERA_START = { x: 0, y: 68, z: 118 };

export const SUN_RADIUS = 5;
export const STAR_COUNT = 5000;
export const STAR_FIELD_RADIUS = 1800;
export const DEFAULT_TIME_SCALE = 1;
export const COLORS = { orbit: 0x52709a, uiBlue: 0x66ccff, sunLight: 0xffffff };

export const PLANETS = [
  {
    id: "mercury",
    name: "Меркурий",
    radius: 0.75,
    distance: 10 * SYSTEM_SCALE,
    color: 0xa9a9a9,
    orbitSpeed: 1.6,
    rotationSpeed: 0.25,
    description:
      "Самая маленькая и быстрая планета. Год здесь длится всего 88 земных дней!",
    fact: "Днём жарче духовки, а ночью — ледяной холод.",
  },
  {
    id: "venus",
    name: "Венера",
    radius: 1.15,
    distance: 15 * SYSTEM_SCALE,
    color: 0xe6bd72,
    orbitSpeed: 1.2,
    rotationSpeed: -0.08,
    description: "Яркая соседка Земли, укутанная плотными облаками.",
    fact: "Венера вращается в сторону, обратную большинству планет.",
  },
  {
    id: "earth",
    name: "Земля",
    radius: 1.25,
    distance: 21 * SYSTEM_SCALE,
    color: 0x3d83e8,
    orbitSpeed: 1,
    rotationSpeed: 1.2,
    atmosphere: true,
    moons: [
      {
        name: "Луна",
        radius: 0.34,
        distance: 2.4 * SYSTEM_SCALE,
        speed: 2.2,
        color: 0xbfc4cc,
      },
    ],
    description: "Наш голубой дом — единственная известная планета с жизнью.",
    fact: "Океаны покрывают около 71% поверхности Земли.",
  },
  {
    id: "mars",
    name: "Марс",
    radius: 0.95,
    distance: 28 * SYSTEM_SCALE,
    color: 0xc85d3c,
    orbitSpeed: 0.8,
    rotationSpeed: 1.1,
    description: "Красная планета с гигантскими вулканами и древними долинами.",
    fact: "Гора Олимп почти втрое выше Эвереста.",
  },
  {
    id: "jupiter",
    name: "Юпитер",
    radius: 3.3,
    distance: 40 * SYSTEM_SCALE,
    color: 0xd7b28a,
    orbitSpeed: 0.43,
    rotationSpeed: 2.1,
    moons: [
      { 
        name: "Ио",
        radius: 0.28,
        distance: 4.3 * SYSTEM_SCALE,
        speed: 2.6,
        color: 0xe4c26e
      },
      {
        name: "Европа",
        radius: 0.24,
        distance: 5.1 * SYSTEM_SCALE,
        speed: 2,
        color: 0xc7b99c,
      },
      {
        name: "Ганимед",
        radius: 0.36,
        distance: 6.0 * SYSTEM_SCALE,
        speed: 1.5,
        color: 0x91857a,
      },
    ],
    description: "Газовый гигант и самая большая планета Солнечной системы.",
    fact: "В Большом красном пятне бушует шторм размером с Землю.",
  },
  {
    id: "saturn",
    name: "Сатурн",
    radius: 2.8,
    distance: 53 * SYSTEM_SCALE,
    color: 0xe5cf8d,
    orbitSpeed: 0.32,
    rotationSpeed: 1.8,
    rings: true,
    moons: [
      {
        name: "Титан",
        radius: 0.34,
        distance: 5.1 * SYSTEM_SCALE,
        speed: 1.2,
        color: 0xd6a855,
      },
    ],
    description: "Лёгкий газовый гигант со знаменитой системой колец.",
    fact: "Кольца состоят из миллиардов кусочков льда и камня.",
  },
  {
    id: "uranus",
    name: "Уран",
    radius: 2,
    distance: 65 * SYSTEM_SCALE,
    color: 0x7ad5df,
    orbitSpeed: 0.23,
    rotationSpeed: -1.25,
    description:
      "Ледяной гигант, который словно катится по своей орбите на боку.",
    fact: "Ось Урана наклонена почти на 98 градусов.",
  },
  {
    id: "neptune",
    name: "Нептун",
    radius: 1.95,
    distance: 77 * SYSTEM_SCALE,
    color: 0x4169d8,
    orbitSpeed: 0.18,
    rotationSpeed: 1.3,
    description: "Далёкий синий мир с самыми быстрыми ветрами среди планет.",
    fact: "Ветер здесь разгоняется быстрее 2 000 км/ч.",
  },
];

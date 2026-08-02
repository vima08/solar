// ==============================
// constants.js
// Общие настройки приложения
// ==============================

// ---------- Масштабы ----------

// Радиусы планет будут умножаться на этот коэффициент
export const PLANET_RADIUS_SCALE = 0.45;

// Радиусы орбит
export const ORBIT_SCALE = 4.5;

// Скорость движения по орбитам
export const ORBIT_SPEED_SCALE = 0.25;

// Скорость собственного вращения
export const ROTATION_SPEED_SCALE = 1.0;

// ---------- Камера ----------

export const CAMERA_FOV = 45;
export const CAMERA_NEAR = 0.1;
export const CAMERA_FAR = 10000;

export const CAMERA_START = {
    x: 0,
    y: 80,
    z: 210
};

// ---------- Солнце ----------

export const SUN_RADIUS = 5;

export const SUN_LIGHT_INTENSITY = 3.8;

// ---------- Космос ----------

export const STAR_COUNT = 7000;

export const STAR_FIELD_RADIUS = 4500;

export const NEBULA_COUNT = 24;

// ---------- Время ----------

export const DEFAULT_TIME_SCALE = 1;

// ---------- Цвета ----------

export const COLORS = {

    orbit: 0x334455,

    uiBlue: 0x66ccff,

    sunLight: 0xffffff

};

// ---------- Планеты ----------

export const PLANETS = [

    {

        name:"Mercury",

        radius:0.7,

        distance:12,

        color:0x888888,

        orbitSpeed:1.6

    },

    {

        name:"Venus",

        radius:1.1,

        distance:18,

        color:0xd7b56d,

        orbitSpeed:1.2

    },

    {

        name:"Earth",

        radius:1.2,

        distance:26,

        color:0x3f7fff,

        orbitSpeed:1.0

    },

    {

        name:"Mars",

        radius:0.9,

        distance:34,

        color:0xcc5533,

        orbitSpeed:0.8

    },

    {

        name:"Mars2",

        radius:2,

        distance:84,

        color:0x3f7fff,

        orbitSpeed:0.3

    }

];
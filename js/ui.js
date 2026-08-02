import {
    togglePause,
    setTimeScale
} from "./time.js";

const pauseBtn = document.getElementById("pauseBtn");
const slowBtn = document.getElementById("slowBtn");
const normalBtn = document.getElementById("normalBtn");
const fastBtn = document.getElementById("fastBtn");

export function initUI() {

    pauseBtn.addEventListener("click", () => {
        togglePause();
    });

    slowBtn.addEventListener("click", () => {
        setTimeScale(0.2);
    });

    normalBtn.addEventListener("click", () => {
        setTimeScale(1);
    });

    fastBtn.addEventListener("click", () => {
        setTimeScale(10);
    });

}
const state = { elapsed: 0, delta: 0, scale: 0.2, paused: false };

export function updateTime(realDelta) {
  state.delta = realDelta;
  if (!state.paused) state.elapsed += realDelta * state.scale;
}

export function getTime() {
  return state;
}
export function pause() {
  state.paused = true;
}
export function resume() {
  state.paused = false;
}
export function togglePause() {
  state.paused = !state.paused;
}
export function setTimeScale(scale) {
  state.scale = scale;
}

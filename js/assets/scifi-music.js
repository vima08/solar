// Original 16-bar space synth theme at 96 BPM: melody, arpeggio, bass and soft drums.
const EIGHTH = 60 / 96 / 2;
const CHORDS = [[52, 55, 59, 66], [48, 52, 55, 62], [43, 50, 55, 59], [50, 54, 57, 64]];
const PHRASES = [
  [76, null, 79, 83, 81, null, 79, 78, 76, null, 74, 78, 79, null, 78, 74],
  [76, null, 79, 84, 83, null, 79, 76, 74, 76, 79, null, 78, null, 74, null],
  [79, null, 83, 86, 83, null, 81, 79, 78, null, 76, 74, 76, null, 79, null],
  [78, null, 81, 86, 84, null, 81, 78, 76, 78, 74, null, 71, null, 74, null],
];

export function createScifiMusic(context, destination) {
  const tone = context.createBiquadFilter();
  tone.type = "lowpass";
  tone.frequency.value = 2800;
  tone.Q.value = 0.5;
  tone.connect(destination);

  const echo = context.createDelay(1);
  echo.delayTime.value = EIGHTH * 1.5;
  const feedback = context.createGain();
  feedback.gain.value = 0.24;
  const echoLevel = context.createGain();
  echoLevel.gain.value = 0.25;
  echo.connect(feedback).connect(echo);
  echo.connect(echoLevel).connect(tone);

  const noise = context.createBuffer(1, Math.ceil(context.sampleRate * 0.15), context.sampleRate);
  const noiseData = noise.getChannelData(0);
  for (let i = 0; i < noiseData.length; i += 1) noiseData[i] = Math.random() * 2 - 1;

  function note(midi, when, duration, level, type = "triangle", pan = 0, delayed = false) {
    const oscillator = context.createOscillator();
    oscillator.type = type;
    oscillator.frequency.value = 440 * 2 ** ((midi - 69) / 12);
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0, when);
    envelope.gain.linearRampToValueAtTime(level, when + 0.018);
    envelope.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    const stereo = context.createStereoPanner();
    stereo.pan.value = pan;
    oscillator.connect(envelope).connect(stereo).connect(tone);
    if (delayed) stereo.connect(echo);
    oscillator.start(when);
    oscillator.stop(when + duration + 0.02);
    oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); stereo.disconnect(); };
  }

  function percussion(when, snare) {
    const source = context.createBufferSource();
    source.buffer = noise;
    const filter = context.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = snare ? 1500 : 7000;
    const gain = context.createGain();
    gain.gain.setValueAtTime(snare ? 0.055 : 0.025, when);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + (snare ? 0.12 : 0.045));
    source.connect(filter).connect(gain).connect(tone);
    source.start(when);
    source.stop(when + 0.15);
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
  }

  function kick(when) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.setValueAtTime(110, when);
    oscillator.frequency.exponentialRampToValueAtTime(42, when + 0.16);
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(0.2, when + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.23);
    oscillator.connect(gain).connect(tone);
    oscillator.start(when);
    oscillator.stop(when + 0.25);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }

  function playStep(step, when) {
    const bar = Math.floor(step / 8) % 16;
    const beat = step % 8;
    const chord = CHORDS[Math.floor(bar / 2) % CHORDS.length];
    const melody = PHRASES[Math.floor(bar / 2) % PHRASES.length][step % 16];
    if (melody !== null) {
      const duration = (step % 16 === 14 ? 2.4 : 1.5) * EIGHTH;
      note(melody, when, duration, 0.2, "triangle", 0.12, true);
      note(melody + 12, when, duration * 0.65, 0.025, "sine", -0.12, true);
    }
    const arp = chord[[0, 2, 1, 3, 2, 1, 3, 2][beat]] + 12;
    note(arp, when, EIGHTH * 0.8, bar < 8 ? 0.035 : 0.055, "sine", beat % 2 ? -0.45 : 0.45, true);
    if ([0, 3, 4, 7].includes(beat)) note(chord[0] - 12, when, EIGHTH * 1.6, 0.15, "sine");
    if (beat === 0) chord.forEach((midi, index) => note(midi, when, EIGHTH * 7, 0.025, "triangle", (index - 1.5) * 0.25));
    if (beat === 0 || beat === 4) kick(when);
    if (beat === 2 || beat === 6) percussion(when, true);
    if (beat % 2 || bar >= 8) percussion(when, false);
  }

  let step = 0;
  let next = context.currentTime + 0.05;
  function schedule() {
    // Skip stale notes after a throttled tab instead of playing a burst of catch-up notes.
    if (next < context.currentTime) {
      const skipped = Math.ceil((context.currentTime - next) / EIGHTH);
      next += skipped * EIGHTH;
      step += skipped;
    }
    while (next < context.currentTime + 0.15) {
      playStep(step, next);
      step += 1;
      next += EIGHTH;
    }
  }
  schedule();
  let timer = setInterval(schedule, 25);
  addEventListener("pagehide", () => { clearInterval(timer); timer = null; });
  addEventListener("pageshow", () => {
    if (timer !== null) return;
    next = context.currentTime + 0.05;
    timer = setInterval(schedule, 25);
  });
}

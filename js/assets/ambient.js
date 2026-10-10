// Slow, overlapping sine pads. No short repeating sample or sharp transients.
export function createAmbient(context, destination) {
  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 900;
  filter.Q.value = 0.3;
  const reverb = context.createConvolver();
  const impulse = context.createBuffer(2, context.sampleRate * 3, context.sampleRate);
  for (let channel = 0; channel < 2; channel += 1) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 3) * 0.25;
    }
  }
  reverb.buffer = impulse;
  const wet = context.createGain();
  wet.gain.value = 0.3;
  filter.connect(destination);
  filter.connect(reverb).connect(wet).connect(destination);
  const chords = [[48, 55, 59, 64], [45, 52, 55, 60], [41, 48, 52, 57], [43, 50, 57, 62]];
  let chord = 0;
  let next = context.currentTime;
  function schedule() {
    while (next < context.currentTime + 2) {
      chords[chord % chords.length].forEach((note, index) => {
        const voice = context.createOscillator();
        voice.type = "sine";
        voice.frequency.value = 440 * 2 ** ((note - 69) / 12);
        voice.detune.value = index % 2 ? 3 : -3;
        const envelope = context.createGain();
        envelope.gain.setValueAtTime(0, next);
        envelope.gain.linearRampToValueAtTime(0.12, next + 5);
        envelope.gain.linearRampToValueAtTime(0.08, next + 11);
        envelope.gain.linearRampToValueAtTime(0, next + 19);
        voice.connect(envelope).connect(filter);
        voice.start(next);
        voice.stop(next + 20);
        voice.onended = () => { voice.disconnect(); envelope.disconnect(); };
      });
      next += 14;
      chord += 1;
    }
  }
  schedule();
  const timer = setInterval(schedule, 1000);
  addEventListener("pagehide", () => clearInterval(timer), { once: true });
}

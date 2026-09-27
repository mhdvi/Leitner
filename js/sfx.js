// Sound effects synthesized with the Web Audio API — no audio files to download,
// so they work offline and stay tiny. Every sound is short, soft and pitched to
// sit together in one key (C major / pentatonic).

import { settings } from './store.js';

let ctx = null;
let master = null;
let reverb = null;

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 3;
    master.connect(comp).connect(ctx.destination);
    reverb = makeReverb();
  }
  if (ctx.state === 'suspended') ctx.resume();
  master.gain.value = settings().volume * 0.9;
  return ctx;
}

// Call from a user gesture so later sounds are allowed to play (iOS/Safari).
export function unlock() {
  const c = audio();
  if (!c) return;
  const b = c.createBuffer(1, 1, 22050);
  const s = c.createBufferSource();
  s.buffer = b;
  s.connect(master);
  s.start(0);
}

function makeReverb() {
  const len = Math.floor(ctx.sampleRate * 1.4);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
  }
  const conv = ctx.createConvolver();
  conv.buffer = buf;
  const wet = ctx.createGain();
  wet.gain.value = 0.22;
  conv.connect(wet).connect(master);
  return conv;
}

function tone(freq, { type = 'sine', at = 0, attack = 0.005, decay = 0.25, gain = 0.3, glide = 0, wet = true, detune = 0 } = {}) {
  const c = ctx;
  const t = c.currentTime + at;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  osc.detune.value = detune;
  if (glide) osc.frequency.exponentialRampToValueAtTime(freq * glide, t + decay);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  osc.connect(g).connect(master);
  if (wet && reverb) g.connect(reverb);
  osc.start(t);
  osc.stop(t + attack + decay + 0.05);
}

function noise({ at = 0, dur = 0.25, from = 400, to = 3000, q = 1.2, gain = 0.12 } = {}) {
  const c = ctx;
  const t = c.currentTime + at;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = q;
  f.frequency.setValueAtTime(from, t);
  f.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + dur * 0.4);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t);
}

function play(fn) {
  if (!settings().sfx) return;
  if (!audio()) return;
  try {
    fn();
  } catch (e) {
    /* audio is decorative; never let it break the app */
  }
}

const N = { C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880, C6: 1046.5, D6: 1174.66, E6: 1318.5, G6: 1567.98, A6: 1760, C7: 2093 };
const LAND = [N.C5, N.D5, N.E5, N.G5, N.A5, N.C6];

export const sfx = {
  tap: () => play(() => tone(1400, { type: 'sine', decay: 0.04, gain: 0.08, wet: false, glide: 0.7 })),
  select: () => play(() => tone(900, { type: 'triangle', decay: 0.06, gain: 0.1, wet: false })),
  whoosh: () => play(() => noise({ dur: 0.28, from: 300, to: 2400, gain: 0.05 })),
  correct: () =>
    play(() => {
      tone(N.E6, { type: 'triangle', decay: 0.18, gain: 0.22 });
      tone(N.A6, { type: 'triangle', at: 0.075, decay: 0.35, gain: 0.2 });
      tone(N.E6 * 2, { type: 'sine', at: 0.075, decay: 0.3, gain: 0.04 });
    }),
  wrong: () =>
    play(() => {
      tone(196, { type: 'triangle', decay: 0.22, gain: 0.3, glide: 0.8, wet: false });
      tone(185, { type: 'sine', at: 0.1, decay: 0.3, gain: 0.25, glide: 0.75 });
    }),
  timeout: () =>
    play(() => {
      tone(330, { type: 'triangle', decay: 0.16, gain: 0.2, wet: false });
      tone(247, { type: 'triangle', at: 0.14, decay: 0.34, gain: 0.22, glide: 0.9 });
    }),
  tick: (urgent) => play(() => tone(urgent ? 2000 : 1600, { type: 'sine', decay: 0.03, gain: urgent ? 0.1 : 0.06, wet: false })),
  start: () =>
    play(() => {
      [N.C5, N.E5, N.G5].forEach((f, i) => tone(f, { type: 'triangle', at: i * 0.06, decay: 0.3, gain: 0.14 }));
      noise({ dur: 0.4, from: 500, to: 5000, gain: 0.03 });
    }),
  land: (box, up) =>
    play(() => {
      const f = LAND[box] || N.C5;
      tone(up ? f * 2 : f, { type: 'sine', decay: 0.16, gain: 0.12 });
      tone(up ? f * 4 : f * 2, { type: 'sine', decay: 0.08, gain: 0.03 });
    }),
  complete: () =>
    play(() => {
      [N.C5, N.E5, N.G5, N.C6, N.E6, N.G6].forEach((f, i) => tone(f, { type: 'triangle', at: i * 0.07, decay: 0.5, gain: 0.13 }));
      tone(N.C7, { type: 'sine', at: 0.45, decay: 1.1, gain: 0.05 });
    }),
  toggle: (on) => play(() => tone(on ? 1200 : 800, { type: 'sine', decay: 0.05, gain: 0.08, wet: false, glide: on ? 1.3 : 0.75 })),
};

'use client';

import { settingsStore } from './settings';

/**
 * Terminal sounds, synthesised with the Web Audio API (no files). The context is created on the
 * first user gesture (autoplay policy); a sound requested before that is simply skipped.
 */
export type SoundKind = 'open' | 'close' | 'alert';

let ctx: AudioContext | null = null;
let primed = false;

function ensure(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** Call once: resumes / creates the context on the first pointer or key event. */
export function primeAudio() {
  if (primed || typeof window === 'undefined') return;
  primed = true;
  const wake = () => {
    ensure();
    window.removeEventListener('pointerdown', wake);
    window.removeEventListener('keydown', wake);
  };
  window.addEventListener('pointerdown', wake);
  window.addEventListener('keydown', wake);
}

function tone(c: AudioContext, freq: number, at: number, dur: number, gain = 0.18, type: OscillatorType = 'sine') {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, at);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(c.destination);
  o.start(at);
  o.stop(at + dur + 0.02);
}

/** Two-tone chimes (~250 ms): open rises, close falls, alert is a quick triple. Muted by the bell menu toggle. */
export function playSound(kind: SoundKind) {
  if (!settingsStore.get().sounds) return;
  const c = ensure();
  if (!c || c.state !== 'running') {
    console.info(`[sound] ${kind} (audio not unlocked yet)`);
    return;
  }
  const t = c.currentTime + 0.01;
  if (kind === 'open') {
    tone(c, 659.25, t, 0.13);
    tone(c, 987.77, t + 0.12, 0.15);
  } else if (kind === 'close') {
    tone(c, 987.77, t, 0.13);
    tone(c, 659.25, t + 0.12, 0.15);
  } else {
    tone(c, 1046.5, t, 0.08, 0.16, 'triangle');
    tone(c, 1046.5, t + 0.1, 0.08, 0.16, 'triangle');
    tone(c, 1318.5, t + 0.2, 0.12, 0.16, 'triangle');
  }
  console.info(`[sound] ${kind}`);
}

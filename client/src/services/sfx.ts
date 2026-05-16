import { getEffectiveVolume } from './audio';

// Synthesized SFX — no asset files, no deps. Each effect is a short envelope
// (oscillator + gain ramp). Tone params are grouped by family with a WHY note
// so the set stays recognizable by ear without being harsh.
type Tone = {
  type: OscillatorType;
  freq: number;
  // Optional linear glide to `endFreq` over the note duration (sweeps/zaps).
  endFreq?: number;
  duration: number;
  // Peak gain BEFORE the global volume scale (kept well under 1 to avoid clipping).
  peak: number;
  // Start offset so a small set of tones reads as a melody, not a chord.
  delay?: number;
};

export type SfxName =
  | 'cardPlay'
  | 'cardDraw'
  | 'skip'
  | 'reverse'
  | 'drawTwo'
  | 'drawFour'
  | 'unoCall'
  | 'unoPenalty'
  | 'win'
  | 'uiClick';

// WHY family choices:
// - Neutral game actions (cardPlay/cardDraw/uiClick): single soft blip, low
//   peak, triangle/sine — frequent, so they must stay unobtrusive.
// - Directional specials (skip/reverse): short pitch glide whose direction
//   mirrors the meaning (skip = down "denied", reverse = up "flip").
// - Penalty specials (drawTwo/drawFour): descending two-note motif, +4 lower
//   and longer to feel "heavier" than +2.
// - UNO call: bright rising two-note flourish (positive). Penalty: dissonant
//   low buzz (negative). Win: ascending arpeggio (celebratory, still ≤300ms).
const TONES: Record<SfxName, Tone[]> = {
  cardPlay: [{ type: 'triangle', freq: 520, duration: 0.1, peak: 0.5 }],
  cardDraw: [{ type: 'sine', freq: 300, endFreq: 360, duration: 0.12, peak: 0.45 }],
  uiClick: [{ type: 'square', freq: 440, duration: 0.05, peak: 0.3 }],
  skip: [{ type: 'sawtooth', freq: 600, endFreq: 200, duration: 0.18, peak: 0.45 }],
  reverse: [{ type: 'sawtooth', freq: 280, endFreq: 660, duration: 0.18, peak: 0.45 }],
  drawTwo: [
    { type: 'square', freq: 360, duration: 0.1, peak: 0.42 },
    { type: 'square', freq: 240, duration: 0.14, peak: 0.42, delay: 0.1 },
  ],
  drawFour: [
    { type: 'square', freq: 260, duration: 0.12, peak: 0.45 },
    { type: 'square', freq: 150, duration: 0.2, peak: 0.45, delay: 0.12 },
  ],
  unoCall: [
    { type: 'triangle', freq: 660, duration: 0.1, peak: 0.5 },
    { type: 'triangle', freq: 990, duration: 0.16, peak: 0.5, delay: 0.1 },
  ],
  unoPenalty: [{ type: 'sawtooth', freq: 140, endFreq: 90, duration: 0.28, peak: 0.5 }],
  win: [
    { type: 'triangle', freq: 523, duration: 0.1, peak: 0.5 },
    { type: 'triangle', freq: 659, duration: 0.1, peak: 0.5, delay: 0.09 },
    { type: 'triangle', freq: 784, duration: 0.18, peak: 0.55, delay: 0.18 },
  ],
};

type AudioContextCtor = typeof AudioContext;

let context: AudioContext | undefined;
let unsupported = false;

function getContext(): AudioContext | undefined {
  if (unsupported) {
    return undefined;
  }
  if (context) {
    return context;
  }

  const Ctor: AudioContextCtor | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
  if (!Ctor) {
    unsupported = true;
    return undefined;
  }

  context = new Ctor();
  return context;
}

function scheduleTone(ctx: AudioContext, tone: Tone, masterGain: number): void {
  const startAt = ctx.currentTime + (tone.delay ?? 0);
  const stopAt = startAt + tone.duration;

  const osc = ctx.createOscillator();
  osc.type = tone.type;
  osc.frequency.setValueAtTime(tone.freq, startAt);
  if (tone.endFreq !== undefined) {
    osc.frequency.linearRampToValueAtTime(tone.endFreq, stopAt);
  }

  const gain = ctx.createGain();
  const level = tone.peak * masterGain;
  // Quick attack + exponential decay keeps every effect click-free and short.
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, level), startAt + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, stopAt);

  osc.connect(gain).connect(ctx.destination);
  osc.start(startAt);
  osc.stop(stopAt + 0.02);
}

/**
 * Play a synthesized effect. No-op when muted (effective volume 0) or when
 * Web Audio is unavailable. Reads volume live per call and never throws, so a
 * sound failure can never block gameplay. The AudioContext is created/resumed
 * lazily here: the first call is always driven by a user gesture (card click,
 * keypress, socket event after interaction), satisfying browser autoplay rules.
 */
export function playSfx(name: SfxName): void {
  try {
    const volume = getEffectiveVolume();
    if (volume <= 0) {
      return;
    }

    const ctx = getContext();
    if (!ctx) {
      return;
    }

    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => undefined);
    }

    const tones = TONES[name];
    tones.forEach((tone) => scheduleTone(ctx, tone, volume));
  } catch {
    // SFX is best-effort cosmetic feedback; never disrupt the game.
  }
}

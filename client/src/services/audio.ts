const STORAGE_KEY = 'uno:audio';
const DEFAULT_VOLUME = 0.7;

export type AudioSettings = {
  volume: number;
  muted: boolean;
};

type AudioListener = (settings: AudioSettings) => void;

const listeners = new Set<AudioListener>();

let state: AudioSettings = loadPersisted();

function clampVolume(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_VOLUME;
  }
  return Math.min(1, Math.max(0, value));
}

function loadPersisted(): AudioSettings {
  const fallback: AudioSettings = { volume: DEFAULT_VOLUME, muted: false };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return fallback;
    }
    const parsed = JSON.parse(raw) as Partial<AudioSettings> | null;
    if (!parsed || typeof parsed !== 'object') {
      return fallback;
    }
    return {
      volume: clampVolume(Number(parsed.volume)),
      muted: parsed.muted === true,
    };
  } catch {
    return fallback;
  }
}

function persist(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Persistence is best-effort; settings still apply for this session.
  }
}

function emit(): void {
  listeners.forEach((listener) => listener(state));
}

export function getAudioSettings(): AudioSettings {
  return state;
}

/** Volume a future SFX layer should actually use (mute wins over level). */
export function getEffectiveVolume(): number {
  return state.muted ? 0 : state.volume;
}

export function setVolume(volume: number): void {
  const next = clampVolume(volume);
  if (next === state.volume) {
    return;
  }
  state = { ...state, volume: next };
  persist();
  emit();
}

export function setMuted(muted: boolean): void {
  if (muted === state.muted) {
    return;
  }
  state = { ...state, muted };
  persist();
  emit();
}

export function toggleMuted(): void {
  setMuted(!state.muted);
}

export function subscribeAudio(listener: AudioListener): () => void {
  listeners.add(listener);
  listener(state);
  return () => {
    listeners.delete(listener);
  };
}

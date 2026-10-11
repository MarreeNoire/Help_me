/** Sirène SOS + vibration pour les gardiens et proches. */

let ctx: AudioContext | null = null;
let audioElem: HTMLAudioElement | null = null;

// Pattern de vibration SOS en morse (... --- ...) : 3 courts, 3 longs, 3 courts
export const SOS_VIBRATION_PATTERN = [
  200, 100, 200, 100, 200, 300, 400, 100, 400, 100, 400, 300, 200, 100, 200, 100, 200,
];

export function isAudioUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(ctx && ctx.state === "running");
}

export function unlockAudio(): boolean {
  if (typeof window === "undefined") return false;
  let unlocked = false;
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AC) {
      if (!ctx) ctx = new AC();
      if (ctx.state === "suspended") void ctx.resume();
      unlocked = ctx.state === "running";
    }
    if (!audioElem) {
      audioElem = new Audio("/alarm.wav");
      audioElem.loop = true;
      audioElem.preload = "auto";
    }
  } catch {
    /* ignore */
  }
  return unlocked;
}

export function startAlarm() {
  unlockAudio();
  let stopped = false;

  // 1. Lecture du fichier audio /alarm.wav (sirène d'urgence)
  try {
    if (!audioElem) {
      audioElem = new Audio("/alarm.wav");
      audioElem.loop = true;
      audioElem.preload = "auto";
    }
    audioElem.currentTime = 0;
    const playPromise = audioElem.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // Bloqué par la politique autoplay du navigateur si aucune interaction préalable
      });
    }
  } catch {
    /* ignore */
  }

  // 2. Synthèse d'urgence Web Audio (bitonale percutante 880Hz / 660Hz)
  let high = false;
  const beep = () => {
    if (stopped) return;
    if (!ctx || ctx.state !== "running") return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.value = high ? 880 : 660;
      high = !high;
      gain.gain.value = 0.25;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch {
      /* ignore */
    }
  };

  beep();

  // 3. Vibration SOS en morse
  try {
    if (navigator.vibrate) navigator.vibrate(SOS_VIBRATION_PATTERN);
  } catch {
    /* ignore */
  }

  const id = setInterval(() => {
    if (stopped) return;
    beep();
    try {
      if (navigator.vibrate) navigator.vibrate(SOS_VIBRATION_PATTERN);
    } catch {
      /* ignore */
    }
  }, 1000);

  return () => {
    stopped = true;
    clearInterval(id);
    if (audioElem) {
      try {
        audioElem.pause();
        audioElem.currentTime = 0;
      } catch {
        /* ignore */
      }
    }
    try {
      if (navigator.vibrate) navigator.vibrate(0);
    } catch {
      /* ignore */
    }
  };
}

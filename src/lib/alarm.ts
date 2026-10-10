/** Sirène + vibration pour les gardiens. L'audio ne démarre qu'après une 1re interaction (règle des navigateurs). */

let ctx: AudioContext | null = null;

export function unlockAudio() {
  if (typeof window === "undefined") return;
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    if (!ctx) ctx = new AC();
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    /* ignore */
  }
}

export function startAlarm() {
  unlockAudio();
  let high = false;

  const beep = () => {
    if (!ctx || ctx.state !== "running") return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = high ? 880 : 660;
    high = !high;
    gain.gain.value = 0.15;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  };

  const id = setInterval(() => {
    beep();
    if (navigator.vibrate) navigator.vibrate([300, 100, 300]);
  }, 900);

  return () => {
    clearInterval(id);
    if (navigator.vibrate) navigator.vibrate(0);
  };
}

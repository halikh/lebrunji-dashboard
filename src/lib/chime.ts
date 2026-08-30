/**
 * The sound a new order makes.
 *
 * ## Why it is synthesised rather than a file
 *
 * A two-note chime is a few lines of Web Audio and no asset to load, cache,
 * fail to load, or ship at three densities. It also starts instantly: an
 * `<audio>` element fetching a file has a first-play delay, and the first play
 * is the one that matters — it is the order nobody has noticed yet.
 *
 * ## The autoplay rule, and why unlocking happens at sign-in
 *
 * A browser will not let a page make a sound until it has been interacted with.
 * The whole point of this chime is that it fires when nobody is looking at the
 * screen, so waiting for an interaction would mean the first order of the day
 * arrives silently. The sign-in click is the first interaction there is, and
 * `unlock()` is called there.
 *
 * Everything here fails quietly. A dashboard that would not load because a
 * sound would not play is a worse dashboard, and the toast and the badge carry
 * the same information.
 */

let context: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (context) return context;

  try {
    const Ctor =
      window.AudioContext ??
      (window as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    context = new Ctor();
    return context;
  } catch {
    return null;
  }
}

/**
 * Wakes the audio context on a real interaction.
 *
 * Called from the sign-in click. Safe to call more than once — a context that
 * is already running resolves immediately.
 */
export function unlock() {
  void audioContext()
    ?.resume()
    .catch(() => {});
}

/**
 * Two notes, rising.
 *
 * Rising rather than falling because a falling pair is the shape every
 * operating system uses for an error, and this is not one — it is work
 * arriving. A fifth apart (E5 to B5) so the two notes are obviously one sound
 * rather than two events.
 *
 * Sine waves at a low gain, with an envelope: a bare oscillator switched on and
 * off clicks at both ends, which is the part that makes a synthesised tone
 * sound cheap.
 */
export function chime() {
  const ctx = audioContext();
  if (!ctx) return;

  // Suspended means the page has not been interacted with yet, or the tab was
  // backgrounded. Trying to resume here is worth one attempt — the tab may
  // have been interacted with since the last unlock.
  if (ctx.state === "suspended") void ctx.resume().catch(() => {});

  try {
    note(ctx, 659.25, ctx.currentTime, 0.16);
    note(ctx, 987.77, ctx.currentTime + 0.13, 0.28);
  } catch {
    // A closed or refused context. Nothing to do and nothing to report.
  }
}

function note(
  ctx: AudioContext,
  frequency: number,
  start: number,
  duration: number,
) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.type = "sine";
  oscillator.frequency.value = frequency;

  // Quiet. This fires in a room where people are working, and a chime that
  // makes anyone jump gets turned off, at which point it protects nothing.
  const peak = 0.09;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

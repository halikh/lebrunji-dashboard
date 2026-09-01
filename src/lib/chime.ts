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
 * Three notes, rising, with the last one held.
 *
 * ## Rising, and high
 *
 * Rising rather than falling because a falling figure is the shape every
 * operating system uses for an error, and this is not one — it is work
 * arriving. The notes climb a fourth at a time (B5 → E6 → A6) so the three are
 * obviously one sound rather than three events.
 *
 * High on purpose, and higher than the two-note version this replaces. The
 * chime has to carry across a room with a kitchen in it, and the frequencies a
 * busy room masks worst are the low ones — a deeper tone is the one that gets
 * lost under a fan and a conversation. It is also the band the ear is most
 * sensitive to, which is why the gain goes *down* as the pitch goes up: equal
 * amplitude at 1760 Hz is not equal loudness, and a top note at the same gain
 * as the bottom one is the part that makes a chime shrill.
 *
 * ## Long enough to be noticed, not long enough to be in the way
 *
 * A little under a second, most of it the held final note. The point of the
 * length is that the sound survives being started while somebody is mid-
 * sentence: a 0.4-second blip that lands under a spoken word is gone before
 * anyone can turn toward it. The tail decays rather than stopping, so it fades
 * out of a conversation instead of cutting off in it.
 *
 * Sine waves with an envelope: a bare oscillator switched on and off clicks at
 * both ends, which is the part that makes a synthesised tone sound cheap.
 */
export function chime() {
  const ctx = audioContext();
  if (!ctx) return;

  // Suspended means the page has not been interacted with yet, or the tab was
  // backgrounded. Trying to resume here is worth one attempt — the tab may
  // have been interacted with since the last unlock.
  if (ctx.state === "suspended") void ctx.resume().catch(() => {});

  try {
    const at = ctx.currentTime;
    // Overlapping slightly rather than butted end to end, so the figure reads
    // as one gesture. The peaks fall as the pitch climbs — see above.
    note(ctx, 987.77, at, 0.22, 0.1); // B5
    note(ctx, 1318.51, at + 0.16, 0.24, 0.085); // E6
    note(ctx, 1760.0, at + 0.32, 0.62, 0.07); // A6, held
  } catch {
    // A closed or refused context. Nothing to do and nothing to report.
  }
}

function note(
  ctx: AudioContext,
  frequency: number,
  start: number,
  duration: number,
  peak: number,
) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.type = "sine";
  oscillator.frequency.value = frequency;

  // Quiet. This fires in a room where people are working, and a chime that
  // makes anyone jump gets turned off, at which point it protects nothing.
  // The caller sets it per note, because the ear hears a high tone as louder
  // than a low one at the same amplitude.
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

/**
 * Coordination between the launch intro and the screen underneath it.
 *
 * The intro ends by settling its line onto the horizon of whichever screen is
 * showing, and that screen holds its own entrance until the intro reveals it.
 * Both sides need to agree on two facts (where the line is, and whether the
 * intro has finished), and neither is render state, so they live here instead
 * of in React.
 */

type IntroStatus = 'pending' | 'playing' | 'done';
type Listener = () => void;

let status: IntroStatus = 'pending';
let lineY: number | null = null;
const listeners = new Set<Listener>();

/** A screen reports where its horizon sits, in window points from the top. */
export function reportHorizonLine(y: number): void {
  lineY = y;
}

export function horizonLine(): number | null {
  return lineY;
}

/** True until the intro has revealed the app (or decided not to play). */
export function introCovering(): boolean {
  return status !== 'done';
}

export function introPending(): boolean {
  return status === 'pending';
}

export function markIntroPlaying(): void {
  if (status === 'pending') status = 'playing';
}

/** Tell the screen underneath that it is now visible. Safe to call twice. */
export function revealUnderIntro(): void {
  if (status === 'done') return;
  status = 'done';
  const waiting = [...listeners];
  listeners.clear();
  waiting.forEach((listener) => listener());
}

/** Run `listener` once the intro reveals the app. Returns an unsubscribe. */
export function onIntroReveal(listener: Listener): () => void {
  if (status === 'done') {
    listener();
    return () => {};
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

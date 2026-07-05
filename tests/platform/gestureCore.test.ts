import { describe, expect, it } from 'vitest';
import {
  GestureRecognizer,
  LONGPRESS_MS,
  TAP_MAX_MS,
  TAP_SLOP_PX,
  type GestureCallbacks,
} from '../../src/platform/gestureCore';

/** Recognizer + event log; sequences are written as plain (id,x,y,t) calls. */
function make(over: GestureCallbacks = {}): { rec: GestureRecognizer; log: string[] } {
  const log: string[] = [];
  const rec = new GestureRecognizer({
    onPressStart: () => log.push('pressStart'),
    onPressEnd: () => log.push('pressEnd'),
    onTap: () => log.push('tap'),
    onLongPress: () => log.push('longPress'),
    ...over,
  });
  return { rec, log };
}

describe('GestureRecognizer', () => {
  it('classifies a quick still press as a tap', () => {
    const { rec, log } = make();
    rec.down(1, 100, 100, 1000);
    rec.move(1, 102, 101, 1050);
    rec.up(1, 102, 101, 1100);
    expect(log).toEqual(['pressStart', 'pressEnd', 'tap']);
    expect(rec.state).toBe('idle');
  });

  it('taps at exactly TAP_MAX_MS (boundary is inclusive)', () => {
    const { rec, log } = make();
    rec.down(1, 0, 0, 0);
    rec.up(1, 0, 0, TAP_MAX_MS);
    expect(log).toEqual(['pressStart', 'pressEnd', 'tap']);
  });

  it('does nothing in the dead zone (TAP_MAX_MS < held < LONGPRESS_MS)', () => {
    const { rec, log } = make();
    rec.down(1, 0, 0, 0);
    rec.up(1, 0, 0, TAP_MAX_MS + 1);
    expect(log).toEqual(['pressStart', 'pressEnd']);
    expect(rec.state).toBe('idle');
  });

  it('fires long-press via timeout at the deadline and consumes the release', () => {
    const { rec, log } = make();
    rec.down(1, 50, 50, 0);
    expect(rec.deadline).toBe(LONGPRESS_MS);
    rec.timeout(LONGPRESS_MS);
    expect(log).toEqual(['pressStart', 'pressEnd', 'longPress']);
    expect(rec.state).toBe('longpress');
    rec.up(1, 50, 50, LONGPRESS_MS + 200);
    expect(log).toEqual(['pressStart', 'pressEnd', 'longPress']); // no tap, no extra events
    expect(rec.state).toBe('idle');
  });

  it('an early timeout poke is a no-op and the press can still tap', () => {
    const { rec, log } = make();
    rec.down(1, 0, 0, 0);
    rec.timeout(LONGPRESS_MS - 1);
    expect(rec.state).toBe('pressed');
    rec.up(1, 0, 0, 100);
    expect(log).toEqual(['pressStart', 'pressEnd', 'tap']);
  });

  it('fires long-press at release when the timer raced the up event', () => {
    const { rec, log } = make();
    rec.down(1, 0, 0, 0);
    rec.up(1, 0, 0, LONGPRESS_MS); // held ≥ LONGPRESS_MS, timeout never delivered
    expect(log).toEqual(['pressStart', 'pressEnd', 'longPress']);
  });

  it('movement past the slop cancels: the release is dead', () => {
    const { rec, log } = make();
    rec.down(1, 100, 100, 0);
    rec.move(1, 100 + TAP_SLOP_PX + 1, 100, 40);
    expect(rec.state).toBe('cancelled');
    rec.up(1, 100 + TAP_SLOP_PX + 1, 100, 80);
    expect(log).toEqual(['pressStart', 'pressEnd']); // no tap
    expect(rec.state).toBe('idle');
  });

  it('a drag also cancels the pending long-press', () => {
    const { rec, log } = make();
    rec.down(1, 0, 0, 0);
    rec.move(1, 40, 0, 100);
    rec.timeout(LONGPRESS_MS); // timer fires after the cancel — must not long-press
    rec.up(1, 40, 0, LONGPRESS_MS + 10);
    expect(log).toEqual(['pressStart', 'pressEnd']);
  });

  it('movement of exactly the slop still taps (boundary is inclusive)', () => {
    const { rec, log } = make();
    rec.down(1, 0, 0, 0);
    rec.move(1, TAP_SLOP_PX, 0, 50);
    rec.up(1, TAP_SLOP_PX, 0, 100);
    expect(log).toEqual(['pressStart', 'pressEnd', 'tap']);
  });

  it('slop is measured from the press origin, so small drifts accumulate', () => {
    const { rec, log } = make();
    rec.down(1, 0, 0, 0);
    rec.move(1, 6, 0, 30); // each step ≤ slop on its own…
    rec.move(1, 12, 0, 60); // …but 12 > TAP_SLOP_PX from the origin
    expect(rec.state).toBe('cancelled');
    rec.up(1, 12, 0, 90);
    expect(log).toEqual(['pressStart', 'pressEnd']);
  });

  it('a flick whose only movement is the release position is not a tap', () => {
    const { rec, log } = make();
    rec.down(1, 0, 0, 0);
    rec.up(1, 50, 0, 60); // no move event arrived, but the up is out of slop
    expect(log).toEqual(['pressStart', 'pressEnd']);
  });

  it('ignores a second concurrent pointer entirely', () => {
    const { rec, log } = make();
    rec.down(1, 0, 0, 0);
    rec.down(2, 300, 300, 20); // second finger — ignored
    rec.move(2, 400, 300, 40); // its drag must not cancel the first press
    rec.up(2, 400, 300, 60); // its release must not classify
    expect(rec.activePointerId).toBe(1);
    rec.up(1, 0, 0, 100);
    expect(log).toEqual(['pressStart', 'pressEnd', 'tap']);
  });

  it('ignores moves and ups from a non-active pointer id while idle too', () => {
    const { rec, log } = make();
    rec.move(1, 10, 10, 0);
    rec.up(1, 10, 10, 20);
    rec.timeout(LONGPRESS_MS * 2);
    expect(log).toEqual([]);
    expect(rec.state).toBe('idle');
  });

  it('cancel() mid-press ends the visual and kills the release', () => {
    const { rec, log } = make();
    rec.down(1, 0, 0, 0);
    rec.cancel(); // object destroyed / modal opened
    expect(log).toEqual(['pressStart', 'pressEnd']);
    rec.up(1, 0, 0, 100); // stale release
    rec.timeout(LONGPRESS_MS); // stale timer
    expect(log).toEqual(['pressStart', 'pressEnd']);
    expect(rec.state).toBe('idle');
  });

  it('cancel() when idle or already long-pressed emits nothing extra', () => {
    const { rec, log } = make();
    rec.cancel();
    expect(log).toEqual([]);
    rec.down(1, 0, 0, 0);
    rec.timeout(LONGPRESS_MS);
    rec.cancel(); // pressEnd already sent at long-press fire
    expect(log).toEqual(['pressStart', 'pressEnd', 'longPress']);
  });

  it('is reusable: tap → long-press → tap on the same instance', () => {
    const { rec, log } = make();
    rec.down(1, 0, 0, 0);
    rec.up(1, 0, 0, 100);
    rec.down(1, 5, 5, 1000);
    rec.timeout(1000 + LONGPRESS_MS);
    rec.up(1, 5, 5, 1000 + LONGPRESS_MS + 50);
    rec.down(2, 9, 9, 3000);
    rec.up(2, 9, 9, 3100);
    expect(log).toEqual([
      'pressStart', 'pressEnd', 'tap',
      'pressStart', 'pressEnd', 'longPress',
      'pressStart', 'pressEnd', 'tap',
    ]);
  });

  it('a repeated down from the same pointer restarts the press cleanly', () => {
    const { rec, log } = make();
    rec.down(1, 0, 0, 0);
    rec.down(1, 200, 200, 300); // missed up — restart from the new origin
    expect(log).toEqual(['pressStart', 'pressEnd', 'pressStart']);
    rec.up(1, 200, 200, 400);
    expect(log).toEqual(['pressStart', 'pressEnd', 'pressStart', 'pressEnd', 'tap']);
  });

  it('pressEnd fires exactly once per pressStart across all outcomes', () => {
    const { rec, log } = make();
    // tap, drag, long-press, cancel — four presses, four pressEnds
    rec.down(1, 0, 0, 0);
    rec.up(1, 0, 0, 10);
    rec.down(1, 0, 0, 100);
    rec.move(1, 99, 0, 110);
    rec.up(1, 99, 0, 120);
    rec.down(1, 0, 0, 200);
    rec.timeout(200 + LONGPRESS_MS);
    rec.up(1, 0, 0, 200 + LONGPRESS_MS + 1);
    rec.down(1, 0, 0, 2000);
    rec.cancel();
    expect(log.filter((e) => e === 'pressStart')).toHaveLength(4);
    expect(log.filter((e) => e === 'pressEnd')).toHaveLength(4);
  });

  it('honors custom thresholds', () => {
    const log: string[] = [];
    const rec = new GestureRecognizer(
      { onTap: () => log.push('tap'), onLongPress: () => log.push('longPress') },
      { tapMaxMs: 100, slopPx: 2, longPressMs: 200 },
    );
    rec.down(1, 0, 0, 0);
    rec.up(1, 0, 0, 101); // dead zone under the tighter tap window
    rec.down(1, 0, 0, 500);
    rec.timeout(700); // the shorter long-press window
    rec.up(1, 0, 0, 750);
    rec.down(1, 0, 0, 1000);
    rec.move(1, 3, 0, 1010); // 3 > slop 2 → cancelled
    rec.up(1, 3, 0, 1020);
    expect(log).toEqual(['longPress']);
  });
});

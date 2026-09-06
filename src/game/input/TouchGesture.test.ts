import { describe, expect, it } from 'vitest';
import { gestureDelta, gestureFrame, isTap } from './TouchGesture';

describe('touch gesture helpers', () => {
  it('computes the midpoint and spacing of two touches', () => {
    expect(gestureFrame([{ x: 10, y: 20 }, { x: 30, y: 40 }])).toEqual({
      center: { x: 20, y: 30 },
      distance: Math.hypot(20, 20),
    });
  });

  it('separates two-finger camera movement from pinch zoom', () => {
    const previous = gestureFrame([{ x: 0, y: 0 }, { x: 20, y: 0 }])!;
    const delta = gestureDelta(previous, [{ x: 4, y: 6 }, { x: 34, y: 6 }]);

    expect(delta).toMatchObject({ deltaX: 9, deltaY: 6, distanceDelta: 10 });
  });

  it('uses a forgiving touch tap tolerance', () => {
    expect(isTap({ x: 100, y: 100 }, { x: 108, y: 107 }, 12)).toBe(true);
    expect(isTap({ x: 100, y: 100 }, { x: 114, y: 100 }, 12)).toBe(false);
  });
});

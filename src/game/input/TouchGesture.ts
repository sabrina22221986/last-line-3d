export interface TouchPoint {
  x: number;
  y: number;
}

export interface TouchGestureFrame {
  center: TouchPoint;
  distance: number;
}

export interface TouchGestureDelta {
  frame: TouchGestureFrame;
  deltaX: number;
  deltaY: number;
  distanceDelta: number;
}

export function gestureFrame(points: readonly TouchPoint[]): TouchGestureFrame | null {
  if (points.length < 2) return null;
  const [first, second] = points;
  return {
    center: {
      x: (first.x + second.x) / 2,
      y: (first.y + second.y) / 2,
    },
    distance: Math.hypot(second.x - first.x, second.y - first.y),
  };
}

export function gestureDelta(
  previous: TouchGestureFrame,
  points: readonly TouchPoint[],
): TouchGestureDelta | null {
  const frame = gestureFrame(points);
  if (!frame) return null;
  return {
    frame,
    deltaX: frame.center.x - previous.center.x,
    deltaY: frame.center.y - previous.center.y,
    distanceDelta: frame.distance - previous.distance,
  };
}

export function isTap(start: TouchPoint, end: TouchPoint, tolerance: number): boolean {
  return Math.hypot(end.x - start.x, end.y - start.y) <= tolerance;
}

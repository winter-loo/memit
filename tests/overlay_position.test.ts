import { describe, it, expect } from 'vitest';
import { calculatePosition } from '../src/content/position';

describe('Overlay Positioning', () => {
  it('should calculate position based on selection rect', () => {
    const rect = {
      left: 100,
      top: 100,
      right: 200,
      bottom: 120,
      width: 100,
      height: 20,
    } as DOMRect;

    const pos = calculatePosition(rect);

    // Expect it to be near the end of selection (right side)
    expect(pos.left).toBeGreaterThan(100);
    expect(pos.top).toBeGreaterThan(100);
  });
});

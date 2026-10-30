// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { arcPoints, formatCoord } from '../../src/pages/Map';

describe('world map helpers', () => {
  it('formats coordinates like a printed chart', () => {
    expect(formatCoord(38.8977, 'lat')).toBe('38°54′N');
    expect(formatCoord(-77.0365, 'lng')).toBe('77°02′W');
    expect(formatCoord(-33.9999, 'lat')).toBe('34°00′S');
  });

  it('draws a string from one place to the other', () => {
    const pts = arcPoints([38.9, -77], [48.1, 11.6], 10);
    expect(pts).toHaveLength(11);
    expect(pts[0].lat).toBeCloseTo(38.9);
    expect(pts[10].lng).toBeCloseTo(11.6);
    // the arc bends away from the straight line
    expect(Math.abs(pts[5].lat - (38.9 + 48.1) / 2)).toBeGreaterThan(1);
  });
});

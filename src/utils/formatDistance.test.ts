import { formatDistance } from './formatDistance';
import { formatDistanceImperial } from './convertUnits';

describe('formatDistance', () => {
  it('assume métrico quando não recebe sistema de unidades', () => {
    expect(formatDistance(5000)).toBe('5.0 km');
    expect(formatDistance(750)).toBe('750 m');
  });

  it('delega em formatDistanceImperial', () => {
    for (const metros of [0, 100, 999, 1000, 5500, 42195]) {
      expect(formatDistance(metros, 'imperial')).toBe(
        formatDistanceImperial(metros, 'imperial'),
      );
      expect(formatDistance(metros, 'metric')).toBe(
        formatDistanceImperial(metros, 'metric'),
      );
    }
  });
});

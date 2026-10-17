import { describe, expect, it } from 'vitest';
import { buildVirtualLayout, virtualRange, captureVirtualAnchor, restoreVirtualAnchor, virtualIndexes } from './virtual-window';

describe('variable height virtual window', () => {
  it('bounds the rendered window in a twenty thousand row history', () => {
    const layout = buildVirtualLayout(Array.from({length: 20_000}, (_, i) => String(i)), new Map(), 50);
    expect(virtualRange(layout, 500_000, 500, 100)).toEqual({start: 9998, end: 10012});
    expect(layout.total).toBe(1_000_000);
  });
  it('includes intersecting tall rows and excludes exact end boundaries', () => {
    const layout = buildVirtualLayout(['a', 'b', 'c', 'd'], new Map([['b', 300], ['d', 100]]), 50);
    expect(virtualRange(layout, 100, 200, 0)).toEqual({start: 1, end: 2});
    expect(virtualRange(layout, 350, 50, 0)).toEqual({start: 2, end: 3});
    expect(virtualRange(layout, 500, 100, 0)).toEqual({start: 4, end: 4});
  });
  it('handles empty lists and viewports above the list', () => {
    expect(virtualRange(buildVirtualLayout([], new Map(), 50), 0, 500, 100)).toEqual({start: 0, end: 0});
    expect(virtualRange(buildVirtualLayout(['a', 'b'], new Map(), 50), -200, 50, 0)).toEqual({start: 0, end: 0});
  });
  it('preserves the visible row and its inner offset when older rows are prepended', () => {
    const before = buildVirtualLayout(['a', 'b', 'c'], new Map(), 50);
    const anchor = captureVirtualAnchor(before, 65);
    expect(anchor).toEqual({key: 'b', offset: 15, index: 1});
    const after = buildVirtualLayout(['older', 'a', 'b', 'c'], new Map([['older', 170]]), 50);
    expect(restoreVirtualAnchor(after, anchor)).toBe(235);
  });
  it('compensates for measured media resizing above the visible anchor', () => {
    const before = buildVirtualLayout(['a', 'b', 'c'], new Map(), 50);
    const after = buildVirtualLayout(['a', 'b', 'c'], new Map([['a', 250]]), 50);
    expect(restoreVirtualAnchor(after, captureVirtualAnchor(before, 80))).toBe(280);
  });
  it('uses a nearby remaining row when the anchored message is removed', () => {
    const before = buildVirtualLayout(['a', 'b', 'c'], new Map(), 50);
    const after = buildVirtualLayout(['a', 'c'], new Map(), 50);
    expect(restoreVirtualAnchor(after, captureVirtualAnchor(before, 60))).toBe(60);
  });
  it('keeps only explicit menu or focused row pins beyond the visible window', () => {
    const layout = buildVirtualLayout(['a', 'b', 'c', 'd', 'e'], new Map(), 50);
    expect(virtualIndexes(layout, {start: 1, end: 3}, ['e', 'a', 'e', 'removed'])).toEqual([0, 1, 2, 4]);
  });
});

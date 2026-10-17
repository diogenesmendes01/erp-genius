export type VirtualRange = { start: number; end: number };
export type VirtualAnchor = { key: string; offset: number; index: number };
export type VirtualLayout = {
  keys: readonly string[];
  offsets: number[];
  total: number;
  indexes: Map<string, number>;
};

export function buildVirtualLayout(
  keys: readonly string[],
  measured: ReadonlyMap<string, number>,
  estimate: number,
): VirtualLayout {
  const offsets = [0], indexes = new Map<string, number>();
  const fallback = Math.max(1, estimate);
  keys.forEach((key, index) => {
    indexes.set(key, index);
    const size = measured.get(key);
    offsets.push(offsets[index] + (size && size > 0 ? size : fallback));
  });
  return { keys, offsets, total: offsets[keys.length], indexes };
}

function lowerBound(values: readonly number[], target: number): number {
  let low = 0, high = values.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (values[middle] < target) low = middle + 1;
    else high = middle;
  }
  return low;
}

/** End is exclusive; only rows intersecting the viewport plus pixel overscan are mounted. */
export function virtualRange(
  layout: VirtualLayout,
  scrollTop: number,
  height: number,
  overscan: number,
): VirtualRange {
  const count = layout.keys.length;
  if (!count || scrollTop + height + overscan <= 0) return { start: 0, end: 0 };
  const top = Math.max(0, scrollTop - overscan);
  const bottom = Math.max(0, scrollTop + height + overscan);
  const boundary = lowerBound(layout.offsets, top);
  const start = Math.min(count, layout.offsets[boundary] === top ? boundary : boundary - 1);
  const end = Math.min(count, lowerBound(layout.offsets, bottom));
  return { start, end: Math.max(start, end) };
}

export function captureVirtualAnchor(layout: VirtualLayout, scrollTop: number): VirtualAnchor | undefined {
  if (!layout.keys.length || scrollTop < 0) return undefined;
  const index = Math.min(layout.keys.length - 1, virtualRange(layout, scrollTop, 1, 0).start);
  return { key: layout.keys[index], offset: scrollTop - layout.offsets[index], index };
}

export function restoreVirtualAnchor(layout: VirtualLayout, anchor?: VirtualAnchor): number | undefined {
  if (!anchor || !layout.keys.length) return undefined;
  const index = layout.indexes.get(anchor.key) ?? Math.min(anchor.index, layout.keys.length - 1);
  return layout.offsets[index] + anchor.offset;
}

export function virtualIndexes(layout: VirtualLayout, range: VirtualRange, pins: readonly string[]): number[] {
  const indexes = new Set<number>();
  for (let index = range.start; index < range.end; index++) indexes.add(index);
  for (const key of pins) {
    const index = layout.indexes.get(key);
    if (index !== undefined) indexes.add(index);
  }
  return [...indexes].sort((a, b) => a - b);
}

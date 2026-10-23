"use client";
/* eslint-disable react-hooks/refs, react-hooks/exhaustive-deps --
   As alturas medidas ficam em refs lidas na renderização de propósito
   (layout virtual recalculado por `revision`), e o layout effect sem dependências é o ciclo de ancoragem/foco.
   No opt-in stableMount esse ciclo mede e acompanha o scroll também antes do limiar. */

import {
  Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState,
  type KeyboardEvent, type ReactNode, type RefObject,
} from 'react';
import {
  buildVirtualLayout, captureVirtualAnchor, restoreVirtualAnchor, virtualIndexes, virtualRange,
  type VirtualLayout,
} from './virtual-window';
// estilos: classes Tailwind abaixo

export type VirtualListProps<T> = {
  items: readonly T[];
  getKey: (item: T, index: number) => string;
  renderItem: (item: T, index: number) => ReactNode;
  /** The existing scroll container; this component never adds a nested scroller. */
  scrollRef: RefObject<HTMLElement | null>;
  estimatedHeight: number;
  threshold?: number;
  /** Preserve row DOM/focus across the threshold; opt-in only, with natural flow below it. */
  stableMount?: boolean;
  /** Extra pixels mounted above and below the viewport. */
  overscan?: number;
  /** Keep open menu anchors or other interactive rows mounted. */
  pinKeys?: readonly string[];
  /** Explicit captured row top during pagination, including transitions into virtualization. */
  transitionAnchor?: {key: string; viewportOffset: number};
  /** Optional cheap exclusion for date/system rows; remaining rows are checked for actual controls. */
  isItemFocusable?: (item: T, index: number) => boolean;
};
// Linhas da lista (mensagens, conversas) não têm campo de texto longo; o compositor fica fora da lista.
const focusable = 'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';
function controlsIn(row?: HTMLElement) {
  return row ? [...row.querySelectorAll<HTMLElement>(focusable)].filter(element =>
    element.tabIndex >= 0 && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden',
  ) : [];
}

export function VirtualList<T>({
  items, getKey, renderItem, scrollRef, estimatedHeight, threshold = 100, overscan = 600, pinKeys = [],
  transitionAnchor, isItemFocusable, stableMount = false,
}: VirtualListProps<T>) {
  const enabled = items.length > threshold;
  const root = useRef<HTMLDivElement>(null);
  const measured = useRef(new Map<string, number>());
  const nodes = useRef(new Map<string, HTMLDivElement>());
  const observer = useRef<ResizeObserver | null>(null);
  const previous = useRef<VirtualLayout | null>(null);
  const seededAnchor = useRef<VirtualListProps<T>['transitionAnchor']>(undefined);
  const providedAnchor = useRef<VirtualListProps<T>['transitionAnchor']>(undefined);
  const lastViewport = useRef({top: 0, height: 600});
  const pendingFocus = useRef<{index: number; backwards: boolean} | null>(null);
  const focusFrame = useRef(0);
  const [candidate, setCandidate] = useState<string>();
  const [revision, setRevision] = useState(0);
  const [viewport, setViewport] = useState(lastViewport.current);
  const [focused, setFocused] = useState<string>();
  const keys = useMemo(() => items.map(getKey), [items, getKey]);
  const layout = useMemo(() => buildVirtualLayout(keys, measured.current, estimatedHeight), [keys, estimatedHeight, revision]);
  const range = virtualRange(layout, viewport.top, viewport.height, overscan);
  const pins = [...pinKeys];
  if (focused) pins.push(focused);
  if (candidate) pins.push(candidate);
  const transitionKey = seededAnchor.current?.key ?? transitionAnchor?.key;
  if (transitionKey) pins.push(transitionKey);
  const indexes = stableMount && !enabled ? keys.map((_, index) => index) : virtualIndexes(layout, range, pins);

  const listOffset = useCallback(() => {
    const container = scrollRef.current, list = root.current;
    return container && list
      ? list.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop - container.clientTop
      : 0;
  }, [scrollRef]);
  const readViewport = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;
    const next = {top: container.scrollTop - listOffset(), height: container.clientHeight};
    lastViewport.current = next;
    setViewport(current => current.top === next.top && current.height === next.height ? current : next);
  }, [scrollRef, listOffset]);

  useLayoutEffect(() => {
    if (!enabled) {
      previous.current = stableMount ? layout : null;
      seededAnchor.current = undefined; providedAnchor.current = undefined;
      if (stableMount) readViewport();
      return;
    }
    const container = scrollRef.current;
    const old = previous.current;
    if (transitionAnchor && transitionAnchor !== providedAnchor.current) {seededAnchor.current = transitionAnchor; providedAnchor.current = transitionAnchor;}
    const seed = seededAnchor.current;
    if (container && seed && layout.indexes.has(seed.key)) {
      // Keep the real captured row through every initial measurement, rather than anchoring
      // inside an estimated date divider whose eventual height may be much smaller.
      const next = listOffset() + layout.offsets[layout.indexes.get(seed.key)!] - seed.viewportOffset;
      if (Math.abs(next - container.scrollTop) > 0.5) container.scrollTop = next;
    } else if (container && old && old !== layout) {
      seededAnchor.current = undefined;
      const anchor = captureVirtualAnchor(old, lastViewport.current.top);
      const next = restoreVirtualAnchor(layout, anchor);
      if (next !== undefined && Math.abs(next - lastViewport.current.top) > 0.5) container.scrollTop = listOffset() + next;
    }
    previous.current = layout;
    readViewport();

    const pending = pendingFocus.current;
    if (!pending) return;
    const direction = pending.backwards ? -1 : 1;
    while (pending.index >= 0 && pending.index < keys.length) {
      if (isItemFocusable && !isItemFocusable(items[pending.index], pending.index)) {
        pending.index += direction;
        continue;
      }
      const key = keys[pending.index], row = nodes.current.get(key);
      if (!row) {
        // Probe one missing row at a time, keeping the original focus mounted. A long run
        // of noninteractive rows never accumulates DOM nodes or synchronous React updates.
        if (!focusFrame.current) focusFrame.current = requestAnimationFrame(() => {
          focusFrame.current = 0;
          setCandidate(key);
        });
        return;
      }
      const controls = controlsIn(row), control = controls[pending.backwards ? controls.length - 1 : 0];
      if (control) {
        pendingFocus.current = null;
        setCandidate(undefined);
        const rect = row.getBoundingClientRect(), bounds = container?.getBoundingClientRect();
        if (container && bounds && (rect.bottom <= bounds.top || rect.top >= bounds.bottom)) {
          seededAnchor.current = undefined;
          container.scrollTop = listOffset() + layout.offsets[pending.index];
          readViewport();
        }
        control.focus({preventScroll: true});
        return;
      }
      pending.index += direction;
    }
    pendingFocus.current = null;
    setCandidate(undefined);
    // Reaching a run of noninteractive rows at either end should still leave the list.
    const all = controlsIn(document.body), current = all.indexOf(document.activeElement as HTMLElement);
    for (let index = current + direction; index >= 0 && index < all.length; index += direction) {
      if (!root.current?.contains(all[index])) {all[index].focus(); return;}
    }
    (document.activeElement as HTMLElement | null)?.blur();
  });

  // Ancestor refs attach after child layout effects on the first mount.
  useEffect(() => {
    if (!enabled && !stableMount) return;
    const container = scrollRef.current, list = root.current;
    if (!container || !list) return;
    let frame = 0;
    const oldOverflowAnchor = container.style.overflowAnchor;
    container.style.overflowAnchor = 'none';
    const onScroll = () => {
      const next = {top: container.scrollTop - listOffset(), height: container.clientHeight};
      // Component corrections call readViewport synchronously; a different position here
      // is a new user/parent scroll and releases the initial transition anchor.
      if (Math.abs(next.top - lastViewport.current.top) > 1) seededAnchor.current = undefined;
      lastViewport.current = next;
      if (!frame) frame = requestAnimationFrame(() => {frame = 0; readViewport();});
    };
    container.addEventListener('scroll', onScroll, {passive: true});
    let width = list.getBoundingClientRect().width;
    const measure = (entries?: ResizeObserverEntry[]) => {
      let changed = false;
      const nextWidth = list.getBoundingClientRect().width;
      if (Math.abs(width - nextWidth) > 0.5) {measured.current.clear(); width = nextWidth; changed = true;}
      const targets = entries ? entries.map(entry => entry.target as HTMLDivElement) : [...nodes.current.values()];
      for (const node of targets) {
        const key = node.dataset.virtualKey;
        if (key === undefined) continue;
        const height = node.getBoundingClientRect().height;
        if (height > 0 && Math.abs((measured.current.get(key) ?? estimatedHeight) - height) > 0.5) {
          measured.current.set(key, height);
          changed = true;
        }
      }
      if (changed) setRevision(value => value + 1);
      readViewport();
    };
    const resize = new ResizeObserver(entries => measure(entries));
    observer.current = resize;
    resize.observe(container);
    resize.observe(list);
    nodes.current.forEach(node => resize.observe(node));
    measure();
    return () => {
      container.removeEventListener('scroll', onScroll);
      container.style.overflowAnchor = oldOverflowAnchor;
      if (frame) cancelAnimationFrame(frame);
      resize.disconnect();
      observer.current = null;
    };
  }, [enabled, stableMount, scrollRef, listOffset, readViewport, estimatedHeight]);

  useEffect(() => () => {if (focusFrame.current) cancelAnimationFrame(focusFrame.current);}, []);
  useLayoutEffect(() => {
    for (const key of measured.current.keys()) if (!layout.indexes.has(key)) measured.current.delete(key);
  }, [layout]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!enabled || event.key !== 'Tab' || event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target as HTMLElement, row = target.closest<HTMLDivElement>('[data-virtual-key]');
    const key = row?.dataset.virtualKey;
    if (!row || key === undefined) return;
    const controls = controlsIn(row);
    if (target !== controls[event.shiftKey ? 0 : controls.length - 1]) return;
    const index = layout.indexes.get(key);
    if (index === undefined) return;
    const nextIndex = index + (event.shiftKey ? -1 : 1), nextKey = keys[nextIndex];
    if (nextKey === undefined) return;
    event.preventDefault();
    pendingFocus.current = {index: nextIndex, backwards: event.shiftKey};
    setCandidate(nextKey);
  }

  if (!enabled && !stableMount) return <>{items.map((item, index) => <Fragment key={keys[index]}>{renderItem(item, index)}</Fragment>)}</>;
  return <div
    className="relative w-full shrink-0 [overflow-anchor:none]" ref={root} style={enabled ? {height: layout.total} : undefined}
    data-virtual-count={enabled ? items.length : undefined}
    onKeyDownCapture={onKeyDown}
    onFocusCapture={event => setFocused((event.target as HTMLElement).closest<HTMLElement>('[data-virtual-key]')?.dataset.virtualKey)}
    onBlurCapture={event => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(undefined);
    }}
  >{indexes.map(index => <div
    className={enabled ? "absolute left-0 top-0 flow-root w-full [overflow-anchor:none]" : "flow-root w-full [overflow-anchor:none]"} key={keys[index]} data-virtual-key={keys[index]}
    style={enabled ? {top: layout.offsets[index]} : undefined}
    ref={node => {
      const old = nodes.current.get(keys[index]);
      if (old) observer.current?.unobserve(old);
      if (node) {nodes.current.set(keys[index], node); observer.current?.observe(node);}
      else nodes.current.delete(keys[index]);
    }}
  >{renderItem(items[index], index)}</div>)}</div>;
}

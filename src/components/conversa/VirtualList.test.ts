import { createElement, createRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { VirtualList } from './VirtualList';

function render(count: number, pinKeys?: string[]) {
  return renderToStaticMarkup(createElement(VirtualList<number>, {
    items: Array.from({length: count}, (_, i) => i),
    getKey: item => String(item),
    renderItem: item => createElement('button', {'data-row': item}, String(item)),
    scrollRef: createRef<HTMLDivElement>(),
    estimatedHeight: 50,
    threshold: 100,
    overscan: 100,
    pinKeys,
  }));
}
describe('virtual list markup', () => {
  it('retains the original row markup for short lists without layout wrappers', () => {
    expect(render(2)).toBe('<button data-row="0">0</button><button data-row="1">1</button>');
  });
  it('mounts a bounded initial window for a large history', () => {
    const html = render(20_000);
    expect((html.match(/data-row=/g) ?? []).length).toBeLessThan(30);
    expect(html).toContain('height:1000000px');
  });
  it('keeps an explicitly pinned menu anchor mounted outside the window', () => {
    expect(render(20_000, ['19999'])).toContain('data-row="19999"');
  });
  it('abaixo do limite renderiza todas as linhas sem posição absoluta', () => {
    const html = renderToStaticMarkup(createElement(VirtualList<string>, {
      items: ['a', 'b'], getKey: x => x, renderItem: x => createElement('p', null, x),
      scrollRef: {current: null}, estimatedHeight: 40,
    }));
    expect(html).toContain('<p>a</p>');
    expect(html).not.toContain('position:absolute');
    expect(html).not.toContain('absolute');
  });
});

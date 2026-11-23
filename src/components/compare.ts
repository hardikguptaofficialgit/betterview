import { CompareSpec } from '../core/types';
import { RenderContext } from './index';
import { h } from '../core/dom';
import { iconEl } from '../core/icons';

export function renderCompare(spec: CompareSpec, _ctx: RenderContext): HTMLElement {
  const card = h('div', { class: 'iui-card iui-compare-card' });
  if (spec.title) {
    card.appendChild(h('div', { class: 'iui-title' }, spec.title));
  }

  const items = spec.items || [];
  const grid = h('div', { class: 'iui-compare-grid' });

  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];
    const tone = item.tone || 'neutral';
    let colorClass = 'c-stone';
    let headerIconName = 'info';

    if (tone === 'good') {
      colorClass = 'c-mint';
      headerIconName = 'check-circle';
    } else if (tone === 'bad') {
      colorClass = 'c-rose';
      headerIconName = 'x-circle';
    }

    const panel = h('div', { class: `iui-compare-panel ${colorClass}` });

    const header = h('div', { class: 'iui-compare-header' });
    const iconBox = h('div', { class: 'iui-compare-iconbox' }, iconEl(headerIconName, 16));
    const label = h('span', { class: 'iui-compare-label' }, item.label);
    header.appendChild(iconBox);
    header.appendChild(label);
    panel.appendChild(header);

    const pointsList = h('div', { class: 'iui-compare-points' });
    const points = item.points || [];

    for (const point of points) {
      const row = h('div', { class: 'iui-compare-point' });
      let iconNode: HTMLElement;

      if (tone === 'good') {
        iconNode = h('span', { class: 'iui-compare-point-icon' }, iconEl('check', 14));
      } else if (tone === 'bad') {
        iconNode = h('span', { class: 'iui-compare-point-icon' }, iconEl('x', 14));
      } else {
        iconNode = h('span', { class: 'iui-compare-dot' });
      }

      const text = h('span', { class: 'iui-compare-point-text' }, point);
      row.appendChild(iconNode);
      row.appendChild(text);
      pointsList.appendChild(row);
    }

    panel.appendChild(pointsList);
    grid.appendChild(panel);
  }

  card.appendChild(grid);
  return card;
}

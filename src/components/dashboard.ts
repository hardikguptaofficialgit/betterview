import { DashboardSpec, DashboardVisualSpec } from '../core/types';
import { RenderContext } from './index';
import { h } from '../core/dom';

export type DashboardVisualRenderer = (spec: DashboardVisualSpec, ctx: RenderContext) => HTMLElement;

export function renderDashboard(
  spec: DashboardSpec,
  ctx: RenderContext,
  renderVisual: DashboardVisualRenderer,
): HTMLElement {
  const card = h('div', { class: 'iui-card iui-dashboard-card' });
  if (spec.title) card.appendChild(h('div', { class: 'iui-title' }, spec.title));
  const grid = h('div', { class: 'iui-dashboard-grid', role: 'group', 'aria-label': spec.title || 'Dashboard' });

  spec.items.forEach((item, index) => {
    const title = item.title || item.visual.title || `${item.visual.type[0].toUpperCase()}${item.visual.type.slice(1)} ${index + 1}`;
    const section = h('section', { class: 'iui-dashboard-panel', 'aria-label': title });
    section.appendChild(h('div', { class: 'iui-dashboard-panel-title', role: 'heading', 'aria-level': '4' }, title));
    const visual = renderVisual(item.visual, ctx);
    visual.classList.add('iui-dashboard-visual');
    visual.querySelector('.iui-title')?.remove();
    section.appendChild(visual);
    grid.appendChild(section);
  });

  card.appendChild(grid);
  return card;
}

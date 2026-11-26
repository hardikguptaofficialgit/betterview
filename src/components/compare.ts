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
  const totalPoints = items.reduce((acc, item) => acc + (item.points?.length || 0), 0);

  let filterQuery = '';
  let focusedIndex: number | null = null;

  function getEffectivePanels(): HTMLElement[] {
    return Array.from(card.querySelectorAll<HTMLElement>('.iui-compare-panel'));
  }

  function applyFocusAndFilter(): void {
    const panels = getEffectivePanels();
    for (let i = 0; i < panels.length; i++) {
      const panel = panels[i];
      // Focus dimming
      if (focusedIndex !== null) {
        panel.classList.toggle('is-dimmed', i !== focusedIndex);
        panel.classList.toggle('is-focused', i === focusedIndex);
      } else {
        panel.classList.remove('is-dimmed', 'is-focused');
      }
      panel.setAttribute('aria-pressed', String(focusedIndex === i));
      // Filter points
      const pointEls = panel.querySelectorAll<HTMLElement>('.iui-compare-point');
      for (const pt of pointEls) {
        if (!filterQuery) {
          pt.hidden = false;
        } else {
          const text = pt.textContent?.toLowerCase() ?? '';
          pt.hidden = !text.includes(filterQuery);
        }
      }
    }
  }

  // Filter bar for tables with > 8 total points
  if (totalPoints > 8) {
    const filterWrap = h('div', { class: 'iui-compare-filter-wrap' });
    const filterInput = h('input', {
      class: 'iui-compare-filter-input',
      type: 'search',
      placeholder: 'Filter points…',
      'aria-label': 'Filter comparison points',
      onInput: (e: Event) => {
        filterQuery = (e.target as HTMLInputElement).value.trim().toLowerCase();
        applyFocusAndFilter();
      },
    });
    filterWrap.appendChild(iconEl('magnifying-glass', 13, 'iui-compare-filter-icon'));
    filterWrap.appendChild(filterInput);
    card.appendChild(filterWrap);
  }

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

    const panel = h('div', {
      class: `iui-compare-panel ${colorClass}`,
      role: 'button',
      tabindex: '0',
      'aria-label': `${item.label}, focus comparison panel`,
      'aria-pressed': 'false',
      onClick: () => {
        if (focusedIndex === idx) {
          focusedIndex = null;
        } else {
          focusedIndex = idx;
        }
        applyFocusAndFilter();
      },
      onKeyDown: (e: Event) => {
        const ke = e as KeyboardEvent;
        if (ke.key === 'Enter' || ke.key === ' ') {
          e.preventDefault();
          (panel as HTMLElement).click();
        }
      },
    });

    const header = h('div', { class: 'iui-compare-header' });
    const iconBox = h('div', { class: 'iui-compare-iconbox' }, iconEl(headerIconName, 16));
    const label = h('span', { class: 'iui-compare-label' }, item.label);
    header.appendChild(iconBox);
    header.appendChild(label);

    // Optional badge
    const badge = (item as any).badge;
    if (badge) {
      header.appendChild(h('span', { class: 'iui-compare-badge' }, badge));
    }

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

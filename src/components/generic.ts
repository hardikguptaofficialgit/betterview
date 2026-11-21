import { GenericSpec } from '../core/types';
import { RenderContext } from './index';
import { h } from '../core/dom';

function formatKey(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function renderValue(val: unknown): HTMLElement {
  if (val === null || val === undefined) {
    return h('span', { class: 'iui-generic-value' }, '-');
  }

  if (typeof val === 'boolean') {
    return h('span', { class: 'iui-generic-chip' }, val ? 'Yes' : 'No');
  }

  if (typeof val === 'number') {
    return h('span', { class: 'iui-generic-value' }, String(val));
  }

  if (typeof val === 'string') {
    return h('span', { class: 'iui-generic-value' }, val);
  }

  if (Array.isArray(val)) {
    if (val.length === 0) {
      return h('span', { class: 'iui-generic-value' }, '(empty)');
    }

    const allPrimitives = val.every(
      (item) =>
        typeof item === 'string' ||
        typeof item === 'number' ||
        typeof item === 'boolean',
    );
    if (allPrimitives) {
      const isShort = val.every((item) => String(item).length <= 25);
      if (isShort && val.length <= 15) {
        const chips = h('div', { class: 'iui-generic-chips' });
        for (const item of val) {
          chips.appendChild(h('span', { class: 'iui-generic-chip' }, String(item)));
        }
        return chips;
      }

      const ul = h('ul', { class: 'iui-generic-list' });
      for (const item of val) {
        ul.appendChild(h('li', {}, String(item)));
      }
      return ul;
    }

    // Array of objects
    const listWrap = h('div', {
      style: 'display: flex; flex-direction: column; gap: 8px; margin-top: 4px;',
    });
    for (const item of val) {
      if (item && typeof item === 'object') {
        const subCard = h('div', { class: 'iui-generic-subcard' });
        for (const [subK, subV] of Object.entries(
          item as Record<string, unknown>,
        )) {
          const row = h('div', {
            style: 'display: flex; flex-direction: column; gap: 2px;',
          });
          row.appendChild(
            h('span', { class: 'iui-generic-label' }, formatKey(subK)),
          );
          row.appendChild(renderValue(subV));
          subCard.appendChild(row);
        }
        listWrap.appendChild(subCard);
      } else {
        listWrap.appendChild(
          h('span', { class: 'iui-generic-value' }, String(item)),
        );
      }
    }
    return listWrap;
  }

  if (typeof val === 'object') {
    const subCard = h('div', { class: 'iui-generic-subcard' });
    for (const [subK, subV] of Object.entries(val as Record<string, unknown>)) {
      const row = h('div', {
        style: 'display: flex; flex-direction: column; gap: 2px;',
      });
      row.appendChild(
        h('span', { class: 'iui-generic-label' }, formatKey(subK)),
      );
      row.appendChild(renderValue(subV));
      subCard.appendChild(row);
    }
    return subCard;
  }

  return h('span', { class: 'iui-generic-value' }, String(val));
}

export function renderGeneric(
  spec: GenericSpec,
  _ctx: RenderContext,
): HTMLElement {
  const card = h('div', { class: 'iui-card iui-generic-card' });

  const title =
    spec.title || (spec.originalType ? formatKey(spec.originalType) : 'Details');
  card.appendChild(h('div', { class: 'iui-title' }, title));

  const content = h('div', { class: 'iui-generic-content' });
  const grid = h('div', { class: 'iui-generic-grid' });

  const entries = Object.entries(spec.data || {}).filter(
    ([k]) => k !== 'type' && k !== 'title' && !k.startsWith('_'),
  );

  for (const [key, val] of entries) {
    const isComplex = typeof val === 'object' && val !== null;
    const isLongString = typeof val === 'string' && val.length > 60;
    const isFullWidth = isComplex || isLongString;

    const row = h('div', {
      class: `iui-generic-row${isFullWidth ? ' full-width' : ''}`,
    });
    row.appendChild(h('span', { class: 'iui-generic-label' }, formatKey(key)));
    row.appendChild(renderValue(val));

    grid.appendChild(row);
  }

  content.appendChild(grid);
  card.appendChild(content);

  return card;
}

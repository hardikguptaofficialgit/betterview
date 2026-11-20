import { StatsSpec, StatItem } from '../core/types';
import { RenderContext } from './index';
import { h } from '../core/dom';
import { iconEl } from '../core/icons';

function parseNumberParts(raw: string | number): { prefix: string; value: number; suffix: string; decimals: number } | null {
  if (typeof raw === 'number') {
    return { prefix: '', value: raw, suffix: '', decimals: raw % 1 !== 0 ? String(raw).split('.')[1]?.length || 0 : 0 };
  }
  const str = String(raw).trim();
  const match = /^([^\d\-+.]*)([+-]?\d+(?:\.\d+)?)([^\d.]*)$/.exec(str);
  if (!match) return null;
  const prefix = match[1];
  const num = parseFloat(match[2]);
  if (Number.isNaN(num)) return null;
  const suffix = match[3];
  const decimals = match[2].includes('.') ? match[2].split('.')[1].length : 0;
  return { prefix, value: num, suffix, decimals };
}

export function renderStats(spec: StatsSpec, ctx: RenderContext): HTMLElement {
  const card = h('div', { class: 'iui-card iui-stats-card' });
  if (spec.title) {
    card.appendChild(h('div', { class: 'iui-title' }, spec.title));
  }

  const items = spec.items || [];
  const grid = h('div', { class: 'iui-stats-grid' });

  const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const itemCard = h('div', { class: 'iui-stat-item' });

    // Label row with optional icon
    const labelRow = h('div', { class: 'iui-stat-label-row' });
    const label = h('div', { class: 'iui-stat-label' }, item.label);
    labelRow.appendChild(label);
    if (item.icon) {
      const iconWrap = h('span', { class: 'iui-stat-item-icon' }, iconEl(item.icon, 15));
      labelRow.appendChild(iconWrap);
    }
    itemCard.appendChild(labelRow);

    // Value container with optional delta
    const valRow = h('div', { class: 'iui-stat-val-row' });
    const valEl = h('div', { class: 'iui-stat-value tabular-nums' }, String(item.value));
    valRow.appendChild(valEl);

    if (item.delta) {
      const deltaClean = item.delta.trim();
      const isPositive = deltaClean.startsWith('+');
      const isNegative = deltaClean.startsWith('-');
      const toneClass = isPositive ? 'c-mint' : isNegative ? 'c-rose' : 'c-stone';

      const deltaChip = h(
        'span',
        { class: `iui-chip iui-stat-delta ${toneClass}` },
        deltaClean,
      );
      valRow.appendChild(deltaChip);
    }

    itemCard.appendChild(valRow);

    // Optional hint
    if (item.hint) {
      const hint = h('div', { class: 'iui-stat-hint' }, item.hint);
      itemCard.appendChild(hint);
    }

    grid.appendChild(itemCard);

    // Number count-up animation over 600ms
    const parsed = parseNumberParts(item.value);
    if (parsed && !prefersReduced && typeof requestAnimationFrame !== 'undefined') {
      const targetVal = parsed.value;
      const duration = 600;
      let startTimestamp: number | null = null;
      let rafId: number | null = null;

      valEl.textContent = `${parsed.prefix}0${parsed.suffix}`;

      const step = (ts: number) => {
        if (!startTimestamp) startTimestamp = ts;
        const elapsed = ts - startTimestamp;
        const progress = Math.min(elapsed / duration, 1);
        // Easing cubic-bezier(.2,.8,.2,1) approx: 1 - Math.pow(1 - progress, 3)
        const eased = 1 - Math.pow(1 - progress, 3);
        const currentVal = targetVal * eased;

        const formattedNumber =
          parsed.decimals > 0
            ? currentVal.toFixed(parsed.decimals)
            : Math.round(currentVal).toLocaleString();

        valEl.textContent = `${parsed.prefix}${formattedNumber}${parsed.suffix}`;

        if (progress < 1) {
          rafId = requestAnimationFrame(step);
        } else {
          valEl.textContent = String(item.value);
        }
      };

      rafId = requestAnimationFrame(step);
      ctx.onCleanup(() => {
        if (rafId !== null) cancelAnimationFrame(rafId);
      });
    }
  }

  card.appendChild(grid);
  return card;
}

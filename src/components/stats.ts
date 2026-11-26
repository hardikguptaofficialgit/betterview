import { StatsSpec, StatItem } from '../core/types';
import { RenderContext } from './index';
import { h } from '../core/dom';
import { iconEl } from '../core/icons';
import { renderMathText } from '../core/mathParser';

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

function buildSparklineSVG(data: number[]): SVGSVGElement | null {
  if (!data || data.length < 2) return null;

  const W = 64;
  const H = 20;
  const pad = 1;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const toX = (i: number) => pad + (i / (data.length - 1)) * (W - 2 * pad);
  const toY = (v: number) => H - pad - ((v - min) / range) * (H - 2 * pad);

  const pts = data.map((v, i) => `${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(' ');
  const last = data[data.length - 1];

  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('width', String(W));
  svg.setAttribute('height', String(H));
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.classList.add('iui-stat-sparkline');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute(
    'title',
    `Min: ${min.toLocaleString()}, Max: ${max.toLocaleString()}, Last: ${last.toLocaleString()}`,
  );

  const polyline = document.createElementNS(NS, 'polyline');
  polyline.setAttribute('points', pts);
  polyline.setAttribute('fill', 'none');
  polyline.setAttribute('stroke', 'var(--iui-accent, #0b57d0)');
  polyline.setAttribute('stroke-width', '1.5');
  polyline.setAttribute('stroke-linecap', 'round');
  polyline.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(polyline);

  // Dot at last point
  const dot = document.createElementNS(NS, 'circle');
  dot.setAttribute('cx', String(toX(data.length - 1).toFixed(1)));
  dot.setAttribute('cy', String(toY(last).toFixed(1)));
  dot.setAttribute('r', '2');
  dot.setAttribute('fill', 'var(--iui-accent, #0b57d0)');
  svg.appendChild(dot);

  return svg;
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
    const label = h('div', { class: 'iui-stat-label' });
    renderMathText(label, item.label);
    labelRow.appendChild(label);
    if (item.icon) {
      const iconWrap = h('span', { class: 'iui-stat-item-icon' }, iconEl(item.icon, 18));
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
        { class: `iui-stat-delta ${toneClass}` },
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

    // Optional sparkline (item.sparkline must be number[] with >= 2 entries)
    const sparklineData = (item as any).sparkline as number[] | undefined;
    if (Array.isArray(sparklineData) && sparklineData.length >= 2) {
      const sparkSVG = buildSparklineSVG(sparklineData);
      if (sparkSVG) {
        const sparkWrap = h('div', { class: 'iui-stat-sparkline-wrap' });
        sparkWrap.appendChild(sparkSVG);
        itemCard.appendChild(sparkWrap);
      }
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

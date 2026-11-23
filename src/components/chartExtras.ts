import { ChartPoint, ChartSpec } from '../core/types';
import type { RenderContext } from './index';
import { h } from '../core/dom';

function element(name: string, attrs: Record<string, string> = {}): SVGElement {
  const node = document.createElementNS('http://www.w3.org/2000/svg', name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
}

function addTitle(card: HTMLElement, title?: string): void {
  if (title) card.appendChild(h('div', { class: 'iui-title' }, title));
}

export function renderHeatmap(spec: ChartSpec, ctx: RenderContext): HTMLElement {
  const card = h('div', { class: 'iui-card iui-chart-card iui-heatmap-card' });
  addTitle(card, spec.title);
  const labels = spec.labels;
  const rows = spec.datasets.map((dataset) => ({
    label: dataset.label,
    values: dataset.data.map((value) => typeof value === 'number' ? value : Number.NaN),
  }));
  const values = rows.flatMap((row) => row.values).filter(Number.isFinite);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const isDark = ctx.theme === 'dark';
  const grid = h('div', { class: 'iui-heatmap-grid', role: 'table', 'aria-label': spec.title || 'Heatmap' });
  grid.style.setProperty('--iui-heatmap-columns', String(labels.length));
  grid.appendChild(h('span', { class: 'iui-heatmap-corner', role: 'presentation' }));
  for (const label of labels) grid.appendChild(h('span', { class: 'iui-heatmap-col-label', role: 'columnheader', title: label }, label));

  rows.forEach((row) => {
    grid.appendChild(h('span', { class: 'iui-heatmap-row-label', role: 'rowheader', title: row.label }, row.label));
    row.values.forEach((value, index) => {
      const fraction = high === low ? 0.5 : Math.max(0, Math.min(1, (value - low) / (high - low)));
      const hue = 210 - fraction * 35;
      const lightness = isDark ? 22 + fraction * 32 : 96 - fraction * 30;
      const cell = h('span', {
        class: 'iui-heatmap-cell',
        role: 'cell',
        title: `${row.label} / ${labels[index]}: ${Number.isFinite(value) ? value : '—'}${spec.unit ? ` ${spec.unit}` : ''}`,
        'aria-label': `${row.label}, ${labels[index]}: ${Number.isFinite(value) ? value : 'no value'}`,
      }, Number.isFinite(value) ? new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value) : '—');
      cell.style.backgroundColor = `hsl(${hue} 52% ${lightness}%)`;
      cell.style.color = fraction > 0.63 ? (isDark ? '#101010' : '#fff') : (isDark ? '#f5f5f5' : '#292929');
      grid.appendChild(cell);
    });
  });

  card.appendChild(grid);
  if (values.length) {
    const legend = h('div', { class: 'iui-heatmap-legend', 'aria-hidden': 'true' },
      h('span', {}, new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(low)),
      h('span', { class: 'iui-heatmap-legend-bar' }),
      h('span', {}, `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(high)}${spec.unit ? ` ${spec.unit}` : ''}`),
    );
    card.appendChild(legend);
  }
  return card;
}

function project(lon: number, lat: number, width: number, height: number, pad: number): { x: number; y: number } {
  return {
    x: pad + ((lon + 180) / 360) * (width - pad * 2),
    y: pad + ((90 - lat) / 180) * (height - pad * 2),
  };
}

export function renderGeoChart(spec: ChartSpec): HTMLElement {
  const card = h('div', { class: 'iui-card iui-chart-card iui-geo-card' });
  addTitle(card, spec.title);
  const width = 720;
  const height = 330;
  const pad = 22;
  const svg = element('svg', {
    class: 'iui-geo-map', viewBox: `0 0 ${width} ${height}`, role: 'img',
    'aria-label': spec.title ? `Geographic chart: ${spec.title}` : 'Geographic chart of locations',
  });
  svg.appendChild(element('rect', { x: String(pad), y: String(pad), width: String(width - pad * 2), height: String(height - pad * 2), rx: '10', class: 'iui-geo-frame' }));
  for (const lon of [-120, -60, 0, 60, 120]) {
    const p = project(lon, 0, width, height, pad);
    svg.appendChild(element('line', { x1: String(p.x), y1: String(pad), x2: String(p.x), y2: String(height - pad), class: 'iui-geo-graticule' }));
  }
  for (const lat of [-60, -30, 0, 30, 60]) {
    const p = project(0, lat, width, height, pad);
    svg.appendChild(element('line', { x1: String(pad), y1: String(p.y), x2: String(width - pad), y2: String(p.y), class: 'iui-geo-graticule' }));
  }

  const points: { point: ChartPoint; label: string; series: number; color: string }[] = [];
  const colors = ['#5488c7', '#48a477', '#c88445', '#8c75bd', '#c45f75', '#4d9ca4'];
  spec.datasets.forEach((dataset, series) => dataset.data.forEach((raw, index) => {
    if (typeof raw !== 'number') points.push({
      point: raw,
      label: raw.label || `${dataset.label} ${index + 1}`,
      series,
      color: colors[series % colors.length],
    });
  }));

  const measuredValues = points.map((item) => item.point.value).filter((value): value is number => value !== undefined && Number.isFinite(value));
  const minimumValue = measuredValues.length ? Math.min(...measuredValues) : 0;
  const maximumValue = measuredValues.length ? Math.max(...measuredValues) : 0;
  for (const item of points) {
    const { x, y } = project(item.point.x, item.point.y, width, height, pad);
    const valueFraction = item.point.value === undefined || maximumValue === minimumValue
      ? 0.5
      : (item.point.value - minimumValue) / (maximumValue - minimumValue);
    const radius = Math.max(4, Math.min(16, item.point.r || 5 + valueFraction * 10));
    const dot = element('circle', { cx: String(x), cy: String(y), r: String(radius), fill: item.color, class: 'iui-geo-point' });
    const title = element('title');
    title.textContent = `${item.label}: ${item.point.y.toFixed(2)}°, ${item.point.x.toFixed(2)}°${item.point.value !== undefined ? ` · ${item.point.value}${spec.unit ? ` ${spec.unit}` : ''}` : ''}`;
    dot.appendChild(title);
    svg.appendChild(dot);
  }
  card.appendChild(svg);

  const key = h('div', { class: 'iui-geo-key', 'aria-label': 'Mapped locations' });
  for (const item of points.slice(0, 12)) {
    const dot = h('span', { class: 'iui-geo-key-dot', 'aria-hidden': 'true' });
    dot.style.backgroundColor = item.color;
    key.appendChild(h('span', { class: 'iui-geo-key-item', title: item.label }, dot, item.label));
  }
  if (points.length > 12) key.appendChild(h('span', { class: 'iui-geo-key-more' }, `+${points.length - 12} more`));
  card.appendChild(key);
  return card;
}

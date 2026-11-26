// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { parseNumericValue } from '../src/components/table';
import {
  LIGHT_SOLIDS,
  DARK_SOLIDS,
  LIGHT_INKS,
  DARK_INKS,
  hexToRgba,
  buildChartConfig,
} from '../src/components/chart';
import {
  LIGHT_THEME_VARIABLES,
  DARK_THEME_VARIABLES,
} from '../src/components/mermaid';
import { RENDERERS } from '../src/components/index';
import { renderChart } from '../src/components/chart';
import { renderCompare } from '../src/components/compare';
import { renderMermaid } from '../src/components/mermaid';
import { renderFlow } from '../src/components/flow';
import { renderTree } from '../src/components/tree';
import { renderStepper, stripStepTitleNumber } from '../src/components/stepper';
import { renderTimeline } from '../src/components/timeline';
import { ChartSpec, FlowSpec, TreeSpec } from '../src/core/types';

describe('parseNumericValue', () => {
  it('parses plain numbers', () => {
    expect(parseNumericValue('42')).toBe(42);
    expect(parseNumericValue('3.14')).toBe(3.14);
    expect(parseNumericValue('0')).toBe(0);
  });

  it('parses numbers with comma separators', () => {
    expect(parseNumericValue('1,200')).toBe(1200);
    expect(parseNumericValue('3,500,000')).toBe(3500000);
  });

  it('parses currency symbols', () => {
    expect(parseNumericValue('$500')).toBe(500);
    expect(parseNumericValue('€75.50')).toBe(75.5);
    expect(parseNumericValue('₹3.5k')).toBe(3500);
    expect(parseNumericValue('₹12k')).toBe(12000);
  });

  it('parses percentages', () => {
    expect(parseNumericValue('45%')).toBe(45);
    expect(parseNumericValue('4.5%')).toBe(4.5);
    expect(parseNumericValue('90%')).toBe(90);
  });

  it('parses multiplier suffixes k, M, B (case-insensitive)', () => {
    expect(parseNumericValue('2.4k')).toBe(2400);
    expect(parseNumericValue('1M')).toBe(1000000);
    expect(parseNumericValue('10M')).toBe(10000000);
    expect(parseNumericValue('1.5B')).toBe(1500000000);
    expect(parseNumericValue('500b')).toBe(500000000000);
  });

  it('parses negative numbers', () => {
    expect(parseNumericValue('-10')).toBe(-10);
    expect(parseNumericValue('-₹5.2k')).toBe(-5200);
  });

  it('returns null for non-numeric or mixed ratio/unit strings', () => {
    expect(parseNumericValue('100:1')).toBeNull();
    expect(parseNumericValue('1.8 TB')).toBeNull();
    expect(parseNumericValue('New URLs/day')).toBeNull();
    expect(parseNumericValue('')).toBeNull();
    expect(parseNumericValue('   ')).toBeNull();
  });
});

describe('Chart palettes and helpers', () => {
  it('has 7 pastel solid colours in exact specified order', () => {
    expect(LIGHT_SOLIDS).toEqual([
      '#A9D3F5', // sky
      '#A6DEC0', // mint
      '#F6C0A0', // peach
      '#C6B9F2', // lavender
      '#F2DC8A', // butter
      '#F2B1C0', // rose
      '#D6D6D3', // stone
    ]);

    expect(DARK_SOLIDS).toEqual([
      '#6FA8D6', // sky
      '#6DBF95', // mint
      '#D9946C', // peach
      '#9585D6', // lavender
      '#CDB45A', // butter
      '#D47F95', // rose
      '#8F8F8B', // stone
    ]);

    expect(LIGHT_INKS).toEqual([
      '#1F5F8F', // sky
      '#1E6B48', // mint
      '#8C4A20', // peach
      '#4C3D91', // lavender
      '#7A5E10', // butter
      '#8E2E46', // rose
      '#4A4A47', // stone
    ]);

    // Dark inks = the light solids
    expect(DARK_INKS).toEqual(LIGHT_SOLIDS);
  });

  it('hexToRgba correctly converts hex to rgba with alpha', () => {
    expect(hexToRgba('#A9D3F5', 0.35)).toBe('rgba(169, 211, 245, 0.35)');
    expect(hexToRgba('#000000', 1)).toBe('rgba(0, 0, 0, 1)');
    expect(hexToRgba('#FFFFFF', 0)).toBe('rgba(255, 255, 255, 0)');
  });

  it('buildChartConfig configures bar chart with zero begin, rounded bars and no animation', () => {
    const spec: ChartSpec = {
      type: 'chart',
      title: 'Redirects per day',
      chartType: 'bar',
      labels: ['Mon', 'Tue'],
      datasets: [{ label: 'Redirects', data: [10, 20] }],
      unit: 'M',
    };

    const config = buildChartConfig(spec, 'light');
    expect(config.type).toBe('bar');
    expect(config.options?.animation).toBe(false);
    expect(config.options?.responsive).toBe(true);
    expect(config.options?.maintainAspectRatio).toBe(false);

    // 1 dataset -> legend hidden
    expect(config.options?.plugins?.legend?.display).toBe(false);

    // Y scale begins at zero; X scale auto-skips overlapping labels
    const scales = config.options?.scales as any;
    expect(scales.y.beginAtZero).toBe(true);
    expect(scales.x.border.display).toBe(false);
    expect(scales.y.border.display).toBe(false);
    expect(scales.x.ticks.autoSkip).toBe(true);
    expect(scales.x.ticks.autoSkipPadding).toBe(14);
    expect(scales.x.ticks.maxRotation).toBe(35);

    // Dataset uses solid color and 1px ink border with radius 4 and balanced bar spacing
    const ds = config.data.datasets[0] as any;
    expect(ds.backgroundColor).toBe(LIGHT_SOLIDS[0]);
    expect(ds.borderColor).toBe(LIGHT_INKS[0]);
    expect(ds.borderWidth).toBe(1);
    expect(ds.borderRadius).toBe(4);
    expect(ds.maxBarThickness).toBe(28);
    expect(ds.barPercentage).toBe(0.72);
    expect(ds.categoryPercentage).toBe(0.78);
  });

  it('buildChartConfig configures line chart with smooth curves, hover targets and no area fill', () => {
    const spec: ChartSpec = {
      type: 'chart',
      chartType: 'line',
      labels: ['Mon', 'Tue'],
      datasets: [
        { label: 'Reads', data: [100, 200] },
        { label: 'Writes', data: [10, 20] },
      ],
    };

    const config = buildChartConfig(spec, 'light');
    expect(config.type).toBe('line');
    // 2 datasets -> legend shown at top left
    expect(config.options?.plugins?.legend?.display).toBe(true);
    expect(config.options?.plugins?.legend?.position).toBe('top');
    expect(config.options?.plugins?.legend?.align).toBe('start');

    const ds0 = config.data.datasets[0] as any;
    expect(ds0.tension).toBe(0.35);
    expect(ds0.borderWidth).toBe(2.5);
    expect(ds0.fill).toBe(false);
    expect(ds0.pointRadius).toBe(2.5);
    expect(ds0.pointHoverRadius).toBe(6);
    expect(ds0.pointBackgroundColor).toBe(LIGHT_SOLIDS[0]);
    expect(ds0.pointBorderColor).toBe(LIGHT_INKS[0]);

    const ds1 = config.data.datasets[1] as any;
    expect(ds1.pointBackgroundColor).toBe(LIGHT_SOLIDS[1]);
    expect(ds1.pointBorderColor).toBe(LIGHT_INKS[1]);
  });

  it('buildChartConfig configures doughnut chart with slice solids, card bg border and legend', () => {
    const spec: ChartSpec = {
      type: 'chart',
      chartType: 'doughnut',
      labels: ['URLs', 'Logs'],
      datasets: [{ label: 'Size', data: [300, 100] }],
    };

    const lightConfig = buildChartConfig(spec, 'light');
    expect(lightConfig.type).toBe('doughnut');
    // Legend shown at bottom when more than one slice label
    expect(lightConfig.options?.plugins?.legend?.display).toBe(true);
    expect(lightConfig.options?.plugins?.legend?.position).toBe('bottom');
    // Scales should be undefined for pie/doughnut
    expect(lightConfig.options?.scales).toBeUndefined();

    const dsLight = lightConfig.data.datasets[0] as any;
    expect(dsLight.backgroundColor).toEqual([LIGHT_SOLIDS[0], LIGHT_SOLIDS[1]]);
    expect(dsLight.borderColor).toBe('#FFFFFF');
    expect(dsLight.borderWidth).toBe(2);

    const darkConfig = buildChartConfig(spec, 'dark');
    const dsDark = darkConfig.data.datasets[0] as any;
    expect(dsDark.backgroundColor).toEqual([DARK_SOLIDS[0], DARK_SOLIDS[1]]);
    expect(dsDark.borderColor).toBe('#0A0A0A');
  });

  it('buildChartConfig configures radar chart with 1.5px stroke, 35% alpha fill and r scale', () => {
    const spec: ChartSpec = {
      type: 'chart',
      chartType: 'radar',
      labels: ['Speed', 'Cost'],
      datasets: [{ label: 'System A', data: [90, 80] }],
    };

    const config = buildChartConfig(spec, 'light');
    expect(config.type).toBe('radar');
    const scales = config.options?.scales as any;
    expect(scales.r).toBeDefined();
    expect(scales.r.ticks.maxTicksLimit).toBe(5);
    expect(scales.r.ticks.backdropColor).toBe('transparent');
    expect(scales.r.pointLabels.padding).toBe(10);
    expect(scales.x).toBeUndefined();
    expect(scales.y).toBeUndefined();

    const ds = config.data.datasets[0] as any;
    expect(ds.borderWidth).toBe(1.5);
    expect(ds.borderColor).toBe(LIGHT_INKS[0]);
    expect(ds.backgroundColor).toBe(hexToRgba(LIGHT_SOLIDS[0], 0.35));
    expect(ds.fill).toBe(true);
  });

  it('tooltip label callback formats value with toLocaleString and unit', () => {
    const spec: ChartSpec = {
      type: 'chart',
      chartType: 'bar',
      labels: ['Mon'],
      datasets: [{ label: 'Count', data: [1500000] }],
      unit: 'req/s',
    };
    const config = buildChartConfig(spec, 'light');
    const callback = config.options?.plugins?.tooltip?.callbacks?.label as any;
    expect(callback).toBeDefined();

    const labelResult = callback({
      raw: 1500000,
      dataset: { label: 'Count' },
    });
    expect(labelResult).toContain((1500000).toLocaleString());
    expect(labelResult).toContain('req/s');
    expect(labelResult).toContain('Count:');
  });

  it('configures area, scatter, and bubble charts with their expected data shapes', () => {
    const area = buildChartConfig({
      type: 'chart', chartType: 'area', labels: ['Mon', 'Tue'], xLabel: 'Day', yLabel: 'Requests',
      datasets: [{ label: 'Traffic', data: [10, 20] }],
    }, 'light');
    expect(area.type).toBe('line');
    expect((area.data.datasets[0] as any).fill).toBe('origin');
    expect((area.options?.scales as any).x.title.display).toBe(true);
    expect((area.options?.scales as any).x.title.text).toBe('Day');
    expect((area.options?.scales as any).y.title.display).toBe(true);
    expect((area.options?.scales as any).y.title.text).toBe('Requests');

    const scatter = buildChartConfig({
      type: 'chart', chartType: 'scatter', labels: [], xLabel: 'Requests', yLabel: 'Latency',
      datasets: [{ label: 'Samples', data: [{ x: 4, y: 18 }] }],
    }, 'light');
    expect(scatter.type).toBe('scatter');
    expect((scatter.options?.scales as any).x.type).toBe('linear');
    expect((scatter.data.datasets[0] as any).data).toEqual([{ x: 4, y: 18 }]);

    const bubble = buildChartConfig({
      type: 'chart', chartType: 'bubble', labels: [],
      datasets: [{ label: 'Accounts', data: [{ x: 4, y: 18, r: 7 }] }],
    }, 'light');
    expect(bubble.type).toBe('bubble');
    expect((bubble.data.datasets[0] as any).data[0].r).toBe(7);
  });
});

describe('Mermaid theme variables', () => {
  it('defines readable, distinct light and dark palettes for nodes, labels, edges and notes', () => {
    for (const variables of [LIGHT_THEME_VARIABLES, DARK_THEME_VARIABLES]) {
      expect(variables.primaryColor).toMatch(/^#[0-9A-F]{6}$/i);
      expect(variables.primaryBorderColor).toMatch(/^#[0-9A-F]{6}$/i);
      expect(variables.primaryTextColor).toMatch(/^#[0-9A-F]{6}$/i);
      expect(variables.secondaryTextColor).toMatch(/^#[0-9A-F]{6}$/i);
      expect(variables.tertiaryTextColor).toMatch(/^#[0-9A-F]{6}$/i);
      expect(variables.lineColor).toMatch(/^#[0-9A-F]{6}$/i);
      expect(variables.noteBkgColor).toMatch(/^#[0-9A-F]{6}$/i);
      expect(variables.noteBorderColor).toMatch(/^#[0-9A-F]{6}$/i);
      expect(variables.actorBkg).toMatch(/^#[0-9A-F]{6}$/i);
      expect(variables.actorBorder).toMatch(/^#[0-9A-F]{6}$/i);
    }
    expect(LIGHT_THEME_VARIABLES.primaryColor).not.toBe(DARK_THEME_VARIABLES.primaryColor);
    expect(LIGHT_THEME_VARIABLES.primaryTextColor).not.toBe(DARK_THEME_VARIABLES.primaryTextColor);
    expect(LIGHT_THEME_VARIABLES.clusterBkg).toBe('#FFFFFF');
    expect(DARK_THEME_VARIABLES.clusterBkg).toBe('#101012');
    expect(DARK_THEME_VARIABLES.primaryColor).toBe('#18181B');
    expect(LIGHT_THEME_VARIABLES.background).toBe('transparent');
    expect(DARK_THEME_VARIABLES.background).toBe('transparent');
  });
});

describe('RENDERERS registry', () => {
  it('maps all UI_TYPES to renderer functions and does not use debug renderer', () => {
    expect(RENDERERS.chart).toBe(renderChart);
    expect(RENDERERS.mermaid).toBe(renderMermaid);
    expect(typeof RENDERERS.flow).toBe('function');
    expect(typeof RENDERERS.stepper).toBe('function');
    expect(typeof RENDERERS.table).toBe('function');
    expect(typeof RENDERERS.compare).toBe('function');
    expect(typeof RENDERERS.quiz).toBe('function');
    expect(typeof RENDERERS.callout).toBe('function');
    expect(typeof RENDERERS.stats).toBe('function');
    expect(typeof RENDERERS.tabs).toBe('function');
    expect(typeof RENDERERS.timeline).toBe('function');
    expect(typeof RENDERERS.followups).toBe('function');
    expect(typeof RENDERERS.math).toBe('function');
    expect(typeof RENDERERS.code).toBe('function');
    expect(typeof RENDERERS.checklist).toBe('function');
    expect(typeof RENDERERS.form).toBe('function');
    expect(typeof RENDERERS.image).toBe('function');
    expect(typeof RENDERERS.dashboard).toBe('function');
    expect(typeof RENDERERS.generic).toBe('function');
  });

  it('renders quiz component into DOM nodes with questions, options, and score', () => {
    const ctx = { theme: 'light' as const, onCleanup: () => {} };
    const quizEl = RENDERERS.quiz(
      {
        type: 'quiz',
        title: 'Networking Basics',
        questions: [
          {
            q: 'What is port 80?',
            options: ['HTTP', 'SSH', 'FTP'],
            answer: 0,
            explain: 'Port 80 is used for HTTP.',
          },
          {
            q: 'What is port 443?',
            options: ['HTTPS', 'DNS'],
            answer: 0,
            explain: 'Port 443 is used for HTTPS.',
          },
        ],
      },
      ctx,
    );
    expect(quizEl.classList.contains('iui-card')).toBe(true);
    expect(quizEl.textContent).toContain('1 of 2');
    expect(quizEl.textContent).toContain('What is port 80?');
    expect(quizEl.textContent).not.toContain('What is port 443?');

    const optButtons = quizEl.querySelectorAll<HTMLButtonElement>('.iui-quiz-opt-row');
    expect(optButtons).toHaveLength(3);

    // Click correct option
    optButtons[0].click();
    const updatedButtons = quizEl.querySelectorAll<HTMLButtonElement>('.iui-quiz-opt-row');
    expect(updatedButtons[0].classList.contains('is-correct')).toBe(true);
    expect(quizEl.textContent).toContain('Port 80 is used for HTTP.');

    // Navigation works
    const nextBtn = quizEl.querySelector<HTMLButtonElement>('button[aria-label="Next question"]')!;
    expect(nextBtn).not.toBeNull();
    nextBtn.click();
    expect(quizEl.textContent).toContain('2 of 2');
    expect(quizEl.textContent).toContain('What is port 443?');
  });

  it('renders an interactive checklist with progress and bulk completion controls', () => {
    const checklist = RENDERERS.checklist({
      type: 'checklist',
      title: 'Launch checklist',
      items: [
        { text: 'Configure domain', detail: 'Add DNS records' },
        { text: 'Run smoke tests', checked: true },
      ],
    }, { theme: 'light', onCleanup: () => {} });
    const rows = checklist.querySelectorAll<HTMLLabelElement>('.iui-checklist-row');
    const progress = checklist.querySelector<HTMLElement>('[role="progressbar"]')!;
    const bulk = checklist.querySelector<HTMLButtonElement>('.iui-checklist-bulk')!;
    expect(rows).toHaveLength(2);
    expect(progress.getAttribute('aria-valuenow')).toBe('1');
    expect(checklist.textContent).toContain('1 of 2 completed');
    expect(checklist.textContent).toContain('Add DNS records');

    const firstInput = rows[0].querySelector<HTMLInputElement>('input')!;
    firstInput.checked = true;
    firstInput.dispatchEvent(new Event('change', { bubbles: true }));
    expect(progress.getAttribute('aria-valuenow')).toBe('2');
    expect(checklist.classList.contains('is-complete')).toBe(true);
    expect(bulk.textContent).toBe('Clear all');

    bulk.click();
    expect(progress.getAttribute('aria-valuenow')).toBe('0');
    expect(checklist.classList.contains('is-complete')).toBe(false);
  });

  it('renders an interactive form with native validation, controls and a response summary', () => {
    const formCard = RENDERERS.form({
      type: 'form', title: 'Project setup', submitLabel: 'Review',
      fields: [
        { id: 'name', label: 'Project name', type: 'text', required: true },
        { id: 'plan', label: 'Plan', type: 'radio', options: ['Basic', 'Pro'], value: 'Pro' },
        { id: 'updates', label: 'Updates', type: 'checkbox', value: true },
        { id: 'budget', label: 'Budget', type: 'range', min: 0, max: 100, value: 40 },
      ],
    }, { theme: 'light', onCleanup: () => {} });
    const form = formCard.querySelector('form')!;
    expect(formCard.textContent).toContain('Project setup');
    expect(form.querySelectorAll('.iui-form-field')).toHaveLength(4);
    expect(form.querySelector<HTMLInputElement>('input[type="range"]')?.value).toBe('40');
    expect(form.querySelector<HTMLInputElement>('input[type="radio"]:checked')?.value).toBe('Pro');
    expect(form.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked).toBe(true);

    const name = form.querySelector<HTMLInputElement>('input[name="name"]')!;
    name.value = 'BetterView';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    const result = formCard.querySelector<HTMLElement>('.iui-form-result')!;
    expect(result.hidden).toBe(false);
    expect(result.textContent).toContain('Response ready');
    expect(result.textContent).toContain('BetterView');
    expect(result.textContent).toContain('Pro');
    expect(result.textContent).toContain('Yes');
    form.dispatchEvent(new Event('reset', { bubbles: true }));
    expect(result.hidden).toBe(true);
  });

  it('renders image, heatmap, geographic points, and a compact dashboard', () => {
    const ctx = { theme: 'light' as const, onCleanup: () => {} };
    const image = RENDERERS.image({
      type: 'image', title: 'Architecture', src: 'https://example.com/architecture.png',
      alt: 'Services connected by arrows', caption: 'Request path', aspect: 'wide',
    }, ctx);
    expect(image.querySelector('img')?.getAttribute('alt')).toBe('Services connected by arrows');
    expect(image.querySelector('img')?.getAttribute('referrerpolicy')).toBe('no-referrer');
    expect(image.textContent).toContain('Request path');

    const heatmap = renderChart({
      type: 'chart', chartType: 'heatmap', title: 'Latency by day', labels: ['Mon', 'Tue'],
      datasets: [{ label: 'API', data: [18, 34] }, { label: 'Cache', data: [3, 7] }],
    }, ctx);
    expect(heatmap.querySelectorAll('.iui-heatmap-cell')).toHaveLength(4);
    expect(heatmap.textContent).toContain('Latency by day');
    expect(heatmap.getAttribute('data-theme')).toBe('light');
    const darkHeatmap = renderChart({
      type: 'chart', chartType: 'heatmap', title: 'Latency by day', labels: ['Mon', 'Tue'],
      datasets: [{ label: 'API', data: [18, 34] }],
    }, { ...ctx, theme: 'dark' });
    expect((darkHeatmap.querySelector('.iui-heatmap-legend-bar') as HTMLElement)?.style.background).toContain('22%');

    const barPlotCard = renderChart({
      type: 'chart', chartType: 'bar', title: 'Traffic', labels: ['Mon', 'Tue'],
      datasets: [{ label: 'Requests', data: [10, 20] }],
    }, ctx);
    const plotEl = barPlotCard.querySelector('.iui-chart-plot') as HTMLElement;
    expect(plotEl.getAttribute('data-chart-type')).toBe('bar');
    expect(plotEl.getAttribute('data-has-legend')).toBe('false');
    expect(plotEl.style.height).toBe('');

    const geo = renderChart({
      type: 'chart', chartType: 'geo', title: 'Events by region', labels: [],
      datasets: [{ label: 'Cities', data: [{ x: -73.9, y: 40.7, label: 'New York' }, { x: 139.7, y: 35.7, label: 'Tokyo' }] }],
    }, ctx);
    expect(geo.querySelectorAll('.iui-geo-point')).toHaveLength(2);
    expect(geo.textContent).toContain('New York');

    const regionalGeo = renderChart({
      type: 'chart', chartType: 'geo', title: 'US Hubs', labels: [],
      datasets: [
        { label: 'East', data: [{ x: -74.0, y: 40.7, label: 'NYC' }] },
        { label: 'West', data: [{ x: -122.4, y: 37.8, label: 'SF' }] },
      ],
    }, ctx);
    const regionalDots = Array.from(regionalGeo.querySelectorAll('.iui-geo-point'));
    const cx0 = Number(regionalDots[0].getAttribute('cx'));
    const cx1 = Number(regionalDots[1].getAttribute('cx'));
    expect(Math.abs(cx0 - cx1)).toBeGreaterThan(200);
    const geoKeyItems = Array.from(regionalGeo.querySelectorAll('.iui-geo-key-item')).map((el) => el.textContent);
    expect(geoKeyItems).toEqual(['East', 'West']);

    const dashboard = RENDERERS.dashboard({
      type: 'dashboard', title: 'Service snapshot',
      items: [
        { title: 'Availability', visual: { type: 'stats', items: [{ label: 'Uptime', value: '99.9%' }, { label: 'Errors', value: '0.1%' }] } },
        { title: 'Traffic', visual: { type: 'callout', tone: 'info', text: 'Traffic is within the normal range.' } },
      ],
    }, ctx);
    expect(dashboard.querySelectorAll('.iui-dashboard-panel')).toHaveLength(2);
    expect(dashboard.querySelectorAll('.iui-dashboard-visual')).toHaveLength(2);
    expect(dashboard.querySelectorAll('.iui-dashboard-panel-title')).toHaveLength(2);
    expect(dashboard.textContent).toContain('Service snapshot');
  });

  it('exposes chart/table switching as accessible toggle buttons and labelled regions', () => {
    const card = renderChart({
      type: 'chart', chartType: 'bar', title: 'Requests', labels: ['Mon'],
      datasets: [{ label: 'Count', data: [12] }],
    }, { theme: 'light', onCleanup: () => {} });
    const buttons = Array.from(card.querySelectorAll<HTMLButtonElement>('.iui-chart-view-btn'));
    expect(card.querySelector('.iui-chart-view-switch')?.getAttribute('role')).toBe('group');
    expect(buttons.map((button) => button.getAttribute('aria-pressed'))).toEqual(['true', 'false']);
    expect(card.querySelector('.iui-chart-plot')?.getAttribute('aria-label')).toBe('bar chart: Requests');

    buttons[1].click();
    expect(buttons.map((button) => button.getAttribute('aria-pressed'))).toEqual(['false', 'true']);
    const tableRegion = card.querySelector<HTMLElement>('.iui-chart-table-view');
    expect(tableRegion?.getAttribute('aria-label')).toBe('Requests data table');
    expect(tableRegion?.hidden).toBe(false);
    expect(card.querySelector<HTMLElement>('.iui-chart-plot')?.hidden).toBe(true);
    expect(tableRegion?.querySelector('.iui-table-view-switch')).toBeNull();
    expect(tableRegion?.querySelector('.iui-table-chart-view, .iui-table-cards-view')).toBeNull();
  });

  it('exposes comparison panels as keyboard-operable toggle buttons', () => {
    const card = renderCompare({
      type: 'compare', items: [
        { label: 'Option A', tone: 'good', points: ['Fast'] },
        { label: 'Option B', tone: 'neutral', points: ['Flexible'] },
      ],
    }, { theme: 'light', onCleanup: () => {} });
    const panels = Array.from(card.querySelectorAll<HTMLElement>('.iui-compare-panel'));
    expect(panels.map((panel) => panel.getAttribute('role'))).toEqual(['button', 'button']);
    expect(panels.map((panel) => panel.getAttribute('aria-pressed'))).toEqual(['false', 'false']);

    panels[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(panels.map((panel) => panel.getAttribute('aria-pressed'))).toEqual(['false', 'true']);
    panels[1].click();
    expect(panels.map((panel) => panel.getAttribute('aria-pressed'))).toEqual(['false', 'false']);
  });

  it('renders generic fallback card into DOM with readable key-value and list layout', () => {
    const ctx = { theme: 'light' as const, onCleanup: () => {} };
    const genericEl = RENDERERS.generic(
      {
        type: 'generic',
        title: 'User Profile',
        data: {
          username: 'alice',
          active: true,
          roles: ['admin', 'editor'],
          metrics: { loginCount: 42 },
        },
      },
      ctx,
    );
    expect(genericEl.classList.contains('iui-card')).toBe(true);
    expect(genericEl.textContent).toContain('User Profile');
    expect(genericEl.textContent).toContain('Username');
    expect(genericEl.textContent).toContain('alice');
    expect(genericEl.textContent).toContain('Roles');
    expect(genericEl.textContent).toContain('admin');
  });

  it('renders all 5 new components into DOM nodes cleanly', () => {
    const ctx = { theme: 'light' as const, onCleanup: () => {} };

    const calloutEl = RENDERERS.callout(
      { type: 'callout', tone: 'tip', title: 'Tip', text: 'Use caching' },
      ctx,
    );
    expect(calloutEl.classList.contains('iui-card')).toBe(true);
    expect(calloutEl.textContent).toContain('Use caching');

    const statsEl = RENDERERS.stats(
      { type: 'stats', items: [{ label: 'QPS', value: '10k', delta: '+5%' }, { label: 'Errors', value: '0%' }] },
      ctx,
    );
    expect(statsEl.querySelectorAll('.iui-stat-item')).toHaveLength(2);
    expect(statsEl.querySelector('.iui-stat-delta')?.classList.contains('iui-chip')).toBe(false);

    const tabsEl = RENDERERS.tabs(
      { type: 'tabs', tabs: [{ label: 'T1', content: 'C1' }, { label: 'T2', content: ['A', 'B'] }] },
      ctx,
    );
    expect(tabsEl.querySelectorAll('.iui-tabs-btn')).toHaveLength(2);

    const timelineEl = RENDERERS.timeline(
      { type: 'timeline', events: [{ title: 'Milestone 1', time: 'Jan', text: 'Started' }] },
      ctx,
    );
    expect(timelineEl.querySelectorAll('.iui-timeline-row')).toHaveLength(1);

    const followupsEl = RENDERERS.followups(
      { type: 'followups', suggestions: ['Why use SQL?', 'Cost breakdown'] },
      ctx,
    );
    expect(followupsEl.querySelectorAll('.iui-followup-chip')).toHaveLength(2);
  });
});

describe('Timeline expansion and status filtering', () => {
  const events = [
    { title: 'Done one', text: 'Done detail one', status: 'done' as const },
    { title: 'Active one', text: 'Active detail one', status: 'active' as const },
    { title: 'Upcoming one', text: 'Upcoming detail one', status: 'upcoming' as const },
    { title: 'Done two', text: 'Done detail two', status: 'done' as const },
    { title: 'Active two', text: 'Active detail two', status: 'active' as const },
    { title: 'Upcoming two', text: 'Upcoming detail two', status: 'upcoming' as const },
    { title: 'Unassigned', text: 'Unassigned detail' },
  ];

  it('preserves per-row expansion when status filters are changed', () => {
    const card = renderTimeline({ type: 'timeline', events }, { theme: 'light', onCleanup: () => {} });
    const rows = Array.from(card.querySelectorAll<HTMLElement>('.iui-timeline-row'));
    const details = rows.map((row) => row.querySelector<HTMLElement>('.iui-timeline-text')!);

    rows[0].click();
    rows[1].click();
    expect(rows[0].getAttribute('aria-expanded')).toBe('true');
    expect(details[0].hidden).toBe(false);
    expect(rows[1].getAttribute('aria-expanded')).toBe('true');

    const activePill = card.querySelector<HTMLButtonElement>('.iui-timeline-filter-pill:not(.is-active)')!;
    activePill.click();
    expect(activePill.getAttribute('aria-pressed')).toBe('true');
    expect(card.querySelector('.iui-timeline-filter-pill.is-active')?.getAttribute('aria-pressed')).toBe('true');
    expect(rows[0].hidden).toBe(false);
    expect(rows[1].hidden).toBe(true);
    expect(rows[0].getAttribute('aria-expanded')).toBe('true');
    expect(details[0].hidden).toBe(false);
    expect(rows[1].getAttribute('aria-expanded')).toBe('true');
    expect(details[1].hidden).toBe(false);

    card.querySelector<HTMLButtonElement>('.iui-timeline-filter-pill.is-active')!.click();
    expect(rows.every((row) => !row.hidden)).toBe(true);
    expect(rows[0].getAttribute('aria-expanded')).toBe('true');
    expect(details[0].hidden).toBe(false);
    expect(rows[1].getAttribute('aria-expanded')).toBe('true');
    expect(details[1].hidden).toBe(false);
  });

  it('keeps individual expansion coherent after expand-all, collapse-all, and filtering', () => {
    const card = renderTimeline({ type: 'timeline', events }, { theme: 'light', onCleanup: () => {} });
    const rows = Array.from(card.querySelectorAll<HTMLElement>('.iui-timeline-row'));
    const details = rows.map((row) => row.querySelector<HTMLElement>('.iui-timeline-text')!);
    const bulkButton = card.querySelector<HTMLButtonElement>('.iui-timeline-expand-btn')!;

    bulkButton.click();
    expect(bulkButton.getAttribute('aria-pressed')).toBe('true');
    expect(rows.every((row) => row.getAttribute('aria-expanded') === 'true')).toBe(true);
    expect(details.every((detail) => !detail.hidden)).toBe(true);

    rows[0].click();
    expect(rows[0].getAttribute('aria-expanded')).toBe('false');
    expect(details[0].hidden).toBe(true);

    // The first status pill is Done. Filtering must not reset row expansion.
    card.querySelector<HTMLButtonElement>('.iui-timeline-filter-pill:not(.is-active)')!.click();
    expect(rows[0].hidden).toBe(false);
    expect(rows[0].getAttribute('aria-expanded')).toBe('false');
    expect(details[0].hidden).toBe(true);
    expect(rows[3].getAttribute('aria-expanded')).toBe('true');
    expect(details[3].hidden).toBe(false);

    bulkButton.click();
    expect(bulkButton.getAttribute('aria-pressed')).toBe('false');
    expect(rows.every((row) => row.getAttribute('aria-expanded') === 'false')).toBe(true);
    expect(details.every((detail) => detail.hidden)).toBe(true);
  });

  it('excludes statusless events from a status-specific filter', () => {
    const card = renderTimeline({ type: 'timeline', events }, { theme: 'light', onCleanup: () => {} });
    const rows = Array.from(card.querySelectorAll<HTMLElement>('.iui-timeline-row'));
    const statuslessRow = rows[6];

    expect(statuslessRow.hidden).toBe(false);
    card.querySelector<HTMLButtonElement>('.iui-timeline-filter-pill:not(.is-active)')!.click();
    expect(rows[0].hidden).toBe(false);
    expect(rows[3].hidden).toBe(false);
    expect(statuslessRow.hidden).toBe(true);
  });
});

describe('Flow diagrams', () => {
  it('renders a small flow as an accessible movable graph with zoom controls', () => {
    const cleanups: (() => void)[] = [];
    const ctx = { theme: 'light' as const, onCleanup: (fn: () => void) => cleanups.push(fn) };
    const spec: FlowSpec = {
      type: 'flow',
      title: 'OAuth flow',
      nodes: [
        { id: 'user', label: 'Resource owner' },
        { id: 'client', label: 'Client application' },
        { id: 'server', label: 'Authorization server' },
      ],
      edges: [
        { from: 'user', to: 'client', label: 'Starts login' },
        { from: 'client', to: 'server', label: 'Requests authorization' },
      ],
    };
    const card = renderFlow(spec, ctx);
    const diagram = card.querySelector<HTMLElement>('.flow-diagram')!;
    const viewport = card.querySelector<HTMLElement>('.flow-viewport')!;
    const flowInner = card.querySelector<HTMLElement>('.flow-inner')!;

    expect(diagram.getAttribute('role')).toBe('region');
    expect(viewport.getAttribute('role')).toBe('region');
    expect(viewport.getAttribute('aria-label')).toBe('Flow diagram: OAuth flow, 3 nodes');
    expect(flowInner).not.toBeNull();
    expect(card.querySelectorAll('.flow-node')).toHaveLength(3);
    expect(card.querySelectorAll('.flow-edge-path')).toHaveLength(2);
    expect(card.querySelectorAll('.flow-control-btn')).toHaveLength(3);
    expect(card.querySelector('.flow-svg-overlay')).not.toBeNull();
    expect(diagram.querySelector('.iui-sr-only')?.textContent).toContain('Resource owner → Client application (Starts login)');
    expect(diagram.querySelector('.iui-sr-only')?.textContent).toContain('Client application → Authorization server (Requests authorization)');

    card.querySelector<HTMLButtonElement>('[aria-label="Zoom in"]')!.click();
    expect(card.querySelector('.flow-zoom-value')?.textContent).toBe('115%');
    cleanups.forEach((cleanup) => cleanup());
  });

  it('keeps a crowded URL-shortener graph pannable and exposes every connection', () => {
    const cleanups: (() => void)[] = [];
    const ctx = { theme: 'light' as const, onCleanup: (fn: () => void) => cleanups.push(fn) };
    const spec: FlowSpec = {
      type: 'flow',
      title: 'URL shortener architecture',
      nodes: [
        { id: 'client', label: 'Client app' },
        { id: 'api', label: 'Shorten API' },
        { id: 'validate', label: 'Validate URL' },
        { id: 'encode', label: 'Generate Base62 code' },
        { id: 'mapping', label: 'URL mapping store' },
        { id: 'redirect', label: 'Redirect service' },
        { id: 'cache', label: 'Redirect cache' },
        { id: 'target', label: 'Destination URL' },
        { id: 'missing', label: 'Expired or missing code' },
        { id: 'events', label: 'Click events' },
        { id: 'queue', label: 'Event queue' },
        { id: 'analytics', label: 'Analytics store' },
      ],
      edges: [
        { from: 'client', to: 'api', label: 'POST /shorten' },
        { from: 'api', to: 'validate', label: 'Check request' },
        { from: 'validate', to: 'encode', label: 'Valid URL' },
        { from: 'encode', to: 'mapping', label: 'Write mapping' },
        { from: 'mapping', to: 'cache', label: 'Warm cache' },
        { from: 'client', to: 'redirect', label: 'GET /:code' },
        { from: 'redirect', to: 'cache', label: 'Lookup' },
        { from: 'cache', to: 'mapping', label: 'Cache miss' },
        { from: 'redirect', to: 'target', label: '302 redirect' },
        { from: 'redirect', to: 'missing', label: 'Expired / unknown' },
        { from: 'target', to: 'events', label: 'Record click' },
        { from: 'events', to: 'queue', label: 'Publish event' },
        { from: 'queue', to: 'analytics', label: 'Batch write' },
      ],
    };
    const card = renderFlow(spec, ctx);
    const diagram = card.querySelector<HTMLElement>('.flow-diagram')!;
    const viewport = card.querySelector<HTMLElement>('.flow-viewport')!;

    expect(viewport.getAttribute('role')).toBe('region');
    expect(viewport.getAttribute('aria-label')).toBe('Flow diagram: URL shortener architecture, 12 nodes');
    expect(card.querySelectorAll('.flow-node')).toHaveLength(12);
    expect(card.querySelectorAll('.flow-edge-path')).toHaveLength(13);
    expect(diagram.querySelectorAll('.iui-sr-only li')).toHaveLength(13);
    expect(diagram.querySelector('.iui-sr-only')?.textContent).toContain('Client app → Shorten API (POST /shorten)');
    expect(card.querySelectorAll('.flow-control-btn')).toHaveLength(3);

    cleanups.forEach((cleanup) => cleanup());
  });

  it('strips leading number patterns from step titles', () => {
    expect(stripStepTitleNumber('1. Browser Cache')).toBe('Browser Cache');
    expect(stripStepTitleNumber('Step 2: DNS Lookup')).toBe('DNS Lookup');
    expect(stripStepTitleNumber('3) TCP Handshake')).toBe('TCP Handshake');
    expect(stripStepTitleNumber('4 - TLS Negotiation')).toBe('TLS Negotiation');
    expect(stripStepTitleNumber('step  5.  HTTP Request')).toBe('HTTP Request');
    expect(stripStepTitleNumber('No Number Title')).toBe('No Number Title');
  });

  it('renders stepper without double numbering and without collapse chevrons', () => {
    const cleanups: (() => void)[] = [];
    const ctx = { theme: 'light' as const, onCleanup: (fn: () => void) => cleanups.push(fn) };
    const spec = {
      type: 'stepper' as const,
      title: 'Loading Steps',
      steps: [
        { title: '1. Browser Cache', detail: 'Check cache' },
        { title: 'Step 2: DNS Lookup', detail: 'Resolve IP' },
        { title: '3) TCP Handshake', detail: 'Connect socket' },
        { title: 'Plain Step', detail: 'Render page' },
      ],
    };
    const card = renderStepper(spec, ctx);
    const titles = Array.from(card.querySelectorAll('.iui-stepper-title')).map((el) => el.textContent?.trim());
    expect(titles).toEqual([
      'Browser Cache',
      'DNS Lookup',
      'TCP Handshake',
      'Plain Step',
    ]);
    expect(card.querySelectorAll('.iui-stepper-chevron')).toHaveLength(0);
    expect(card.querySelectorAll('.iui-stepper-btn')).toHaveLength(0);
    expect(card.querySelectorAll('.iui-stepper-detail')).toHaveLength(4);
    cleanups.forEach((c) => c());
  });
});

describe('Tree diagrams', () => {
  it('keeps search filtering and expanded ancestors when switching views', () => {
    const spec: TreeSpec = {
      type: 'tree',
      title: 'Product map',
      root: {
        id: 'root', label: 'Product', collapsed: true,
        children: [{
          id: 'platform', label: 'Platform', collapsed: true,
          children: [{ id: 'api', label: 'Public API' }],
        }],
      },
    };
    const card = renderTree(spec, { theme: 'light', onCleanup: () => {} });
    const search = card.querySelector<HTMLInputElement>('.iui-tree-search')!;

    expect(card.querySelector('.iui-tree-title')?.textContent).toBe('Product map');
    search.value = 'public api';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    expect(card.querySelector<HTMLElement>('.iui-tree-dn-children')?.style.display).toBe('');

    card.querySelector<HTMLButtonElement>('.iui-tree-toggle-btn:not(.is-active)')!.click();
    expect(card.querySelector('.iui-tree-ol-item.is-search-match')?.textContent).toContain('Public API');
    expect(card.querySelector<HTMLElement>('.iui-tree-ol-children')?.style.display).toBe('');
    expect(card.querySelector<HTMLElement>('.iui-tree-ol-item[data-node-id="root"]')?.getAttribute('aria-expanded')).toBe('true');
  });

  it('keeps expansion state and aria-expanded synchronized in both views and bulk controls', () => {
    const card = renderTree({
      type: 'tree',
      root: { id: 'root', label: 'Root', collapsed: true, children: [{ id: 'branch', label: 'Branch', children: [{ id: 'leaf', label: 'Leaf' }] }] },
    }, { theme: 'light', onCleanup: () => {} });
    const diagramRoot = card.querySelector<HTMLElement>('.iui-tree-dn-node[data-node-id="root"]')!;
    expect(card.querySelector('.iui-tree-diagram[role="tree"]')).not.toBeNull();
    expect(diagramRoot.getAttribute('aria-expanded')).toBe('false');
    expect(diagramRoot.getAttribute('aria-level')).toBe('1');
    expect(card.querySelector(`#${diagramRoot.getAttribute('aria-owns')}`)?.getAttribute('role')).toBe('group');
    diagramRoot.querySelector<HTMLButtonElement>('.iui-tree-dn-chevron')!.click();
    expect(diagramRoot.getAttribute('aria-expanded')).toBe('true');

    card.querySelector<HTMLButtonElement>('.iui-tree-ctrl-btn[title="Collapse all"]')!.click();
    expect(diagramRoot.getAttribute('aria-expanded')).toBe('false');
    card.querySelector<HTMLButtonElement>('.iui-tree-toggle-btn:not(.is-active)')!.click();

    const outlineRoot = card.querySelector<HTMLElement>('.iui-tree-ol-item[data-node-id="root"]')!;
    expect(outlineRoot.getAttribute('aria-expanded')).toBe('false');
    expect(outlineRoot.querySelector<HTMLElement>('.iui-tree-ol-children')!.style.display).toBe('none');
    card.querySelector<HTMLButtonElement>('.iui-tree-ctrl-btn[title="Expand all"]')!.click();
    expect(outlineRoot.getAttribute('aria-expanded')).toBe('true');

    card.querySelector<HTMLButtonElement>('.iui-tree-toggle-btn:not(.is-active)')!.click();
    expect(card.querySelector<HTMLElement>('.iui-tree-dn-node[data-node-id="root"]')?.getAttribute('aria-expanded')).toBe('true');
  });

  it('supports diagram tree arrow navigation and hides collapsed branch connectors', () => {
    const card = renderTree({
      type: 'tree',
      layout: 'vertical',
      root: {
        id: 'root', label: 'Root', collapsed: true,
        children: [{ id: 'branch', label: 'Branch', children: [{ id: 'leaf', label: 'Leaf' }] }],
      },
    }, { theme: 'light', onCleanup: () => {} });
    document.body.appendChild(card);

    const rootWrapper = card.querySelector<HTMLElement>('.iui-tree-dn-wrapper[data-node-id="root"]')!;
    const root = rootWrapper.querySelector<HTMLElement>(':scope > .iui-tree-dn-node')!;
    expect(rootWrapper.classList.contains('is-collapsed')).toBe(true);
    expect(root.tabIndex).toBe(0);

    root.focus();
    root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(root.getAttribute('aria-expanded')).toBe('true');
    expect(rootWrapper.classList.contains('is-collapsed')).toBe(false);

    root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    const branch = card.querySelector<HTMLElement>('.iui-tree-dn-node[data-node-id="branch"]')!;
    expect(document.activeElement).toBe(branch);
    branch.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    const leaf = card.querySelector<HTMLElement>('.iui-tree-dn-node[data-node-id="leaf"]')!;
    expect(document.activeElement).toBe(leaf);

    leaf.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(document.activeElement).toBe(branch);
    branch.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(branch.getAttribute('aria-expanded')).toBe('false');
    expect(card.querySelector('.iui-tree-dn-wrapper[data-node-id="branch"]')?.classList.contains('is-collapsed')).toBe(true);

    root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(branch);
    branch.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    expect(document.activeElement).toBe(root);
    root.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(document.activeElement).toBe(branch);
    card.remove();
  });

  it('supports selecting a node and closing its detail panel', () => {
    const card = renderTree({
      type: 'tree',
      root: { id: 'root', label: 'Root', children: [{ id: 'leaf', label: 'Leaf', note: 'Leaf detail' }] },
    }, { theme: 'light', onCleanup: () => {} });

    card.querySelector<HTMLElement>('.iui-tree-dn-node[data-node-id="leaf"]')!.click();
    expect(card.querySelector<HTMLElement>('.iui-tree-detail-bar')?.style.display).toBe('');
    expect(card.querySelector('.iui-tree-detail-content')?.textContent).toContain('Leaf detail');
    card.querySelector<HTMLButtonElement>('.iui-tree-detail-close')!.click();
    expect(card.querySelector<HTMLElement>('.iui-tree-detail-bar')?.style.display).toBe('none');
  });
});

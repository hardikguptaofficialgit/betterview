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
import { renderMermaid } from '../src/components/mermaid';
import { renderFlow } from '../src/components/flow';
import { ChartSpec, FlowSpec } from '../src/core/types';

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

    // Y scale begins at zero
    const scales = config.options?.scales as any;
    expect(scales.y.beginAtZero).toBe(true);
    expect(scales.x.border.display).toBe(false);
    expect(scales.y.border.display).toBe(false);

    // Dataset uses solid color and 1px ink border with radius 4
    const ds = config.data.datasets[0] as any;
    expect(ds.backgroundColor).toBe(LIGHT_SOLIDS[0]);
    expect(ds.borderColor).toBe(LIGHT_INKS[0]);
    expect(ds.borderWidth).toBe(1);
    expect(ds.borderRadius).toBe(8);
    expect(ds.maxBarThickness).toBe(48);
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
    // 2 datasets -> legend shown at bottom
    expect(config.options?.plugins?.legend?.display).toBe(true);
    expect(config.options?.plugins?.legend?.position).toBe('bottom');

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
    // Legend always shown for doughnut even with 1 dataset
    expect(lightConfig.options?.plugins?.legend?.display).toBe(true);
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
      type: 'chart', chartType: 'area', labels: ['Mon', 'Tue'],
      datasets: [{ label: 'Traffic', data: [10, 20] }],
    }, 'light');
    expect(area.type).toBe('line');
    expect((area.data.datasets[0] as any).fill).toBe('origin');

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
  it('has exact light and dark theme variables matching specification', () => {
    expect(LIGHT_THEME_VARIABLES.primaryColor).toBe('#F1EDFC');
    expect(LIGHT_THEME_VARIABLES.primaryBorderColor).toBe('#DCD3F6');
    expect(LIGHT_THEME_VARIABLES.primaryTextColor).toBe('#0A0A0A');
    expect(LIGHT_THEME_VARIABLES.secondaryColor).toBe('#EAF4FD');
    expect(LIGHT_THEME_VARIABLES.tertiaryColor).toBe('#E9F7F0');
    expect(LIGHT_THEME_VARIABLES.lineColor).toBe('#A3A3A3');
    expect(LIGHT_THEME_VARIABLES.background).toBe('#FFFFFF');
    expect(LIGHT_THEME_VARIABLES.noteBkgColor).toBe('#FDF7E1');
    expect(LIGHT_THEME_VARIABLES.noteBorderColor).toBe('#F3E4A8');
    expect(LIGHT_THEME_VARIABLES.actorBkg).toBe('#F5F5F4');
    expect(LIGHT_THEME_VARIABLES.actorBorder).toBe('#E4E4E2');
    expect(LIGHT_THEME_VARIABLES.signalColor).toBe('#4A4A47');

    expect(DARK_THEME_VARIABLES.primaryColor).toBe('#1E1B29');
    expect(DARK_THEME_VARIABLES.primaryBorderColor).toBe('#383150');
    expect(DARK_THEME_VARIABLES.primaryTextColor).toBe('#FAFAFA');
    expect(DARK_THEME_VARIABLES.secondaryColor).toBe('#16212B');
    expect(DARK_THEME_VARIABLES.tertiaryColor).toBe('#15241D');
    expect(DARK_THEME_VARIABLES.lineColor).toBe('#5C5C5C');
    expect(DARK_THEME_VARIABLES.background).toBe('#0A0A0A');
    expect(DARK_THEME_VARIABLES.noteBkgColor).toBe('#26231A');
    expect(DARK_THEME_VARIABLES.noteBorderColor).toBe('#463F27');
    expect(DARK_THEME_VARIABLES.actorBkg).toBe('#1C1C1C');
    expect(DARK_THEME_VARIABLES.actorBorder).toBe('#333333');
    expect(DARK_THEME_VARIABLES.signalColor).toBe('#D6D6D3');
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
        ],
      },
      ctx,
    );
    expect(quizEl.classList.contains('iui-card')).toBe(true);
    expect(quizEl.textContent).toContain('What is port 80?');
    const optButtons = quizEl.querySelectorAll<HTMLButtonElement>('.iui-quiz-opt-btn');
    expect(optButtons).toHaveLength(3);

    // Click correct option
    optButtons[0].click();
    expect(optButtons[0].classList.contains('is-correct')).toBe(true);
    expect(quizEl.textContent).toContain('Score 1');
    expect(quizEl.textContent).toContain('Port 80 is used for HTTP.');
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

    const geo = renderChart({
      type: 'chart', chartType: 'geo', title: 'Events by region', labels: [],
      datasets: [{ label: 'Cities', data: [{ x: -73.9, y: 40.7, label: 'New York' }, { x: 139.7, y: 35.7, label: 'Tokyo' }] }],
    }, ctx);
    expect(geo.querySelectorAll('.iui-geo-point')).toHaveLength(2);
    expect(geo.textContent).toContain('New York');

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
    const canvas = card.querySelector<HTMLElement>('.flow-graph-canvas')!;

    expect(diagram.getAttribute('role')).toBe('region');
    expect(viewport.getAttribute('role')).toBe('region');
    expect(viewport.getAttribute('aria-label')).toBe('Interactive flow canvas: OAuth flow, 3 nodes');
    expect(canvas.getAttribute('role')).toBe('application');
    expect(canvas.getAttribute('tabindex')).toBe('0');
    expect(canvas.dataset.flowNodeCount).toBe('3');
    expect(canvas.dataset.flowEdgeCount).toBe('2');
    expect(card.querySelectorAll('.flow-control-btn')).toHaveLength(4);
    expect(card.querySelector('[aria-label="Fit flow in canvas"]')).not.toBeNull();
    expect(card.querySelector('.flow-svg-overlay')).toBeNull();
    expect(card.querySelector('.flow-node')).toBeNull();
    expect(diagram.querySelector('.iui-sr-only')?.textContent).toContain('Resource owner → Client application (Starts login)');
    expect(diagram.querySelector('.iui-sr-only')?.textContent).toContain('Client application → Authorization server (Requests authorization)');

    card.querySelector<HTMLButtonElement>('[aria-label="Zoom in"]')!.click();
    expect(card.querySelector('.flow-zoom-value')?.textContent).toBe('110%');
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
    const canvas = card.querySelector<HTMLElement>('.flow-graph-canvas')!;

    expect(viewport.getAttribute('role')).toBe('region');
    expect(viewport.hasAttribute('tabindex')).toBe(false);
    expect(canvas.getAttribute('tabindex')).toBe('0');
    expect(canvas.dataset.flowNodeCount).toBe('12');
    expect(canvas.dataset.flowEdgeCount).toBe('13');
    expect(diagram.querySelectorAll('.iui-sr-only li')).toHaveLength(13);
    expect(diagram.querySelector('.iui-sr-only')?.textContent).toContain('Client app → Shorten API (POST /shorten)');
    expect(card.querySelectorAll('.flow-control-btn')).toHaveLength(4);

    cleanups.forEach((cleanup) => cleanup());
  });
});

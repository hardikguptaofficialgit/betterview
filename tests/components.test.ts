// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
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
import { ChartSpec } from '../src/core/types';

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

  it('buildChartConfig configures bar chart with zero begin, radius 4 and no animation', () => {
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
    expect(ds.borderRadius).toBe(4);
  });

  it('buildChartConfig configures line chart with tension 0.3, pointRadius 3 and no area fill', () => {
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
    expect(ds0.tension).toBe(0.3);
    expect(ds0.borderWidth).toBe(2);
    expect(ds0.fill).toBe(false);
    expect(ds0.pointRadius).toBe(3);
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

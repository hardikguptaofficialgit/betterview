import type { ChartConfiguration } from 'chart.js';
import { ChartSpec } from '../core/types';
import { ThemeMode } from '../core/theme';
import { RenderContext } from './index';
import { h } from '../core/dom';
import { renderGeoChart, renderHeatmap } from './chartExtras';
import { UIHost } from '../core/types';

let chartClassPromise: Promise<any> | null = null;

export async function getChartClass(): Promise<any> {
  if (!chartClassPromise) {
    chartClassPromise = import('chart.js').then((m) => {
      m.Chart.register(
        m.BarController,
        m.LineController,
        m.PieController,
        m.DoughnutController,
        m.RadarController,
        m.ScatterController,
        m.BubbleController,
        m.CategoryScale,
        m.LinearScale,
        m.RadialLinearScale,
        m.BarElement,
        m.LineElement,
        m.PointElement,
        m.ArcElement,
        m.Tooltip,
        m.Legend,
        m.Title,
        m.Filler,
      );
      return m.Chart;
    });
  }
  return chartClassPromise;
}

const FONT_STACK =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Google Sans", Inter, sans-serif';

export const LIGHT_SOLIDS = [
  '#A9D3F5', // sky
  '#A6DEC0', // mint
  '#F6C0A0', // peach
  '#C6B9F2', // lavender
  '#F2DC8A', // butter
  '#F2B1C0', // rose
  '#D6D6D3', // stone
];

export const DARK_SOLIDS = [
  '#6FA8D6', // sky
  '#6DBF95', // mint
  '#D9946C', // peach
  '#9585D6', // lavender
  '#CDB45A', // butter
  '#D47F95', // rose
  '#8F8F8B', // stone
];

export const LIGHT_INKS = [
  '#1F5F8F', // sky
  '#1E6B48', // mint
  '#8C4A20', // peach
  '#4C3D91', // lavender
  '#7A5E10', // butter
  '#8E2E46', // rose
  '#4A4A47', // stone
];

// Dark: the light solids
export const DARK_INKS = [...LIGHT_SOLIDS];

export function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function buildChartConfig(
  spec: ChartSpec,
  theme: ThemeMode,
  animated = false,
  host?: UIHost,
): ChartConfiguration {
  const isDark = theme === 'dark';
  let solids = isDark ? DARK_SOLIDS : LIGHT_SOLIDS;
  let inks = isDark ? DARK_INKS : LIGHT_INKS;
  let cardBg = isDark ? '#0A0A0A' : '#FFFFFF';
  let mutedColor = isDark ? '#A3A3A3' : '#6B6B6B';
  let borderColor = isDark ? '#262626' : '#E7E7E7';
  let tooltipBg = isDark ? '#FAFAFA' : '#0A0A0A';
  let tooltipText = isDark ? '#0A0A0A' : '#FAFAFA';
  let fontStack = FONT_STACK;

  if (host === 'gemini') {
    solids = isDark
      ? ['#A8C7FA', '#81C995', '#FDD663', '#F28B82', '#0B57D0', '#137333', '#C4C7C5']
      : ['#0B57D0', '#1E8E3E', '#A8C7FA', '#F9AB00', '#D93025', '#81C995', '#747775'];
    inks = isDark
      ? ['#D3E3FD', '#C4EED0', '#FFE082', '#F9DEDC', '#A8C7FA', '#81C995', '#E3E3E3']
      : ['#041E49', '#072711', '#0B57D0', '#3F2E00', '#410E0B', '#137333', '#1F1F1F'];
    cardBg = isDark ? '#1E1F20' : '#F0F4F9';
    mutedColor = isDark ? '#C4C7C5' : '#444746';
    borderColor = isDark ? '#3C4043' : '#E1E3E1';
    tooltipBg = isDark ? '#E3E3E3' : '#1F1F1F';
    tooltipText = isDark ? '#131314' : '#FFFFFF';
    fontStack = '"Google Sans Text", "Google Sans", Roboto, Arial, sans-serif';
  } else if (host === 'grok') {
    solids = isDark
      ? ['#F5F5F5', '#A3A3A3', '#737373', '#525252', '#383838', '#262626']
      : ['#0D0D0D', '#525252', '#737373', '#9A9A9A', '#C4C4C4', '#E0E0E0'];
    inks = isDark
      ? ['#FFFFFF', '#D4D4D4', '#A3A3A3', '#737373', '#525252', '#404040']
      : ['#0D0D0D', '#262626', '#404040', '#525252', '#737373', '#8A8A8A'];
    cardBg = isDark ? '#141414' : '#FFFFFF';
    mutedColor = isDark ? '#A3A3A3' : '#6B6B6B';
    borderColor = isDark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.08)';
    tooltipBg = isDark ? '#F5F5F5' : '#0D0D0D';
    tooltipText = isDark ? '#141414' : '#FFFFFF';
    fontStack = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  }

  const isPieOrDoughnut = spec.chartType === 'pie' || spec.chartType === 'doughnut';

  let chartDatasets: any[] = [];

  if (spec.chartType === 'bar') {
    chartDatasets = spec.datasets.map((ds, idx) => ({
      label: ds.label,
      data: ds.data,
      backgroundColor: solids[idx % solids.length],
      borderColor: inks[idx % inks.length],
      borderWidth: 1,
      borderRadius: 4,
      borderSkipped: 'bottom',
      maxBarThickness: 28,
      grouped: true,
    }));
  } else if (spec.chartType === 'line' || spec.chartType === 'area') {
    chartDatasets = spec.datasets.map((ds, idx) => ({
      label: ds.label,
      data: ds.data,
      borderColor: inks[idx % inks.length],
      borderWidth: 2.5,
      tension: 0.35,
      pointRadius: 2.5,
      pointHoverRadius: 6,
      pointBackgroundColor: solids[idx % solids.length],
      pointBorderColor: inks[idx % inks.length],
      pointBorderWidth: 1,
      pointHoverBorderWidth: 2,
      fill: spec.chartType === 'area' ? 'origin' : false,
    }));
  } else if (spec.chartType === 'scatter' || spec.chartType === 'bubble') {
    chartDatasets = spec.datasets.map((ds, idx) => ({
      label: ds.label,
      data: ds.data,
      backgroundColor: hexToRgba(solids[idx % solids.length], 0.72),
      borderColor: inks[idx % inks.length],
      borderWidth: 1.5,
      pointRadius: spec.chartType === 'scatter' ? 4 : undefined,
      pointHoverRadius: 7,
    }));
  } else if (isPieOrDoughnut) {
    const sliceSolids = spec.labels.map((_, idx) => solids[idx % solids.length]);
    chartDatasets = spec.datasets.map((ds) => ({
      label: ds.label,
      data: ds.data,
      backgroundColor: sliceSolids,
      borderColor: cardBg,
      borderWidth: 2,
      borderRadius: 4,
      hoverOffset: 8,
    }));
  } else if (spec.chartType === 'radar') {
    chartDatasets = spec.datasets.map((ds, idx) => ({
      label: ds.label,
      data: ds.data,
      borderColor: inks[idx % inks.length],
      borderWidth: 1.5,
      backgroundColor: hexToRgba(solids[idx % solids.length], 0.35),
      fill: true,
      pointRadius: 3,
      pointBackgroundColor: solids[idx % solids.length],
      pointBorderColor: inks[idx % inks.length],
      pointBorderWidth: 1,
    }));
  }

  let scales: any = undefined;
  if (spec.chartType === 'bar' || spec.chartType === 'line' || spec.chartType === 'area') {
    scales = {
      x: {
        stacked: false,
        grid: {
          display: false,
        },
        border: {
          display: false,
        },
        ticks: {
          color: mutedColor,
          maxRotation: 0,
          minRotation: 0,
          autoSkip: false,
          font: {
            family: fontStack,
            size: 11,
          },
        },
      },
      y: {
        stacked: false,
        beginAtZero: spec.chartType === 'bar',
        grid: {
          display: true,
          color: 'color-mix(in srgb, var(--iui-text, #000) 6%, transparent)',
          lineWidth: 1,
          drawTicks: false,
        },
        border: {
          display: false,
        },
        ticks: {
          color: mutedColor,
          padding: 8,
          font: {
            family: fontStack,
            size: 11,
          },
        },
      },
    };
  } else if (spec.chartType === 'scatter' || spec.chartType === 'bubble') {
    scales = {
      x: {
        type: 'linear',
        title: { display: !!spec.xLabel, text: spec.xLabel || '', color: mutedColor },
        grid: { color: borderColor, drawTicks: false },
        border: { display: false },
        ticks: { color: mutedColor, maxTicksLimit: 8, font: { family: fontStack, size: 11 } },
      },
      y: {
        type: 'linear',
        title: { display: !!spec.yLabel, text: spec.yLabel || '', color: mutedColor },
        grid: { color: borderColor, drawTicks: false },
        border: { display: false },
        ticks: { color: mutedColor, maxTicksLimit: 8, font: { family: fontStack, size: 11 } },
      },
    };
  } else if (spec.chartType === 'radar') {
    scales = {
      r: {
        grid: {
          color: borderColor,
          lineWidth: 1,
        },
        angleLines: {
          color: borderColor,
          lineWidth: 1,
        },
        border: {
          display: false,
        },
        ticks: {
          color: mutedColor,
          backdropColor: 'transparent',
          font: {
            family: fontStack,
            size: 11,
          },
        },
        pointLabels: {
          color: mutedColor,
          font: {
            family: fontStack,
            size: 12,
          },
        },
      },
    };
  }

  const showLegend = spec.datasets.length > 1;

  const animationConfig = animated
    ? {
        duration: 800,
        easing: 'easeOutQuart' as const,
      }
    : false;

  return {
    type: (spec.chartType === 'area' ? 'line' : spec.chartType) as any,
    data: {
      labels: spec.labels,
      datasets: chartDatasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: animationConfig as any,
      plugins: {
        legend: {
          display: showLegend,
          position: 'top',
          align: 'start',
          labels: {
            usePointStyle: true,
            pointStyle: 'circle',
            color: mutedColor,
            font: {
              family: fontStack,
              size: 11,
            },
            padding: 12,
            boxWidth: 6,
            boxHeight: 6,
          },
        },
        title: {
          display: false,
        },
        tooltip: {
          backgroundColor: tooltipBg,
          titleColor: tooltipText,
          bodyColor: tooltipText,
          cornerRadius: 8,
          padding: 10,
          displayColors: true,
          boxPadding: 4,
          caretSize: 5,
          titleFont: {
            family: fontStack,
            size: 12,
            weight: 600,
          },
          bodyFont: {
            family: fontStack,
            size: 12,
          },
          callbacks: {
            label: (context: any) => {
              const rawVal = context.raw;
              if (rawVal && typeof rawVal === 'object' && 'x' in rawVal && 'y' in rawVal) {
                const point = rawVal as { x: number; y: number };
                const dsLabel = context.dataset?.label || '';
                const coordinates = `(${point.x}, ${point.y})`;
                return `${dsLabel ? `${dsLabel}: ` : ''}${coordinates}`;
              }
              const num = typeof rawVal === 'number' ? rawVal : Number(rawVal);
              const formatted = !Number.isNaN(num) ? num.toLocaleString() : String(rawVal ?? '');
              const unitSuffix = spec.unit ? ` ${spec.unit}` : '';
              if (isPieOrDoughnut) {
                const label = context.label || '';
                return label ? `${label}: ${formatted}${unitSuffix}` : `${formatted}${unitSuffix}`;
              }
              const dsLabel = context.dataset?.label || '';
              return dsLabel ? `${dsLabel}: ${formatted}${unitSuffix}` : `${formatted}${unitSuffix}`;
            },
          },
        },
      },
      ...(scales ? { scales } : {}),
      interaction: {
        mode: spec.chartType === 'scatter' || spec.chartType === 'bubble' ? 'nearest' : 'index',
        intersect: false,
      },
      layout: {
        padding: { top: 8, right: 8, bottom: 4, left: 4 },
      },
    },
  };
}

export function renderChart(spec: ChartSpec, ctx: RenderContext): HTMLElement {
  if (spec.chartType === 'heatmap') return renderHeatmap(spec, ctx);
  if (spec.chartType === 'geo') return renderGeoChart(spec);

  const card = h('div', { class: 'iui-card iui-chart-card' });
  if (spec.title) {
    card.appendChild(h('div', { class: 'iui-title' }, spec.title));
  }

  const isPieOrDoughnut = spec.chartType === 'pie' || spec.chartType === 'doughnut';
  const height = isPieOrDoughnut ? '200px' : '220px';

  const ariaLabel = spec.title
    ? `${spec.chartType} chart: ${spec.title}`
    : `${spec.chartType} chart`;

  const canvas = h('canvas', {
    role: 'img',
    'aria-label': ariaLabel,
  }) as HTMLCanvasElement;

  const container = h(
    'div',
    {
      class: 'iui-chart-plot',
      style: `position: relative; height: ${height};`,
    },
    canvas,
  );

  card.appendChild(container);

  const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const config = buildChartConfig(spec, ctx.theme, !prefersReduced, ctx.host);

  let disposed = false;
  let chartInstance: any = null;

  ctx.onCleanup(() => {
    disposed = true;
    if (chartInstance) {
      try {
        chartInstance.destroy();
      } catch {
        // ignore cleanup error
      }
    }
  });

  (card as any).__chartReady = getChartClass()
    .then((Chart) => {
      if (disposed) return null;
      try {
        chartInstance = new Chart(canvas, config);
        (card as any).__chartInstance = chartInstance;
        (canvas as any).__chartInstance = chartInstance;
        return chartInstance;
      } catch (err) {
        console.warn('[IUI] Chart initialization failed:', err);
        return null;
      }
    })
    .catch((err) => {
      console.warn('[IUI] Failed to load Chart.js:', err);
      return null;
    });

  return card;
}

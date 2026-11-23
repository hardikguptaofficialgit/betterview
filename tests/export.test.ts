// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import {
  sanitizeCssForSvg,
  serializeCardToSvg,
  serializeFlowToSvg,
  showCardToast,
  sanitizeFilename,
} from '../src/core/export';

describe('Export: sanitizeCssForSvg (styles inlined, no external URLs)', () => {
  it('strips @import rules from CSS', () => {
    const rawCss = '@import url("https://fonts.googleapis.com/css?family=Roboto"); .card { color: red; }';
    const sanitized = sanitizeCssForSvg(rawCss);
    expect(sanitized).not.toContain('@import');
    expect(sanitized).toContain('.card { color: red; }');
  });

  it('strips @font-face blocks and external font URLs from CSS', () => {
    const rawCss = '@font-face { font-family: "Test"; src: url("fonts/KaTeX_Main.woff2") format("woff2"); } .title { font-size: 14px; }';
    const sanitized = sanitizeCssForSvg(rawCss);
    expect(sanitized).not.toContain('@font-face');
    expect(sanitized).not.toContain('KaTeX_Main.woff2');
    expect(sanitized).toContain('.title { font-size: 14px; }');
  });

  it('replaces external url(...) references with none but preserves data: URIs', () => {
    const rawCss = '.bg-external { background: url("http://example.com/pic.png"); } .bg-data { background: url("data:image/svg+xml,..."); }';
    const sanitized = sanitizeCssForSvg(rawCss);
    expect(sanitized).not.toContain('http://example.com');
    expect(sanitized).toContain('url("data:image/svg+xml,..."');
  });
});

describe('Export serialization: serializeCardToSvg', () => {
  it('serializes card into an SVG foreignObject with inlined styles and NO external URLs', () => {
    const card = document.createElement('div');
    card.className = 'iui-card iui-table-card';
    card.innerHTML = `
      <div class="iui-card-header">
        <div class="iui-title">System Metrics</div>
        <div class="iui-card-toolbar"><button>Copy</button></div>
      </div>
      <div class="iui-source-panel is-collapsed"><pre>{}</pre></div>
      <div class="iui-table-wrap"><table><tr><td>Data</td></tr></table></div>
    `;

    const sampleStyles = [
      '@font-face { font-family: KaTeX_Main; src: url(fonts/KaTeX_Main-Regular.woff2); }',
      '@import url("https://external.cdn/style.css");',
      '.iui-card { background: #fff; padding: 16px; border: 1px solid #e5e5e5; }',
      '.iui-title { font-weight: 600; font-size: 15px; }',
    ];

    const svg = serializeCardToSvg(card, {
      theme: 'light',
      host: 'gemini',
      watermark: true,
      allStyles: sampleStyles,
      title: 'System Metrics',
    });

    // 1. Valid SVG wrapper with foreignObject
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(svg).toContain('<foreignObject');
    expect(svg).toContain('</foreignObject>');
    expect(svg).toContain('class="iui-root" data-theme="light" data-host="gemini"');
    expect(svg).toContain('System Metrics');

    // 2. Inlined styles present
    expect(svg).toContain('<style>');
    expect(svg).toContain('.iui-card { background: #fff;');
    expect(svg).toContain('.iui-title { font-weight: 600;');

    // 3. NO external URLs in the serialized SVG output
    const styleContent = svg.match(/<style>([\s\S]*?)<\/style>/)?.[1] || '';
    expect(styleContent).not.toContain('http://');
    expect(styleContent).not.toContain('https://');
    expect(styleContent).not.toContain('fonts/');
    expect(svg).not.toContain('https://external.cdn');
    expect(svg).not.toContain('fonts/KaTeX_Main');
    expect(svg).not.toContain('@import');
    expect(svg).not.toContain('@font-face');

    // 4. UI chrome is stripped from clone
    expect(svg).not.toContain('iui-card-toolbar');
    expect(svg).not.toContain('iui-source-panel');

    // 5. Card background and 24px padding
    expect(svg).toContain('fill="#FFFFFF"');
    expect(svg).toContain('x="24"');
    expect(svg).toContain('y="24"');

    // 6. Watermark present by default
    expect(svg).toContain('BetterView AI');
    expect(svg).toContain('font-size="12"');
  });

  it('omits watermark when watermark is set to false', () => {
    const card = document.createElement('div');
    card.className = 'iui-card';
    card.textContent = 'Simple Card';

    const svg = serializeCardToSvg(card, {
      theme: 'dark',
      watermark: false,
    });

    expect(svg).not.toContain('BetterView AI');
    expect(svg).toContain('fill="#0A0A0A"');
  });

  it('includes wider static flow content in card exports', () => {
    const card = document.createElement('div');
    card.className = 'iui-card flow-card';
    const flowDiagram = document.createElement('div');
    flowDiagram.className = 'flow-diagram';
    const flowInner = document.createElement('div');
    flowInner.className = 'flow-inner';
    flowInner.textContent = 'A wide flowchart';
    flowDiagram.appendChild(flowInner);
    card.appendChild(flowDiagram);
    Object.defineProperty(flowDiagram, 'scrollWidth', { configurable: true, value: 980 });
    Object.defineProperty(flowDiagram, 'clientWidth', { configurable: true, value: 420 });

    const svg = serializeCardToSvg(card, { theme: 'light', host: 'grok' });

    expect(svg).toContain('width="1028"');
    expect(svg).toContain('data-host="grok"');
    expect(svg).toContain('width: 980px');
    expect(svg).toContain('overflow: visible');
  });
});

describe('Export serialization: serializeFlowToSvg', () => {
  it('exports flow nodes, connectors and labels as native SVG without foreignObject', () => {
    const card = document.createElement('div');
    card.className = 'iui-card flow-card';
    card.innerHTML = `
      <div class="iui-title flow-title">Approval Flow</div>
      <div class="flow-diagram"><div class="flow-inner">
        <svg class="flow-svg-overlay"><path d="M 10 20 L 10 80" /></svg>
        <div class="flow-node"><span class="flow-node-label">Start &amp; review</span><span class="flow-node-sub">Check request</span></div>
        <span class="flow-edge-label">Yes</span>
      </div></div>`;
    const svg = serializeFlowToSvg(card, { theme: 'light', watermark: false });

    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('Approval Flow');
    expect(svg).toContain('Start &amp; review');
    expect(svg).toContain('Check request');
    expect(svg).toContain('M 10 20 L 10 80');
    expect(svg).toContain('>Yes</text>');
    expect(svg).not.toContain('foreignObject');
    expect(svg).not.toContain('BetterView AI');
  });
});

describe('Export: showCardToast', () => {
  it('creates a toast element inside the card with auto-hide class', () => {
    vi.useFakeTimers();

    const card = document.createElement('div');
    card.className = 'iui-card';
    document.body.appendChild(card);

    showCardToast(card, 'Copied');
    const toast = card.querySelector('.iui-toast');
    expect(toast).not.toBeNull();
    expect(toast?.textContent).toBe('Copied');

    // Advance by 1600ms -> is-hiding added
    vi.advanceTimersByTime(1600);
    expect(toast?.classList.contains('is-hiding')).toBe(true);

    // Advance 200ms -> removed
    vi.advanceTimersByTime(200);
    expect(card.querySelector('.iui-toast')).toBeNull();

    vi.useRealTimers();
  });
});

describe('Export: sanitizeFilename', () => {
  it('sanitizes strings into safe filenames', () => {
    expect(sanitizeFilename('System Metrics (2024)')).toBe('system-metrics-2024');
    expect(sanitizeFilename('OAuth 2.0 Flow')).toBe('oauth-2-0-flow');
    expect(sanitizeFilename('')).toBe('betterview-card');
    expect(sanitizeFilename(undefined)).toBe('betterview-card');
  });
});

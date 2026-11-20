import { MermaidSpec } from '../core/types';
import { RenderContext } from './index';
import { h } from '../core/dom';

let mermaidIdCounter = 0;
let mermaidPromise: Promise<any> | null = null;

export async function getMermaid(): Promise<any> {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((m) => m.default || m);
  }
  return mermaidPromise;
}

const FONT_STACK =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Google Sans", Inter, sans-serif';

export const LIGHT_THEME_VARIABLES = {
  primaryColor: '#F1EDFC',
  primaryBorderColor: '#DCD3F6',
  primaryTextColor: '#0A0A0A',
  secondaryColor: '#EAF4FD',
  tertiaryColor: '#E9F7F0',
  lineColor: '#A3A3A3',
  background: '#FFFFFF',
  noteBkgColor: '#FDF7E1',
  noteBorderColor: '#F3E4A8',
  actorBkg: '#F5F5F4',
  actorBorder: '#E4E4E2',
  signalColor: '#4A4A47',
};

export const DARK_THEME_VARIABLES = {
  primaryColor: '#1E1B29',
  primaryBorderColor: '#383150',
  primaryTextColor: '#FAFAFA',
  secondaryColor: '#16212B',
  tertiaryColor: '#15241D',
  lineColor: '#5C5C5C',
  background: '#0A0A0A',
  noteBkgColor: '#26231A',
  noteBorderColor: '#463F27',
  actorBkg: '#1C1C1C',
  actorBorder: '#333333',
  signalColor: '#D6D6D3',
};

function cleanupStrayMermaidElements(renderId: string): void {
  if (typeof document === 'undefined') return;
  try {
    const candidates = document.querySelectorAll(
      `[id^="d${renderId}"], [id^="${renderId}"], [id^="diiui-mmd-"], [id^="iui-mmd-"]`,
    );
    candidates.forEach((el) => {
      if (!el.closest('.iui-card')) {
        el.remove();
      }
    });
  } catch {
    // ignore cleanup error
  }
}

function animateMermaidSvg(svgEl: SVGElement): void {
  if (typeof window === 'undefined') return;
  const prefersReduced =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) return;

  const paths = Array.from(svgEl.querySelectorAll<SVGGeometryElement>('path, line, polyline'));
  const nodes = Array.from(
    svgEl.querySelectorAll<SVGElement>('.node, .actor, .note, g[id*="flowchart-"] rect, g[id*="flowchart-"] polygon, g.cluster'),
  );

  const totalCapMs = 1200;
  const pathDuration = Math.min(400, Math.max(150, totalCapMs / Math.max(paths.length, 1)));
  const stagger = Math.min(40, (totalCapMs - pathDuration) / Math.max(paths.length, 1));

  paths.forEach((p, idx) => {
    try {
      const len = p.getTotalLength?.() || 200;
      p.style.strokeDasharray = `${len}`;
      p.style.strokeDashoffset = `${len}`;
      p.style.transition = `stroke-dashoffset ${pathDuration}ms cubic-bezier(.2,.8,.2,1) ${idx * stagger}ms`;
      requestAnimationFrame(() => {
        p.style.strokeDashoffset = '0';
      });
    } catch {
      // ignore
    }
  });

  nodes.forEach((n, idx) => {
    n.style.opacity = '0';
    n.style.transition = `opacity 280ms cubic-bezier(.2,.8,.2,1) ${Math.min(idx * 40, totalCapMs - 280)}ms`;
    requestAnimationFrame(() => {
      n.style.opacity = '1';
    });
  });
}

export function renderMermaid(spec: MermaidSpec, ctx: RenderContext): HTMLElement {
  const card = h('div', { class: 'iui-card iui-mermaid-card' });
  if (spec.title) {
    card.appendChild(h('div', { class: 'iui-title' }, spec.title));
  }

  const skeleton = h('div', { class: 'iui-skel iui-skel-mermaid' });
  card.appendChild(skeleton);

  const isDark = ctx.theme === 'dark';
  const themeVariables = isDark ? DARK_THEME_VARIABLES : LIGHT_THEME_VARIABLES;

  const renderId = 'iui-mmd-' + (++mermaidIdCounter);
  let disposed = false;

  ctx.onCleanup(() => {
    disposed = true;
    cleanupStrayMermaidElements(renderId);
  });

  (async () => {
    try {
      const mermaid = await getMermaid();
      if (disposed) return;

      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: 'base',
        fontFamily: FONT_STACK,
        themeVariables,
        suppressErrorRendering: true,
        logLevel: 'fatal' as any,
      });

      const res = await mermaid.render(renderId, spec.code);
      cleanupStrayMermaidElements(renderId);

      if (disposed) return;

      const parser = new DOMParser();
      const doc = parser.parseFromString(res.svg, 'image/svg+xml');
      const parserError = doc.querySelector('parsererror');
      if (parserError) {
        throw new Error(parserError.textContent || 'Failed to parse diagram SVG');
      }

      const svgNode = document.importNode(doc.documentElement, true) as unknown as SVGElement;
      svgNode.style.maxWidth = '100%';
      svgNode.style.height = 'auto';
      svgNode.style.display = 'block';
      svgNode.style.margin = '0 auto';

      animateMermaidSvg(svgNode);

      const wrapper = h(
        'div',
        {
          class: 'iui-mermaid-wrap',
          style: 'overflow-x: auto; display: flex; justify-content: center; width: 100%;',
        },
        svgNode,
      );

      skeleton.replaceWith(wrapper);
    } catch (err: unknown) {
      cleanupStrayMermaidElements(renderId);

      if (disposed) return;

      const errMsg = err instanceof Error ? err.message : String(err);
      const errorBox = h(
        'div',
        { class: 'iui-fallback', style: 'margin-top: 8px;' },
        h('div', { class: 'iui-fallback-note' }, `Diagram couldn't be drawn: ${errMsg}`),
        h('pre', { class: 'iui-fallback-pre' }, spec.code),
      );
      skeleton.replaceWith(errorBox);
    }
  })();

  return card;
}

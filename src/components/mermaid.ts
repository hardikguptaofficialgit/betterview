import { MermaidSpec } from '../core/types';
import { RenderContext } from './index';
import { h } from '../core/dom';

let mermaidIdCounter = 0;
let mermaidRenderQueue: Promise<void> = Promise.resolve();

function renderMermaidSerialized<T>(render: () => Promise<T>): Promise<T> {
  const pending = mermaidRenderQueue.then(render, render);
  mermaidRenderQueue = pending.then(() => undefined, () => undefined);
  return pending;
}
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
  primaryColor: '#F8FAFC',
  primaryBorderColor: '#A1A1AA',
  primaryTextColor: '#18181B',
  secondaryColor: '#F1F5F9',
  secondaryBorderColor: '#94A3B8',
  secondaryTextColor: '#1E293B',
  tertiaryColor: '#F4F4F5',
  tertiaryBorderColor: '#A1A1AA',
  tertiaryTextColor: '#27272A',
  lineColor: '#71717A',
  defaultLinkColor: '#71717A',
  textColor: '#18181B',
  mainBkg: '#F8FAFC',
  nodeBorder: '#A1A1AA',
  clusterBkg: '#FFFFFF',
  clusterBorder: '#E4E4E7',
  edgeLabelBackground: '#FFFFFF',
  background: 'transparent',
  noteBkgColor: '#FAFAFA',
  noteBorderColor: '#D4D4D8',
  actorBkg: '#F4F4F5',
  actorBorder: '#A1A1AA',
  signalColor: '#3F3F46',
  labelTextColor: '#27272A',
};

export const DARK_THEME_VARIABLES = {
  primaryColor: '#18181B',
  primaryBorderColor: '#52525B',
  primaryTextColor: '#FAFAFA',
  secondaryColor: '#202024',
  secondaryBorderColor: '#52525B',
  secondaryTextColor: '#F4F4F5',
  tertiaryColor: '#27272A',
  tertiaryBorderColor: '#52525B',
  tertiaryTextColor: '#E4E4E7',
  lineColor: '#A1A1AA',
  defaultLinkColor: '#A1A1AA',
  textColor: '#FAFAFA',
  mainBkg: '#18181B',
  nodeBorder: '#52525B',
  clusterBkg: '#101012',
  clusterBorder: '#3F3F46',
  edgeLabelBackground: '#09090B',
  background: 'transparent',
  noteBkgColor: '#27272A',
  noteBorderColor: '#52525B',
  actorBkg: '#202024',
  actorBorder: '#52525B',
  signalColor: '#E4E4E7',
  labelTextColor: '#F4F4F5',
};

function cleanupStrayMermaidElements(renderId: string): void {
  if (typeof document === 'undefined') return;
  try {
    const candidates = document.querySelectorAll(
      `[id^="d${renderId}"], [id^="${renderId}"]`,
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

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.15;

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
  let extraCleanup: (() => void) | null = null;

  ctx.onCleanup(() => {
    disposed = true;
    extraCleanup?.();
    cleanupStrayMermaidElements(renderId);
  });

  (async () => {
    try {
      const mermaid = await getMermaid();
      if (disposed) return;

      const res = await renderMermaidSerialized(async () => {
        if (disposed) return null;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: 'base',
          fontFamily: FONT_STACK,
          themeVariables,
          suppressErrorRendering: true,
          logLevel: 'fatal' as any,
        });
        const result = await mermaid.render(renderId, spec.code);
        // Keep cleanup inside the serialized section: the next Mermaid render
        // may start as soon as this promise settles and must not lose its temp DOM.
        cleanupStrayMermaidElements(renderId);
        return result;
      });
      if (!res) return;

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

      const diagram = h('div', { class: 'iui-mermaid-diagram', role: 'region', 'aria-label': spec.title || 'Mermaid diagram' });

      const controls = h('div', {
        class: 'flow-controls iui-diagram-controls',
        role: 'group',
        'aria-label': 'Diagram zoom controls',
      });
      const zoomOutBtn = h('button', {
        class: 'flow-control-btn',
        type: 'button',
        'aria-label': 'Zoom out',
        title: 'Zoom out',
      }, '\u2212') as HTMLButtonElement;
      const zoomValue = h('span', { class: 'flow-zoom-value', 'aria-live': 'polite' }, '100%');
      const zoomInBtn = h('button', {
        class: 'flow-control-btn',
        type: 'button',
        'aria-label': 'Zoom in',
        title: 'Zoom in',
      }, '+') as HTMLButtonElement;
      const fitBtn = h('button', {
        class: 'flow-fit-btn',
        type: 'button',
        'aria-label': 'Fit diagram to view',
        title: 'Fit to view',
      }, 'Fit') as HTMLButtonElement;
      const resetBtn = h('button', {
        class: 'flow-control-btn',
        type: 'button',
        'aria-label': 'Reset zoom',
        title: 'Reset view (or double-click)',
      }, '\u21BA') as HTMLButtonElement;
      controls.append(zoomOutBtn, zoomValue, zoomInBtn, fitBtn, resetBtn);

      const inner = h('div', { class: 'iui-mermaid-inner' }, svgNode);
      const wrapper = h('div', { class: 'iui-mermaid-wrap' }, inner);

      diagram.append(controls, wrapper);

      let zoom = 1;
      let panX = 0;
      let panY = 0;

      const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, +z.toFixed(2)));

      const applyTransform = () => {
        inner.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
        zoomValue.textContent = `${Math.round(zoom * 100)}%`;
      };

      const resetView = () => {
        zoom = 1;
        panX = 0;
        panY = 0;
        applyTransform();
      };

      const fitToView = () => {
        panX = 0;
        panY = 0;
        const wrapW = wrapper.clientWidth;
        const svgRect = svgNode.getBoundingClientRect();
        const naturalW = svgRect.width > 0 ? svgRect.width / zoom : 0;
        if (wrapW > 0 && naturalW > 0) {
          zoom = clampZoom(Math.min(1, wrapW / naturalW));
        } else {
          zoom = 1;
        }
        applyTransform();
      };

      zoomInBtn.onclick = () => {
        zoom = clampZoom(zoom + ZOOM_STEP);
        applyTransform();
      };
      zoomOutBtn.onclick = () => {
        zoom = clampZoom(zoom - ZOOM_STEP);
        applyTransform();
      };
      fitBtn.onclick = fitToView;
      resetBtn.onclick = resetView;

      // Pointer-drag panning
      let isDragging = false;
      let hasDragged = false;
      let dragStartX = 0;
      let dragStartY = 0;
      let startPanX = 0;
      let startPanY = 0;

      const onPointerDown = (e: PointerEvent) => {
        if (e.button !== 0) return;
        const target = e.target as HTMLElement | null;
        if (target?.closest('.iui-diagram-controls')) return;
        isDragging = true;
        hasDragged = false;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        startPanX = panX;
        startPanY = panY;
      };

      const onPointerMove = (e: PointerEvent) => {
        if (!isDragging) return;
        const dx = e.clientX - dragStartX;
        const dy = e.clientY - dragStartY;
        if (!hasDragged && Math.hypot(dx, dy) > 4) {
          hasDragged = true;
          wrapper.classList.add('is-panning');
        }
        if (hasDragged) {
          panX = startPanX + dx;
          panY = startPanY + dy;
          applyTransform();
        }
      };

      const onPointerUp = () => {
        if (!isDragging) return;
        isDragging = false;
        wrapper.classList.remove('is-panning');
      };

      wrapper.addEventListener('pointerdown', onPointerDown);
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);

      wrapper.addEventListener('dblclick', (e) => {
        const target = e.target as HTMLElement | null;
        if (target?.closest('.iui-diagram-controls')) return;
        resetView();
      });

      const onWheel = (e: WheelEvent) => {
        if (!e.ctrlKey && !e.metaKey) return;
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.1 : 0.9;
        zoom = clampZoom(zoom * factor);
        applyTransform();
      };
      wrapper.addEventListener('wheel', onWheel, { passive: false });

      extraCleanup = () => {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerUp);
      };

      skeleton.replaceWith(diagram);
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

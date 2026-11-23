import { FlowSpec } from '../core/types';
import { RenderContext } from './index';
import { clear, h } from '../core/dom';
import { iconEl } from '../core/icons';
import { dagreLayoutFlow, renderSmoothDagrePath } from './flowLayout';

export function renderFlow(spec: FlowSpec, ctx: RenderContext): HTMLElement {
  const card = h('div', { class: 'iui-card flow-card' });
  if (spec.title) {
    card.appendChild(h('div', { class: 'iui-title flow-title' }, spec.title));
  }

  const nodes = spec.nodes || [];
  const edges = spec.edges || [];
  const groups = spec.groups || [];

  const layout = dagreLayoutFlow(nodes, edges, groups);

  const diagram = h('div', { class: 'flow-diagram', role: 'region' });

  // Accessible screen reader list
  const srList = h('ol', { class: 'iui-sr-only' });
  const nodeNameMap = new Map(nodes.map((n) => [n.id, n.label]));
  for (const edge of edges) {
    const s = nodeNameMap.get(edge.from) || edge.from;
    const t = nodeNameMap.get(edge.to) || edge.to;
    srList.appendChild(h('li', {}, `${s} \u2192 ${t}${edge.label ? ` (${edge.label})` : ''}`));
  }
  if (edges.length === 0) {
    for (const node of nodes) srList.appendChild(h('li', {}, node.label));
  }
  diagram.appendChild(srList);

  // Zoom controls: small, top-right, hidden until hover
  const controls = h('div', { class: 'flow-controls', role: 'group', 'aria-label': 'Flow zoom controls' });
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

  const resetBtn = h('button', {
    class: 'flow-control-btn',
    type: 'button',
    'aria-label': 'Reset zoom',
    title: 'Reset zoom',
  }, 'Reset') as HTMLButtonElement;

  controls.append(zoomOutBtn, zoomValue, zoomInBtn, resetBtn);
  diagram.appendChild(controls);

  // Viewport & Inner canvas
  const viewport = h('div', {
    class: 'flow-viewport',
    role: 'region',
    'aria-label': `Flow diagram: ${spec.title || 'Untitled'}, ${nodes.length} nodes`,
  });

  const flowInner = h('div', {
    class: 'flow-inner',
  });
  flowInner.style.width = `${layout.width}px`;
  flowInner.style.height = `${layout.height}px`;
  flowInner.style.position = 'relative';

  const uid = Math.random().toString(36).slice(2, 8);
  const arrowMarkerId = `flow-arrow-${uid}`;

  // SVG overlay for edges
  const svgNs = 'http://www.w3.org/2000/svg';
  const svgOverlay = document.createElementNS(svgNs, 'svg');
  svgOverlay.setAttribute('class', 'flow-svg-overlay');
  svgOverlay.setAttribute('width', String(layout.width));
  svgOverlay.setAttribute('height', String(layout.height));
  svgOverlay.setAttribute('viewBox', `0 0 ${layout.width} ${layout.height}`);
  svgOverlay.style.position = 'absolute';
  svgOverlay.style.inset = '0';
  svgOverlay.style.width = `${layout.width}px`;
  svgOverlay.style.height = `${layout.height}px`;
  svgOverlay.style.pointerEvents = 'none';
  svgOverlay.style.overflow = 'visible';

  // Arrow marker def
  const defs = document.createElementNS(svgNs, 'defs');
  const marker = document.createElementNS(svgNs, 'marker');
  marker.setAttribute('id', arrowMarkerId);
  marker.setAttribute('viewBox', '0 0 6 6');
  marker.setAttribute('refX', '5');
  marker.setAttribute('refY', '3');
  marker.setAttribute('markerWidth', '4.5');
  marker.setAttribute('markerHeight', '4.5');
  marker.setAttribute('orient', 'auto-start-reverse');

  const markerPath = document.createElementNS(svgNs, 'path');
  markerPath.setAttribute('d', 'M 0 0.75 L 5 3 L 0 5.25 z');
  markerPath.setAttribute('fill', 'currentColor');
  marker.appendChild(markerPath);
  defs.appendChild(marker);
  svgOverlay.appendChild(defs);

  // Render edges
  for (const edge of layout.edges) {
    const pathD = renderSmoothDagrePath(edge.points);
    if (!pathD) continue;

    const path = document.createElementNS(svgNs, 'path');
    path.setAttribute('d', pathD);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', '1.25');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    path.setAttribute('marker-end', `url(#${arrowMarkerId})`);

    const edgeToneClass = edge.tone === 'positive'
      ? 'is-positive'
      : edge.tone === 'negative'
        ? 'is-negative'
        : 'is-neutral';
    path.setAttribute('class', `flow-edge-path ${edgeToneClass}`);

    svgOverlay.appendChild(path);
  }
  flowInner.appendChild(svgOverlay);

  // Render edge labels (tiny 11px pills with host background color masking line under them)
  for (const edge of layout.edges) {
    if (!edge.label || edge.labelX === undefined || edge.labelY === undefined) continue;

    const pill = h('span', {
      class: `flow-edge-label ${edge.tone ? `tone-${edge.tone}` : ''}`,
      style: `left: ${edge.labelX}px; top: ${edge.labelY}px;`,
    }, edge.label);
    flowInner.appendChild(pill);
  }

  // Render nodes: compact rounded rects with 8px radius (pill for start/end), padding 6px by 10px, 13px text
  for (const node of layout.nodes) {
    const isPill = node.isStart || node.isEnd;
    const isDecision = node.decision;

    const nodeClasses = ['flow-node'];
    if (isPill) nodeClasses.push('is-pill');
    if (isDecision) nodeClasses.push('is-decision');
    if (node.color) nodeClasses.push(`c-${node.color}`);

    const nodeEl = h('div', {
      class: nodeClasses.join(' '),
      style: `left: ${node.x - node.width / 2}px; top: ${node.y - node.height / 2}px; width: ${node.width}px; height: ${node.height}px;`,
    });

    if (node.icon) {
      const iconBox = h('span', { class: 'flow-node-iconbox' }, iconEl(node.icon, 14));
      nodeEl.appendChild(iconBox);
    }

    const textCol = h('div', { class: 'flow-node-text' });
    const labelEl = h('span', { class: 'flow-node-label' }, node.label);
    textCol.appendChild(labelEl);

    if (node.sub) {
      const subEl = h('span', { class: 'flow-node-sub' }, node.sub);
      textCol.appendChild(subEl);
    }

    nodeEl.appendChild(textCol);
    flowInner.appendChild(nodeEl);
  }

  viewport.appendChild(flowInner);
  diagram.appendChild(viewport);
  card.appendChild(diagram);

  // Zoom and fit logic: fit to width by default (scale down, never past 100%)
  let userZoom = 1;
  let baseScale = 1;

  function updateLayout(): void {
    const containerWidth = viewport.clientWidth || card.clientWidth || layout.width;
    if (containerWidth > 0 && layout.width > 0) {
      baseScale = Math.min(1, containerWidth / layout.width);
    } else {
      baseScale = 1;
    }

    const effectiveScale = baseScale * userZoom;
    flowInner.style.transform = `scale(${effectiveScale})`;
    flowInner.style.transformOrigin = 'top left';

    const scaledHeight = Math.ceil(layout.height * effectiveScale);
    viewport.style.height = `${scaledHeight}px`;
    viewport.style.overflow = userZoom > 1 ? 'auto' : 'hidden';

    zoomValue.textContent = `${Math.round(userZoom * 100)}%`;
  }

  zoomInBtn.onclick = () => {
    userZoom = Math.min(2.5, +(userZoom + 0.15).toFixed(2));
    updateLayout();
  };

  zoomOutBtn.onclick = () => {
    userZoom = Math.max(0.5, +(userZoom - 0.15).toFixed(2));
    updateLayout();
  };

  resetBtn.onclick = () => {
    userZoom = 1;
    updateLayout();
  };

  const resizeObserver = typeof ResizeObserver !== 'undefined'
    ? new ResizeObserver(() => updateLayout())
    : null;
  resizeObserver?.observe(viewport);

  ctx.onCleanup(() => {
    resizeObserver?.disconnect();
  });

  requestAnimationFrame(() => {
    updateLayout();
    requestAnimationFrame(() => updateLayout());
  });

  return card;
}

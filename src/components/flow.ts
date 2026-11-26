import { FlowSpec } from '../core/types';
import { RenderContext } from './index';
import { clear, h } from '../core/dom';
import { iconEl } from '../core/icons';
import { dagreLayoutFlow, renderSmoothDagrePath } from './flowLayout';

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.15;

type FlowNodeWithDetail = FlowSpec['nodes'][number] & { detail?: string };

export function renderFlow(spec: FlowSpec, ctx: RenderContext): HTMLElement {
  const card = h('div', { class: 'iui-card flow-card' });
  if (spec.title) {
    card.appendChild(h('div', { class: 'iui-title flow-title' }, spec.title));
  }

  const nodes = (spec.nodes || []) as FlowNodeWithDetail[];
  const edges = spec.edges || [];
  const groups = spec.groups || [];

  const specNodeMap = new Map<string, FlowNodeWithDetail>(nodes.map((n) => [n.id, n]));
  const groupLabelMap = new Map<string, string>(groups.map((g) => [g.id, g.label]));
  const incomingEdgesMap = new Map<string, typeof edges>();
  const outgoingEdgesMap = new Map<string, typeof edges>();
  for (const edge of edges) {
    const outList = outgoingEdgesMap.get(edge.from) || [];
    outList.push(edge);
    outgoingEdgesMap.set(edge.from, outList);

    const inList = incomingEdgesMap.get(edge.to) || [];
    inList.push(edge);
    incomingEdgesMap.set(edge.to, inList);
  }

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
  const controls = h('div', {
    class: 'flow-controls iui-diagram-controls',
    role: 'group',
    'aria-label': 'Flow zoom controls',
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
  flowInner.style.margin = '0 auto';
  flowInner.style.transformOrigin = 'top center';

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
  const edgePathEls: SVGPathElement[] = [];
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
    path.setAttribute('data-from', edge.from);
    path.setAttribute('data-to', edge.to);

    const edgeToneClass = edge.tone === 'positive'
      ? 'is-positive'
      : edge.tone === 'negative'
        ? 'is-negative'
        : 'is-neutral';
    path.setAttribute('class', `flow-edge-path ${edgeToneClass}`);

    svgOverlay.appendChild(path);
    edgePathEls.push(path);
  }
  flowInner.appendChild(svgOverlay);

  // Render edge labels (tiny 11px pills with host background color masking line under them)
  const edgeLabelEls: HTMLElement[] = [];
  for (const edge of layout.edges) {
    if (!edge.label || edge.labelX === undefined || edge.labelY === undefined) continue;

    const pill = h('span', {
      class: `flow-edge-label ${edge.tone ? `tone-${edge.tone}` : ''}`,
      style: `left: ${edge.labelX}px; top: ${edge.labelY}px;`,
      'data-from': edge.from,
      'data-to': edge.to,
    }, edge.label);
    flowInner.appendChild(pill);
    edgeLabelEls.push(pill);
  }

  // Render nodes: compact rounded rects with 8px radius (pill for start/end), padding 6px by 10px, 13px text
  const nodeEls: HTMLElement[] = [];
  let isPointerInteraction = false;

  for (const node of layout.nodes) {
    const isPill = node.isStart || node.isEnd;
    const isDecision = node.decision;

    const nodeClasses = ['flow-node'];
    if (isPill) nodeClasses.push('is-pill');
    if (isDecision) nodeClasses.push('is-decision');
    if (node.color) nodeClasses.push(`c-${node.color}`);

    const nodeEl = h('div', {
      class: nodeClasses.join(' '),
      'data-node-id': node.id,
      tabindex: '0',
      role: 'button',
      'aria-pressed': 'false',
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

    nodeEl.addEventListener('pointerdown', () => {
      isPointerInteraction = true;
      requestAnimationFrame(() => {
        isPointerInteraction = false;
      });
    });

    nodeEl.addEventListener('focus', () => {
      if (!isPointerInteraction && selectedNodeId !== node.id) {
        selectNode(node.id);
      }
    });

    nodeEl.addEventListener('click', (e) => {
      if (suppressNextClick) return;
      e.stopPropagation();
      selectNode(selectedNodeId === node.id ? null : node.id);
    });

    nodeEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        selectNode(selectedNodeId === node.id ? null : node.id);
      } else if (e.key === 'Escape' && selectedNodeId !== null) {
        e.preventDefault();
        e.stopPropagation();
        selectNode(null);
      }
    });

    flowInner.appendChild(nodeEl);
    nodeEls.push(nodeEl);
  }

  // Node detail popover/bar
  const detailPanel = h('div', {
    class: 'flow-node-detail',
    role: 'region',
    'aria-live': 'polite',
    'aria-label': 'Selected node details',
    hidden: true,
  });

  viewport.appendChild(flowInner);
  diagram.appendChild(viewport);
  diagram.appendChild(detailPanel);
  card.appendChild(diagram);

  let selectedNodeId: string | null = null;

  function renderDetailPanel(nodeId: string | null): void {
    clear(detailPanel);
    if (!nodeId) {
      detailPanel.hidden = true;
      return;
    }

    const specNode = specNodeMap.get(nodeId);
    if (!specNode) {
      detailPanel.hidden = true;
      return;
    }

    detailPanel.hidden = false;

    const header = h('div', { class: 'flow-node-detail-header' });
    const titleWrap = h('div', { class: 'flow-node-detail-title-wrap' });
    titleWrap.appendChild(h('span', { class: 'flow-node-detail-title' }, specNode.label));
    if (specNode.group) {
      const groupName = groupLabelMap.get(specNode.group) || specNode.group;
      titleWrap.appendChild(h('span', { class: 'flow-node-detail-group' }, groupName));
    }

    const closeBtn = h('button', {
      class: 'flow-node-detail-close',
      type: 'button',
      'aria-label': 'Close node details',
      title: 'Close (Esc)',
    }, '\u00d7') as HTMLButtonElement;
    closeBtn.onclick = () => selectNode(null);

    header.append(titleWrap, closeBtn);
    detailPanel.appendChild(header);

    if (specNode.sub) {
      detailPanel.appendChild(h('div', { class: 'flow-node-detail-sub' }, specNode.sub));
    }
    if (specNode.detail) {
      detailPanel.appendChild(h('div', { class: 'flow-node-detail-body' }, specNode.detail));
    }

    const incoming = incomingEdgesMap.get(nodeId) || [];
    const outgoing = outgoingEdgesMap.get(nodeId) || [];
    if (incoming.length > 0 || outgoing.length > 0) {
      const connList = h('div', { class: 'flow-node-detail-conns' });
      if (incoming.length > 0) {
        const inItems = incoming.map((e) => {
          const fromLabel = nodeNameMap.get(e.from) || e.from;
          return e.label ? `${fromLabel} (${e.label})` : fromLabel;
        });
        connList.appendChild(
          h('div', { class: 'flow-node-detail-conn' },
            h('span', { class: 'flow-node-detail-conn-dir' }, 'In:'),
            h('span', { class: 'flow-node-detail-conn-text' }, inItems.join(', ')),
          ),
        );
      }
      if (outgoing.length > 0) {
        const outItems = outgoing.map((e) => {
          const toLabel = nodeNameMap.get(e.to) || e.to;
          return e.label ? `${toLabel} (${e.label})` : toLabel;
        });
        connList.appendChild(
          h('div', { class: 'flow-node-detail-conn' },
            h('span', { class: 'flow-node-detail-conn-dir' }, 'Out:'),
            h('span', { class: 'flow-node-detail-conn-text' }, outItems.join(', ')),
          ),
        );
      }
      detailPanel.appendChild(connList);
    }
  }

  function selectNode(nodeId: string | null): void {
    selectedNodeId = nodeId;
    flowInner.classList.toggle('has-selection', nodeId !== null);

    const neighbors = new Set<string>();
    if (nodeId !== null) {
      neighbors.add(nodeId);
      for (const e of incomingEdgesMap.get(nodeId) || []) neighbors.add(e.from);
      for (const e of outgoingEdgesMap.get(nodeId) || []) neighbors.add(e.to);
    }

    for (const el of nodeEls) {
      const id = el.dataset.nodeId || '';
      const isSelected = nodeId !== null && id === nodeId;
      const isNeighbor = nodeId !== null && neighbors.has(id);
      el.classList.toggle('is-selected', isSelected);
      el.classList.toggle('is-neighbor', isNeighbor && !isSelected);
      el.classList.toggle('is-dimmed', nodeId !== null && !isNeighbor);
      el.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
    }

    for (const path of edgePathEls) {
      const from = path.getAttribute('data-from');
      const to = path.getAttribute('data-to');
      const isConnected = nodeId !== null && (from === nodeId || to === nodeId);
      path.classList.toggle('is-highlighted', isConnected);
      path.classList.toggle('is-dimmed', nodeId !== null && !isConnected);
    }

    for (const pill of edgeLabelEls) {
      const from = pill.getAttribute('data-from');
      const to = pill.getAttribute('data-to');
      const isConnected = nodeId !== null && (from === nodeId || to === nodeId);
      pill.classList.toggle('is-highlighted', isConnected);
      pill.classList.toggle('is-dimmed', nodeId !== null && !isConnected);
    }

    renderDetailPanel(nodeId);
  }

  // Zoom, pan, and fit logic: fit to width by default (scale down, never past 100%)
  let userZoom = 1;
  let panX = 0;
  let panY = 0;
  let currentBaseScale = 1;
  let currentFitScale = 1;

  function applyTransform(): void {
    const effectiveScale = currentBaseScale * userZoom;
    flowInner.style.transform = `translate(${panX}px, ${panY}px) scale(${effectiveScale})`;
    flowInner.style.transformOrigin = 'top center';
    zoomValue.textContent = `${Math.round(userZoom * 100)}%`;
  }

  function updateLayout(): void {
    const containerWidth = viewport.clientWidth || card.clientWidth || layout.width;
    let widthScale = 1;
    if (containerWidth > 0 && layout.width > 0) {
      widthScale = Math.min(1, containerWidth / layout.width);
    }

    const maxAllowedCardHeight = 440;
    const paddingHeight = 24;
    const maxContentHeight = maxAllowedCardHeight - paddingHeight;

    let heightScale = 1;
    if (layout.height > maxContentHeight) {
      heightScale = maxContentHeight / layout.height;
    }

    currentFitScale = Math.min(widthScale, heightScale);
    currentBaseScale = Math.max(0.7, Math.min(1, currentFitScale));
    const effectiveScale = currentBaseScale * userZoom;

    flowInner.style.margin = '0 auto';
    const leftOffset = (containerWidth - layout.width) / 2;
    flowInner.style.left = `${leftOffset}px`;

    const scaledHeight = Math.ceil(layout.height * effectiveScale);
    viewport.style.height = `${Math.min(maxContentHeight, Math.max(scaledHeight, 80))}px`;
    viewport.style.overflow = 'hidden';

    applyTransform();
  }

  function clampZoom(z: number): number {
    return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, +z.toFixed(2)));
  }

  zoomInBtn.onclick = () => {
    userZoom = clampZoom(userZoom + ZOOM_STEP);
    updateLayout();
  };

  zoomOutBtn.onclick = () => {
    userZoom = clampZoom(userZoom - ZOOM_STEP);
    updateLayout();
  };

  fitBtn.onclick = () => {
    panX = 0;
    panY = 0;
    userZoom = currentBaseScale > 0
      ? clampZoom(Math.min(1, currentFitScale / currentBaseScale))
      : 1;
    updateLayout();
  };

  resetBtn.onclick = () => {
    userZoom = 1;
    panX = 0;
    panY = 0;
    updateLayout();
  };

  // Pointer-drag panning
  let isDragging = false;
  let hasDragged = false;
  let suppressNextClick = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let startPanX = 0;
  let startPanY = 0;

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest('.flow-controls') || target?.closest('.flow-node-detail')) return;

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
      viewport.classList.add('is-panning');
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
    viewport.classList.remove('is-panning');
    if (hasDragged) {
      suppressNextClick = true;
      setTimeout(() => {
        suppressNextClick = false;
      }, 0);
    }
  };

  viewport.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);

  // Clear selection when clicking empty viewport background
  viewport.addEventListener('click', (e) => {
    if (suppressNextClick) return;
    const target = e.target as HTMLElement | null;
    if (!target?.closest('.flow-node') && selectedNodeId !== null) {
      selectNode(null);
    }
  });

  // Double-click viewport to reset view
  viewport.addEventListener('dblclick', (e) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest('.flow-controls') || target?.closest('.flow-node-detail')) return;
    userZoom = 1;
    panX = 0;
    panY = 0;
    updateLayout();
  });

  // Ctrl/Meta + wheel zoom
  const onWheel = (e: WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    userZoom = clampZoom(userZoom * factor);
    updateLayout();
  };
  viewport.addEventListener('wheel', onWheel, { passive: false });

  // Escape clears selection
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && selectedNodeId !== null) {
      selectNode(null);
    }
  };
  document.addEventListener('keydown', onKeyDown);

  const resizeObserver = typeof ResizeObserver !== 'undefined'
    ? new ResizeObserver(() => updateLayout())
    : null;
  resizeObserver?.observe(viewport);

  ctx.onCleanup(() => {
    resizeObserver?.disconnect();
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);
    document.removeEventListener('keydown', onKeyDown);
  });

  requestAnimationFrame(() => {
    updateLayout();
    requestAnimationFrame(() => updateLayout());
  });

  return card;
}

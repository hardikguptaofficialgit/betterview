import { FlowSpec, FlowNode, FlowEdge, FlowGroup } from '../core/types';
import { RenderContext } from './index';
import { clear, h, svg } from '../core/dom';
import { iconEl } from '../core/icons';
import { layoutFlow, computeEdgeRoute } from './flowLayout';

function isDecisionNode(node: FlowNode, outgoingEdges: FlowEdge[]): boolean {
  if (node.label.trim().endsWith('?')) {
    return true;
  }
  if (outgoingEdges.length >= 2) {
    for (const e of outgoingEdges) {
      if (e.label && /^(yes|no|true|false)$/i.test(e.label.trim())) {
        return true;
      }
    }
  }
  return false;
}

export function renderFlow(spec: FlowSpec, ctx: RenderContext): HTMLElement {
  const card = h('div', { class: 'iui-card flow-card' });

  if (spec.title) {
    card.appendChild(h('div', { class: 'iui-title flow-title' }, spec.title));
  }

  const nodes = spec.nodes || [];
  const edges = spec.edges || [];
  const groups = spec.groups || [];

  const titleText = spec.title || 'Untitled';
  const canvas = h('div', {
    class: 'flow-canvas',
    role: 'region',
    tabindex: '0',
    'aria-label': `Flow diagram: ${titleText}, ${nodes.length} steps`,
  });

  // A compact, always-visible canvas toolbar. Zoom is applied to the whole
  // diagram so nodes, routes and labels stay aligned while the user explores.
  let zoom = 1;
  let contentWidth = 0;
  let contentHeight = 0;
  const controls = h('div', { class: 'flow-controls', role: 'toolbar', 'aria-label': 'Diagram controls' });
  const zoomLabel = h('span', { class: 'flow-zoom-label', 'aria-live': 'polite' }, '100%');
  const zoomSurface = h('div', { class: 'flow-zoom-surface' });
  const flowInner = h('div', { class: 'flow-inner' });

  function setZoom(next: number, anchorX?: number, anchorY?: number): void {
    const previous = zoom;
    zoom = Math.max(0.35, Math.min(2.5, next));
    if (previous === zoom) return;
    const x = anchorX ?? canvas.clientWidth / 2;
    const y = anchorY ?? canvas.clientHeight / 2;
    const logicalX = (canvas.scrollLeft + x) / previous;
    const logicalY = (canvas.scrollTop + y) / previous;
    flowInner.style.zoom = String(zoom);
    const surfaceScale = zoom;
    zoomSurface.style.width = `${contentWidth * surfaceScale}px`;
    zoomSurface.style.height = `${contentHeight * surfaceScale}px`;
    zoomLabel.textContent = `${Math.round(zoom * 100)}%`;
    canvas.scrollLeft = logicalX * zoom - x;
    canvas.scrollTop = logicalY * zoom - y;
  }

  function addControl(label: string, icon: string, action: () => void): HTMLButtonElement {
    const button = h('button', {
      class: 'flow-control-btn', type: 'button', 'aria-label': label, title: label,
      onClick: (event: Event) => { event.stopPropagation(); action(); },
    }, iconEl(icon, 15));
    controls.appendChild(button);
    return button;
  }

  addControl('Zoom out', 'minus', () => setZoom(zoom - 0.15));
  addControl('Zoom in', 'plus', () => setZoom(zoom + 0.15));
  addControl('Fit diagram', 'bounding-box', () => {
    if (!contentWidth || !contentHeight) return;
    const fit = Math.min((canvas.clientWidth - 32) / contentWidth, (canvas.clientHeight - 32) / contentHeight, 1);
    setZoom(Math.max(0.35, fit));
    canvas.scrollTo({ left: 0, top: 0, behavior: 'smooth' });
  });
  const fullscreenButton = addControl('Enter full screen', 'corners-out', async () => {
    try {
      if (card.matches(':fullscreen')) await document.exitFullscreen();
      else if (card.requestFullscreen) await card.requestFullscreen();
      else card.classList.toggle('is-fullscreen-fallback');
    } catch {
      card.classList.toggle('is-fullscreen-fallback');
    }
    syncFullscreen();
  });
  const syncFullscreen = () => {
    const active = card.matches(':fullscreen') || card.classList.contains('is-fullscreen-fallback');
    fullscreenButton.setAttribute('aria-label', active ? 'Exit full screen' : 'Enter full screen');
    fullscreenButton.title = active ? 'Exit full screen' : 'Enter full screen';
    fullscreenButton.replaceChildren(iconEl(active ? 'corners-in' : 'corners-out', 15));
    if (active) requestAnimationFrame(() => {
      const fit = Math.min(
        (canvas.clientWidth - 56) / Math.max(contentWidth, 1),
        (canvas.clientHeight - 56) / Math.max(contentHeight, 1),
        1.5,
      );
      setZoom(Math.max(0.35, fit));
      canvas.scrollTo({ left: 0, top: 0, behavior: 'smooth' });
    });
  };
  document.addEventListener('fullscreenchange', syncFullscreen);
  ctx.onCleanup(() => document.removeEventListener('fullscreenchange', syncFullscreen));
  controls.appendChild(zoomLabel);

  // Ctrl/⌘ + wheel zooms around the pointer; ordinary wheel/trackpad scrolls.
  const onWheel = (event: WheelEvent) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    setZoom(zoom * (event.deltaY < 0 ? 1.08 : 0.92), event.clientX - rect.left, event.clientY - rect.top);
  };
  canvas.addEventListener('wheel', onWheel, { passive: false });
  ctx.onCleanup(() => canvas.removeEventListener('wheel', onWheel));

  // Grab-and-drag panning (ignore clicks on controls and diagram nodes).
  let drag: { x: number; y: number; left: number; top: number } | null = null;
  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest('.flow-node, .flow-controls')) return;
    drag = { x: event.clientX, y: event.clientY, left: canvas.scrollLeft, top: canvas.scrollTop };
    canvas.classList.add('is-panning');
    canvas.setPointerCapture?.(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent) => {
    if (!drag) return;
    canvas.scrollLeft = drag.left - (event.clientX - drag.x);
    canvas.scrollTop = drag.top - (event.clientY - drag.y);
  };
  const stopPan = () => { drag = null; canvas.classList.remove('is-panning'); };
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', stopPan);
  canvas.addEventListener('pointercancel', stopPan);
  ctx.onCleanup(() => {
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', stopPan);
    canvas.removeEventListener('pointercancel', stopPan);
  });

  const nodeMap = new Map<string, FlowNode>();
  for (const n of nodes) {
    nodeMap.set(n.id, n);
  }

  const outgoingMap = new Map<string, FlowEdge[]>();
  for (const n of nodes) {
    outgoingMap.set(n.id, []);
  }
  for (const e of edges) {
    if (outgoingMap.has(e.from)) {
      outgoingMap.get(e.from)!.push(e);
    }
  }

  // Accessibility: visually hidden <ol> with "A → B (label)" lines
  const srList = h('ol', { class: 'iui-sr-only' });
  for (const n of nodes) {
    const outs = outgoingMap.get(n.id) || [];
    if (outs.length > 0) {
      for (const e of outs) {
        const targetNode = nodeMap.get(e.to);
        const targetLabel = targetNode ? targetNode.label : e.to;
        const edgeLabelPart = e.label ? ` (${e.label})` : '';
        srList.appendChild(
          h('li', {}, `${n.label} → ${targetLabel}${edgeLabelPart}`)
        );
      }
    } else {
      srList.appendChild(h('li', {}, n.label));
    }
  }
  canvas.appendChild(srList);

  // Compute graph layout
  const layout = layoutFlow(nodes, edges);

  const topoOrder = new Map<string, number>();
  let topoIdx = 0;
  for (const r of layout.ranks) {
    for (const id of r) {
      topoOrder.set(id, topoIdx++);
    }
  }

  const svgOverlay = svg('svg', { class: 'flow-svg-overlay' });
  const labelsLayer = h('div', { class: 'flow-labels-layer' });

  // Generate unique marker ID per instance
  const markerId = 'flow-arrow-' + Math.random().toString(36).slice(2, 9);
  const defs = svg('defs');
  const marker = svg('marker', {
    id: markerId,
    viewBox: '0 0 8 8',
    refX: 6,
    refY: 4,
    markerWidth: 5,
    markerHeight: 5,
    orient: 'auto-start-reverse',
  });
  const markerPath = svg('path', {
    d: 'M 1 2 L 6 4 L 1 6 z',
    fill: 'var(--iui-muted)',
  });
  marker.appendChild(markerPath);
  defs.appendChild(marker);
  svgOverlay.appendChild(defs);

  function createNodeCard(node: FlowNode): HTMLElement {
    const outs = outgoingMap.get(node.id) || [];
    const isDecision = isDecisionNode(node, outs);
    const color = isDecision && !node.color ? 'amber' : node.color || 'stone';

    const cardClasses = ['flow-node', `c-${color}`];
    if (isDecision) {
      cardClasses.push('is-decision');
    }

    const tooltip = node.sub ? `${node.label}\n${node.sub}` : node.label;
    const nodeEl = h('div', {
      class: cardClasses.join(' '),
      'data-node-id': node.id,
      title: tooltip,
    });
    const topoRank = topoOrder.get(node.id) ?? 0;
    nodeEl.style.setProperty('--node-topo-idx', String(topoRank));

    // Only show an icon when the model supplied a meaningful one. Filling
    // every node with a generic sparkle makes diagrams feel noisy and templated.
    if (node.icon) {
      const iconBox = h(
        'div',
        { class: 'flow-node-iconbox' },
        iconEl(node.icon, 16)
      );
      nodeEl.appendChild(iconBox);
    }

    // Text column
    const textCol = h('div', { class: 'flow-node-text' });
    const labelEl = h('span', { class: 'flow-node-label' });
    if (isDecision) {
      labelEl.appendChild(h('span', { class: 'flow-diamond-glyph' }, '\u25C6'));
    }
    labelEl.appendChild(document.createTextNode(node.label));
    textCol.appendChild(labelEl);

    if (node.sub) {
      const subEl = h('span', { class: 'flow-node-sub' }, node.sub);
      textCol.appendChild(subEl);
    }

    nodeEl.appendChild(textCol);
    return nodeEl;
  }

  const hasGroups =
    (groups && groups.length > 0) || nodes.some((n) => !!n.group);

  if (!hasGroups) {
    // Without groups: each rank is a row with 44px vertical gap
    const flowBody = h('div', { class: 'flow-body flow-ungrouped-body' });
    for (let r = 0; r < layout.ranks.length; r++) {
      const rankRow = h('div', { class: 'flow-rank-row' });
      for (const id of layout.ranks[r]) {
        const node = nodeMap.get(id);
        if (node) {
          rankRow.appendChild(createNodeCard(node));
        }
      }
      flowBody.appendChild(rankRow);
    }
    flowInner.appendChild(flowBody);
  } else {
    // With groups: render one group container per group in the order its nodes first appear by rank.
    // Containers stack vertically with 40px gaps.
    // Nodes without a group render in an ungrouped section in the same rank order.
    const flowBody = h('div', { class: 'flow-body flow-grouped-body' });

    const groupMap = new Map<string, FlowGroup>();
    for (const g of groups) {
      groupMap.set(g.id, g);
    }

    // Collect distinct groups in order of first appearance by rank
    interface SectionOrder {
      type: 'group' | 'ungrouped';
      groupId?: string;
      minRank: number;
    }
    const sections: SectionOrder[] = [];

    for (const g of groups) {
      const gNodes = nodes.filter((n) => n.group === g.id);
      if (gNodes.length > 0) {
        const minRank = Math.min(
          ...gNodes.map((n) => layout.rankOf[n.id] ?? 0)
        );
        sections.push({ type: 'group', groupId: g.id, minRank });
      }
    }

    const ungroupedNodes = nodes.filter((n) => !n.group);
    if (ungroupedNodes.length > 0) {
      const minRank = Math.min(
        ...ungroupedNodes.map((n) => layout.rankOf[n.id] ?? 0)
      );
      sections.push({ type: 'ungrouped', minRank });
    }

    sections.sort((a, b) => a.minRank - b.minRank);

    for (const sec of sections) {
      if (sec.type === 'group' && sec.groupId) {
        const g = groupMap.get(sec.groupId) || {
          id: sec.groupId,
          label: sec.groupId,
        };
        const color = g.color || 'stone';
        const groupContainer = h('div', {
          class: `flow-group-container tinted c-${color}`,
        });

        const labelChip = h('div', { class: 'flow-group-label' }, g.label);
        groupContainer.appendChild(labelChip);

        const rowsWrap = h('div', { class: 'flow-group-rows' });
        // Distinct ranks for this group in order
        const gNodes = nodes.filter((n) => n.group === g.id);
        const gRanks = Array.from(
          new Set(gNodes.map((n) => layout.rankOf[n.id] ?? 0))
        ).sort((a, b) => a - b);

        for (const r of gRanks) {
          const rankRow = h('div', { class: 'flow-rank-row' });
          const idsAtRank = (layout.ranks[r] || []).filter(
            (id) => nodeMap.get(id)?.group === g.id
          );
          for (const id of idsAtRank) {
            const node = nodeMap.get(id);
            if (node) {
              rankRow.appendChild(createNodeCard(node));
            }
          }
          rowsWrap.appendChild(rankRow);
        }

        groupContainer.appendChild(rowsWrap);
        flowBody.appendChild(groupContainer);
      } else if (sec.type === 'ungrouped') {
        const ungroupedSec = h('div', { class: 'flow-ungrouped-section' });
        const unRanks = Array.from(
          new Set(ungroupedNodes.map((n) => layout.rankOf[n.id] ?? 0))
        ).sort((a, b) => a - b);

        for (const r of unRanks) {
          const rankRow = h('div', { class: 'flow-rank-row' });
          const idsAtRank = (layout.ranks[r] || []).filter(
            (id) => !nodeMap.get(id)?.group
          );
          for (const id of idsAtRank) {
            const node = nodeMap.get(id);
            if (node) {
              rankRow.appendChild(createNodeCard(node));
            }
          }
          ungroupedSec.appendChild(rankRow);
        }

        flowBody.appendChild(ungroupedSec);
      }
    }

    flowInner.appendChild(flowBody);
  }

  flowInner.appendChild(svgOverlay);
  flowInner.appendChild(labelsLayer);
  zoomSurface.appendChild(flowInner);
  canvas.appendChild(zoomSurface);
  card.appendChild(controls);
  card.appendChild(canvas);

  function redraw(): void {
    // Clear previous paths & pills
    while (svgOverlay.childNodes.length > 1) {
      svgOverlay.removeChild(svgOverlay.lastChild!);
    }
    clear(labelsLayer);

    // Measure and route in the diagram's unscaled coordinate space. The zoom
    // is restored after layout so SVG paths and labels are scaled together.
    const appliedZoom = flowInner.style.zoom || '1';
    flowInner.style.zoom = '1';
    const innerRect = flowInner.getBoundingClientRect();
    if (innerRect.width === 0 && innerRect.height === 0) {
      flowInner.style.zoom = appliedZoom;
      return;
    }

    // Measure card rects relative to flowInner
    const nodeBoxes = new Map<
      string,
      { x: number; y: number; width: number; height: number }
    >();
    let allBoxesRight = 0;
    for (const n of nodes) {
      const nodeEl = flowInner.querySelector(
        `[data-node-id="${n.id}"]`
      ) as HTMLElement | null;
      if (nodeEl) {
        const rect = nodeEl.getBoundingClientRect();
        const box = {
          x: rect.left - innerRect.left,
          y: rect.top - innerRect.top,
          width: rect.width,
          height: rect.height,
        };
        nodeBoxes.set(n.id, box);
        allBoxesRight = Math.max(allBoxesRight, box.x + box.width);
      }
    }

    // Count outer edges for gutter sizing
    let outerEdgeCount = 0;
    for (const e of edges) {
      const isBackEdge =
        layout.backEdges.has(`${e.from}->${e.to}`) ||
        (layout.rankOf[e.to] ?? 0) <= (layout.rankOf[e.from] ?? 0);
      const isRankSkip =
        (layout.rankOf[e.to] ?? 0) > (layout.rankOf[e.from] ?? 0) + 1;
      if (isBackEdge || isRankSkip) {
        outerEdgeCount++;
      }
    }

    const scrollW = Math.max(
      flowInner.scrollWidth,
      flowInner.clientWidth,
      allBoxesRight + (outerEdgeCount > 0 ? 50 + outerEdgeCount * 18 : 20),
    );
    const scrollH = Math.max(flowInner.scrollHeight, flowInner.clientHeight);

    contentWidth = scrollW;
    contentHeight = scrollH;
    const surfaceScale = zoom;
    zoomSurface.style.width = `${contentWidth * surfaceScale}px`;
    zoomSurface.style.height = `${contentHeight * surfaceScale}px`;

    // Preserve readable node text on narrow chat columns. The canvas scrolls
    // horizontally when a graph is wider than the available conversation width.
    flowInner.style.transform = '';
    flowInner.style.transformOrigin = '';
    canvas.style.height = '';

    svgOverlay.setAttribute('width', String(scrollW));
    svgOverlay.setAttribute('height', String(scrollH));
    svgOverlay.style.width = `${scrollW}px`;
    svgOverlay.style.height = `${scrollH}px`;
    labelsLayer.style.width = `${scrollW}px`;
    labelsLayer.style.height = `${scrollH}px`;

    // Group forward outgoing edges for fan-out calculation
    const forwardOutByFrom = new Map<string, FlowEdge[]>();
    for (const e of edges) {
      const isBackEdge =
        layout.backEdges.has(`${e.from}->${e.to}`) ||
        (layout.rankOf[e.to] ?? 0) <= (layout.rankOf[e.from] ?? 0);
      const isRankSkip =
        (layout.rankOf[e.to] ?? 0) > (layout.rankOf[e.from] ?? 0) + 1;
      if (!isBackEdge && !isRankSkip) {
        if (!forwardOutByFrom.has(e.from)) {
          forwardOutByFrom.set(e.from, []);
        }
        forwardOutByFrom.get(e.from)!.push(e);
      }
    }

    // Draw edges and gently separate nearby edge labels. Several long/back
    // channels can share a midpoint; stacking pills there made them unreadable.
    const placedLabels: { x: number; y: number; width: number; height: number }[] = [];
    let currentOuterIdx = 0;
    for (let edgeIdx = 0; edgeIdx < edges.length; edgeIdx++) {
      const e = edges[edgeIdx];
      const sourceBox = nodeBoxes.get(e.from);
      const targetBox = nodeBoxes.get(e.to);
      if (!sourceBox || !targetBox) continue;

      const isBackEdge =
        layout.backEdges.has(`${e.from}->${e.to}`) ||
        (layout.rankOf[e.to] ?? 0) <= (layout.rankOf[e.from] ?? 0);
      const isRankSkip =
        (layout.rankOf[e.to] ?? 0) > (layout.rankOf[e.from] ?? 0) + 1;

      let fanOffset = 0;
      if (!isBackEdge && !isRankSkip) {
        const siblings = forwardOutByFrom.get(e.from) || [e];
        const k = siblings.length;
        const idx = siblings.indexOf(e);
        if (k > 1) {
          fanOffset = -12 + (idx / (k - 1)) * 24;
        }
      }

      const outerIdx = (isBackEdge || isRankSkip) ? currentOuterIdx++ : 0;
      const route = computeEdgeRoute(
        sourceBox,
        targetBox,
        isBackEdge,
        isRankSkip,
        allBoxesRight,
        outerIdx,
        fanOffset,
        Array.from(nodeBoxes.values()),
      );

      const pathEl = svg('path', {
        d: route.pathD,
        stroke: 'var(--iui-muted)',
        'stroke-width': '1.75',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        fill: 'none',
        'marker-end': `url(#${markerId})`,
      });

      // Edges are intentionally static. redraw() runs after layout, font and
      // resize changes; animating newly-created SVG paths here made every
      // observer pass look like the whole diagram was restarting.
      svgOverlay.appendChild(pathEl);

      // Edge label at route.labelPoint
      if (e.label && e.label.trim()) {
        const labelText = e.label.trim();
        let chipClass = 'c-stone';
        if (/^(yes|true)$/i.test(labelText)) {
          chipClass = 'c-mint';
        } else if (/^(no|false)$/i.test(labelText)) {
          chipClass = 'c-rose';
        }

        const pill = h(
          'span',
          { class: `flow-edge-label iui-chip ${chipClass}` },
          labelText
        );
        const candidates = [0, 22, -22, 44, -44, 66, -66, 88, -88];
        const measuredWidth = Math.max(44, labelText.length * 7 + 22);
        const measuredHeight = 26;
        let labelX = route.labelPoint.x;
        let labelY = route.labelPoint.y;
        for (const offset of candidates) {
          const candidate = { x: route.labelPoint.x, y: route.labelPoint.y + offset, width: measuredWidth, height: measuredHeight };
          const collides = placedLabels.some((other) =>
            Math.abs(candidate.x - other.x) < (candidate.width + other.width) / 2 + 8 &&
            Math.abs(candidate.y - other.y) < (candidate.height + other.height) / 2 + 5,
          );
          if (!collides) { labelX = candidate.x; labelY = candidate.y; placedLabels.push(candidate); break; }
        }
        pill.style.left = `${labelX}px`;
        pill.style.top = `${labelY}px`;

        labelsLayer.appendChild(pill);
      }
    }
    flowInner.style.zoom = appliedZoom;
  }

  // Setup ResizeObserver and settles
  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => {
      redraw();
    });
    ro.observe(canvas);
    ro.observe(flowInner);
    ctx.onCleanup(() => {
      ro.disconnect();
    });
  }

  // Settle after layout / fonts
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      redraw();
    });
  });

  if (typeof document !== 'undefined' && 'fonts' in document) {
    (document as any).fonts?.ready?.then(() => {
      redraw();
    });
  }

  return card;
}

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
    role: 'img',
    'aria-label': `Flow diagram: ${titleText}, ${nodes.length} steps`,
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

  const flowInner = h('div', { class: 'flow-inner' });
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
    fill: 'var(--iui-text)',
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

    // Iconbox
    const iconBox = h(
      'div',
      { class: 'flow-node-iconbox' },
      iconEl(node.icon, 18)
    );
    nodeEl.appendChild(iconBox);

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
  canvas.appendChild(flowInner);
  card.appendChild(canvas);

  function redraw(): void {
    // Clear previous paths & pills
    while (svgOverlay.childNodes.length > 1) {
      svgOverlay.removeChild(svgOverlay.lastChild!);
    }
    clear(labelsLayer);

    const innerRect = flowInner.getBoundingClientRect();
    if (innerRect.width === 0 && innerRect.height === 0) {
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

    // Fit to chat width: scale down to fit exactly, no arbitrary minimum
    const canvasWidth = canvas.clientWidth;
    if (canvasWidth > 0 && scrollW > canvasWidth) {
      const scale = Math.min(1, canvasWidth / scrollW);
      flowInner.style.transformOrigin = 'top left';
      flowInner.style.transform = scale < 0.999 ? `scale(${scale})` : '';
      canvas.style.height = scale < 0.999 ? `${Math.ceil(scrollH * scale)}px` : '';
    } else {
      flowInner.style.transform = '';
      canvas.style.height = '';
    }

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

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Draw edges
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
        stroke: 'var(--iui-text)',
        'stroke-width': '1.5',
        fill: 'none',
        'marker-end': `url(#${markerId})`,
      });

      if (!prefersReduced && typeof requestAnimationFrame !== 'undefined') {
        try {
          const len = (pathEl as SVGGeometryElement).getTotalLength?.() || 200;
          pathEl.style.strokeDasharray = `${len}`;
          pathEl.style.strokeDashoffset = `${len}`;
          const edgeDelay = 150 + edgeIdx * 100;
          pathEl.style.transition = `stroke-dashoffset 400ms cubic-bezier(.2,.8,.2,1) ${edgeDelay}ms`;
          requestAnimationFrame(() => {
            pathEl.style.strokeDashoffset = '0';
          });
        } catch {
          // ignore
        }
      }

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
        pill.style.left = `${route.labelPoint.x}px`;
        pill.style.top = `${route.labelPoint.y}px`;

        if (!prefersReduced && typeof requestAnimationFrame !== 'undefined') {
          pill.style.opacity = '0';
          const labelDelay = 150 + edgeIdx * 100 + 350;
          pill.style.transition = `opacity 240ms cubic-bezier(.2,.8,.2,1) ${labelDelay}ms`;
          requestAnimationFrame(() => {
            pill.style.opacity = '1';
          });
        }

        labelsLayer.appendChild(pill);
      }
    }
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

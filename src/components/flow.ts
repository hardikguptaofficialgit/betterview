import {
  BaseGraph,
  ConnectorShape,
  EdgeMarker,
  EdgeMarkerRegistry,
  FitPlugin,
  HierarchicalLayout,
  InternalEvent,
  Perimeter,
  PerimeterRegistry,
  PanningHandler,
  RectangleShape,
  SelectionCellsHandler,
  SelectionHandler,
  ShapeRegistry,
  registerOrthogonalEdgeStyle,
} from '@maxgraph/core';
import type { CellStyle } from '@maxgraph/core';
import { FlowSpec } from '../core/types';
import { RenderContext } from './index';
import { h } from '../core/dom';
import { buildFlowGraphModel } from './flowGraph';

const LIGHT_STROKES: Record<string, string> = {
  blue: '#8ABFEA', sky: '#8ABFEA', green: '#87C9A5', teal: '#79C5BA', mint: '#87C9A5',
  amber: '#D8C16D', butter: '#D8C16D', orange: '#E7A87E', peach: '#E7A87E',
  red: '#E49AAA', pink: '#E49AAA', rose: '#E49AAA', purple: '#A99AE5', lavender: '#A99AE5',
  gray: '#B2B2AE', stone: '#B2B2AE',
};

const DARK_STROKES: Record<string, string> = {
  blue: '#6FA8D6', sky: '#6FA8D6', green: '#6DBF95', teal: '#63B7AC', mint: '#6DBF95',
  amber: '#CDB45A', butter: '#CDB45A', orange: '#D9946C', peach: '#D9946C',
  red: '#D47F95', pink: '#D47F95', rose: '#D47F95', purple: '#9585D6', lavender: '#9585D6',
  gray: '#8F8F8B', stone: '#8F8F8B',
};

let graphStylesRegistered = false;

function registerGraphStyles(): void {
  if (graphStylesRegistered) return;
  if (!ShapeRegistry.get('rectangle')) ShapeRegistry.add('rectangle', RectangleShape);
  if (!ShapeRegistry.get('connector')) ShapeRegistry.add('connector', ConnectorShape);
  if (!PerimeterRegistry.get('rectanglePerimeter')) PerimeterRegistry.add('rectanglePerimeter', Perimeter.RectanglePerimeter);
  if (!EdgeMarkerRegistry.get('classic')) EdgeMarkerRegistry.add('classic', EdgeMarker.createArrow(2));
  registerOrthogonalEdgeStyle();
  graphStylesRegistered = true;
}

function controlButton(label: string, ariaLabel: string, onClick: () => void): HTMLButtonElement {
  return h('button', {
    class: 'flow-control-btn',
    type: 'button',
    'aria-label': ariaLabel,
    title: ariaLabel,
    onClick,
  }, label) as HTMLButtonElement;
}

export function renderFlow(spec: FlowSpec, ctx: RenderContext): HTMLElement {
  const card = h('div', { class: 'iui-card flow-card' });
  if (spec.title) card.appendChild(h('div', { class: 'iui-title flow-title' }, spec.title));

  const model = buildFlowGraphModel(spec);
  const diagram = h('div', { class: 'flow-diagram', role: 'region' });
  const srList = h('ol', { class: 'iui-sr-only' });
  const nodeLabels = new Map(model.nodes.map((node) => [node.id, node.accessibleLabel]));
  for (const edge of model.edges) {
    const source = nodeLabels.get(edge.from) || edge.from;
    const target = nodeLabels.get(edge.to) || edge.to;
    srList.appendChild(h('li', {}, `${source} → ${target}${edge.label ? ` (${edge.label})` : ''}`));
  }
  if (model.edges.length === 0) {
    for (const node of model.nodes) srList.appendChild(h('li', {}, node.accessibleLabel));
  }
  diagram.appendChild(srList);

  const controls = h('div', { class: 'flow-controls', role: 'group', 'aria-label': 'Flow zoom controls' });
  const zoomValue = h('span', { class: 'flow-zoom-value', 'aria-live': 'polite' }, '100%');
  const viewport = h('div', {
    class: 'flow-viewport',
    role: 'region',
    'aria-label': `Interactive flow canvas: ${spec.title || 'Untitled'}, ${model.nodes.length} nodes`,
  });
  const canvas = h('div', {
    class: 'flow-graph-canvas',
    role: 'application',
    tabindex: '0',
    'aria-label': `Diagram with ${model.nodes.length} movable nodes and ${model.edges.length} connected edges`,
  });
  canvas.dataset.flowNodeCount = String(model.nodes.length);
  canvas.dataset.flowEdgeCount = String(model.edges.length);
  viewport.appendChild(canvas);

  const instructions = h('div', { class: 'flow-instructions' }, 'Drag a block to move it · drag empty space to pan · use the controls to zoom');
  instructions.id = `flow-help-${Math.random().toString(36).slice(2, 9)}`;
  canvas.setAttribute('aria-describedby', instructions.id);

  registerGraphStyles();
  InternalEvent.disableContextMenu(canvas);
  const graph = new BaseGraph({
    container: canvas,
    plugins: [PanningHandler, SelectionHandler, SelectionCellsHandler, FitPlugin],
  });

  const isDark = ctx.theme === 'dark';
  const nodeFill = isDark ? '#1C1C1E' : '#FFFFFF';
  const textColor = isDark ? '#F5F5F5' : '#1F1F1F';
  const edgeTextColor = isDark ? '#DDDDDF' : '#3F3F46';
  const neutralEdge = isDark ? '#85858A' : '#8A8A8F';
  const edgeLabelFill = nodeFill;
  const groupStyles = new Map((spec.groups || []).map((group) => [group.id, group]));
  const cellById = new Map<string, ReturnType<BaseGraph['insertVertex']>>();
  const parent = graph.getDefaultParent();

  graph.setTooltips(false);
  graph.getView().setAllowEval(false);
  graph.container.style.backgroundColor = nodeFill;
  graph.container.style.touchAction = 'none';

  const defaultVertexStyle = graph.getStylesheet().getDefaultVertexStyle();
  defaultVertexStyle.perimeter = 'rectanglePerimeter';
  const defaultEdgeStyle = graph.getStylesheet().getDefaultEdgeStyle();
  defaultEdgeStyle.edgeStyle = 'orthogonalEdgeStyle';
  defaultEdgeStyle.endArrow = 'classic';

  graph.batchUpdate(() => {
    for (const node of model.nodes) {
      const group = node.groupId ? groupStyles.get(node.groupId) : undefined;
      const color = LIGHT_STROKES[node.color] ? node.color : group?.color || 'stone';
      const stroke = (isDark ? DARK_STROKES : LIGHT_STROKES)[color] || neutralEdge;
      const style: CellStyle = {
        rounded: true,
        arcSize: 12,
        fillColor: nodeFill,
        strokeColor: node.decision ? (isDark ? DARK_STROKES.amber : LIGHT_STROKES.amber) : stroke,
        strokeWidth: node.decision ? 1.6 : 1.35,
        dashed: node.decision,
        fontColor: textColor,
        fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, sans-serif',
        fontSize: 13,
        align: 'center',
        verticalAlign: 'middle',
        whiteSpace: 'wrap',
        overflow: 'hidden',
        spacing: 10,
      };
      const cell = graph.insertVertex({
        parent,
        id: node.id,
        value: node.label,
        position: [0, 0],
        size: [232, node.sub ? 78 : 58],
        style,
      });
      cellById.set(node.id, cell);
    }

    for (const edge of model.edges) {
      const source = cellById.get(edge.from);
      const target = cellById.get(edge.to);
      if (!source || !target) continue;
      const toneColor = edge.tone === 'positive'
        ? (isDark ? '#79C89A' : '#337D55')
        : edge.tone === 'negative'
          ? (isDark ? '#E39AA7' : '#A63A4E')
          : neutralEdge;
      graph.insertEdge({
        parent,
        source,
        target,
        value: edge.label || '',
        style: {
          edgeStyle: 'orthogonalEdgeStyle',
          rounded: true,
          strokeColor: toneColor,
          strokeWidth: 1.6,
          startArrow: 'none',
          endArrow: 'classic',
          fontColor: edge.tone === 'neutral' ? edgeTextColor : toneColor,
          fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, sans-serif',
          fontSize: 11,
          labelBackgroundColor: edgeLabelFill,
          align: 'center',
          verticalAlign: 'middle',
          whiteSpace: 'wrap',
        },
      });
    }
  });

  const layout = new HierarchicalLayout(graph, 'north');
  layout.intraCellSpacing = 36;
  layout.interRankCellSpacing = 52;
  layout.interHierarchySpacing = 48;
  layout.parallelEdgeSpacing = 18;
  layout.execute(parent);
  graph.refresh();

  const panning = graph.getPlugin<PanningHandler>(PanningHandler.pluginId);
  if (panning) {
    panning.setPanningEnabled(true);
    panning.useLeftButtonForPanning = true;
    panning.ignoreCell = false;
  }
  const selection = graph.getPlugin<SelectionHandler>(SelectionHandler.pluginId);
  if (selection) {
    selection.moveEnabled = true;
    selection.cloneEnabled = false;
    selection.rotationEnabled = false;
  }

  const fitPlugin = graph.getPlugin<FitPlugin>(FitPlugin.pluginId);
  if (fitPlugin) {
    fitPlugin.minFitScale = 0.84;
    fitPlugin.maxFitScale = 1.1;
  }

  const updateZoomLabel = () => {
    zoomValue.textContent = `${Math.round(graph.getView().scale * 100)}%`;
  };
  const zoomTo = (requestedScale: number) => {
    const view = graph.getView();
    const previousScale = view.scale || 1;
    const nextScale = Math.max(0.6, Math.min(1.8, requestedScale));
    const centerX = canvas.clientWidth / 2;
    const centerY = canvas.clientHeight / 2;
    const translate = view.translate;
    view.scaleAndTranslate(
      nextScale,
      translate.x + centerX / nextScale - centerX / previousScale,
      translate.y + centerY / nextScale - centerY / previousScale,
    );
    updateZoomLabel();
  };

  const zoomOut = controlButton('−', 'Zoom out', () => zoomTo(graph.getView().scale - 0.1));
  const zoomIn = controlButton('+', 'Zoom in', () => zoomTo(graph.getView().scale + 0.1));
  const reset = controlButton('Reset', 'Reset flow zoom', () => {
    graph.getView().scaleAndTranslate(1, 24, 24);
    updateZoomLabel();
  });
  const fit = controlButton('Fit', 'Fit flow in canvas', () => {
    if (!fitPlugin) return;
    fitPlugin.minFitScale = 0.6;
    fitPlugin.maxFitScale = 1.15;
    fitPlugin.fitCenter({ margin: 24 });
    fitPlugin.minFitScale = 0.84;
    fitPlugin.maxFitScale = 1.1;
    updateZoomLabel();
  });
  controls.append(zoomOut, zoomValue, zoomIn, reset, fit);
  diagram.append(controls, viewport, instructions);
  card.appendChild(diagram);

  let initialFitPending = true;
  let disposed = false;
  const fitInitialView = () => {
    if (disposed || !canvas.isConnected || !initialFitPending || canvas.clientWidth === 0 || canvas.clientHeight === 0) return;
    if (fitPlugin) fitPlugin.fitCenter({ margin: 24 });
    initialFitPending = false;
    updateZoomLabel();
  };
  const refreshGraph = () => {
    if (disposed || !canvas.isConnected) return;
    graph.refresh();
    fitInitialView();
  };

  const resizeObserver = typeof ResizeObserver !== 'undefined'
    ? new ResizeObserver(() => {
        refreshGraph();
      })
    : null;
  resizeObserver?.observe(viewport);
  ctx.onCleanup(() => {
    disposed = true;
    resizeObserver?.disconnect();
    graph.destroy();
  });

  requestAnimationFrame(() => {
    requestAnimationFrame(refreshGraph);
  });
  if (typeof document !== 'undefined' && 'fonts' in document) {
    void (document as any).fonts?.ready?.then(() => {
      refreshGraph();
    });
  }

  return card;
}

import type { Color, FlowEdge, FlowGroup, FlowNode, FlowSpec } from '../core/types';

export interface FlowGraphNode {
  id: string;
  label: string;
  accessibleLabel: string;
  tooltip: string;
  color: Color;
  decision: boolean;
  groupId?: string;
  icon?: string;
  sub?: string;
}

export interface FlowGraphEdge {
  from: string;
  to: string;
  label?: string;
  tone: 'positive' | 'negative' | 'neutral';
}

export interface FlowGraphModel {
  nodes: FlowGraphNode[];
  edges: FlowGraphEdge[];
}

function edgeTone(label?: string): FlowGraphEdge['tone'] {
  const value = label?.trim().toLowerCase();
  if (value === 'yes' || value === 'true') return 'positive';
  if (value === 'no' || value === 'false') return 'negative';
  return 'neutral';
}

function isDecisionNode(node: FlowNode, outgoing: FlowEdge[]): boolean {
  if (node.label.trim().endsWith('?')) return true;
  return outgoing.length >= 2 && outgoing.some((edge) => /^(yes|no|true|false)$/i.test(edge.label?.trim() || ''));
}

function accessibleNodeLabel(node: FlowNode, group?: FlowGroup): string {
  return [node.label, node.sub, group?.label].filter((value): value is string => !!value?.trim()).join('. ');
}

export function buildFlowGraphModel(spec: FlowSpec): FlowGraphModel {
  const groups = new Map((spec.groups || []).map((group) => [group.id, group]));
  const nodeIds = new Set(spec.nodes.map((node) => node.id));
  const validEdges = spec.edges.filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to));
  const outgoing = new Map<string, FlowEdge[]>();
  for (const node of spec.nodes) outgoing.set(node.id, []);
  for (const edge of validEdges) outgoing.get(edge.from)?.push(edge);

  const nodes = spec.nodes.map((node): FlowGraphNode => {
    const group = node.group ? groups.get(node.group) : undefined;
    const groupPrefix = group?.label?.trim() ? `${group.label.trim()} · ` : '';
    return {
      id: node.id,
      label: `${groupPrefix}${node.label}${node.sub ? `\n${node.sub}` : ''}`,
      accessibleLabel: accessibleNodeLabel(node, group),
      tooltip: [node.label, node.sub, group?.label].filter((value): value is string => !!value?.trim()).join('\n'),
      color: node.color || group?.color || 'stone',
      decision: isDecisionNode(node, outgoing.get(node.id) || []),
      ...(node.group ? { groupId: node.group } : {}),
      ...(node.icon ? { icon: node.icon } : {}),
      ...(node.sub ? { sub: node.sub } : {}),
    };
  });

  const edges = validEdges.map((edge): FlowGraphEdge => ({
    from: edge.from,
    to: edge.to,
    ...(edge.label?.trim() ? { label: edge.label.trim() } : {}),
    tone: edgeTone(edge.label),
  }));

  return { nodes, edges };
}

import { describe, expect, it } from 'vitest';
import { buildFlowGraphModel } from '../src/components/flowGraph';
import type { FlowSpec } from '../src/core/types';

describe('buildFlowGraphModel', () => {
  it('preserves grouped node labels, subtitles, colors, and accessible descriptions', () => {
    const spec: FlowSpec = {
      type: 'flow',
      title: 'Grouped URL shortener',
      groups: [
        { id: 'api', label: 'API layer', color: 'purple' },
        { id: 'data', label: 'Data layer', color: 'green' },
      ],
      nodes: [
        { id: 'shorten', label: 'Shorten API', sub: 'POST /shorten', group: 'api' },
        { id: 'db', label: 'Database', sub: 'code → long URL', color: 'teal', group: 'data' },
      ],
      edges: [{ from: 'shorten', to: 'db', label: 'Persist mapping' }],
    };

    const model = buildFlowGraphModel(spec);
    expect(model.nodes).toEqual([
      expect.objectContaining({
        id: 'shorten',
        label: 'API layer · Shorten API\nPOST /shorten',
        accessibleLabel: 'Shorten API. POST /shorten. API layer',
        color: 'purple',
        groupId: 'api',
      }),
      expect.objectContaining({
        id: 'db',
        label: 'Data layer · Database\ncode → long URL',
        color: 'teal',
        groupId: 'data',
      }),
    ]);
    expect(model.edges).toEqual([
      { from: 'shorten', to: 'db', label: 'Persist mapping', tone: 'neutral' },
    ]);
  });

  it('retains question and yes/no decision semantics for graph styling', () => {
    const spec: FlowSpec = {
      type: 'flow',
      nodes: [
        { id: 'check', label: 'URL seen before?' },
        { id: 'cached', label: 'Return cached URL' },
        { id: 'create', label: 'Create mapping' },
      ],
      edges: [
        { from: 'check', to: 'cached', label: 'Yes' },
        { from: 'check', to: 'create', label: 'No' },
      ],
    };

    const model = buildFlowGraphModel(spec);
    expect(model.nodes[0].decision).toBe(true);
    expect(model.edges.map((edge) => edge.tone)).toEqual(['positive', 'negative']);
  });

  it('keeps untrusted labels as plain text and ignores edges to missing nodes', () => {
    const spec: FlowSpec = {
      type: 'flow',
      nodes: [{ id: 'source', label: '<img src=x onerror=alert(1)>' }],
      edges: [{ from: 'source', to: 'missing', label: '<script>bad()</script>' }],
    };

    const model = buildFlowGraphModel(spec);
    expect(model.nodes[0].label).toBe('<img src=x onerror=alert(1)>');
    expect(model.edges).toEqual([]);
  });
});

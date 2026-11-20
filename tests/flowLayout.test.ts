import { describe, it, expect } from 'vitest';
import { layoutFlow } from '../src/components/flowLayout';

describe('layoutFlow', () => {
  it('a linear chain gives ranks [[a],[b],[c]]', () => {
    const nodes = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const edges = [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c' },
    ];
    const res = layoutFlow(nodes, edges);
    expect(res.ranks).toEqual([['a'], ['b'], ['c']]);
    expect(res.rankOf).toEqual({ a: 0, b: 1, c: 2 });
    expect(res.backEdges.size).toBe(0);
  });

  it('diamond branching gives d at rank 2 and b and c in rank 1', () => {
    const nodes = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
    const edges = [
      { from: 'a', to: 'b' },
      { from: 'a', to: 'c' },
      { from: 'b', to: 'd' },
      { from: 'c', to: 'd' },
    ];
    const res = layoutFlow(nodes, edges);
    expect(res.rankOf.d).toBe(2);
    expect(res.rankOf.b).toBe(1);
    expect(res.rankOf.c).toBe(1);
    expect(res.rankOf.a).toBe(0);
    expect(res.ranks[0]).toEqual(['a']);
    expect(res.ranks[1]).toEqual(['b', 'c']);
    expect(res.ranks[2]).toEqual(['d']);
    expect(res.backEdges.size).toBe(0);
  });

  it('a cycle a->b->a is handled (one back edge, no infinite loop)', () => {
    const nodes = [{ id: 'a' }, { id: 'b' }];
    const edges = [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'a' },
    ];
    const res = layoutFlow(nodes, edges);
    expect(res.backEdges.has('b->a')).toBe(true);
    expect(res.rankOf.a).toBe(0);
    expect(res.rankOf.b).toBe(1);
    expect(res.ranks).toEqual([['a'], ['b']]);
  });

  it('output is deterministic for the same input', () => {
    const nodes = [
      { id: 'u' },
      { id: 'api' },
      { id: 'chk' },
      { id: 'gen' },
      { id: 'db' },
      { id: 'cache' },
    ];
    const edges = [
      { from: 'u', to: 'api' },
      { from: 'api', to: 'chk' },
      { from: 'chk', to: 'db' },
      { from: 'chk', to: 'gen' },
      { from: 'gen', to: 'db' },
      { from: 'db', to: 'cache' },
    ];
    const res1 = layoutFlow(nodes, edges);
    const res2 = layoutFlow(nodes, edges);
    expect(res1.ranks).toEqual(res2.ranks);
    expect(res1.rankOf).toEqual(res2.rankOf);
    expect(Array.from(res1.backEdges)).toEqual(Array.from(res2.backEdges));
  });

  it('isolated nodes are at rank 0', () => {
    const nodes = [{ id: 'x' }, { id: 'y' }, { id: 'z' }];
    const edges: { from: string; to: string }[] = [];
    const res = layoutFlow(nodes, edges);
    expect(res.ranks).toEqual([['x', 'y', 'z']]);
    expect(res.rankOf).toEqual({ x: 0, y: 0, z: 0 });
    expect(res.backEdges.size).toBe(0);
  });

  it('empty input returns empty ranks', () => {
    const res = layoutFlow([], []);
    expect(res.ranks).toEqual([]);
    expect(res.rankOf).toEqual({});
    expect(res.backEdges.size).toBe(0);
  });
});

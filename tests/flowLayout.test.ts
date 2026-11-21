import { describe, it, expect } from 'vitest';
import {
  layoutFlow,
  computeEdgeRoute,
  segmentIntersectsBox,
  BoxRect,
  EdgeRoute,
} from '../src/components/flowLayout';

function assertNoIntersectionWithNonEndpoints(
  route: EdgeRoute,
  sourceBox: BoxRect,
  targetBox: BoxRect,
  allBoxes: BoxRect[],
) {
  const obstacles = allBoxes.filter(
    (b) =>
      b !== sourceBox &&
      b !== targetBox &&
      (b.x !== sourceBox.x || b.y !== sourceBox.y) &&
      (b.x !== targetBox.x || b.y !== targetBox.y),
  );

  const points = route.points;
  expect(points).toBeDefined();
  expect(points!.length).toBeGreaterThanOrEqual(2);

  for (let i = 0; i < points!.length - 1; i++) {
    const p1 = points![i];
    const p2 = points![i + 1];
    for (const obs of obstacles) {
      const intersects = segmentIntersectsBox(p1, p2, obs, 0);
      expect(intersects).toBe(false);
    }
  }
}

describe('computeEdgeRoute', () => {
  it('routes back-edge orthogonally through right side gutter around nodes', () => {
    const sourceBox = { x: 50, y: 200, width: 120, height: 40 };
    const targetBox = { x: 50, y: 50, width: 120, height: 40 };
    const allBoxesRight = 200;

    const route = computeEdgeRoute(sourceBox, targetBox, true, false, allBoxesRight);

    expect(route.isOuter).toBe(true);
    expect(route.labelPoint.x).toBeGreaterThanOrEqual(allBoxesRight + 24);
    expect(route.pathD).toContain('M 170 220');
    expect(route.pathD).toContain('L 170 70');
    expect(route.labelPoint.y).toBe((220 + 70) / 2);
  });

  it('routes rank-skipping edge orthogonally through right side gutter', () => {
    const sourceBox = { x: 50, y: 50, width: 120, height: 40 };
    const targetBox = { x: 50, y: 250, width: 120, height: 40 };
    const allBoxesRight = 200;

    const route = computeEdgeRoute(sourceBox, targetBox, false, true, allBoxesRight);

    expect(route.isOuter).toBe(true);
    expect(route.labelPoint.x).toBeGreaterThanOrEqual(allBoxesRight + 24);
    expect(route.pathD).toContain('M 170 70');
    expect(route.pathD).toContain('L 170 270');
  });

  it('routes same-lane adjacent edge as straight orthogonal line', () => {
    const sourceBox = { x: 50, y: 50, width: 120, height: 40 };
    const targetBox = { x: 50, y: 150, width: 120, height: 40 };

    const route = computeEdgeRoute(sourceBox, targetBox, false, false, 200);

    expect(route.isOuter).toBe(false);
    expect(route.pathD).toBe('M 110 90 L 110 150');
    expect(route.labelPoint).toEqual({ x: 110, y: 120 });
  });

  it('linear fixture: assert no routed segment intersects any non-endpoint node rect', () => {
    const nodeA: BoxRect = { x: 100, y: 50, width: 140, height: 50 };
    const nodeB: BoxRect = { x: 100, y: 160, width: 140, height: 50 };
    const nodeC: BoxRect = { x: 100, y: 270, width: 140, height: 50 };
    const allBoxes = [nodeA, nodeB, nodeC];

    const routeAB = computeEdgeRoute(nodeA, nodeB, false, false, 240, 0, 0, allBoxes);
    const routeBC = computeEdgeRoute(nodeB, nodeC, false, false, 240, 0, 0, allBoxes);

    assertNoIntersectionWithNonEndpoints(routeAB, nodeA, nodeB, allBoxes);
    assertNoIntersectionWithNonEndpoints(routeBC, nodeB, nodeC, allBoxes);
  });

  it('branching fixture: assert no routed segment intersects any non-endpoint node rect', () => {
    // Node A branches to Node B (left) and Node C (right)
    const nodeA: BoxRect = { x: 150, y: 50, width: 140, height: 50 };
    const nodeB: BoxRect = { x: 50, y: 170, width: 140, height: 50 };
    const nodeC: BoxRect = { x: 250, y: 170, width: 140, height: 50 };
    const allBoxes = [nodeA, nodeB, nodeC];

    const routeAB = computeEdgeRoute(nodeA, nodeB, false, false, 390, 0, -10, allBoxes);
    const routeAC = computeEdgeRoute(nodeA, nodeC, false, false, 390, 0, 10, allBoxes);

    assertNoIntersectionWithNonEndpoints(routeAB, nodeA, nodeB, allBoxes);
    assertNoIntersectionWithNonEndpoints(routeAC, nodeA, nodeC, allBoxes);
  });

  it('back-edge fixture: assert no routed segment intersects any non-endpoint node rect', () => {
    const nodeA: BoxRect = { x: 100, y: 50, width: 140, height: 50 };
    const nodeB: BoxRect = { x: 100, y: 160, width: 140, height: 50 };
    const allBoxes = [nodeA, nodeB];

    const routeBA = computeEdgeRoute(nodeB, nodeA, true, false, 240, 0, 0, allBoxes);

    assertNoIntersectionWithNonEndpoints(routeBA, nodeB, nodeA, allBoxes);
    expect(routeBA.isOuter).toBe(true);
    expect(routeBA.labelPoint.x).toBeGreaterThan(240);
  });

  it('rank-skip fixture: A connects to C straight across B, edge routes around B without intersecting it', () => {
    // Node A is at top, Node B is directly underneath, Node C is below B
    const nodeA: BoxRect = { x: 100, y: 50, width: 140, height: 50 };
    const nodeB: BoxRect = { x: 100, y: 160, width: 140, height: 50 };
    const nodeC: BoxRect = { x: 100, y: 270, width: 140, height: 50 };
    const allBoxes = [nodeA, nodeB, nodeC];

    const routeAC = computeEdgeRoute(nodeA, nodeC, false, true, 240, 0, 0, allBoxes);

    assertNoIntersectionWithNonEndpoints(routeAC, nodeA, nodeC, allBoxes);
    expect(routeAC.isOuter).toBe(true);
  });

  it('3 groups/lanes fixture: complex cross-lane edges never intersect intermediate node rects', () => {
    // Lane 1: [L1_1, L1_2]
    // Lane 2: [L2_1, L2_2]
    // Lane 3: [L3_1, L3_2]
    const l1_1: BoxRect = { x: 50, y: 50, width: 140, height: 50 };
    const l1_2: BoxRect = { x: 50, y: 180, width: 140, height: 50 };

    const l2_1: BoxRect = { x: 230, y: 50, width: 140, height: 50 };
    const l2_2: BoxRect = { x: 230, y: 180, width: 140, height: 50 };

    const l3_1: BoxRect = { x: 410, y: 50, width: 140, height: 50 };
    const l3_2: BoxRect = { x: 410, y: 180, width: 140, height: 50 };

    const allBoxes = [l1_1, l1_2, l2_1, l2_2, l3_1, l3_2];
    const right = 550;

    // Edge from Lane 1 Node 1 to Lane 3 Node 2 (skips across Lane 2!)
    const routeCross = computeEdgeRoute(l1_1, l3_2, false, false, right, 0, 0, allBoxes);
    assertNoIntersectionWithNonEndpoints(routeCross, l1_1, l3_2, allBoxes);

    // Edge from Lane 2 Node 2 back to Lane 1 Node 1
    const routeBack = computeEdgeRoute(l2_2, l1_1, true, false, right, 1, 0, allBoxes);
    assertNoIntersectionWithNonEndpoints(routeBack, l2_2, l1_1, allBoxes);

    // Edge from Lane 3 Node 1 to Lane 2 Node 2
    const route3to2 = computeEdgeRoute(l3_1, l2_2, false, false, right, 0, 0, allBoxes);
    assertNoIntersectionWithNonEndpoints(route3to2, l3_1, l2_2, allBoxes);
  });
});

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

  it('3-node linear chain with branch: all nodes ranked and edges routed without overlap', () => {
    // A -> B, A -> C (branch from A)
    const nodes = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const edges = [{ from: 'a', to: 'b' }, { from: 'a', to: 'c' }];
    const res = layoutFlow(nodes, edges);
    expect(res.rankOf['a']).toBe(0);
    expect(res.rankOf['b']).toBe(1);
    expect(res.rankOf['c']).toBe(1);
    expect(res.ranks[0]).toEqual(['a']);
    expect(res.ranks[1].length).toBe(2);
    expect(res.backEdges.size).toBe(0);

    // Verify edge routing doesn't go through the other branch node
    const boxA: BoxRect = { x: 100, y: 50, width: 120, height: 40 };
    const boxB: BoxRect = { x: 50, y: 170, width: 120, height: 40 };
    const boxC: BoxRect = { x: 230, y: 170, width: 120, height: 40 };
    const allBoxes = [boxA, boxB, boxC];

    const routeAB = computeEdgeRoute(boxA, boxB, false, false, 350, 0, -10, allBoxes);
    const routeAC = computeEdgeRoute(boxA, boxC, false, false, 350, 0, 10, allBoxes);
    assertNoIntersectionWithNonEndpoints(routeAB, boxA, boxB, allBoxes);
    assertNoIntersectionWithNonEndpoints(routeAC, boxA, boxC, allBoxes);
  });

  it('6-node graph with branches: correct ranks and no back-edges', () => {
    // A -> B -> D, A -> C -> D, D -> E, D -> F (diamond + branch)
    const nodes = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }, { id: 'e' }, { id: 'f' }];
    const edges = [
      { from: 'a', to: 'b' }, { from: 'a', to: 'c' },
      { from: 'b', to: 'd' }, { from: 'c', to: 'd' },
      { from: 'd', to: 'e' }, { from: 'd', to: 'f' },
    ];
    const res = layoutFlow(nodes, edges);
    expect(res.rankOf['a']).toBe(0);
    expect(res.rankOf['b']).toBe(1);
    expect(res.rankOf['c']).toBe(1);
    expect(res.rankOf['d']).toBe(2);
    expect(res.rankOf['e']).toBe(3);
    expect(res.rankOf['f']).toBe(3);
    expect(res.backEdges.size).toBe(0);
    // 4 ranks total
    expect(res.ranks.length).toBe(4);
  });

  it('10-node graph with multiple branches and a back-edge: layout is stable', () => {
    const nodes = Array.from({ length: 10 }, (_, i) => ({ id: String(i + 1) }));
    const edges = [
      { from: '1', to: '2' }, { from: '1', to: '3' },
      { from: '2', to: '4' }, { from: '3', to: '4' },
      { from: '4', to: '5' }, { from: '4', to: '6' },
      { from: '5', to: '7' }, { from: '6', to: '7' },
      { from: '7', to: '8' }, { from: '8', to: '9' },
      { from: '9', to: '10' },
      { from: '10', to: '4' }, // back-edge: creates cycle
    ];
    const res = layoutFlow(nodes, edges);
    // All 10 nodes should be ranked
    expect(Object.keys(res.rankOf)).toHaveLength(10);
    // The back-edge '10->4' should be detected
    expect(res.backEdges.has('10->4')).toBe(true);
    // No other back edges (the graph is otherwise a DAG)
    expect(res.backEdges.size).toBe(1);
    // Node 1 should be at rank 0 (source)
    expect(res.rankOf['1']).toBe(0);
    // Results are deterministic
    const res2 = layoutFlow(nodes, edges);
    expect(res.ranks).toEqual(res2.ranks);
    expect(res.rankOf).toEqual(res2.rankOf);
  });
});

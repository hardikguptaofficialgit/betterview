export interface LayoutResult {
  ranks: string[][];
  rankOf: Record<string, number>;
  backEdges: Set<string>; /* "from->to" */
}

export function layoutFlow(
  nodes: { id: string }[],
  edges: { from: string; to: string }[]
): LayoutResult {
  if (nodes.length === 0) {
    return {
      ranks: [],
      rankOf: {},
      backEdges: new Set<string>(),
    };
  }

  const nodeIds = new Set(nodes.map((n) => n.id));
  const inputOrder = new Map<string, number>();
  nodes.forEach((n, idx) => inputOrder.set(n.id, idx));

  // Build initial adjacency list for cycle breaking
  const adj = new Map<string, string[]>();
  for (const n of nodes) {
    adj.set(n.id, []);
  }
  for (const e of edges) {
    if (adj.has(e.from) && nodeIds.has(e.to)) {
      adj.get(e.from)!.push(e.to);
    }
  }

  // Break cycles: DFS from nodes in input order.
  const visited = new Set<string>();
  const onStack = new Set<string>();
  const backEdges = new Set<string>();

  function dfs(u: string): void {
    visited.add(u);
    onStack.add(u);

    for (const v of adj.get(u) || []) {
      const edgeKey = `${u}->${v}`;
      if (onStack.has(v)) {
        backEdges.add(edgeKey);
      } else if (!visited.has(v)) {
        dfs(v);
      }
    }

    onStack.delete(u);
  }

  for (const n of nodes) {
    if (!visited.has(n.id)) {
      dfs(n.id);
    }
  }

  // Build DAG with non-back edges
  const dagAdj = new Map<string, string[]>();
  const dagRevAdj = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const n of nodes) {
    dagAdj.set(n.id, []);
    dagRevAdj.set(n.id, []);
    inDegree.set(n.id, 0);
  }

  for (const e of edges) {
    const edgeKey = `${e.from}->${e.to}`;
    if (nodeIds.has(e.from) && nodeIds.has(e.to) && !backEdges.has(edgeKey)) {
      dagAdj.get(e.from)!.push(e.to);
      dagRevAdj.get(e.to)!.push(e.from);
      inDegree.set(e.to, (inDegree.get(e.to) || 0) + 1);
    }
  }

  // Ranking: longest path from any source
  const rankOf: Record<string, number> = {};
  const queue: string[] = [];

  for (const n of nodes) {
    if (inDegree.get(n.id) === 0) {
      rankOf[n.id] = 0;
      queue.push(n.id);
    }
  }

  let head = 0;
  while (head < queue.length) {
    const u = queue[head++];
    const uRank = rankOf[u] ?? 0;
    for (const v of dagAdj.get(u) || []) {
      rankOf[v] = Math.max(rankOf[v] ?? 0, uRank + 1);
      const remaining = (inDegree.get(v) || 0) - 1;
      inDegree.set(v, remaining);
      if (remaining === 0) {
        queue.push(v);
      }
    }
  }

  // Fallback for any unreachable nodes
  for (const n of nodes) {
    if (rankOf[n.id] === undefined) {
      rankOf[n.id] = 0;
    }
  }

  // Group nodes by rank
  let maxRank = 0;
  for (const n of nodes) {
    const r = rankOf[n.id];
    if (r > maxRank) {
      maxRank = r;
    }
  }

  const ranks: string[][] = Array.from({ length: maxRank + 1 }, () => []);
  for (const n of nodes) {
    ranks[rankOf[n.id]].push(n.id);
  }

  // Order within a rank
  for (let r = 1; r <= maxRank; r++) {
    const prevRank = ranks[r - 1];
    const prevPos = new Map<string, number>();
    prevRank.forEach((id, idx) => prevPos.set(id, idx));

    const barycenters = new Map<string, number>();
    ranks[r].forEach((id, currentIdx) => {
      const preds = (dagRevAdj.get(id) || []).filter((p) => prevPos.has(p));
      if (preds.length > 0) {
        const sum = preds.reduce((acc, p) => acc + prevPos.get(p)!, 0);
        barycenters.set(id, sum / preds.length);
      } else {
        barycenters.set(id, currentIdx);
      }
    });

    ranks[r].sort((a, b) => {
      const bA = barycenters.get(a)!;
      const bB = barycenters.get(b)!;
      if (Math.abs(bA - bB) > 1e-9) {
        return bA - bB;
      }
      return inputOrder.get(a)! - inputOrder.get(b)!;
    });
  }

  for (let r = maxRank - 1; r >= 0; r--) {
    const nextRank = ranks[r + 1];
    const nextPos = new Map<string, number>();
    nextRank.forEach((id, idx) => nextPos.set(id, idx));

    const barycenters = new Map<string, number>();
    ranks[r].forEach((id, currentIdx) => {
      const succs = (dagAdj.get(id) || []).filter((s) => nextPos.has(s));
      if (succs.length > 0) {
        const sum = succs.reduce((acc, s) => acc + nextPos.get(s)!, 0);
        barycenters.set(id, sum / succs.length);
      } else {
        barycenters.set(id, currentIdx);
      }
    });

    ranks[r].sort((a, b) => {
      const bA = barycenters.get(a)!;
      const bB = barycenters.get(b)!;
      if (Math.abs(bA - bB) > 1e-9) {
        return bA - bB;
      }
      return inputOrder.get(a)! - inputOrder.get(b)!;
    });
  }

  return {
    ranks,
    rankOf,
    backEdges,
  };
}

export interface BoxRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EdgeRoute {
  isOuter: boolean;
  pathD: string;
  labelPoint: { x: number; y: number };
  points?: { x: number; y: number }[];
}

export interface Point {
  x: number;
  y: number;
}

/**
 * Checks if a 2D line segment between p1 and p2 intersects a rectangle box (with optional padding).
 */
export function segmentIntersectsBox(
  p1: Point,
  p2: Point,
  box: BoxRect,
  padding = 0,
): boolean {
  const minX = box.x - padding;
  const maxX = box.x + box.width + padding;
  const minY = box.y - padding;
  const maxY = box.y + box.height + padding;

  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;

  // Horizontal segment
  if (Math.abs(dy) < 1e-6) {
    const y = p1.y;
    if (y < minY || y > maxY) return false;
    const segMinX = Math.min(p1.x, p2.x);
    const segMaxX = Math.max(p1.x, p2.x);
    return Math.max(segMinX, minX) < Math.min(segMaxX, maxX);
  }

  // Vertical segment
  if (Math.abs(dx) < 1e-6) {
    const x = p1.x;
    if (x < minX || x > maxX) return false;
    const segMinY = Math.min(p1.y, p2.y);
    const segMaxY = Math.max(p1.y, p2.y);
    return Math.max(segMinY, minY) < Math.min(segMaxY, maxY);
  }

  // General segment via Liang-Barsky line clipping
  const p = [-dx, dx, -dy, dy];
  const q = [p1.x - minX, maxX - p1.x, p1.y - minY, maxY - p1.y];
  let u1 = 0;
  let u2 = 1;

  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return false;
    } else {
      const t = q[i] / p[i];
      if (p[i] < 0) {
        if (t > u2) return false;
        if (t > u1) u1 = t;
      } else {
        if (t < u1) return false;
        if (t < u2) u2 = t;
      }
    }
  }

  return u1 < u2 && u2 > 1e-6 && u1 < 1 - 1e-6;
}

/**
 * Simplifies a sequence of orthogonal points by eliminating redundant collinear points.
 */
export function simplifyCollinear(points: Point[]): Point[] {
  if (points.length <= 2) return [...points];
  const result: Point[] = [points[0]];

  for (let i = 1; i < points.length - 1; i++) {
    const prev = result[result.length - 1];
    const curr = points[i];
    const next = points[i + 1];

    const isCollinearX = Math.abs(prev.x - curr.x) < 1e-4 && Math.abs(curr.x - next.x) < 1e-4;
    const isCollinearY = Math.abs(prev.y - curr.y) < 1e-4 && Math.abs(curr.y - next.y) < 1e-4;

    if (!isCollinearX && !isCollinearY) {
      result.push(curr);
    }
  }

  result.push(points[points.length - 1]);
  return result;
}

/**
 * Constructs an SVG path from a list of orthogonal points, rounding corners with radius r.
 */
export function renderRoundedPath(points: Point[], radius = 8): string {
  if (points.length <= 1) return '';
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const pPrev = points[i - 1];
    const pCurr = points[i];
    const pNext = points[i + 1];

    const d1x = pCurr.x - pPrev.x;
    const d1y = pCurr.y - pPrev.y;
    const len1 = Math.hypot(d1x, d1y);

    const d2x = pNext.x - pCurr.x;
    const d2y = pNext.y - pCurr.y;
    const len2 = Math.hypot(d2x, d2y);

    if (len1 < 1e-4 || len2 < 1e-4) {
      continue;
    }

    const cr = Math.min(radius, len1 / 2, len2 / 2);
    const startX = pCurr.x - (d1x / len1) * cr;
    const startY = pCurr.y - (d1y / len1) * cr;
    const endX = pCurr.x + (d2x / len2) * cr;
    const endY = pCurr.y + (d2y / len2) * cr;

    d += ` L ${startX} ${startY} Q ${pCurr.x} ${pCurr.y} ${endX} ${endY}`;
  }

  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

/**
 * Locates the midpoint of the longest segment in a polyline.
 */
export function findLongestSegmentMidpoint(points: Point[]): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return { ...points[0] };

  let maxLen = -1;
  let bestIdx = 0;

  for (let i = 0; i < points.length - 1; i++) {
    const len = Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
    if (len > maxLen) {
      maxLen = len;
      bestIdx = i;
    }
  }

  const p1 = points[bestIdx];
  const p2 = points[bestIdx + 1];
  return {
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2,
  };
}

function orthogonalIntersections(a: Point, b: Point, c: Point, d: Point): Point[] {
  const aHorizontal = Math.abs(a.y - b.y) < 1e-6;
  const bHorizontal = Math.abs(c.y - d.y) < 1e-6;

  if (aHorizontal && bHorizontal) {
    if (Math.abs(a.y - c.y) >= 1e-6) return [];
    const left = Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x));
    const right = Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x));
    return left <= right + 1e-6 ? [{ x: (left + right) / 2, y: a.y }] : [];
  }

  if (!aHorizontal && !bHorizontal) {
    if (Math.abs(a.x - c.x) >= 1e-6) return [];
    const top = Math.max(Math.min(a.y, b.y), Math.min(c.y, d.y));
    const bottom = Math.min(Math.max(a.y, b.y), Math.max(c.y, d.y));
    return top <= bottom + 1e-6 ? [{ x: a.x, y: (top + bottom) / 2 }] : [];
  }

  const horizontalStart = aHorizontal ? a : c;
  const horizontalEnd = aHorizontal ? b : d;
  const verticalStart = aHorizontal ? c : a;
  const verticalEnd = aHorizontal ? d : b;
  const x = verticalStart.x;
  const y = horizontalStart.y;
  const onHorizontal = x >= Math.min(horizontalStart.x, horizontalEnd.x) - 1e-6 &&
    x <= Math.max(horizontalStart.x, horizontalEnd.x) + 1e-6;
  const onVertical = y >= Math.min(verticalStart.y, verticalEnd.y) - 1e-6 &&
    y <= Math.max(verticalStart.y, verticalEnd.y) + 1e-6;
  return onHorizontal && onVertical ? [{ x, y }] : [];
}

function segmentCrossingPenalty(
  a: Point,
  b: Point,
  routedEdges: Point[][],
  start: Point,
  goal: Point,
): number {
  let penalty = 0;
  for (const route of routedEdges) {
    for (let i = 0; i < route.length - 1; i++) {
      for (const point of orthogonalIntersections(a, b, route[i], route[i + 1])) {
        const near = (p1: Point, p2: Point) => Math.hypot(p1.x - p2.x, p1.y - p2.y) < 20;
        if (
          near(point, start) || near(point, goal) ||
          near(point, route[0]) || near(point, route[route.length - 1])
        ) continue;
        penalty += 700;
      }
    }
  }
  return penalty;
}

function pathHasInteriorConflict(points: Point[], routedEdges: Point[][]): boolean {
  for (let i = 0; i < points.length - 1; i++) {
    if (segmentCrossingPenalty(points[i], points[i + 1], routedEdges, points[0], points[points.length - 1]) > 0) {
      return true;
    }
  }
  return false;
}

/**
 * A* Orthogonal grid router with obstacle avoidance, bend penalty and edge separation.
 */
function routeAStar(
  start: Point,
  goal: Point,
  obstacles: BoxRect[],
  allBoxes: BoxRect[],
  gutterX: number,
  padding = 16,
  routedEdges: Point[][] = [],
): Point[] {
  // Build coarse grid coordinates
  const xSet = new Set<number>([start.x, goal.x, gutterX]);
  const ySet = new Set<number>([start.y, goal.y]);

  for (const b of allBoxes) {
    xSet.add(b.x - padding);
    xSet.add(b.x + b.width + padding);
    xSet.add(b.x + b.width / 2);

    ySet.add(b.y - padding);
    ySet.add(b.y + b.height + padding);
    ySet.add(b.y + b.height / 2);
  }

  for (const route of routedEdges) {
    for (const point of route) {
      xSet.add(point.x);
      ySet.add(point.y);
    }
    for (let i = 0; i < route.length - 1; i++) {
      const a = route[i];
      const b = route[i + 1];
      if (Math.abs(a.y - b.y) < 1e-6) {
        ySet.add(a.y - 12);
        ySet.add(a.y + 12);
      } else {
        xSet.add(a.x - 12);
        xSet.add(a.x + 12);
      }
    }
  }

  // Add intermediate channels between sorted boxes
  const sortedBoxesByY = [...allBoxes].sort((a, b) => a.y - b.y);
  for (let i = 0; i < sortedBoxesByY.length - 1; i++) {
    const b1 = sortedBoxesByY[i];
    const b2 = sortedBoxesByY[i + 1];
    if (b2.y > b1.y + b1.height) {
      ySet.add((b1.y + b1.height + b2.y) / 2);
    }
  }

  const sortedBoxesByX = [...allBoxes].sort((a, b) => a.x - b.x);
  for (let i = 0; i < sortedBoxesByX.length - 1; i++) {
    const b1 = sortedBoxesByX[i];
    const b2 = sortedBoxesByX[i + 1];
    if (b2.x > b1.x + b1.width) {
      xSet.add((b1.x + b1.width + b2.x) / 2);
    }
  }

  const xCoords = Array.from(xSet).sort((a, b) => a - b);
  const yCoords = Array.from(ySet).sort((a, b) => a - b);

  const numX = xCoords.length;
  const numY = yCoords.length;

  const startXi = xCoords.indexOf(start.x);
  const startYi = yCoords.indexOf(start.y);
  const goalXi = xCoords.indexOf(goal.x);
  const goalYi = yCoords.indexOf(goal.y);

  if (startXi === -1 || startYi === -1 || goalXi === -1 || goalYi === -1) {
    return [start, goal];
  }

  // Direction: 0 = none, 1 = horizontal, 2 = vertical
  const BEND_PENALTY = 50;

  // Segment collision check against non-endpoint obstacles
  function isSegmentBlocked(pA: Point, pB: Point, isNearEnd: boolean): boolean {
    const pad = isNearEnd ? 0 : Math.max(4, padding - 4);
    for (const obs of obstacles) {
      if (segmentIntersectsBox(pA, pB, obs, pad)) {
        return true;
      }
    }
    return false;
  }

  // Key: `${xi},${yi},${dir}`
  const dist = new Map<string, number>();
  const parent = new Map<string, string>();
  const startKey = `${startXi},${startYi},0`;
  dist.set(startKey, 0);

  // Priority queue: elements are [fScore, key]
  interface QItem {
    f: number;
    g: number;
    xi: number;
    yi: number;
    dir: number;
    key: string;
  }
  const open: QItem[] = [
    {
      f: Math.abs(goal.x - start.x) + Math.abs(goal.y - start.y),
      g: 0,
      xi: startXi,
      yi: startYi,
      dir: 0,
      key: startKey,
    },
  ];

  let foundEndKey: string | null = null;

  while (open.length > 0) {
    // Pop minimum f
    let bestIdx = 0;
    for (let i = 1; i < open.length; i++) {
      if (open[i].f < open[bestIdx].f) {
        bestIdx = i;
      }
    }
    const current = open.splice(bestIdx, 1)[0];

    if (current.xi === goalXi && current.yi === goalYi) {
      foundEndKey = current.key;
      break;
    }

    const currentG = dist.get(current.key) ?? Infinity;
    if (current.g > currentG) continue;

    const curPt: Point = { x: xCoords[current.xi], y: yCoords[current.yi] };

    // Explore 4 orthogonal neighbors
    const neighbors = [
      { nXi: current.xi + 1, nYi: current.yi, nDir: 1 },
      { nXi: current.xi - 1, nYi: current.yi, nDir: 1 },
      { nXi: current.xi, nYi: current.yi + 1, nDir: 2 },
      { nXi: current.xi, nYi: current.yi - 1, nDir: 2 },
    ];

    for (const n of neighbors) {
      if (n.nXi < 0 || n.nXi >= numX || n.nYi < 0 || n.nYi >= numY) continue;

      const nPt: Point = { x: xCoords[n.nXi], y: yCoords[n.nYi] };
      const isEndpointNeighbor =
        (current.xi === startXi && current.yi === startYi) ||
        (n.nXi === goalXi && n.nYi === goalYi);

      if (isSegmentBlocked(curPt, nPt, isEndpointNeighbor)) {
        continue;
      }

      const stepLen = Math.abs(nPt.x - curPt.x) + Math.abs(nPt.y - curPt.y);
      const bendCost = current.dir !== 0 && current.dir !== n.nDir ? BEND_PENALTY : 0;
      const crossingCost = segmentCrossingPenalty(curPt, nPt, routedEdges, start, goal);
      const tentG = current.g + stepLen + bendCost + crossingCost;

      const nKey = `${n.nXi},${n.nYi},${n.nDir}`;
      const prevG = dist.get(nKey) ?? Infinity;

      if (tentG < prevG) {
        dist.set(nKey, tentG);
        parent.set(nKey, current.key);
        const h = Math.abs(goal.x - nPt.x) + Math.abs(goal.y - nPt.y);
        open.push({
          f: tentG + h,
          g: tentG,
          xi: n.nXi,
          yi: n.nYi,
          dir: n.nDir,
          key: nKey,
        });
      }
    }
  }

  if (!foundEndKey) {
    // If the visibility grid is over-constrained, try clear channels outside
    // the obstacle bounds. Never fall back to a direct line through a node.
    const minY = Math.min(...allBoxes.map((box) => box.y), start.y, goal.y) - padding - 24;
    const maxY = Math.max(...allBoxes.map((box) => box.y + box.height), start.y, goal.y) + padding + 24;
    const maxX = Math.max(...allBoxes.map((box) => box.x + box.width), start.x, goal.x) + padding + 24;
    const candidates: Point[][] = [
      [start, { x: start.x, y: minY }, { x: goal.x, y: minY }, goal],
      [start, { x: start.x, y: maxY }, { x: goal.x, y: maxY }, goal],
      [start, { x: maxX, y: start.y }, { x: maxX, y: goal.y }, goal],
    ];
    const clearRoutes = candidates.filter((points) => points.slice(1).every((point, index) =>
      !obstacles.some((box) => segmentIntersectsBox(points[index], point, box, 2)),
    ));
    if (clearRoutes.length > 0) {
      return simplifyCollinear(clearRoutes.sort((a, b) => {
        const cost = (route: Point[]) => route.slice(1).reduce((sum, point, index) =>
          sum + Math.abs(point.x - route[index].x) + Math.abs(point.y - route[index].y) +
            segmentCrossingPenalty(route[index], point, routedEdges, start, goal), 0);
        return cost(a) - cost(b);
      })[0]);
    }

    // This is only reachable for fully enclosed/overlapping input geometry.
    return [start, goal];
  }

  // Reconstruct path
  const path: Point[] = [];
  let currKey: string | undefined = foundEndKey;
  while (currKey) {
    const parts = currKey.split(',').map(Number);
    path.push({ x: xCoords[parts[0]], y: yCoords[parts[1]] });
    currKey = parent.get(currKey);
  }

  path.reverse();
  return simplifyCollinear(path);
}

export function computeEdgeRoute(
  sourceBox: BoxRect,
  targetBox: BoxRect,
  isBackEdge: boolean,
  isRankSkip: boolean,
  allBoxesRight: number,
  outerIndex = 0,
  fanOffset = 0,
  allBoxes: BoxRect[] = [],
  targetFanOffset = 0,
  routedEdges: Point[][] = [],
): EdgeRoute {
  // Ensure obstacle set does not include source or target node
  const obstacleBoxes = allBoxes.filter(
    (b) =>
      b !== sourceBox &&
      b !== targetBox &&
      (b.x !== sourceBox.x || b.y !== sourceBox.y || b.width !== sourceBox.width || b.height !== sourceBox.height) &&
      (b.x !== targetBox.x || b.y !== targetBox.y || b.width !== targetBox.width || b.height !== targetBox.height),
  );

  const gutterX =
    Math.max(allBoxesRight, sourceBox.x + sourceBox.width, targetBox.x + targetBox.width) +
    24 +
    outerIndex * 18;

  // 1. Back-edges and rank-skipping edges go through the outer gutter
  if (isBackEdge || isRankSkip) {
    const sx = sourceBox.x + sourceBox.width;
    const sy = sourceBox.y + sourceBox.height / 2;
    const tx = targetBox.x + targetBox.width;
    const ty = targetBox.y + targetBox.height / 2;

    const p0: Point = { x: sx, y: sy };
    const p1: Point = { x: gutterX, y: sy };
    const p2: Point = { x: gutterX, y: ty };
    const p3: Point = { x: tx, y: ty };

    // Verify whether direct gutter waypoints intersect any non-endpoint obstacles
    const p0p1Blocked = obstacleBoxes.some((obs) => segmentIntersectsBox(p0, p1, obs, 0));
    const p2p3Blocked = obstacleBoxes.some((obs) => segmentIntersectsBox(p2, p3, obs, 0));

    let points: Point[];
    if (!p0p1Blocked && !p2p3Blocked) {
      points = simplifyCollinear([p0, p1, p2, p3]);
      if (pathHasInteriorConflict(points, routedEdges)) {
        points = routeAStar(p0, p3, obstacleBoxes, [sourceBox, targetBox, ...obstacleBoxes], gutterX, 16, routedEdges);
      }
    } else {
      points = routeAStar(p0, p3, obstacleBoxes, [sourceBox, targetBox, ...obstacleBoxes], gutterX, 16, routedEdges);
    }

    const pathD = renderRoundedPath(points, 8);
    // Outer gutter label sits on the vertical segment in the gutter
    const labelPoint: Point = {
      x: gutterX,
      y: (sy + ty) / 2,
    };

    return { isOuter: true, pathD, labelPoint, points };
  }

  // 2. Same-lane adjacent edges stay straight
  const sx = sourceBox.x + sourceBox.width / 2 + fanOffset;
  const sy = sourceBox.y + sourceBox.height;
  const tx = targetBox.x + targetBox.width / 2 + targetFanOffset;
  const ty = targetBox.y;

  const isSameLane = Math.abs(sx - tx) < 5 && ty >= sy;
  if (isSameLane) {
    const straightBlocked = obstacleBoxes.some((obs) =>
      segmentIntersectsBox({ x: sx, y: sy }, { x: tx, y: ty }, obs, 0),
    );

    if (!straightBlocked) {
      const points = [{ x: sx, y: sy }, { x: tx, y: ty }];
      if (!pathHasInteriorConflict(points, routedEdges)) {
        const pathD = `M ${sx} ${sy} L ${tx} ${ty}`;
        const labelPoint = { x: sx, y: (sy + ty) / 2 };
        return { isOuter: false, pathD, labelPoint, points };
      }
    }
  }

  // 3. Other forward edges (branching, lateral, rank offset):
  // Route on coarse grid built from node bounds plus 16px padding using A* with bend penalty
  const startPt: Point = { x: sx, y: sy };
  const goalPt: Point = { x: tx, y: ty };

  const allBoxesList = [sourceBox, targetBox, ...obstacleBoxes];
  const routedPoints = routeAStar(startPt, goalPt, obstacleBoxes, allBoxesList, gutterX, 16, routedEdges);
  const pathD = renderRoundedPath(routedPoints, 8);
  const labelPoint = findLongestSegmentMidpoint(routedPoints);

  return { isOuter: false, pathD, labelPoint, points: routedPoints };
}

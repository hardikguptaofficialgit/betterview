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
  // An edge to a node already on the DFS stack is a back edge.
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

  // Ranking: longest path from any source (node with no incoming non-back edges).
  // Isolated nodes get rank 0.
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

  // Fallback for any unreachable nodes (e.g. isolated or odd components)
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

  // Order within a rank:
  // First by the barycenter (average order index of predecessors in the previous rank),
  // ties by input order. Do 2 sweeps (down, then up using successors).

  // Sweep 1: Down sweep (from rank 1 up to maxRank)
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

  // Sweep 2: Up sweep (from rank maxRank - 1 down to 0)
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

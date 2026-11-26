import { TreeSpec, TreeNode, Color } from '../core/types';
import { RenderContext } from './index';
import { h } from '../core/dom';

type Layout = 'horizontal' | 'vertical' | 'outline';
let treeInstanceSequence = 0;

// ---- Color token helpers ----
const COLOR_ACCENT_MAP: Record<Color, string> = {
  blue: 'var(--iui-color-blue, #3b82f6)',
  green: 'var(--iui-color-green, #22c55e)',
  amber: 'var(--iui-color-amber, #f59e0b)',
  orange: 'var(--iui-color-orange, #f97316)',
  red: 'var(--iui-color-red, #ef4444)',
  purple: 'var(--iui-color-purple, #a855f7)',
  teal: 'var(--iui-color-teal, #14b8a6)',
  pink: 'var(--iui-color-pink, #ec4899)',
  gray: 'var(--iui-color-gray, #71717a)',
  sky: 'var(--iui-color-sky, #0ea5e9)',
  mint: 'var(--iui-color-mint, #6ee7b7)',
  butter: 'var(--iui-color-butter, #fde68a)',
  peach: 'var(--iui-color-peach, #fdba74)',
  rose: 'var(--iui-color-rose, #fb7185)',
  lavender: 'var(--iui-color-lavender, #c4b5fd)',
  stone: 'var(--iui-color-stone, #a8a29e)',
};

function colorFor(color?: Color): string | undefined {
  return color ? COLOR_ACCENT_MAP[color] : undefined;
}

// ---- State tracking ----
interface NodeState {
  el: HTMLElement;
  collapsed: boolean;
  node: TreeNode;
}

// Count total descendants of a node
function countDescendants(node: TreeNode): number {
  if (!node.children || node.children.length === 0) return 0;
  let count = node.children.length;
  for (const c of node.children) {
    count += countDescendants(c);
  }
  return count;
}

// Collect ancestor IDs for a given node id
function buildAncestorMap(root: TreeNode, target: string, ancestors: Set<string> = new Set()): boolean {
  if (root.id === target) {
    ancestors.add(root.id);
    return true;
  }
  if (!root.children) return false;
  for (const child of root.children) {
    if (buildAncestorMap(child, target, ancestors)) {
      ancestors.add(root.id);
      return true;
    }
  }
  return false;
}

// Find node matching a search query (label text, case-insensitive)
function collectMatchingIds(node: TreeNode, query: string, result: Set<string>): boolean {
  const match = node.label.toLowerCase().includes(query) ||
    (node.note ?? '').toLowerCase().includes(query) ||
    (node.badge ?? '').toLowerCase().includes(query);
  let childMatch = false;
  if (node.children) {
    for (const c of node.children) {
      if (collectMatchingIds(c, query, result)) {
        childMatch = true;
      }
    }
  }
  if (match || childMatch) result.add(node.id);
  return match || childMatch;
}

// ===== Outline Renderer =====

function renderOutline(
  root: TreeNode,
  _spec: TreeSpec,
  nodeStates: Map<string, NodeState>,
  onSelectNode: (id: string | null) => void,
  selectedId: { v: string | null },
  searchQuery: { v: string },
): HTMLElement {
  const list = h('ul', { class: 'iui-tree-outline-root', role: 'tree', 'aria-label': 'Tree outline' });

  function buildItem(node: TreeNode, depth: number): HTMLLIElement {
    const isLeaf = !node.children || node.children.length === 0;
    const hasChildren = !isLeaf;
    const initialCollapsed = node.collapsed ?? false;

    const li = h('li', {
      class: 'iui-tree-ol-item',
      role: 'treeitem',
      'aria-expanded': hasChildren ? String(!initialCollapsed) : undefined,
      'aria-level': String(depth),
      tabindex: '0',
      'data-node-id': node.id,
    }) as HTMLLIElement;

    const row = h('div', { class: 'iui-tree-ol-row' });

    // Chevron button
    if (hasChildren) {
      const chevron = h('button', {
        class: 'iui-tree-ol-chevron',
        type: 'button',
        'aria-label': 'Toggle children',
        tabindex: '-1',
      }, '▶');
      row.appendChild(chevron);

      chevron.addEventListener('click', (e) => {
        e.stopPropagation();
        const state = nodeStates.get(node.id);
        if (!state) return;
        state.collapsed = !state.collapsed;
        const childList = li.querySelector(':scope > .iui-tree-ol-children') as HTMLElement | null;
        if (childList) {
          childList.style.display = state.collapsed ? 'none' : '';
        }
        chevron.textContent = state.collapsed ? '▶' : '▼';
        const badge = li.querySelector('.iui-tree-ol-count-badge') as HTMLElement | null;
        if (badge) {
          badge.style.display = state.collapsed ? '' : 'none';
          badge.textContent = `+${countDescendants(node)}`;
        }
        li.setAttribute('aria-expanded', String(!state.collapsed));
      });
    } else {
      row.appendChild(h('span', { class: 'iui-tree-ol-leaf-dot' }));
    }

    // Node label
    const accent = colorFor(node.color);
    const label = h('span', {
      class: 'iui-tree-ol-label',
      ...(accent ? { style: `color: ${accent}` } : {}),
    }, node.label);
    row.appendChild(label);

    // Badge
    if (node.badge) {
      row.appendChild(h('span', { class: 'iui-tree-ol-badge' }, node.badge));
    }

    // Collapsed count badge (hidden when expanded)
    if (hasChildren) {
      const countBadge = h('span', {
        class: 'iui-tree-ol-count-badge',
        style: 'display: none',
      }, `+${countDescendants(node)}`);
      row.appendChild(countBadge);
    }

    li.appendChild(row);

    // Track state
    nodeStates.set(node.id, { el: li, collapsed: initialCollapsed, node });

    // Click to select (focus + highlight ancestor path)
    li.addEventListener('click', (e) => {
      e.stopPropagation();
      onSelectNode(selectedId.v === node.id ? null : node.id);
    });
    li.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        onSelectNode(selectedId.v === node.id ? null : node.id);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        e.stopPropagation();
        const state = nodeStates.get(node.id);
        if (hasChildren && state?.collapsed) {
          (row.querySelector('.iui-tree-ol-chevron') as HTMLButtonElement | null)?.click();
        } else if (hasChildren) {
          const firstChild = li.querySelector(':scope > .iui-tree-ol-children > .iui-tree-ol-item') as HTMLElement | null;
          firstChild?.focus();
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        e.stopPropagation();
        const state = nodeStates.get(node.id);
        if (hasChildren && state && !state.collapsed) {
          (row.querySelector('.iui-tree-ol-chevron') as HTMLButtonElement | null)?.click();
        } else {
          const parentLi = li.parentElement?.closest('.iui-tree-ol-item') as HTMLElement | null;
          parentLi?.focus();
        }
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        const allItems = Array.from(list.querySelectorAll<HTMLElement>('.iui-tree-ol-item')).filter((el) => {
          let parent = el.parentElement;
          while (parent && parent !== list) {
            if (parent.classList.contains('iui-tree-ol-children') && (parent as HTMLElement).style.display === 'none') {
              return false;
            }
            parent = parent.parentElement;
          }
          return true;
        });
        const idx = allItems.indexOf(li);
        if (idx !== -1) {
          const nextIdx = e.key === 'ArrowDown' ? Math.min(idx + 1, allItems.length - 1) : Math.max(idx - 1, 0);
          allItems[nextIdx]?.focus();
        }
      }
    });

    // Children
    if (hasChildren) {
      const childList = h('ul', {
        class: 'iui-tree-ol-children',
        role: 'group',
        style: initialCollapsed ? 'display: none' : '',
      });
      for (const child of node.children!) {
        childList.appendChild(buildItem(child, depth + 1));
      }
      li.appendChild(childList);

      if (initialCollapsed) {
        const chevronEl = li.querySelector('.iui-tree-ol-chevron');
        if (chevronEl) chevronEl.textContent = '▶';
        const countBadge = li.querySelector('.iui-tree-ol-count-badge') as HTMLElement | null;
        if (countBadge) countBadge.style.display = '';
      }
    }

    return li;
  }

  list.appendChild(buildItem(root, 1));
  return list;
}

// ===== Diagram Tree: CSS connector tree =====
// We render a pure-CSS tree with connecting lines using SVG overlays.

interface LayoutNode {
  node: TreeNode;
  el: HTMLElement;
  children: LayoutNode[];
  depth: number;
}

function renderDiagramTree(
  root: TreeNode,
  layout: Layout,
  nodeStates: Map<string, NodeState>,
  onSelectNode: (id: string | null) => void,
  selectedId: { v: string | null },
): HTMLElement {
  const isHorizontal = layout === 'horizontal';
  const treeInstanceId = ++treeInstanceSequence;
  let nextGroupId = 0;
  let nextNodeIndex = 0;
  const container = h('div', {
    class: `iui-tree-diagram ${isHorizontal ? 'iui-tree-h' : 'iui-tree-v'}`,
    role: 'tree',
    'aria-label': 'Tree diagram',
  });

  function buildDiagramNode(node: TreeNode, depth: number): HTMLElement {
    const initialCollapsed = node.collapsed ?? false;
    const hasChildren = !!(node.children && node.children.length > 0);
    const wrapper = h('div', {
      class: `iui-tree-dn-wrapper${initialCollapsed ? ' is-collapsed' : ''}`,
      'data-node-id': node.id,
    });
    const childGroupId = hasChildren ? `iui-tree-${treeInstanceId}-group-${++nextGroupId}` : undefined;
    const nodeDiv = h('div', {
      class: 'iui-tree-dn-node',
      tabindex: nextNodeIndex++ === 0 ? '0' : '-1',
      role: 'treeitem',
      'aria-label': node.label + (node.note ? `: ${node.note}` : ''),
      'aria-level': String(depth),
      ...(childGroupId ? { 'aria-owns': childGroupId } : {}),
      'data-node-id': node.id,
    });

    const accent = colorFor(node.color);
    if (accent) {
      nodeDiv.style.borderColor = accent;
    }

    // Label + badge row
    const labelRow = h('div', { class: 'iui-tree-dn-label-row' });
    if (hasChildren) {
      const chevBtn = h('button', {
        class: 'iui-tree-dn-chevron',
        type: 'button',
        'aria-label': 'Toggle children',
        tabindex: '-1',
      }, '▼');
      labelRow.appendChild(chevBtn);

      chevBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const state = nodeStates.get(node.id);
        if (!state) return;
        state.collapsed = !state.collapsed;
        wrapper.classList.toggle('is-collapsed', state.collapsed);
        const childrenEl = wrapper.querySelector(':scope > .iui-tree-dn-children') as HTMLElement | null;
        if (childrenEl) {
          childrenEl.style.display = state.collapsed ? 'none' : '';
        }
        chevBtn.textContent = state.collapsed ? '▶' : '▼';
        const badge = nodeDiv.querySelector('.iui-tree-dn-count') as HTMLElement | null;
        if (badge) {
          badge.style.display = state.collapsed ? '' : 'none';
          badge.textContent = `+${countDescendants(node)}`;
        }
        nodeDiv.setAttribute('aria-expanded', String(!state.collapsed));
      });
    }

    const labelEl = h('span', {
      class: 'iui-tree-dn-label',
      ...(accent ? { style: `color: ${accent}` } : {}),
    }, node.label);
    labelRow.appendChild(labelEl);

    if (node.badge) {
      labelRow.appendChild(h('span', { class: 'iui-tree-dn-badge' }, node.badge));
    }
    if (hasChildren) {
      const countBadge = h('span', {
        class: 'iui-tree-dn-count',
        style: 'display: none',
      }, `+${countDescendants(node)}`);
      labelRow.appendChild(countBadge);
    }

    nodeDiv.appendChild(labelRow);

    if (node.note && depth === 1) {
      nodeDiv.appendChild(h('div', { class: 'iui-tree-dn-note' }, node.note));
    }

    // Click to select
    nodeDiv.addEventListener('click', () => {
      onSelectNode(selectedId.v === node.id ? null : node.id);
    });
    nodeDiv.addEventListener('focus', () => {
      container.querySelectorAll<HTMLElement>('.iui-tree-dn-node').forEach((item) => {
        item.tabIndex = item === nodeDiv ? 0 : -1;
      });
    });
    nodeDiv.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSelectNode(selectedId.v === node.id ? null : node.id);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        const state = nodeStates.get(node.id);
        if (hasChildren && state?.collapsed) {
          (nodeDiv.querySelector('.iui-tree-dn-chevron') as HTMLButtonElement | null)?.click();
        } else if (hasChildren) {
          const firstChild = wrapper.querySelector(':scope > .iui-tree-dn-children > .iui-tree-dn-wrapper > .iui-tree-dn-node') as HTMLElement | null;
          firstChild?.focus();
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const state = nodeStates.get(node.id);
        if (hasChildren && state && !state.collapsed) {
          (nodeDiv.querySelector('.iui-tree-dn-chevron') as HTMLButtonElement | null)?.click();
        } else {
          const parentWrapper = wrapper.parentElement?.closest('.iui-tree-dn-wrapper') as HTMLElement | null;
          (parentWrapper?.querySelector(':scope > .iui-tree-dn-node') as HTMLElement | null)?.focus();
        }
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Home' || e.key === 'End') {
        e.preventDefault();
        const visibleNodes = Array.from(container.querySelectorAll<HTMLElement>('.iui-tree-dn-node')).filter((item) => {
          let parent = item.parentElement;
          while (parent && parent !== container) {
            if (parent.classList.contains('iui-tree-dn-children') && (parent as HTMLElement).style.display === 'none') return false;
            parent = parent.parentElement;
          }
          return true;
        });
        const index = visibleNodes.indexOf(nodeDiv);
        const nextIndex = e.key === 'Home' ? 0
          : e.key === 'End' ? visibleNodes.length - 1
          : e.key === 'ArrowDown' ? Math.min(index + 1, visibleNodes.length - 1)
          : Math.max(index - 1, 0);
        visibleNodes[nextIndex]?.focus();
      }
    });

    wrapper.appendChild(nodeDiv);

    if (hasChildren) nodeDiv.setAttribute('aria-expanded', String(!initialCollapsed));
    nodeStates.set(node.id, { el: nodeDiv, collapsed: initialCollapsed, node });

    if (hasChildren) {
      const childrenEl = h('div', {
        class: 'iui-tree-dn-children',
        id: childGroupId,
        role: 'group',
        style: initialCollapsed ? 'display: none' : '',
      });
      for (const child of node.children!) {
        childrenEl.appendChild(buildDiagramNode(child, depth + 1));
      }
      wrapper.appendChild(childrenEl);

      if (initialCollapsed) {
        const chevronEl = nodeDiv.querySelector('.iui-tree-dn-chevron');
        if (chevronEl) chevronEl.textContent = '▶';
        const countBadge = nodeDiv.querySelector('.iui-tree-dn-count') as HTMLElement | null;
        if (countBadge) countBadge.style.display = '';
      }
    }

    return wrapper;
  }

  container.appendChild(buildDiagramNode(root, 1));
  return container;
}

// ===== Main render function =====

export function renderTree(spec: TreeSpec, _ctx: RenderContext): HTMLElement {
  const card = h('div', { class: 'iui-card iui-tree-card' });

  // Header: title + controls
  const header = h('div', { class: 'iui-tree-header' });

  if (spec.title) {
    header.appendChild(h('div', { class: 'iui-title iui-tree-title' }, spec.title));
  }

  const controls = h('div', { class: 'iui-tree-controls' });

  // Search input
  const searchInput = h('input', {
    class: 'iui-tree-search',
    type: 'search',
    placeholder: 'Filter nodes…',
    'aria-label': 'Filter tree nodes',
  }) as HTMLInputElement;
  controls.appendChild(searchInput);

  // Expand/Collapse all buttons
  const expandAllBtn = h('button', {
    class: 'iui-tree-ctrl-btn',
    type: 'button',
    title: 'Expand all',
  }, 'Expand all') as HTMLButtonElement;
  const collapseAllBtn = h('button', {
    class: 'iui-tree-ctrl-btn',
    type: 'button',
    title: 'Collapse all',
  }, 'Collapse all') as HTMLButtonElement;
  controls.appendChild(expandAllBtn);
  controls.appendChild(collapseAllBtn);

  // View toggle: Diagram vs Outline
  const toggleGroup = h('div', { class: 'iui-tree-toggle', role: 'group', 'aria-label': 'View mode' });
  const diagramBtn = h('button', {
    class: 'iui-tree-toggle-btn is-active',
    type: 'button',
    'aria-pressed': 'true',
  }, 'Diagram') as HTMLButtonElement;
  const outlineBtn = h('button', {
    class: 'iui-tree-toggle-btn',
    type: 'button',
    'aria-pressed': 'false',
  }, 'Outline') as HTMLButtonElement;
  toggleGroup.appendChild(diagramBtn);
  toggleGroup.appendChild(outlineBtn);
  controls.appendChild(toggleGroup);

  header.appendChild(controls);
  card.appendChild(header);

  // Detail bar (shown on node selection)
  const detailBar = h('div', { class: 'iui-tree-detail-bar', style: 'display:none' });
  const detailClose = h('button', {
    class: 'iui-tree-detail-close',
    type: 'button',
    'aria-label': 'Close detail',
  }, '×');
  const detailContent = h('div', { class: 'iui-tree-detail-content' });
  detailBar.appendChild(detailContent);
  detailBar.appendChild(detailClose);

  // State
  const nodeStates = new Map<string, NodeState>();
  const selectedId = { v: null as string | null };
  const searchQuery = { v: '' };
  let currentLayout: Layout = spec.layout === 'outline' ? 'outline' : (spec.layout ?? 'vertical');
  let viewMode: 'diagram' | 'outline' = spec.layout === 'outline' ? 'outline' : 'diagram';

  // --- Content area ---
  const contentArea = h('div', { class: 'iui-tree-content' });
  card.appendChild(detailBar);
  card.appendChild(contentArea);

  function highlightAncestors(nodeId: string | null) {
    // Clear all highlights
    contentArea.querySelectorAll<HTMLElement>('.iui-tree-dn-node, .iui-tree-ol-row').forEach(el => {
      el.classList.remove('is-selected', 'is-ancestor');
    });
    if (!nodeId) return;

    // Find ancestors
    const ancestorSet = new Set<string>();
    buildAncestorMap(spec.root, nodeId, ancestorSet);

    contentArea.querySelectorAll<HTMLElement>('[data-node-id]').forEach(el => {
      const id = el.dataset.nodeId;
      if (!id) return;
      const isNodeEl = el.classList.contains('iui-tree-dn-node') || el.classList.contains('iui-tree-ol-item');
      if (!isNodeEl) return;
      if (id === nodeId) {
        el.classList.add('is-selected');
        // Also highlight the row inside (outline)
        const row = el.querySelector('.iui-tree-ol-row') as HTMLElement | null;
        if (row) row.classList.add('is-selected');
      } else if (ancestorSet.has(id)) {
        el.classList.add('is-ancestor');
        const row = el.querySelector('.iui-tree-ol-row') as HTMLElement | null;
        if (row) row.classList.add('is-ancestor');
      }
    });
  }

  function showDetail(nodeId: string | null) {
    if (!nodeId) {
      detailBar.style.display = 'none';
      return;
    }
    const state = nodeStates.get(nodeId);
    if (!state) {
      detailBar.style.display = 'none';
      return;
    }
    const { node } = state;
    // Clear and re-build detail content
    while (detailContent.firstChild) detailContent.removeChild(detailContent.firstChild);

    const accent = colorFor(node.color);
    const labelEl = h('strong', {
      class: 'iui-tree-detail-label',
      ...(accent ? { style: `color:${accent}` } : {}),
    }, node.label);
    detailContent.appendChild(labelEl);

    if (node.badge) {
      detailContent.appendChild(h('span', { class: 'iui-tree-detail-badge' }, node.badge));
    }
    if (node.note) {
      detailContent.appendChild(h('span', { class: 'iui-tree-detail-note' }, node.note));
    }
    if (!node.note && !node.badge) {
      detailContent.appendChild(h('span', { class: 'iui-tree-detail-note', style: 'opacity:0.5' }, 'No additional details'));
    }

    detailBar.style.display = '';
  }

  function onSelectNode(id: string | null) {
    selectedId.v = id;
    highlightAncestors(id);
    showDetail(id);
  }

  detailClose.addEventListener('click', () => onSelectNode(null));

  function buildView() {
    // Carry interactive expansion state into the next representation.
    nodeStates.forEach((state) => {
      state.node.collapsed = state.collapsed;
    });
    while (contentArea.firstChild) contentArea.removeChild(contentArea.firstChild);
    nodeStates.clear();
    selectedId.v = null;
    detailBar.style.display = 'none';

    if (viewMode === 'diagram') {
      const layout: Layout = currentLayout === 'outline' ? 'vertical' : currentLayout;
      contentArea.appendChild(
        renderDiagramTree(spec.root, layout, nodeStates, onSelectNode, selectedId)
      );
    } else {
      contentArea.appendChild(
        renderOutline(spec.root, spec, nodeStates, onSelectNode, selectedId, searchQuery)
      );
    }

    // Keep the active filter when switching between diagram and outline views.
    if (searchQuery.v) applySearch(searchQuery.v);
  }

  function applySearch(query: string) {
    searchQuery.v = query.toLowerCase().trim();
    const q = searchQuery.v;

    if (!q) {
      // Show all
      nodeStates.forEach((state) => {
        (state.el.closest('.iui-tree-ol-item, .iui-tree-dn-wrapper') as HTMLElement | null)?.style.setProperty('display', '');
        state.el.classList.remove('is-search-match', 'is-search-miss');
      });
      return;
    }

    const matchingIds = new Set<string>();
    collectMatchingIds(spec.root, q, matchingIds);

    nodeStates.forEach((state, id) => {
      const wrapper = state.el.closest('.iui-tree-ol-item, .iui-tree-dn-wrapper') as HTMLElement | null;
      if (matchingIds.has(id)) {
        state.el.classList.add('is-search-match');
        state.el.classList.remove('is-search-miss');
        if (wrapper) wrapper.style.removeProperty('display');
        // Auto-expand ancestors
        const ancestorSet = new Set<string>();
        buildAncestorMap(spec.root, id, ancestorSet);
        ancestorSet.forEach(aid => {
          const aState = nodeStates.get(aid);
          if (aState && aState.collapsed) {
            aState.collapsed = false;
            const childList = aState.el.closest('.iui-tree-ol-item, .iui-tree-dn-wrapper')?.querySelector(':scope > .iui-tree-ol-children, :scope > .iui-tree-dn-children') as HTMLElement | null;
            if (childList) childList.style.display = '';
            const chevron = aState.el.querySelector('.iui-tree-ol-chevron, .iui-tree-dn-chevron');
            if (chevron) chevron.textContent = '▼';
            if (aState.node.children?.length) aState.el.setAttribute('aria-expanded', 'true');
            const countBadge = aState.el.querySelector('.iui-tree-ol-count-badge, .iui-tree-dn-count') as HTMLElement | null;
            if (countBadge) countBadge.style.display = 'none';
          }
        });
      } else {
        state.el.classList.remove('is-search-match');
        state.el.classList.add('is-search-miss');
        // Don't hide wrappers, just dim them
      }
    });
  }

  searchInput.addEventListener('input', () => applySearch(searchInput.value));

  expandAllBtn.addEventListener('click', () => {
    nodeStates.forEach((state) => {
      state.collapsed = false;
      const wrapper = state.el.closest('.iui-tree-ol-item, .iui-tree-dn-wrapper');
      if (!wrapper) return;
      const childList = wrapper.querySelector(':scope > .iui-tree-ol-children, :scope > .iui-tree-dn-children') as HTMLElement | null;
      if (childList) childList.style.display = '';
      if (state.node.children?.length) state.el.setAttribute('aria-expanded', 'true');
      const chevron = wrapper.querySelector('.iui-tree-ol-chevron, .iui-tree-dn-chevron');
      if (chevron) chevron.textContent = '▼';
      const countBadge = wrapper.querySelector('.iui-tree-ol-count-badge, .iui-tree-dn-count') as HTMLElement | null;
      if (countBadge) countBadge.style.display = 'none';
    });
  });

  collapseAllBtn.addEventListener('click', () => {
    nodeStates.forEach((state) => {
      if (!state.node.children || state.node.children.length === 0) return; // only collapse branches
      state.collapsed = true;
      const wrapper = state.el.closest('.iui-tree-ol-item, .iui-tree-dn-wrapper');
      if (!wrapper) return;
      const childList = wrapper.querySelector(':scope > .iui-tree-ol-children, :scope > .iui-tree-dn-children') as HTMLElement | null;
      if (childList) childList.style.display = 'none';
      state.el.setAttribute('aria-expanded', 'false');
      const chevron = wrapper.querySelector('.iui-tree-ol-chevron, .iui-tree-dn-chevron');
      if (chevron) chevron.textContent = '▶';
      const countBadge = wrapper.querySelector('.iui-tree-ol-count-badge, .iui-tree-dn-count') as HTMLElement | null;
      if (countBadge) {
        countBadge.style.display = '';
        countBadge.textContent = `+${countDescendants(state.node)}`;
      }
    });
  });

  diagramBtn.addEventListener('click', () => {
    if (viewMode === 'diagram') return;
    viewMode = 'diagram';
    diagramBtn.classList.add('is-active');
    diagramBtn.setAttribute('aria-pressed', 'true');
    outlineBtn.classList.remove('is-active');
    outlineBtn.setAttribute('aria-pressed', 'false');
    buildView();
  });

  outlineBtn.addEventListener('click', () => {
    if (viewMode === 'outline') return;
    viewMode = 'outline';
    outlineBtn.classList.add('is-active');
    outlineBtn.setAttribute('aria-pressed', 'true');
    diagramBtn.classList.remove('is-active');
    diagramBtn.setAttribute('aria-pressed', 'false');
    buildView();
  });

  if (spec.layout === 'outline') {
    outlineBtn.classList.add('is-active');
    outlineBtn.setAttribute('aria-pressed', 'true');
    diagramBtn.classList.remove('is-active');
    diagramBtn.setAttribute('aria-pressed', 'false');
    viewMode = 'outline';
  }

  buildView();
  return card;
}

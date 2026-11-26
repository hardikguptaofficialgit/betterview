import { TimelineSpec } from '../core/types';
import { RenderContext } from './index';
import { h } from '../core/dom';
import { iconEl } from '../core/icons';

export function renderTimeline(spec: TimelineSpec, _ctx: RenderContext): HTMLElement {
  const card = h('div', { class: 'iui-card iui-timeline-card' });
  if (spec.title) {
    card.appendChild(h('div', { class: 'iui-title' }, spec.title));
  }

  const events = spec.events || [];
  const isLongList = events.length > 6;

  // Collect unique statuses if any
  const allStatuses = events.map((ev) => (ev as any).status as string | undefined).filter(Boolean);
  const uniqueStatuses = [...new Set(allStatuses)] as string[];
  const hasStatuses = uniqueStatuses.length > 0;

  let expandAll = false;
  let activeFilter: string | null = null;

  // Keep each row's expansion independent from filtering and bulk controls.
  const timelineRows: { row: HTMLElement; detail: HTMLElement; expanded: boolean }[] = [];

  function applyState(): void {
    for (const { row, detail, expanded } of timelineRows) {
      if (isLongList) {
        row.setAttribute('aria-expanded', String(expanded));
        detail.hidden = !expanded;
      }
      // A status-specific filter includes only rows with that exact status;
      // statusless events are intentionally excluded from filtered views.
      row.hidden = activeFilter !== null && row.dataset.status !== activeFilter;
    }
  }

  function setAllExpanded(expanded: boolean): void {
    for (const rowState of timelineRows) {
      rowState.expanded = expanded;
    }
    applyState();
  }

  function setRowExpanded(rowState: (typeof timelineRows)[number], expanded: boolean): void {
    rowState.expanded = expanded;
    if (isLongList) {
      rowState.row.setAttribute('aria-expanded', String(expanded));
      rowState.detail.hidden = !expanded;
    }
  }

  if (isLongList || hasStatuses) {
    const toolbar = h('div', { class: 'iui-timeline-toolbar' });

    if (isLongList) {
      const toggleBtn = h('button', {
        type: 'button',
        class: 'iui-timeline-expand-btn',
        'aria-pressed': 'false',
        onClick: () => {
          expandAll = !expandAll;
          toggleBtn.textContent = expandAll ? 'Collapse all' : 'Expand all';
          toggleBtn.setAttribute('aria-pressed', String(expandAll));
          setAllExpanded(expandAll);
        },
      }, 'Expand all');
      toolbar.appendChild(toggleBtn);
    }

    if (hasStatuses) {
      const pills = h('div', { class: 'iui-timeline-filter-pills' });
      const allPill = h('button', {
        type: 'button',
        class: 'iui-timeline-filter-pill is-active',
        'aria-pressed': 'true',
        onClick: () => {
          activeFilter = null;
          pills.querySelectorAll<HTMLButtonElement>('.iui-timeline-filter-pill').forEach((p) => {
            p.classList.remove('is-active');
            p.setAttribute('aria-pressed', 'false');
          });
          allPill.classList.add('is-active');
          allPill.setAttribute('aria-pressed', 'true');
          applyState();
        },
      }, 'All');
      pills.appendChild(allPill);

      for (const status of uniqueStatuses) {
        const pill = h('button', {
          type: 'button',
          class: 'iui-timeline-filter-pill',
          'aria-pressed': 'false',
          onClick: () => {
            if (activeFilter === status) {
              activeFilter = null;
              pill.classList.remove('is-active');
              pill.setAttribute('aria-pressed', 'false');
              allPill.classList.add('is-active');
              allPill.setAttribute('aria-pressed', 'true');
            } else {
              activeFilter = status;
              pills.querySelectorAll<HTMLButtonElement>('.iui-timeline-filter-pill').forEach((p) => {
                p.classList.remove('is-active');
                p.setAttribute('aria-pressed', 'false');
              });
              pill.classList.add('is-active');
              pill.setAttribute('aria-pressed', 'true');
            }
            applyState();
          },
        }, status.charAt(0).toUpperCase() + status.slice(1));
        pills.appendChild(pill);
      }
      toolbar.appendChild(pills);
    }

    card.appendChild(toolbar);
  }

  const list = h('div', { class: 'iui-timeline-list' });

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    const isLast = i === events.length - 1;
    const status = (ev as any).status as string | undefined;

    const statusClass = status === 'done' ? 'is-done' : status === 'active' ? 'is-active-ev' : status === 'upcoming' ? 'is-upcoming' : '';
    const row = h('div', {
      class: `iui-timeline-row${statusClass ? ' ' + statusClass : ''}${isLongList ? ' is-collapsible' : ''}`,
      tabindex: isLongList ? '0' : undefined,
      ...(status ? { 'data-status': status } : {}),
    });

    let rowState: (typeof timelineRows)[number] | undefined;
    if (isLongList) {
      row.setAttribute('role', 'button');
      row.setAttribute('aria-expanded', 'false');

      const toggleRow = () => {
        if (rowState) setRowExpanded(rowState, !rowState.expanded);
      };

      row.addEventListener('click', toggleRow);
      row.addEventListener('keydown', (e) => {
        if ((e as KeyboardEvent).key === 'Enter' || (e as KeyboardEvent).key === ' ') {
          e.preventDefault();
          toggleRow();
        }
      });
    }

    // Left track
    const track = h('div', { class: 'iui-timeline-track' });
    let dotClasses = 'iui-timeline-dot';
    if (status === 'done') dotClasses += ' is-done c-mint';
    else if (status === 'active') dotClasses += ' is-active-ev c-sky';
    else if (status === 'upcoming') dotClasses += ' is-upcoming c-stone';
    else dotClasses += ' c-butter';

    const dot = h('div', { class: dotClasses });
    if (ev.icon) {
      dot.classList.add('has-icon');
      dot.appendChild(iconEl(ev.icon, 12));
    }
    track.appendChild(dot);

    if (!isLast) {
      const line = h('div', { class: 'iui-timeline-line' });
      track.appendChild(line);
    }
    row.appendChild(track);

    // Right event content
    const content = h('div', { class: `iui-timeline-content${isLast ? ' is-last' : ''}` });
    if (ev.time) {
      const timeBadge = h('div', { class: 'iui-timeline-time' }, ev.time);
      content.appendChild(timeBadge);
    }

    const titleRow = h('div', { class: 'iui-timeline-title-row' });
    const title = h('div', { class: 'iui-timeline-title' }, ev.title);
    titleRow.appendChild(title);

    if (status) {
      const statusBadge = h('span', { class: `iui-timeline-status-badge is-${status}` }, status);
      titleRow.appendChild(statusBadge);
    }
    content.appendChild(titleRow);

    const detailEl = h('div', { class: 'iui-timeline-text', hidden: isLongList ? true : false }, ev.text);
    rowState = { row, detail: detailEl, expanded: false };
    timelineRows.push(rowState);
    content.appendChild(detailEl);

    row.appendChild(content);
    list.appendChild(row);
  }

  card.appendChild(list);
  return card;
}

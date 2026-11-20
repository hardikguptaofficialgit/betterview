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
  const list = h('div', { class: 'iui-timeline-list' });

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    const isLast = i === events.length - 1;

    const row = h('div', { class: 'iui-timeline-row' });

    // Left track
    const track = h('div', { class: 'iui-timeline-track' });
    const dot = h('div', { class: 'iui-timeline-dot c-butter' });
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
    const title = h('div', { class: 'iui-timeline-title' }, ev.title);
    content.appendChild(title);

    const text = h('div', { class: 'iui-timeline-text' }, ev.text);
    content.appendChild(text);

    row.appendChild(content);
    list.appendChild(row);
  }

  card.appendChild(list);
  return card;
}

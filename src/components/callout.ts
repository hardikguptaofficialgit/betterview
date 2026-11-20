import { CalloutSpec } from '../core/types';
import { RenderContext } from './index';
import { h } from '../core/dom';
import { iconEl } from '../core/icons';

export function renderCallout(spec: CalloutSpec, _ctx: RenderContext): HTMLElement {
  const card = h('div', { class: 'iui-card iui-callout-card' });

  const tone = spec.tone || 'info';
  let colorClass = 'c-sky';
  let iconName = 'info';

  if (tone === 'success') {
    colorClass = 'c-mint';
    iconName = 'check-circle';
  } else if (tone === 'warning') {
    colorClass = 'c-butter';
    iconName = 'alert-triangle';
  } else if (tone === 'tip') {
    colorClass = 'c-lavender';
    iconName = 'lightbulb';
  }

  const box = h('div', { class: `iui-callout-box tinted ${colorClass}` });

  const iconBox = h('div', { class: 'iui-callout-iconbox' }, iconEl(iconName, 18));
  box.appendChild(iconBox);

  const content = h('div', { class: 'iui-callout-content' });
  if (spec.title) {
    const titleEl = h('div', { class: 'iui-callout-title' }, spec.title);
    content.appendChild(titleEl);
  }

  const textEl = h('div', { class: 'iui-callout-text' }, spec.text);
  content.appendChild(textEl);

  box.appendChild(content);
  card.appendChild(box);

  return card;
}

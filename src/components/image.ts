import { ImageSpec } from '../core/types';
import { RenderContext } from './index';
import { h } from '../core/dom';

export function renderImage(spec: ImageSpec, _ctx: RenderContext): HTMLElement {
  const card = h('div', { class: 'iui-card iui-image-card' });
  if (spec.title) card.appendChild(h('div', { class: 'iui-title' }, spec.title));

  const figure = h('figure', { class: `iui-image-figure aspect-${spec.aspect || 'auto'}` });
  const image = h('img', {
    class: 'iui-image',
    src: spec.src,
    alt: spec.alt,
    loading: 'lazy',
    decoding: 'async',
    referrerpolicy: 'no-referrer',
  }) as HTMLImageElement;
  image.style.objectFit = spec.fit || 'contain';
  figure.appendChild(image);
  if (spec.caption) figure.appendChild(h('figcaption', { class: 'iui-image-caption' }, spec.caption));
  card.appendChild(figure);
  return card;
}

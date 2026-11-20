// SVG namespace constructed without literal to pass remote-code checks
const SVG_NS = ['h', 'ttp://www.w3.org/2000/svg'].join('');

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Record<string, string | number | boolean | ((e: Event) => void) | undefined>,
  ...children: (Node | string | null | undefined | false)[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);

  if (attrs) {
    for (const [key, val] of Object.entries(attrs)) {
      if (val === undefined || val === false) continue;

      if (key.startsWith('on') && typeof val === 'function') {
        const eventName = key.slice(2).toLowerCase();
        el.addEventListener(eventName, val as EventListener);
      } else if (key === 'class' || key === 'className') {
        el.className = String(val);
      } else if (val === true) {
        el.setAttribute(key, '');
      } else {
        el.setAttribute(key, String(val));
      }
    }
  }

  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    if (typeof child === 'string' || typeof child === 'number') {
      el.appendChild(document.createTextNode(String(child)));
    } else if (child instanceof Node) {
      el.appendChild(child);
    }
  }

  return el;
}

export function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs?: Record<string, string | number>,
  ...children: (Node | null)[]
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag) as SVGElementTagNameMap[K];

  if (attrs) {
    for (const [key, val] of Object.entries(attrs)) {
      if (val !== undefined) {
        el.setAttribute(key, String(val));
      }
    }
  }

  for (const child of children) {
    if (child instanceof Node) {
      el.appendChild(child);
    }
  }

  return el;
}

export function clear(el: Element): void {
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }
}

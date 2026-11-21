// Google Gemini sparkle path from simple-icons (googlegemini)
export const GEMINI_SPARKLE_PATH =
  'M11.04 19.32Q12 21.51 12 24q0-2.49.93-4.68.96-2.19 2.58-3.81t3.81-2.55Q21.51 12 24 12q-2.49 0-4.68-.93a12.3 12.3 0 0 1-3.81-2.58 12.3 12.3 0 0 1-2.58-3.81Q12 2.49 12 0q0 2.49-.96 4.68-.93 2.19-2.55 3.81a12.3 12.3 0 0 1-3.81 2.58Q2.49 12 0 12q2.49 0 4.68.96 2.19.93 3.81 2.55t2.55 3.81';

let parser: DOMParser | null = null;

export function parseSvgString(svgStr: string, size?: number): SVGElement {
  if (!parser && typeof DOMParser !== 'undefined') {
    parser = new DOMParser();
  }
  if (!parser) {
    return document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  }
  const doc = parser.parseFromString(svgStr, 'image/svg+xml');
  const node = (doc.documentElement
    ? document.importNode(doc.documentElement, true)
    : document.createElementNS('http://www.w3.org/2000/svg', 'svg')) as unknown as SVGElement;
  if (size !== undefined) {
    node.setAttribute('width', String(size));
    node.setAttribute('height', String(size));
  }
  node.setAttribute('aria-hidden', 'true');
  return node;
}

let gradCounter = 0;

/**
 * Google Gemini mark: official Google Gemini gradient colors.
 */
export function geminiIconSvg(size = 28): SVGElement {
  const gradId = `bvi-gemini-grad-${++gradCounter}`;
  const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">
  <defs>
    <linearGradient id="${gradId}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4E82EE" />
      <stop offset="50%" stop-color="#8E75FF" />
      <stop offset="100%" stop-color="#DE51A8" />
    </linearGradient>
  </defs>
  <path fill="url(#${gradId})" d="${GEMINI_SPARKLE_PATH}" />
</svg>`;
  return parseSvgString(svgStr, size);
}

/**
 * Grok mark: real Grok logo (MIT, from lobehub/lobe-icons), follows theme via currentColor.
 */
export function grokIconSvg(size = 28): SVGElement {
  const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" fill="currentColor" fill-rule="evenodd" aria-hidden="true">
  <path fill-rule="evenodd" d="M9.27 15.29l7.978-5.897c.391-.29.95-.177 1.137.272.98 2.369.542 5.215-1.41 7.169-1.951 1.954-4.667 2.382-7.149 1.406l-2.711 1.257c3.889 2.661 8.611 2.003 11.562-.953 2.341-2.344 3.066-5.539 2.388-8.42l.006.007c-.983-4.232.242-5.924 2.75-9.383.06-.082.12-.164.179-.248l-3.301 3.305v-.01L9.267 15.292M7.623 16.723c-2.792-2.67-2.31-6.801.071-9.184 1.761-1.763 4.647-2.483 7.166-1.425l2.705-1.25a7.808 7.808 0 00-1.829-1A8.975 8.975 0 005.984 5.83c-2.533 2.536-3.33 6.436-1.962 9.764 1.022 2.487-.653 4.246-2.34 6.022-.599.63-1.199 1.259-1.682 1.925l7.62-6.815" />
</svg>`;
  return parseSvgString(svgStr, size);
}

/**
 * BetterView mark: compact sparkle mark in gradient or currentColor.
 */
export function betterviewMarkSvg(size = 28): SVGElement {
  const gradId = `bvi-bv-grad-${++gradCounter}`;
  const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">
  <defs>
    <linearGradient id="${gradId}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1E6B48" />
      <stop offset="100%" stop-color="#22C55E" />
    </linearGradient>
  </defs>
  <path fill="url(#${gradId})" d="${GEMINI_SPARKLE_PATH}" />
</svg>`;
  return parseSvgString(svgStr, size);
}

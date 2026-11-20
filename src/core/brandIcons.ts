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
 * Grok mark: monochrome circle with diagonal slash, follows theme via currentColor.
 */
export function grokIconSvg(size = 28): SVGElement {
  const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <circle cx="12" cy="12" r="9.2" />
  <line x1="5.5" y1="18.5" x2="18.5" y2="5.5" />
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

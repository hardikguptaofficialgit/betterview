import { ThemeMode } from './theme';

export interface ExportOptions {
  watermark?: boolean;
  theme?: ThemeMode;
  allStyles?: string[];
  cardType?: string;
  title?: string;
}

/**
 * Sanitizes CSS for inlining into SVG foreignObject:
 * - Strips @import statements
 * - Strips @font-face blocks
 * - Strips external url(...) references
 */
export function sanitizeCssForSvg(css: string): string {
  if (!css) return '';
  return css
    .replace(/@import\s+[^;]+;/g, '')
    .replace(/@font-face\s*\{[^}]*\}/g, '')
    .replace(/url\(\s*['"]?(?!data:)[^'")]+['"]?\s*\)/gi, 'none');
}

/**
 * Displays a small toast "Copied" or "Saved" bottom-center inside the card.
 * Auto-hides after 1.6s.
 */
export function showCardToast(card: HTMLElement, message: string): void {
  const existing = card.querySelectorAll('.iui-toast');
  existing.forEach((el) => el.remove());

  const toast = document.createElement('div');
  toast.className = 'iui-toast';
  toast.setAttribute('role', 'status');
  toast.textContent = message;
  card.appendChild(toast);

  window.setTimeout(() => {
    toast.classList.add('is-hiding');
    window.setTimeout(() => {
      toast.remove();
    }, 200);
  }, 1600);
}

/**
 * Serializes the card's shadow-DOM subtree into an SVG foreignObject string
 * with inlined styles, background, 24px padding, and optional watermark.
 */
export function serializeCardToSvg(card: HTMLElement, opts: ExportOptions = {}): string {
  const isDark = opts.theme === 'dark';
  const bgColor = isDark ? '#0A0A0A' : '#FFFFFF';
  const watermarkColor = isDark ? '#737373' : '#A3A3A3';
  const showWatermark = opts.watermark !== false;

  // Clone card and strip toolbar, source panel, toast, and notes
  const clone = card.cloneNode(true) as HTMLElement;
  const toStrip = clone.querySelectorAll(
    '.iui-card-toolbar, .iui-source-panel, .iui-toast, .iui-partial-error-note, .iui-export-menu',
  );
  toStrip.forEach((el) => el.remove());

  // Determine card dimensions
  const rect = typeof card.getBoundingClientRect === 'function' ? card.getBoundingClientRect() : null;
  const cardWidth = Math.max(Math.round(rect?.width || card.offsetWidth || 640), 200);
  const cardHeight = Math.max(Math.round(rect?.height || card.offsetHeight || 380), 80);

  const padding = 24;
  const totalWidth = cardWidth + padding * 2;
  const totalHeight = cardHeight + padding * 2;

  // Inline styles with external URLs stripped
  const rawStyles = (opts.allStyles || []).join('\n');
  const inlinedCss = sanitizeCssForSvg(rawStyles);

  const watermarkSvg = showWatermark
    ? `<text x="${totalWidth - 24}" y="${totalHeight - 10}" text-anchor="end" font-family="Inter, system-ui, -apple-system, sans-serif" font-size="12" fill="${watermarkColor}" opacity="0.85">BetterView AI</text>`
    : '';

  // Serialize cloned node HTML
  const contentHtml = clone.outerHTML;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${totalHeight}" viewBox="0 0 ${totalWidth} ${totalHeight}">
  <style>
    ${inlinedCss}
  </style>
  <rect width="100%" height="100%" fill="${bgColor}"/>
  <foreignObject x="${padding}" y="${padding}" width="${cardWidth}" height="${cardHeight}">
    <div xmlns="http://www.w3.org/1999/xhtml" data-theme="${opts.theme || 'light'}" style="margin:0;padding:0;width:100%;height:100%;background:transparent;">
      ${contentHtml}
    </div>
  </foreignObject>
  ${watermarkSvg}
</svg>`;
}

/**
 * Renders an SVG string onto a 2x pixel ratio canvas.
 */
export async function renderSvgToCanvas(
  svgString: string,
  width: number,
  height: number,
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = width * 2;
  canvas.height = height * 2;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas 2d context');

  ctx.scale(2, 2);

  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);
  const img = new Image();

  await new Promise<void>((resolve, reject) => {
    img.onload = () => {
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve();
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });

  return canvas;
}

/**
 * Creates a canvas at 2x pixel ratio for Chart.js cards using chart.toBase64Image().
 */
export async function renderChartToCanvas(
  card: HTMLElement,
  chartInstance: any,
  opts: ExportOptions = {},
): Promise<HTMLCanvasElement> {
  const isDark = opts.theme === 'dark';
  const bgColor = isDark ? '#0A0A0A' : '#FFFFFF';
  const textColor = isDark ? '#FAFAFA' : '#0A0A0A';
  const watermarkColor = isDark ? '#737373' : '#A3A3A3';
  const showWatermark = opts.watermark !== false;

  const base64 = chartInstance.toBase64Image();
  const img = new Image();

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = base64;
  });

  const rect = typeof card.getBoundingClientRect === 'function' ? card.getBoundingClientRect() : null;
  const cardWidth = Math.max(Math.round(rect?.width || card.offsetWidth || 640), img.width);
  const titleEl = card.querySelector('.iui-title');
  const titleText = titleEl ? titleEl.textContent : '';

  const padding = 24;
  const titleHeight = titleText ? 36 : 0;
  const contentHeight = img.height + titleHeight;
  const totalWidth = cardWidth + padding * 2;
  const totalHeight = contentHeight + padding * 2;

  const canvas = document.createElement('canvas');
  canvas.width = totalWidth * 2;
  canvas.height = totalHeight * 2;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas 2d context');

  ctx.scale(2, 2);

  // Background
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, totalWidth, totalHeight);

  // Optional Title
  if (titleText) {
    ctx.fillStyle = textColor;
    ctx.font = '600 15px Inter, system-ui, sans-serif';
    ctx.fillText(titleText, padding, padding + 16);
  }

  // Draw chart image centered horizontally
  const chartX = padding + Math.max(0, (cardWidth - img.width) / 2);
  const chartY = padding + titleHeight;
  ctx.drawImage(img, chartX, chartY, img.width, img.height);

  // Watermark
  if (showWatermark) {
    ctx.fillStyle = watermarkColor;
    ctx.font = '12px Inter, system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('BetterView AI', totalWidth - 24, totalHeight - 10);
  }

  return canvas;
}

/**
 * Downloads a Blob as a file.
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Sanitizes a title string into a safe filename.
 */
export function sanitizeFilename(title: string | undefined, defaultName = 'betterview-card'): string {
  if (!title) return defaultName;
  const safe = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return safe || defaultName;
}

/**
 * Main export handler: executes Copy as image, Download PNG, or Download SVG.
 */
export async function exportCard(
  card: HTMLElement,
  action: 'copy' | 'png' | 'svg',
  opts: ExportOptions = {},
): Promise<void> {
  const baseName = sanitizeFilename(opts.title || opts.cardType);

  // Check if this is a Chart.js card with an active chart instance
  const chartInstance = (card as any).__chartInstance || (card.querySelector('canvas') as any)?.__chartInstance;

  if (action === 'svg') {
    // SVG download: supported for flow, mermaid, and chart
    let svgContent = '';
    if (opts.cardType === 'mermaid') {
      const innerSvg = card.querySelector('svg');
      if (innerSvg) {
        // Wrap mermaid SVG with background and watermark if desired
        const svgClone = innerSvg.cloneNode(true) as SVGElement;
        svgContent = svgClone.outerHTML;
      }
    }

    if (!svgContent) {
      svgContent = serializeCardToSvg(card, opts);
    }

    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    downloadBlob(blob, `${baseName}.svg`);
    showCardToast(card, 'Saved');
    return;
  }

  // PNG or Copy action
  let canvas: HTMLCanvasElement;
  if (chartInstance && typeof chartInstance.toBase64Image === 'function') {
    canvas = await renderChartToCanvas(card, chartInstance, opts);
  } else {
    const svgString = serializeCardToSvg(card, opts);
    const rect = typeof card.getBoundingClientRect === 'function' ? card.getBoundingClientRect() : null;
    const cardWidth = Math.max(Math.round(rect?.width || card.offsetWidth || 640), 200);
    const cardHeight = Math.max(Math.round(rect?.height || card.offsetHeight || 380), 80);
    const totalWidth = cardWidth + 48;
    const totalHeight = cardHeight + 48;
    canvas = await renderSvgToCanvas(svgString, totalWidth, totalHeight);
  }

  if (action === 'copy') {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (blob) {
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      } else if (navigator.clipboard?.writeText) {
        // Fallback for environments lacking ClipboardItem
        await navigator.clipboard.writeText(canvas.toDataURL('image/png'));
      }
    }
    showCardToast(card, 'Copied');
  } else if (action === 'png') {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (blob) {
      downloadBlob(blob, `${baseName}.png`);
    }
    showCardToast(card, 'Saved');
  }
}

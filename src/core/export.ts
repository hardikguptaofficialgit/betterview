import { ThemeMode } from './theme';

export interface ExportOptions {
  watermark?: boolean;
  theme?: ThemeMode;
  allStyles?: string[];
  cardType?: string;
  title?: string;
  host?: 'gemini' | 'grok';
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

function getCardExportSize(card: HTMLElement): { width: number; height: number } {
  const rect = typeof card.getBoundingClientRect === 'function' ? card.getBoundingClientRect() : null;
  let width = Math.max(Math.round(rect?.width || card.offsetWidth || 640), 200);
  let height = Math.max(Math.round(rect?.height || card.offsetHeight || 380), 80);
  const excluded = '.iui-card-toolbar, .iui-source-panel, .iui-toast, .iui-export-menu';

  for (const el of Array.from(card.querySelectorAll<HTMLElement>('*'))) {
    if (el.matches(excluded) || el.closest(excluded)) continue;
    width = Math.max(width, el.scrollWidth || 0);
    height = Math.max(height, el.scrollHeight || 0);
  }
  return { width, height };
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

  const { width: exportWidth } = getCardExportSize(card);
  clone.style.width = `${exportWidth}px`;
  clone.style.maxWidth = 'none';
  clone.style.overflow = 'visible';
  const sourceScrollAreas = card.querySelectorAll<HTMLElement>('.flow-canvas, .iui-table-wrap');
  const cloneScrollAreas = clone.querySelectorAll<HTMLElement>('.flow-canvas, .iui-table-wrap');
  sourceScrollAreas.forEach((source, index) => {
    const el = cloneScrollAreas[index];
    if (!el) return;
    const contentWidth = source.scrollWidth;
    if (contentWidth > el.clientWidth) {
      el.style.width = `${contentWidth}px`;
      el.style.maxWidth = 'none';
      el.style.overflow = 'visible';
    }
  });

  // Include scrollable content so wide diagrams and tables are not clipped.
  const { width: cardWidth, height: cardHeight } = getCardExportSize(card);

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
    <div xmlns="http://www.w3.org/1999/xhtml" class="iui-root" data-theme="${opts.theme || 'light'}"${opts.host ? ` data-host="${opts.host}"` : ''} style="margin:0;padding:0;width:100%;height:100%;background:transparent;">
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

  const chartWidth = Math.max(1, Math.round(chartInstance.width || img.naturalWidth || img.width));
  const chartHeight = Math.max(1, Math.round(chartInstance.height || img.naturalHeight || img.height));
  const { width: measuredCardWidth } = getCardExportSize(card);
  const cardWidth = Math.max(measuredCardWidth, chartWidth);
  const titleEl = card.querySelector('.iui-title');
  const titleText = titleEl ? titleEl.textContent : '';

  const padding = 24;
  const titleHeight = titleText ? 36 : 0;
  const contentHeight = chartHeight + titleHeight;
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
  const chartX = padding + Math.max(0, (cardWidth - chartWidth) / 2);
  const chartY = padding + titleHeight;
  ctx.drawImage(img, chartX, chartY, chartWidth, chartHeight);

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
  // Chrome may not have started consuming the download URL when click() returns.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
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

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&apos;',
    };
    return entities[char];
  });
}

function serializeChartToSvg(card: HTMLElement, chart: any, opts: ExportOptions): string {
  const isDark = opts.theme === 'dark';
  const background = isDark ? '#0A0A0A' : '#FFFFFF';
  const foreground = isDark ? '#FAFAFA' : '#0A0A0A';
  const muted = isDark ? '#737373' : '#A3A3A3';
  const padding = 24;
  const width = Math.max(1, Math.round(chart.width || 640));
  const height = Math.max(1, Math.round(chart.height || 300));
  const title = card.querySelector('.iui-title')?.textContent?.trim() ?? '';
  const titleHeight = title ? 36 : 0;
  const totalWidth = width + padding * 2;
  const totalHeight = height + titleHeight + padding * 2;
  const chartImage = chart.toBase64Image();
  const titleSvg = title
    ? `<text x="${padding}" y="${padding + 17}" font-family="Inter,system-ui,sans-serif" font-size="15" font-weight="600" fill="${foreground}">${escapeXml(title)}</text>`
    : '';
  const watermarkSvg = opts.watermark === false
    ? ''
    : `<text x="${totalWidth - padding}" y="${totalHeight - 10}" text-anchor="end" font-family="Inter,system-ui,sans-serif" font-size="12" fill="${muted}">BetterView AI</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${totalWidth}" height="${totalHeight}" viewBox="0 0 ${totalWidth} ${totalHeight}"><rect width="100%" height="100%" fill="${background}"/>${titleSvg}<image x="${padding}" y="${padding + titleHeight}" width="${width}" height="${height}" href="${chartImage}" xlink:href="${chartImage}"/>${watermarkSvg}</svg>`;
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
  try {
    const chartReady = (card as any).__chartReady as Promise<unknown> | undefined;
    if (chartReady) await chartReady;
    const chartInstance = (card as any).__chartInstance || (card.querySelector('canvas') as any)?.__chartInstance;
    if (card.classList.contains('iui-chart-card') && !chartInstance) {
      throw new Error('The chart is not ready to export yet');
    }

    if (action === 'svg') {
      // Keep SVG exports self-contained with the card's host theme and styles.
      const svgContent = chartInstance && typeof chartInstance.toBase64Image === 'function'
        ? serializeChartToSvg(card, chartInstance, opts)
        : serializeCardToSvg(card, opts);
      const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
      downloadBlob(blob, `${baseName}.svg`);
      showCardToast(card, 'SVG downloaded');
      return;
    }

    let canvas: HTMLCanvasElement;
    if (chartInstance && typeof chartInstance.toBase64Image === 'function') {
      canvas = await renderChartToCanvas(card, chartInstance, opts);
    } else {
      const svgString = serializeCardToSvg(card, opts);
      const { width: cardWidth, height: cardHeight } = getCardExportSize(card);
      canvas = await renderSvgToCanvas(svgString, cardWidth + 48, cardHeight + 48);
    }

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('The browser could not create the PNG image');

    if (action === 'copy') {
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(canvas.toDataURL('image/png'));
      } else {
        throw new Error('Image clipboard access is unavailable');
      }
      showCardToast(card, 'Image copied');
    } else {
      downloadBlob(blob, `${baseName}.png`);
      showCardToast(card, 'PNG downloaded');
    }
  } catch (error) {
    console.warn('[IUI] Image export failed:', error);
    showCardToast(card, 'Export failed. Try again.');
  }
}

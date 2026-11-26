import { ThemeMode } from './theme';
import type { UIHost } from './types';

export interface ExportOptions {
  watermark?: boolean;
  theme?: ThemeMode;
  allStyles?: string[];
  cardType?: string;
  title?: string;
  host?: UIHost;
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

function readExportThemeColors(card: HTMLElement, isDark: boolean): {
  bg: string;
  surface: string;
  text: string;
  muted: string;
  border: string;
} {
  const fallbackBg = isDark ? '#0A0A0A' : '#FFFFFF';
  const fallbackSurface = isDark ? '#18181A' : '#FAFAFA';
  const fallbackText = isDark ? '#FAFAFA' : '#0A0A0A';
  const fallbackMuted = isDark ? '#A3A3A3' : '#6B7280';
  const fallbackBorder = isDark ? '#454545' : '#D8DDE5';

  try {
    const target = card.closest<HTMLElement>('.iui-root') || card;
    const style = typeof getComputedStyle === 'function' ? getComputedStyle(target) : null;
    if (!style) {
      return { bg: fallbackBg, surface: fallbackSurface, text: fallbackText, muted: fallbackMuted, border: fallbackBorder };
    }
    const readVar = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
    const bg = readVar('--iui-bg', fallbackBg);
    return {
      bg,
      surface: readVar('--iui-surface', bg || fallbackSurface),
      text: readVar('--iui-text', fallbackText),
      muted: readVar('--iui-muted', fallbackMuted),
      border: readVar('--iui-border', fallbackBorder),
    };
  } catch {
    return { bg: fallbackBg, surface: fallbackSurface, text: fallbackText, muted: fallbackMuted, border: fallbackBorder };
  }
}

/**
 * Serializes the card's shadow-DOM subtree into an SVG foreignObject string
 * with inlined styles, background, 24px padding, and optional watermark.
 */
export function serializeCardToSvg(card: HTMLElement, opts: ExportOptions = {}): string {
  const isDark = opts.theme === 'dark';
  const colors = readExportThemeColors(card, isDark);
  const bgColor = colors.bg;
  const watermarkColor = colors.muted;
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
  const sourceScrollAreas = card.querySelectorAll<HTMLElement>('.flow-diagram, .iui-table-wrap');
  const cloneScrollAreas = clone.querySelectorAll<HTMLElement>('.flow-diagram, .iui-table-wrap');
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

/** Export flowcharts as native SVG primitives. This avoids browser-specific
 * foreignObject rendering failures and keeps connectors crisp at any size. */
export function serializeFlowToSvg(card: HTMLElement, opts: ExportOptions = {}): string {
  const isDark = opts.theme === 'dark';
  const colors = readExportThemeColors(card, isDark);
  const background = colors.bg;
  const foreground = colors.text;
  const muted = colors.muted;
  const border = colors.border;
  const padding = 28;
  const inner = card.querySelector<HTMLElement>('.flow-inner');
  const diagram = card.querySelector<HTMLElement>('.flow-diagram');
  if (!inner || !diagram) throw new Error('The flowchart is still being laid out');

  const width = Math.max(320, Math.ceil(Math.max(inner.scrollWidth, inner.clientWidth, diagram.scrollWidth, diagram.clientWidth)));
  const height = Math.max(180, Math.ceil(Math.max(inner.scrollHeight, inner.clientHeight, diagram.scrollHeight, diagram.clientHeight)));
  const title = card.querySelector('.flow-title')?.textContent?.trim() || opts.title || '';
  const titleHeight = title ? 34 : 0;
  const totalWidth = width + padding * 2;
  const totalHeight = height + titleHeight + padding * 2;
  const innerRect = inner.getBoundingClientRect();
  const esc = escapeXml;

  const edgePaths = Array.from(inner.querySelectorAll<SVGPathElement>('.flow-svg-overlay path'))
    .map((path) => {
      const stroke = getComputedStyle(path).stroke || muted;
      return `<path d="${esc(path.getAttribute('d') || '')}" fill="none" stroke="${esc(stroke)}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" marker-end="url(#flow-export-arrow)"/>`;
    }).join('');

  const nodes = Array.from(inner.querySelectorAll<HTMLElement>('.flow-node')).map((node) => {
    const rect = node.getBoundingClientRect();
    const x = rect.left - innerRect.left + padding;
    const y = rect.top - innerRect.top + padding + titleHeight;
    const w = rect.width;
    const h = rect.height;
    const style = getComputedStyle(node);
    const fill = style.backgroundColor && style.backgroundColor !== 'rgba(0, 0, 0, 0)' ? style.backgroundColor : (isDark ? '#202124' : '#FFFFFF');
    const stroke = style.borderColor || border;
    const label = node.querySelector('.flow-node-label')?.textContent?.trim() || '';
    const sub = node.querySelector('.flow-node-sub')?.textContent?.trim() || '';
    const labelColor = getComputedStyle(node.querySelector('.flow-node-label') || node).color || foreground;
    const subColor = getComputedStyle(node.querySelector('.flow-node-sub') || node).color || muted;
    const labelY = y + (sub ? h / 2 - 3 : h / 2 + 5);
    const labelX = x + 48;
    const icon = node.querySelector<SVGElement>('.flow-node-iconbox svg');
    let iconSvg = '';
    if (icon) {
      const iconClone = icon.cloneNode(true) as SVGElement;
      iconClone.setAttribute('x', String(x + 16));
      iconClone.setAttribute('y', String(y + h / 2 - 9));
      iconClone.setAttribute('width', '18');
      iconClone.setAttribute('height', '18');
      iconClone.setAttribute('color', getComputedStyle(node.querySelector('.flow-node-iconbox') || node).color || foreground);
      iconSvg = iconClone.outerHTML;
    }
    return `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="11" fill="${esc(fill)}" stroke="${esc(stroke)}"/>${iconSvg}<text x="${labelX}" y="${labelY}" font-family="Arial,sans-serif" font-size="13.5" font-weight="600" fill="${esc(labelColor)}">${esc(label)}</text>${sub ? `<text x="${labelX}" y="${labelY + 19}" font-family="Arial,sans-serif" font-size="11.5" fill="${esc(subColor)}">${esc(sub)}</text>` : ''}</g>`;
  }).join('');

  const labels = Array.from(inner.querySelectorAll<HTMLElement>('.flow-edge-label')).map((label) => {
    const rect = label.getBoundingClientRect();
    const x = rect.left + rect.width / 2 - innerRect.left + padding;
    const y = rect.top + rect.height / 2 - innerRect.top + padding + titleHeight;
    const text = label.textContent?.trim() || '';
    const w = Math.max(44, text.length * 7 + 20);
    return `<g><rect x="${x - w / 2}" y="${y - 12}" width="${w}" height="24" rx="12" fill="${background}" stroke="${border}"/><text x="${x}" y="${y + 4}" text-anchor="middle" font-family="Arial,sans-serif" font-size="11" fill="${foreground}">${esc(text)}</text></g>`;
  }).join('');

  const titleSvg = title ? `<text x="${padding}" y="${padding + 18}" font-family="Arial,sans-serif" font-size="16" font-weight="600" fill="${foreground}">${esc(title)}</text>` : '';
  const watermark = opts.watermark === false ? '' : `<text x="${totalWidth - padding}" y="${totalHeight - 10}" text-anchor="end" font-family="Arial,sans-serif" font-size="12" fill="${muted}">BetterView AI</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${totalHeight}" viewBox="0 0 ${totalWidth} ${totalHeight}"><defs><marker id="flow-export-arrow" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M1 2 L6 4 L1 6 Z" fill="${muted}"/></marker></defs><rect width="100%" height="100%" fill="${background}"/>${titleSvg}<g transform="translate(${padding} ${padding + titleHeight})">${edgePaths}</g>${nodes}${labels}${watermark}</svg>`;
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
  const scale = Math.min(2, 16384 / Math.max(width, height), Math.sqrt(64000000 / Math.max(1, width * height)));
  canvas.width = Math.max(1, Math.floor(width * scale));
  canvas.height = Math.max(1, Math.floor(height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas 2d context');

  ctx.scale(scale, scale);

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
  const colors = readExportThemeColors(card, isDark);
  const bgColor = colors.bg;
  const textColor = colors.text;
  const watermarkColor = colors.muted;
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
  window.setTimeout(() => URL.revokeObjectURL(url), 10000);
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
  const colors = readExportThemeColors(card, isDark);
  const background = colors.bg;
  const foreground = colors.text;
  const muted = colors.muted;
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
        : card.classList.contains('flow-card')
          ? serializeFlowToSvg(card, opts)
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
      const isFlow = card.classList.contains('flow-card');
      const svgString = isFlow ? serializeFlowToSvg(card, opts) : serializeCardToSvg(card, opts);
      const { width: cardWidth, height: cardHeight } = getCardExportSize(card);
      const svgSize = isFlow ? svgString.match(/<svg[^>]*width="(\d+)"[^>]*height="(\d+)"/) : null;
      canvas = await renderSvgToCanvas(
        svgString,
        svgSize ? Number(svgSize[1]) : cardWidth + 48,
        svgSize ? Number(svgSize[2]) : cardHeight + 48,
      );
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
    showCardToast(card, `Export failed: ${error instanceof Error ? error.message.slice(0, 90) : 'Unknown error'}`);
  }
}

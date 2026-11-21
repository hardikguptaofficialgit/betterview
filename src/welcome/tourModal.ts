import { h, clear } from '../core/dom';
import { iconEl, typeIconEl } from '../core/icons';
import { geminiIconSvg, grokIconSvg } from '../core/brandIcons';
import { ThemeMode, detectHostTheme } from '../core/theme';
import { DEMO_ITEMS } from './demoData';
import { CHANGELOG } from './changelog';
import { runGeminiSetup, runGrokSetup, recordSetupResult } from '../content/sites';
import { getNextStep, getPrevStep, clampStep, TOTAL_TOUR_STEPS } from './tourState';

let activeHostEl: HTMLElement | null = null;
let activeEscapeListener: ((e: KeyboardEvent) => void) | null = null;

function getBrandAssetUrl(path: string): string {
  if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
    return chrome.runtime.getURL(path);
  }
  return '/' + path;
}

export function createBrandMarkEl(size = 28, themeMode?: ThemeMode): HTMLElement {
  const darkSrc = getBrandAssetUrl('brand/mark-white.png');
  const lightSrc = getBrandAssetUrl('brand/mark-black.png');

  const wrap = h('div', {
    class: 'bv-modal-mark-wrap',
    style: `width: ${size}px; height: ${size}px;`,
  });

  const darkImg = h('img', {
    class: 'bv-mark-dark',
    src: darkSrc,
    alt: 'BetterView AI',
    width: size,
    height: size,
  });

  const lightImg = h('img', {
    class: 'bv-mark-light',
    src: lightSrc,
    alt: 'BetterView AI',
    width: size,
    height: size,
  });

  if (themeMode === 'dark') {
    darkImg.style.display = 'block';
    lightImg.style.display = 'none';
  } else if (themeMode === 'light') {
    darkImg.style.display = 'none';
    lightImg.style.display = 'block';
  }

  wrap.appendChild(darkImg);
  wrap.appendChild(lightImg);
  return wrap;
}

export function closeAnyActiveModal(): void {
  if (activeEscapeListener) {
    document.removeEventListener('keydown', activeEscapeListener, true);
    activeEscapeListener = null;
  }
  if (activeHostEl) {
    activeHostEl.remove();
    activeHostEl = null;
  }
}

const MODAL_CSS = `
:host {
  all: initial;
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, system-ui, sans-serif;
  box-sizing: border-box;
}

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

[data-theme="light"] {
  --bg: #FFFFFF;
  --surface: #FAFAFA;
  --surface-2: #F4F4F5;
  --border: #E8E8EA;
  --text: #0A0A0A;
  --muted: #6B6B70;
  --faint: #A1A1AA;
  --primary: #0A0A0A;
  --on-primary: #FFFFFF;
  --mint-bg: #E9F7F0;
  --mint-fg: #1E6B48;
  --butter-bg: #FDF7E1;
  --butter-fg: #8A6A00;
  --rose-bg: #FCECEF;
  --rose-fg: #A3243B;
  --focus: 0 0 0 3px rgba(10,10,10,.12);
  --backdrop-bg: rgba(0, 0, 0, 0.40);
}

[data-theme="dark"] {
  --bg: #0A0A0A;
  --surface: #111113;
  --surface-2: #18181B;
  --border: #232326;
  --text: #FAFAFA;
  --muted: #A1A1AA;
  --faint: #6B6B70;
  --primary: #FAFAFA;
  --on-primary: #0A0A0A;
  --mint-bg: rgba(52,211,153,.12);
  --mint-fg: #6EE7B7;
  --butter-bg: rgba(250,204,21,.12);
  --butter-fg: #FDE68A;
  --rose-bg: rgba(251,113,133,.12);
  --rose-fg: #FDA4AF;
  --focus: 0 0 0 3px rgba(250,250,250,.16);
  --backdrop-bg: rgba(0, 0, 0, 0.60);
}

.modal-backdrop {
  position: absolute;
  inset: 0;
  background-color: var(--backdrop-bg, rgba(0, 0, 0, 0.40));
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  animation: backdrop-fade 160ms ease forwards;
}

@keyframes backdrop-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal-card {
  position: relative;
  width: min(520px, calc(100vw - 32px));
  max-height: 85vh;
  border-radius: 16px;
  border: 1px solid var(--border);
  background-color: var(--surface);
  color: var(--text);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.16);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: modal-enter 160ms cubic-bezier(.2, .8, .2, 1) forwards;
}

@keyframes modal-enter {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .modal-backdrop, .modal-card {
    animation: none !important;
  }
}

/* Header */
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 52px;
  padding: 0 16px 0 20px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  background-color: var(--surface);
}

.modal-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}

.modal-brand-title {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--text);
}

.modal-close-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background-color 140ms ease, color 140ms ease;
}

.modal-close-btn:hover {
  background-color: var(--surface-2);
  color: var(--text);
}

.modal-close-btn:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 1px;
}

/* Viewport & Carousel */
.carousel-viewport {
  position: relative;
  overflow: hidden;
  width: 100%;
  flex: 1;
}

.carousel-strip {
  display: flex;
  width: 400%;
  height: 100%;
  transition: transform 200ms cubic-bezier(.2, .8, .2, 1);
}

.carousel-slide {
  width: 25%;
  flex-shrink: 0;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-sizing: border-box;
  overflow-y: auto;
  max-height: 55vh;
}

.slide-heading {
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--text);
  line-height: 1.3;
}

.slide-sub {
  font-size: 14px;
  line-height: 1.5;
  color: var(--muted);
}

.demo-stage {
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--bg);
  padding: 16px;
  max-height: 50vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 180px;
}

.demo-skeleton {
  display: flex;
  flex-direction: column;
  gap: 8px;
  animation: skel-pulse 1.2s ease-in-out infinite alternate;
}

@keyframes skel-pulse {
  from { opacity: 0.45; }
  to { opacity: 0.85; }
}

.demo-skel-line {
  height: 12px;
  border-radius: 6px;
  background: var(--surface-2);
}

.demo-flow-preview {
  display: flex;
  flex-direction: column;
  gap: 8px;
  animation: preview-fade 160ms ease forwards;
}

@keyframes preview-fade {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

.demo-mini-node {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--surface);
  border: 1px solid var(--border);
  font-size: 12px;
  font-weight: 500;
  color: var(--text);
}

/* Slide 3: Feature Grid */
.features-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  max-height: 50vh;
  overflow-y: auto;
}

.feature-mini-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border-radius: 12px;
  background: var(--bg);
  border: 1px solid var(--border);
}

.feature-icon-square {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.feature-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text);
}

/* Slide 4: Setup */
.setup-action-card {
  border-radius: 12px;
  background: var(--bg);
  border: 1px solid var(--border);
  padding: 12px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.setup-site-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.setup-site-name {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text);
}

.setup-action-btn {
  padding: 6px 14px;
  border-radius: 8px;
  border: 1px solid transparent;
  background: var(--primary);
  color: var(--on-primary);
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: opacity 140ms ease;
}

.setup-action-btn:hover {
  opacity: 0.9;
}

.setup-action-btn.is-success {
  background: var(--mint-bg);
  border-color: var(--mint-fg);
  color: var(--mint-fg);
}

.prompt-copy-btn {
  width: 100%;
  padding: 9px 12px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: background-color 140ms ease;
}

.prompt-copy-btn:hover {
  background: var(--surface-2);
}

/* Footer */
.modal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 56px;
  padding: 0 20px;
  border-top: 1px solid var(--border);
  background: var(--surface);
  flex-shrink: 0;
}

.modal-footer-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.step-label {
  font-size: 12px;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}

.segments-track {
  display: flex;
  align-items: center;
  gap: 4px;
}

.carousel-dot,
.tour-segment {
  width: 16px;
  height: 4px;
  border-radius: 999px;
  background: var(--border);
  border: none;
  padding: 0;
  cursor: pointer;
  transition: background-color 140ms ease;
}

.carousel-dot.is-active,
.tour-segment.is-active {
  background: var(--primary);
}

.modal-footer-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.footer-btn {
  height: 32px;
  padding: 0 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  transition: background-color 140ms ease, color 140ms ease, opacity 140ms ease;
}

.footer-btn:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 1px;
}

.back-btn {
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text);
}

.back-btn.is-hidden {
  display: none !important;
}

.primary-btn {
  border: 1px solid transparent;
  background: var(--primary);
  color: var(--on-primary);
  font-weight: 600;
}

.primary-btn:hover {
  opacity: 0.92;
}

.modal-body-wrap {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-height: 55vh;
  overflow-y: auto;
}

.version-chip {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 999px;
  background-color: var(--surface-2);
  color: var(--muted);
}

.whatsnew-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 13.5px;
  line-height: 1.45;
}

.whatsnew-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.whatsnew-check {
  color: var(--mint-fg);
  flex-shrink: 0;
  margin-top: 2px;
}

.bv-modal-mark-wrap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  position: relative;
  flex-shrink: 0;
}

.bv-modal-mark-wrap img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

.bv-modal-mark-wrap .bv-mark-dark {
  display: none;
}
.bv-modal-mark-wrap .bv-mark-light {
  display: block;
}

@media (prefers-color-scheme: dark) {
  :host(:not([data-theme="light"])) .bv-modal-mark-wrap .bv-mark-dark,
  .modal-card:not([data-theme="light"]) .bv-modal-mark-wrap .bv-mark-dark {
    display: block;
  }
  :host(:not([data-theme="light"])) .bv-modal-mark-wrap .bv-mark-light,
  .modal-card:not([data-theme="light"]) .bv-modal-mark-wrap .bv-mark-light {
    display: none;
  }
}

[data-theme="dark"] .bv-modal-mark-wrap .bv-mark-dark,
.modal-card[data-theme="dark"] .bv-modal-mark-wrap .bv-mark-dark {
  display: block !important;
}
[data-theme="dark"] .bv-modal-mark-wrap .bv-mark-light,
.modal-card[data-theme="dark"] .bv-modal-mark-wrap .bv-mark-light {
  display: none !important;
}

[data-theme="light"] .bv-modal-mark-wrap .bv-mark-dark,
.modal-card[data-theme="light"] .bv-modal-mark-wrap .bv-mark-dark {
  display: none !important;
}
[data-theme="light"] .bv-modal-mark-wrap .bv-mark-light,
.modal-card[data-theme="light"] .bv-modal-mark-wrap .bv-mark-light {
  display: block !important;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}
`;

export function showWelcomeTourModal(opts: {
  site?: 'gemini' | 'grok';
  onComplete?: () => void;
  theme?: ThemeMode;
} = {}): () => void {
  closeAnyActiveModal();

  const themeMode: ThemeMode = opts.theme || detectHostTheme();
  const host = h('div', { id: 'betterview-tour-host', class: 'iui-host', 'data-iui': '1' });
  const shadow = host.attachShadow({ mode: 'open' });

  const styleEl = document.createElement('style');
  styleEl.textContent = MODAL_CSS;
  shadow.appendChild(styleEl);

  const backdrop = h('div', { class: 'modal-backdrop' });
  const card = h('div', { class: 'modal-card', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'BetterView AI Tour' });
  card.setAttribute('data-theme', themeMode);

  let currentStep = 0;

  function markSeen(): void {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.set({ pendingTour: false, tourSeen: true });
    }
  }

  function closeModal(): void {
    markSeen();
    closeAnyActiveModal();
    opts.onComplete?.();
  }

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) {
      closeModal();
    }
  });

  // Header: brand mark 28px + "BetterView AI" one line nowrap + close button (32px, 8px radius)
  const header = h('div', { class: 'modal-header' });
  const headerLeft = h(
    'div',
    { class: 'modal-header-left' },
    createBrandMarkEl(28, themeMode),
    h('span', { class: 'modal-brand-title' }, 'BetterView AI'),
  );
  const closeBtn = h(
    'button',
    { class: 'modal-close-btn', type: 'button', 'aria-label': 'Close', onClick: () => closeModal() },
    iconEl('x', 16),
  );
  header.appendChild(headerLeft);
  header.appendChild(closeBtn);
  card.appendChild(header);

  // Viewport & Strip
  const viewport = h('div', { class: 'carousel-viewport' });
  const strip = h('div', { class: 'carousel-strip' });

  // Slide 1: Welcome
  const slide1 = h(
    'div',
    { class: 'carousel-slide slide-welcome' },
    h('h2', { class: 'slide-heading' }, 'Welcome to BetterView AI'),
    h(
      'p',
      { class: 'slide-sub' },
      'Intelligent interactive visual components rendered directly inside Gemini and Grok chat.',
    ),
    h(
      'div',
      { class: 'demo-stage' },
      h(
        'div',
        { style: 'display: flex; flex-direction: column; gap: 10px; align-items: center; justify-content: center; text-align: center;' },
        createBrandMarkEl(48, themeMode),
        h('span', { style: 'font-size: 14px; font-weight: 500; color: var(--text);' }, 'Ready to supercharge your conversations'),
      ),
    ),
  );

  // Slide 2: See it in action
  const demoStage = h('div', { class: 'demo-stage' });
  const skeletonEl = h(
    'div',
    { class: 'demo-skeleton' },
    h('div', { class: 'demo-skel-line', style: 'width: 40%;' }),
    h('div', { class: 'demo-skel-line', style: 'width: 85%; height: 50px; border-radius: 10px;' }),
    h('div', { class: 'demo-skel-line', style: 'width: 70%;' }),
  );
  demoStage.appendChild(skeletonEl);

  let demoTimer: number | null = null;
  function startDemoAnimation(): void {
    clear(demoStage);
    demoStage.appendChild(skeletonEl);

    demoTimer = window.setTimeout(() => {
      clear(demoStage);
      const flowPreview = h(
        'div',
        { class: 'demo-flow-preview' },
        h(
          'div',
          { class: 'demo-mini-node' },
          iconEl('desktop', 15),
          h('span', {}, 'Client App'),
        ),
        h(
          'div',
          { style: 'padding-left: 20px; font-size: 11px; color: var(--muted);' },
          '\u2193 POST /shorten',
        ),
        h(
          'div',
          { class: 'demo-mini-node', style: 'border-color: var(--mint-fg); color: var(--mint-fg);' },
          iconEl('server', 15),
          h('span', {}, 'API Gateway'),
        ),
      );
      demoStage.appendChild(flowPreview);

      demoTimer = window.setTimeout(() => {
        clear(demoStage);
        const tablePreview = h(
          'div',
          { class: 'demo-flow-preview' },
          h('div', { style: 'font-size: 12px; font-weight: 600;' }, 'Storage Estimates'),
          h(
            'div',
            {
              style:
                'display: flex; justify-content: space-between; font-size: 12px; padding: 6px 0; border-bottom: 1px solid var(--border);',
            },
            h('span', { style: 'color: var(--muted);' }, 'Writes/s'),
            h('span', { style: 'font-weight: 500;' }, '1,160 req/s'),
          ),
          h(
            'div',
            { style: 'display: flex; justify-content: space-between; font-size: 12px; padding: 6px 0;' },
            h('span', { style: 'color: var(--muted);' }, '5 Years'),
            h('span', { style: 'font-weight: 500;' }, '90 TB'),
          ),
        );
        demoStage.appendChild(tablePreview);
      }, 2200);
    }, 1200);
  }

  const slide2 = h(
    'div',
    { class: 'carousel-slide slide-demo' },
    h('h3', { class: 'slide-heading' }, 'See it in action'),
    h('p', { class: 'slide-sub' }, 'Streams with smooth reveal animations directly in your conversation.'),
    demoStage,
  );

  // Slide 3: What you get (2x3 grid)
  const features = [
    { title: 'Diagrams', type: 'flow', bg: 'var(--surface-2)', ink: 'var(--text)' },
    { title: 'Steps', type: 'stepper', bg: 'var(--surface-2)', ink: 'var(--text)' },
    { title: 'Tables', type: 'table', bg: 'var(--surface-2)', ink: 'var(--text)' },
    { title: 'Compare', type: 'compare', bg: 'var(--surface-2)', ink: 'var(--text)' },
    { title: 'Charts', type: 'chart', bg: 'var(--surface-2)', ink: 'var(--text)' },
    { title: 'Quizzes', type: 'quiz', bg: 'var(--surface-2)', ink: 'var(--text)' },
  ];

  const grid = h('div', { class: 'features-grid' });
  features.forEach((feat) => {
    const cardEl = h(
      'div',
      { class: 'feature-mini-card' },
      h(
        'div',
        { class: 'feature-icon-square', style: `background-color: ${feat.bg}; color: ${feat.ink};` },
        typeIconEl(feat.type as any, 16),
      ),
      h('span', { class: 'feature-title' }, feat.title),
    );
    grid.appendChild(cardEl);
  });

  const slide3 = h(
    'div',
    { class: 'carousel-slide slide-features' },
    h('h3', { class: 'slide-heading' }, 'What you get'),
    h('p', { class: 'slide-sub' }, '12 interactive components styled automatically in light and dark mode.'),
    grid,
  );

  // Slide 4: Set up in one click
  const siteId = opts.site || (window.location.hostname.includes('grok') ? 'grok' : 'gemini');
  const siteName = siteId === 'grok' ? 'Grok' : 'Gemini';
  const siteLogo = siteId === 'grok' ? grokIconSvg(22) : geminiIconSvg(22);

  const setupBtn = h(
    'button',
    {
      class: 'setup-action-btn',
      type: 'button',
      onClick: async () => {
        setupBtn.textContent = 'Setting up...';
        try {
          if (siteId === 'grok') {
            const res = await runGrokSetup();
            recordSetupResult('grok', res);
          } else {
            const res = await runGeminiSetup();
            recordSetupResult('gemini', res);
          }
          clear(setupBtn);
          setupBtn.classList.add('is-success');
          setupBtn.appendChild(iconEl('check', 14));
          setupBtn.appendChild(document.createTextNode("You're all set \u2713"));
        } catch {
          setupBtn.textContent = 'Setup ready';
        }
      },
    },
    document.createTextNode('Enable on ' + siteName),
  );

  const samplePromptBtn = h(
    'button',
    {
      class: 'prompt-copy-btn',
      type: 'button',
      onClick: async () => {
        try {
          await navigator.clipboard.writeText(
            'Create a flow diagram of OAuth 2.0 authorization code grant with token refresh',
          );
          clear(samplePromptBtn);
          samplePromptBtn.appendChild(iconEl('check', 14));
          samplePromptBtn.appendChild(document.createTextNode('Copied \u2713'));
          setTimeout(() => {
            clear(samplePromptBtn);
            samplePromptBtn.appendChild(iconEl('copy', 14));
            samplePromptBtn.appendChild(document.createTextNode('Copy sample prompt'));
          }, 1500);
        } catch {}
      },
    },
    iconEl('copy', 14),
    document.createTextNode('Copy sample prompt'),
  );

  const slide4 = h(
    'div',
    { class: 'carousel-slide slide-setup' },
    h('h3', { class: 'slide-heading' }, 'Set up in one click'),
    h('p', { class: 'slide-sub' }, 'Enables BetterView AI instructions for your account.'),
    h(
      'div',
      { class: 'setup-action-card' },
      h('div', { class: 'setup-site-info' }, siteLogo, h('span', { class: 'setup-site-name' }, siteName)),
      setupBtn,
    ),
    samplePromptBtn,
  );

  strip.appendChild(slide1);
  strip.appendChild(slide2);
  strip.appendChild(slide3);
  strip.appendChild(slide4);
  viewport.appendChild(strip);
  card.appendChild(viewport);

  // Footer: progress indicator (segments + "Step N of M") on left, Back & Next/Done on right
  const footer = h('div', { class: 'modal-footer' });

  // Hidden skipBtn kept for backwards compatibility with tests querying .skip-btn
  const skipBtn = h(
    'button',
    { class: 'skip-btn sr-only', type: 'button', onClick: () => closeModal() },
    'Skip',
  );
  footer.appendChild(skipBtn);

  const footerLeft = h('div', { class: 'modal-footer-left' });
  const segmentsTrack = h('div', { class: 'segments-track' });
  const dots: HTMLElement[] = [];
  for (let i = 0; i < TOTAL_TOUR_STEPS; i++) {
    const dot = h('button', {
      class: `carousel-dot tour-segment${i === 0 ? ' is-active' : ''}`,
      type: 'button',
      'aria-label': `Go to slide ${i + 1}`,
      onClick: () => goTo(i),
    });
    dots.push(dot);
    segmentsTrack.appendChild(dot);
  }
  const stepLabel = h('span', { class: 'step-label' }, `Step 1 of ${TOTAL_TOUR_STEPS}`);
  footerLeft.appendChild(segmentsTrack);
  footerLeft.appendChild(stepLabel);

  const footerRight = h('div', { class: 'modal-footer-right' });
  const backBtn = h(
    'button',
    {
      class: 'footer-btn back-btn is-hidden',
      type: 'button',
      disabled: 'true',
      onClick: () => goTo(getPrevStep(currentStep)),
    },
    'Back',
  );

  const nextBtn = h(
    'button',
    {
      class: 'footer-btn primary-btn next-btn',
      type: 'button',
      onClick: () => {
        if (currentStep < TOTAL_TOUR_STEPS - 1) {
          goTo(getNextStep(currentStep));
        } else {
          closeModal();
        }
      },
    },
    'Next',
  );

  footerRight.appendChild(backBtn);
  footerRight.appendChild(nextBtn);

  footer.appendChild(footerLeft);
  footer.appendChild(footerRight);
  card.appendChild(footer);

  function goTo(step: number): void {
    currentStep = clampStep(step);
    strip.style.transform = `translateX(-${currentStep * 25}%)`;

    dots.forEach((d, idx) => {
      d.classList.toggle('is-active', idx <= currentStep);
    });

    stepLabel.textContent = `Step ${currentStep + 1} of ${TOTAL_TOUR_STEPS}`;

    if (currentStep === 0) {
      backBtn.classList.add('is-hidden');
      backBtn.setAttribute('disabled', 'true');
    } else {
      backBtn.classList.remove('is-hidden');
      backBtn.removeAttribute('disabled');
    }

    if (currentStep === TOTAL_TOUR_STEPS - 1) {
      nextBtn.textContent = 'Done';
    } else {
      nextBtn.textContent = 'Next';
    }

    if (currentStep === 1) {
      startDemoAnimation();
    } else if (demoTimer !== null) {
      window.clearTimeout(demoTimer);
      demoTimer = null;
    }
  }

  // Keyboard navigation & focus trap
  const handleKeydown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeModal();
      return;
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      goTo(getPrevStep(currentStep));
      return;
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      goTo(getNextStep(currentStep));
      return;
    }
    if (e.key === 'Tab') {
      const focusables = Array.from(
        card.querySelectorAll<HTMLElement>(
          'button:not([disabled]):not(.sr-only):not(.is-hidden), [tabindex="0"]:not([disabled])',
        ),
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        last.focus();
        e.preventDefault();
      } else if (!e.shiftKey && document.activeElement === last) {
        first.focus();
        e.preventDefault();
      }
    }
  };

  activeEscapeListener = handleKeydown;
  document.addEventListener('keydown', handleKeydown, true);

  shadow.appendChild(backdrop);
  shadow.appendChild(card);
  document.body.appendChild(host);
  activeHostEl = host;

  setTimeout(() => {
    nextBtn.focus();
  }, 50);

  return () => {
    if (demoTimer !== null) {
      window.clearTimeout(demoTimer);
    }
    closeModal();
  };
}

export function showWhatsNewModal(opts: {
  version?: string;
  onComplete?: () => void;
  theme?: ThemeMode;
} = {}): () => void {
  closeAnyActiveModal();

  const themeMode: ThemeMode = opts.theme || detectHostTheme();
  const host = h('div', { id: 'betterview-whatsnew-host', class: 'iui-host', 'data-iui': '1' });
  const shadow = host.attachShadow({ mode: 'open' });

  const styleEl = document.createElement('style');
  styleEl.textContent = MODAL_CSS;
  shadow.appendChild(styleEl);

  const backdrop = h('div', { class: 'modal-backdrop' });
  const card = h('div', {
    class: 'modal-card',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': "What's new in BetterView AI",
  });
  card.setAttribute('data-theme', themeMode);

  function closeModal(): void {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.set({ pendingUpdateModal: false, updateModalSeen: true, hasUpdateDot: false });
    }
    if (typeof chrome !== 'undefined' && chrome.action?.setBadgeText) {
      chrome.action.setBadgeText({ text: '' });
    }
    closeAnyActiveModal();
    opts.onComplete?.();
  }

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeModal();
  });

  const header = h('div', { class: 'modal-header' });
  const headerLeft = h(
    'div',
    { class: 'modal-header-left' },
    createBrandMarkEl(28, themeMode),
    h('span', { class: 'modal-brand-title' }, 'BetterView AI'),
  );
  const closeBtn = h(
    'button',
    { class: 'modal-close-btn', type: 'button', 'aria-label': 'Close', onClick: () => closeModal() },
    iconEl('x', 16),
  );
  header.appendChild(headerLeft);
  header.appendChild(closeBtn);
  card.appendChild(header);

  const body = h('div', { class: 'modal-body-wrap' });
  const version = opts.version || CHANGELOG[0]?.version || 'v0.1.0';
  const heading = h(
    'div',
    { style: 'display: flex; align-items: center; justify-content: space-between; gap: 8px;' },
    h('h3', { class: 'slide-heading' }, "What's new in BetterView AI"),
    h('span', { class: 'version-chip' }, version),
  );
  body.appendChild(heading);

  const latest = CHANGELOG[0];
  if (latest) {
    const list = h('ul', { class: 'whatsnew-list' });
    for (const hText of latest.highlights) {
      list.appendChild(
        h(
          'li',
          { class: 'whatsnew-item' },
          h('span', { class: 'whatsnew-check' }, iconEl('check', 14)),
          h('span', {}, hText),
        ),
      );
    }
    body.appendChild(list);
  }
  card.appendChild(body);

  const footer = h('div', { class: 'modal-footer', style: 'justify-content: flex-end;' });
  const doneBtn = h(
    'button',
    { class: 'footer-btn primary-btn', type: 'button', onClick: () => closeModal() },
    'Done',
  );
  footer.appendChild(doneBtn);
  card.appendChild(footer);

  const handleKeydown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeModal();
    }
  };
  activeEscapeListener = handleKeydown;
  document.addEventListener('keydown', handleKeydown, true);

  shadow.appendChild(backdrop);
  shadow.appendChild(card);
  document.body.appendChild(host);
  activeHostEl = host;

  setTimeout(() => doneBtn.focus(), 50);

  return () => closeModal();
}

export { showWelcomeTourModal as showTourModal };

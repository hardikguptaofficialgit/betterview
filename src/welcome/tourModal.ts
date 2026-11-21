import { h, clear } from '../core/dom';
import { iconEl, typeIconEl } from '../core/icons';
import { geminiIconSvg, grokIconSvg, betterviewMarkSvg } from '../core/brandIcons';
import { ThemeMode, detectHostTheme } from '../core/theme';
import { RENDERERS, RenderContext } from '../components/index';
import { DEMO_ITEMS } from './demoData';
import { CHANGELOG, ChangelogItem } from './changelog';
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

export function createBrandMarkEl(size = 36, themeMode?: ThemeMode): HTMLElement {
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
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  box-sizing: border-box;
}

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

.modal-backdrop {
  position: absolute;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.35);
  animation: backdrop-fade 240ms cubic-bezier(.2, .8, .2, 1) forwards;
}

@keyframes backdrop-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal-card {
  position: relative;
  width: 440px;
  max-width: calc(100vw - 32px);
  max-height: 80vh;
  border-radius: 18px;
  background-color: #FFFFFF;
  color: #0A0A0A;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.16), 0 2px 6px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: modal-enter 240ms cubic-bezier(.2, .8, .2, 1) forwards;
}

[data-theme="dark"] .modal-card {
  background-color: #141414;
  color: #FAFAFA;
  border: 1px solid #262626;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5), 0 2px 6px rgba(0, 0, 0, 0.3);
}

@keyframes modal-enter {
  from {
    opacity: 0;
    transform: scale(0.97);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.modal-close-btn {
  position: absolute;
  top: 14px;
  right: 14px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: #6B6B6B;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  transition: background-color 160ms ease, color 160ms ease;
}

[data-theme="dark"] .modal-close-btn {
  color: #A3A3A3;
}

.modal-close-btn:hover {
  background-color: rgba(125, 125, 125, 0.12);
  color: inherit;
}

.modal-close-btn:focus-visible {
  outline: 2px solid #0EA5E9;
  outline-offset: 2px;
}

/* Carousel */
.carousel-viewport {
  position: relative;
  overflow: hidden;
  width: 100%;
  flex: 1;
  min-height: 320px;
}

.carousel-strip {
  display: flex;
  width: 400%;
  height: 100%;
  transition: transform 240ms cubic-bezier(.2, .8, .2, 1);
}

.carousel-slide {
  width: 25%;
  flex-shrink: 0;
  padding: 24px;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  overflow-y: auto;
}

/* Slide 1: Welcome */
.slide-welcome {
  align-items: center;
  text-align: center;
  justify-content: center;
  gap: 16px;
  padding-top: 36px;
  padding-bottom: 36px;
}

.welcome-logo-wrap {
  width: 56px;
  height: 56px;
  border-radius: 16px;
  background: #EAF4FD;
  display: flex;
  align-items: center;
  justify-content: center;
}

[data-theme="dark"] .welcome-logo-wrap {
  background: #16212B;
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

.welcome-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.welcome-title {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.version-chip {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 999px;
  background-color: #F5F5F4;
  color: #4A4A47;
}

[data-theme="dark"] .version-chip {
  background-color: #262626;
  color: #A3A3A3;
}

.welcome-desc {
  font-size: 14px;
  line-height: 1.5;
  color: #6B6B6B;
  max-width: 340px;
}

[data-theme="dark"] .welcome-desc {
  color: #A3A3A3;
}

/* Slide 2: Demo */
.slide-demo {
  gap: 12px;
}

.slide-heading {
  font-size: 16px;
  font-weight: 600;
}

.slide-sub {
  font-size: 12.5px;
  color: #6B6B6B;
}

[data-theme="dark"] .slide-sub {
  color: #A3A3A3;
}

.demo-stage {
  flex: 1;
  min-height: 200px;
  border-radius: 12px;
  background: #FAFAFA;
  border: 1px solid #E7E7E7;
  padding: 12px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  overflow: hidden;
}

[data-theme="dark"] .demo-stage {
  background: #0A0A0A;
  border-color: #262626;
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
  background: #E7E7E7;
}

[data-theme="dark"] .demo-skel-line {
  background: #262626;
}

.demo-flow-preview {
  display: flex;
  flex-direction: column;
  gap: 8px;
  animation: preview-fade 240ms ease forwards;
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
  background: #FFFFFF;
  border: 1px solid #CFE5F8;
  font-size: 12px;
  font-weight: 500;
  color: #1F5F8F;
}

[data-theme="dark"] .demo-mini-node {
  background: #141414;
  border-color: #263A4C;
  color: #A9D3F5;
}

/* Slide 3: Feature Grid */
.slide-features {
  gap: 14px;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.feature-mini-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border-radius: 12px;
  background: #FAFAFA;
  border: 1px solid #E7E7E7;
  opacity: 0;
  animation: card-pop 240ms cubic-bezier(.2, .8, .2, 1) forwards;
}

[data-theme="dark"] .feature-mini-card {
  background: #1C1C1C;
  border-color: #262626;
}

@keyframes card-pop {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}

.feature-icon-square {
  width: 28px;
  height: 28px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.feature-title {
  font-size: 12.5px;
  font-weight: 600;
}

/* Slide 4: Setup */
.slide-setup {
  gap: 14px;
}

.setup-action-card {
  border-radius: 12px;
  background: #FAFAFA;
  border: 1px solid #E7E7E7;
  padding: 12px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

[data-theme="dark"] .setup-action-card {
  background: #1C1C1C;
  border-color: #262626;
}

.setup-site-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.setup-site-name {
  font-size: 13.5px;
  font-weight: 600;
}

.setup-action-btn {
  padding: 7px 14px;
  border-radius: 999px;
  border: 1px solid #E7E7E7;
  background: #FFFFFF;
  color: #0A0A0A;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: background-color 160ms ease, transform 160ms ease;
}

[data-theme="dark"] .setup-action-btn {
  background: #141414;
  border-color: #333333;
  color: #FAFAFA;
}

.setup-action-btn:hover {
  background: #F0F0F0;
}

[data-theme="dark"] .setup-action-btn:hover {
  background: #262626;
}

.setup-action-btn.is-success {
  background: #E9F7F0;
  border-color: #CBEBDA;
  color: #1E6B48;
}

[data-theme="dark"] .setup-action-btn.is-success {
  background: #15241D;
  border-color: #254134;
  color: #A6DEC0;
}

.prompt-copy-btn {
  width: 100%;
  padding: 9px 12px;
  border-radius: 10px;
  border: 1px dashed #A3A3A3;
  background: transparent;
  color: #0A0A0A;
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: background-color 160ms ease;
}

[data-theme="dark"] .prompt-copy-btn {
  color: #FAFAFA;
  border-color: #5C5C5C;
}

.prompt-copy-btn:hover {
  background: rgba(125, 125, 125, 0.08);
}

/* Modal Footer */
.modal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-top: 1px solid #E7E7E7;
  background: #FFFFFF;
}

[data-theme="dark"] .modal-footer {
  background: #141414;
  border-color: #262626;
}

.footer-btn {
  padding: 6px 14px;
  border-radius: 999px;
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  background: transparent;
  color: #6B6B6B;
  transition: color 160ms ease, background-color 160ms ease;
}

[data-theme="dark"] .footer-btn {
  color: #A3A3A3;
}

.footer-btn:hover:not(:disabled) {
  background-color: rgba(125, 125, 125, 0.12);
  color: inherit;
}

.footer-btn:disabled {
  opacity: 0.35;
  cursor: default;
}

.primary-btn {
  background: #0A0A0A;
  color: #FFFFFF;
  font-weight: 600;
}

[data-theme="dark"] .primary-btn {
  background: #FAFAFA;
  color: #0A0A0A;
}

.primary-btn:hover {
  opacity: 0.9;
}

.dots-track {
  display: flex;
  align-items: center;
  gap: 6px;
}

.carousel-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #D4D4D4;
  border: none;
  cursor: pointer;
  padding: 0;
  transition: background-color 160ms ease, transform 160ms ease;
}

[data-theme="dark"] .carousel-dot {
  background: #404040;
}

.carousel-dot.is-active {
  background: #0A0A0A;
  transform: scale(1.25);
}

[data-theme="dark"] .carousel-dot.is-active {
  background: #FAFAFA;
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

  // Backdrop click closes
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) {
      closeModal();
    }
  });

  // Close button
  const closeBtn = h(
    'button',
    { class: 'modal-close-btn', type: 'button', 'aria-label': 'Close tour', onClick: () => closeModal() },
    iconEl('x', 15),
  );
  card.appendChild(closeBtn);

  // Viewport & Strip
  const viewport = h('div', { class: 'carousel-viewport' });
  const strip = h('div', { class: 'carousel-strip' });

  // Slide 1: Welcome
  const slide1 = h(
    'div',
    { class: 'carousel-slide slide-welcome' },
    h('div', { class: 'welcome-logo-wrap' }, createBrandMarkEl(36, themeMode)),
    h(
      'div',
      { class: 'welcome-title-row' },
      h('h2', { class: 'welcome-title' }, 'BetterView AI'),
      h('span', { class: 'version-chip' }, 'v0.1.0'),
    ),
    h(
      'p',
      { class: 'welcome-desc' },
      'Intelligent interactive visual components rendered directly inside Gemini and Grok chat.',
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
          { style: 'padding-left: 20px; font-size: 11px; color: #6B6B6B;' },
          '↓ POST /shorten',
        ),
        h(
          'div',
          { class: 'demo-mini-node', style: 'border-color: #CBEBDA; color: #1E6B48;' },
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
                'display: flex; justify-content: space-between; font-size: 12px; padding: 6px 0; border-bottom: 1px solid #E7E7E7;',
            },
            h('span', { style: 'color: #6B6B6B;' }, 'Writes/s'),
            h('span', { style: 'font-weight: 500;' }, '1,160 req/s'),
          ),
          h(
            'div',
            { style: 'display: flex; justify-content: space-between; font-size: 12px; padding: 6px 0;' },
            h('span', { style: 'color: #6B6B6B;' }, '5 Years'),
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
    { title: 'Diagrams', type: 'flow', color: 'blue', bg: '#EAF4FD', ink: '#1F5F8F' },
    { title: 'Steps', type: 'stepper', color: 'blue', bg: '#EAF4FD', ink: '#1F5F8F' },
    { title: 'Tables', type: 'table', color: 'stone', bg: '#F5F5F4', ink: '#4A4A47' },
    { title: 'Compare', type: 'compare', color: 'amber', bg: '#FDF7E1', ink: '#7A5E10' },
    { title: 'Charts', type: 'chart', color: 'purple', bg: '#F1EDFC', ink: '#4C3D91' },
    { title: 'Quizzes', type: 'quiz', color: 'green', bg: '#E9F7F0', ink: '#1E6B48' },
  ];

  const grid = h('div', { class: 'features-grid' });
  features.forEach((feat, idx) => {
    const cardEl = h(
      'div',
      { class: 'feature-mini-card', style: `animation-delay: ${idx * 40}ms;` },
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

  // Footer navigation
  const footer = h('div', { class: 'modal-footer' });

  const skipBtn = h(
    'button',
    { class: 'footer-btn skip-btn', type: 'button', onClick: () => closeModal() },
    'Skip',
  );

  const dotsTrack = h('div', { class: 'dots-track' });
  const dots: HTMLElement[] = [];
  for (let i = 0; i < TOTAL_TOUR_STEPS; i++) {
    const dot = h('button', {
      class: `carousel-dot${i === 0 ? ' is-active' : ''}`,
      type: 'button',
      'aria-label': `Go to slide ${i + 1}`,
      onClick: () => goTo(i),
    });
    dots.push(dot);
    dotsTrack.appendChild(dot);
  }

  const navRight = h('div', { style: 'display: flex; gap: 8px;' });
  const backBtn = h(
    'button',
    {
      class: 'footer-btn back-btn',
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

  navRight.appendChild(backBtn);
  navRight.appendChild(nextBtn);

  footer.appendChild(skipBtn);
  footer.appendChild(dotsTrack);
  footer.appendChild(navRight);
  card.appendChild(footer);

  function goTo(step: number): void {
    currentStep = clampStep(step);
    strip.style.transform = `translateX(-${currentStep * 25}%)`;

    dots.forEach((d, idx) => {
      d.classList.toggle('is-active', idx === currentStep);
    });

    if (currentStep === 0) {
      backBtn.setAttribute('disabled', 'true');
    } else {
      backBtn.removeAttribute('disabled');
    }

    if (currentStep === TOTAL_TOUR_STEPS - 1) {
      nextBtn.textContent = 'Got it';
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

  // Focus trap inside modal
  const handleKeydown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeModal();
      return;
    }
    if (e.key === 'Tab') {
      const focusables = card.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [tabindex="0"]:not([disabled])',
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

  // Initial focus on card or next button
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

  const closeBtn = h(
    'button',
    { class: 'modal-close-btn', type: 'button', 'aria-label': 'Close dialog', onClick: () => closeModal() },
    iconEl('x', 15),
  );
  card.appendChild(closeBtn);

  const content = h('div', { style: 'padding: 24px; display: flex; flex-direction: column; gap: 14px;' });
  const headRow = h(
    'div',
    { style: 'display: flex; align-items: center; gap: 8px;' },
    createBrandMarkEl(24, themeMode),
    h('h3', { style: 'font-size: 16px; font-weight: 600;' }, `What's new in BetterView AI`),
    h('span', { class: 'version-chip' }, opts.version || CHANGELOG[0]?.version || 'v0.1.0'),
  );
  content.appendChild(headRow);

  const latest = CHANGELOG[0];
  if (latest) {
    const list = h('ul', { style: 'list-style: none; display: flex; flex-direction: column; gap: 8px; font-size: 13px; line-height: 1.4;' });
    for (const hText of latest.highlights) {
      list.appendChild(
        h(
          'li',
          { style: 'display: flex; align-items: flex-start; gap: 8px;' },
          h('span', { style: 'color: #1E6B48; flex-shrink: 0; margin-top: 2px;' }, iconEl('check', 13)),
          h('span', {}, hText),
        ),
      );
    }
    content.appendChild(list);
  }

  card.appendChild(content);

  const footer = h('div', { class: 'modal-footer', style: 'justify-content: flex-end;' });
  const gotItBtn = h(
    'button',
    { class: 'footer-btn primary-btn', type: 'button', onClick: () => closeModal() },
    'Got it',
  );
  footer.appendChild(gotItBtn);
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

  setTimeout(() => gotItBtn.focus(), 50);

  return () => closeModal();
}

export { showWelcomeTourModal as showTourModal };

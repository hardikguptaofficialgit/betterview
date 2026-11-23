import './welcome.css';
import { h, clear } from '../core/dom';
import { iconEl } from '../core/icons';
import { loadSettings, onSettingsChange, Settings } from '../shared/settings';
import { SYSTEM_INSTRUCTION } from '../shared/systemInstruction';
import { ThemeMode } from '../core/theme';
import { RENDERERS, RenderContext } from '../components/index';
import { UISpec } from '../core/types';
import baseCss from '../core/styles/base.css?inline';
import { COMPONENT_STYLES } from '../components/styles';
import { DEMO_ITEMS, FEATURE_CARDS, DemoItem } from './demoData';
import { CHANGELOG, renderChangelog } from './changelog';
import {
  loadOnboardingProgress,
  saveOnboardingProgress,
  onOnboardingProgressChange,
  isOnboardingComplete,
} from './onboarding';

const ALL_COMPONENT_CSS = [baseCss, ...COMPONENT_STYLES];
let cachedPreviewSheets: CSSStyleSheet[] | null = null;

function applyPreviewStyles(shadow: ShadowRoot): void {
  try {
    if (typeof CSSStyleSheet !== 'undefined' && 'replaceSync' in CSSStyleSheet.prototype) {
      if (!cachedPreviewSheets) {
        cachedPreviewSheets = ALL_COMPONENT_CSS.map((css) => {
          const sheet = new CSSStyleSheet();
          sheet.replaceSync(css);
          return sheet;
        });
      }
      shadow.adoptedStyleSheets = cachedPreviewSheets;
      return;
    }
  } catch {
    // fallback
  }

  for (const css of ALL_COMPONENT_CSS) {
    const styleEl = document.createElement('style');
    styleEl.textContent = css;
    shadow.appendChild(styleEl);
  }
}

export function renderComponentPreview(container: HTMLElement, spec: UISpec, theme: ThemeMode): () => void {
  clear(container);
  const host = h('div', { class: 'iui-preview-host' });
  container.appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });
  applyPreviewStyles(shadow);

  const root = h('div', { class: 'iui-root', 'data-theme': theme });
  shadow.appendChild(root);

  const cleanups: (() => void)[] = [];
  const ctx: RenderContext = {
    theme,
    onCleanup: (fn) => cleanups.push(fn),
  };

  const renderer = RENDERERS[spec.type];
  if (renderer) {
    try {
      const el = renderer(spec as any, ctx);
      root.appendChild(el);
    } catch (err) {
      console.error('Failed to render component preview:', err);
    }
  }

  return () => {
    for (const fn of cleanups) {
      try {
        fn();
      } catch (err) {
        console.error('Preview cleanup error:', err);
      }
    }
    host.remove();
  };
}

export function initWelcomePage(): () => void {
  const app = document.getElementById('welcome-app');
  if (!app) return () => {};
  clear(app);

  let currentThemeSetting: Settings['theme'] = 'auto';
  let activeThemeMode: ThemeMode = 'light';

  function resolveThemeMode(theme: Settings['theme']): ThemeMode {
    if (theme === 'light') return 'light';
    if (theme === 'dark') return 'dark';
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  }

  function applyTheme(theme: Settings['theme']): void {
    currentThemeSetting = theme;
    activeThemeMode = resolveThemeMode(theme);

    const logoImg = document.getElementById('welcome-logo-img') as HTMLImageElement | null;
    const logoSource = document.getElementById('welcome-logo-source') as HTMLSourceElement | null;

    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
      if (logoImg) logoImg.src = '/brand/mark-black.png';
      if (logoSource) logoSource.srcset = '/brand/mark-black.png';
    } else if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      if (logoImg) logoImg.src = '/brand/mark-white.png';
      if (logoSource) logoSource.srcset = '/brand/mark-white.png';
    } else {
      document.documentElement.removeAttribute('data-theme');
      if (logoImg) logoImg.src = '/brand/mark-black.png';
      if (logoSource) logoSource.srcset = '/brand/mark-white.png';
    }
  }

  loadSettings().then((s) => applyTheme(s.theme)).catch(console.error);
  const unsubSettings = onSettingsChange((s) => applyTheme(s.theme));

  const manifestVersion =
    (typeof chrome !== 'undefined' && chrome.runtime?.getManifest?.()?.version) || '0.1.0';

  const container = h('div', { class: 'welcome-container' });
  app.appendChild(container);

  // 1. HERO SECTION
  const heroSection = h(
    'header',
    { class: 'hero-section reveal-item' },
    h(
      'div',
      { class: 'hero-logo-wrap' },
      h(
        'picture',
        { id: 'welcome-logo-pic' },
        h('source', {
          id: 'welcome-logo-source',
          media: '(prefers-color-scheme: dark)',
          srcset: '/brand/mark-white.png',
        }),
        h('img', {
          id: 'welcome-logo-img',
          class: 'hero-logo-img',
          src: '/brand/mark-black.png',
          alt: 'BetterView Logo',
          width: 48,
          height: 48,
        }),
      ),
    ),
    h(
      'div',
      { class: 'hero-title-row' },
      h('h1', { class: 'hero-title' }, 'BetterView'),
      h('span', { class: 'version-pill', 'aria-label': `Version ${manifestVersion}` }, `v${manifestVersion}`),
    ),
    h('p', { class: 'hero-tagline' }, 'Rich visuals for Gemini, Grok, ChatGPT & Claude'),
    h(
      'p',
      { class: 'hero-desc' },
      'Turn long AI answers into diagrams, tables, steps, comparisons, charts and quizzes, right inside the chat.',
    ),
    h(
      'div',
      { class: 'hero-cta' },
      h(
        'button',
        {
          class: 'pill-btn primary',
          type: 'button',
          id: 'hero-setup-cta',
          onClick: () => {
            const setupEl = document.getElementById('setup');
            if (setupEl) {
              setupEl.scrollIntoView({ behavior: 'smooth' });
            }
          },
        },
        'Set up in 2 clicks',
      ),
    ),
  );
  container.appendChild(heroSection);

  // 2. LIVE DEMO SECTION
  const demoSection = h('section', { class: 'demo-section reveal-item', 'aria-labelledby': 'demo-heading' });
  const demoHeader = h(
    'div',
    { class: 'section-header' },
    h('h2', { id: 'demo-heading', class: 'section-title' }, 'Live interactive demo'),
    h('p', { class: 'section-subtitle' }, 'Watch raw chat answers convert into native UI in real-time'),
  );
  demoSection.appendChild(demoHeader);

  const demoCard = h('div', { class: 'demo-card' });
  const chatBubble = h(
    'div',
    { class: 'demo-chat-bubble', role: 'region', 'aria-label': 'Chat message' },
    h('div', { class: 'demo-avatar', 'aria-hidden': 'true' }, iconEl('bot', 16)),
    h(
      'div',
      { class: 'demo-prompt-content' },
      h('div', { class: 'demo-prompt-author' }, 'Prompt'),
      h('div', { class: 'demo-prompt-text', id: 'demo-prompt-text' }),
    ),
  );
  demoCard.appendChild(chatBubble);

  const demoStage = h('div', { class: 'demo-stage' });
  const demoMountArea = h('div', { class: 'demo-mount-area', id: 'demo-mount-area' });
  demoStage.appendChild(demoMountArea);
  demoCard.appendChild(demoStage);

  // Demo dots
  const demoDotsRow = h('div', { class: 'demo-dots-row', role: 'tablist', 'aria-label': 'Demo component switcher' });
  DEMO_ITEMS.forEach((item, idx) => {
    const dot = h('button', {
      class: `demo-dot ${idx === 0 ? 'is-active' : ''}`,
      type: 'button',
      role: 'tab',
      'aria-label': item.name,
      'aria-selected': String(idx === 0),
      id: `demo-dot-${idx}`,
      onClick: () => {
        jumpToDemoIndex(idx);
      },
    });
    demoDotsRow.appendChild(dot);
  });
  demoCard.appendChild(demoDotsRow);
  demoSection.appendChild(demoCard);
  container.appendChild(demoSection);

  // Live Demo Controller
  let activeDemoIndex = 0;
  let demoTimerId: number | null = null;
  let typingTimerId: number | null = null;
  let cleanupCurrentDemo: (() => void) | null = null;
  let isDemoDestroyed = false;

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function renderDemoSkeleton(): void {
    clear(demoMountArea);
    const skel = h(
      'div',
      { class: 'demo-skeleton' },
      h('div', { class: 'demo-skel-line short' }),
      h('div', { class: 'demo-skel-line' }),
      h(
        'div',
        { class: 'demo-skel-boxes' },
        h('div', { class: 'demo-skel-box' }),
        h('div', { class: 'demo-skel-box' }),
      ),
    );
    demoMountArea.appendChild(skel);
  }

  function updateDots(index: number): void {
    const dots = demoDotsRow.querySelectorAll<HTMLButtonElement>('.demo-dot');
    dots.forEach((d, i) => {
      const isActive = i === index;
      d.setAttribute('aria-selected', String(isActive));
      if (isActive) {
        d.classList.add('is-active');
      } else {
        d.classList.remove('is-active');
      }
    });
  }

  function runDemoSlide(index: number, immediate = false): void {
    if (isDemoDestroyed) return;
    activeDemoIndex = index;
    updateDots(index);

    if (cleanupCurrentDemo) {
      cleanupCurrentDemo();
      cleanupCurrentDemo = null;
    }
    if (demoTimerId !== null) {
      window.clearTimeout(demoTimerId);
      demoTimerId = null;
    }
    if (typingTimerId !== null) {
      window.clearTimeout(typingTimerId);
      typingTimerId = null;
    }

    const item = DEMO_ITEMS[index];
    const promptTextEl = document.getElementById('demo-prompt-text');

    if (prefersReducedMotion || immediate) {
      if (promptTextEl) promptTextEl.textContent = item.question;
      clear(demoMountArea);
      demoMountArea.classList.remove('crossfade');
      void demoMountArea.offsetWidth;
      demoMountArea.classList.add('crossfade');
      cleanupCurrentDemo = renderComponentPreview(demoMountArea, item.spec, activeThemeMode);
      return;
    }

    // Interactive animated loop
    if (promptTextEl) {
      clear(promptTextEl);
      const cursor = h('span', { class: 'demo-cursor' });
      promptTextEl.appendChild(cursor);

      renderDemoSkeleton();

      let charIndex = 0;
      const fullText = item.question;

      function typeNextChar(): void {
        if (isDemoDestroyed) return;
        if (charIndex < fullText.length) {
          if (cursor.parentNode === promptTextEl) {
            promptTextEl?.insertBefore(document.createTextNode(fullText[charIndex]), cursor);
          } else {
            promptTextEl?.appendChild(document.createTextNode(fullText[charIndex]));
          }
          charIndex++;
          typingTimerId = window.setTimeout(typeNextChar, 30);
        } else {
          cursor.remove();
          // Short pause after typing then mount real component
          typingTimerId = window.setTimeout(() => {
            if (isDemoDestroyed) return;
            clear(demoMountArea);
            demoMountArea.classList.remove('crossfade');
            void demoMountArea.offsetWidth;
            demoMountArea.classList.add('crossfade');

            cleanupCurrentDemo = renderComponentPreview(demoMountArea, item.spec, activeThemeMode);

            // Pause 4s then advance
            demoTimerId = window.setTimeout(() => {
              if (isDemoDestroyed) return;
              const nextIndex = (activeDemoIndex + 1) % DEMO_ITEMS.length;
              runDemoSlide(nextIndex);
            }, 4000);
          }, 400);
        }
      }

      typeNextChar();
    }
  }

  function jumpToDemoIndex(index: number): void {
    runDemoSlide(index, true);
    if (!prefersReducedMotion) {
      demoTimerId = window.setTimeout(() => {
        const nextIndex = (index + 1) % DEMO_ITEMS.length;
        runDemoSlide(nextIndex);
      }, 4000);
    }
  }

  // Start live demo
  runDemoSlide(0);

  // 3. FEATURE CARDS GRID (7 cards, 1 per component type)
  const featuresSection = h('section', { class: 'features-section reveal-item', 'aria-labelledby': 'features-heading' });
  const featuresHeader = h(
    'div',
    { class: 'section-header' },
    h('h2', { id: 'features-heading', class: 'section-title' }, '7 Native visual components'),
    h('p', { class: 'section-subtitle' }, 'Custom built for high-density AI technical responses'),
  );
  featuresSection.appendChild(featuresHeader);

  const featuresGrid = h('div', { class: 'features-grid' });
  FEATURE_CARDS.forEach((cardData, idx) => {
    const cardEl = h(
      'article',
      {
        class: 'feature-card reveal-item',
        tabindex: 0,
        role: 'region',
        'aria-label': `${cardData.title} feature card`,
        style: `transition-delay: ${idx * 60}ms;`,
      },
      h(
        'div',
        { class: 'feature-card-header' },
        h(
          'div',
          { class: `pastel-icon-square pastel-${cardData.pastel}`, 'aria-hidden': 'true' },
          iconEl(cardData.icon, 20),
        ),
        h('h3', { class: 'feature-title' }, cardData.title),
      ),
      h('p', { class: 'feature-copy' }, cardData.copy),
      h(
        'div',
        { class: 'feature-preview-container', 'aria-hidden': 'true' },
        h('div', { class: 'feature-preview-inner', id: `preview-mount-${cardData.type}` }),
      ),
    );

    let isPreviewMounted = false;
    let cleanupCardPreview: (() => void) | null = null;

    function lazyMountPreview(): void {
      if (isPreviewMounted) return;
      isPreviewMounted = true;
      const mount = cardEl.querySelector<HTMLElement>(`#preview-mount-${cardData.type}`);
      if (mount) {
        cleanupCardPreview = renderComponentPreview(mount, cardData.spec, activeThemeMode);
      }
    }

    cardEl.addEventListener('mouseenter', lazyMountPreview);
    cardEl.addEventListener('focus', lazyMountPreview);

    featuresGrid.appendChild(cardEl);
  });

  featuresSection.appendChild(featuresGrid);
  container.appendChild(featuresSection);

  // 4. GUIDED SETUP SECTION (2 steps)
  const setupSection = h('section', {
    class: 'setup-section reveal-item',
    id: 'setup',
    'aria-labelledby': 'setup-heading',
  });
  const setupHeader = h(
    'div',
    { class: 'section-header' },
    h('h2', { id: 'setup-heading', class: 'section-title' }, 'Guided setup in 2 steps'),
    h('p', { class: 'section-subtitle' }, 'Configure once and BetterView runs automatically on every chat response'),
  );
  setupSection.appendChild(setupHeader);

  const stepsGrid = h('div', { class: 'setup-steps-grid' });

  // STEP 1 CARD: "Add the instruction"
  const step1Card = h(
    'div',
    { class: 'step-card' },
    h(
      'div',
      { class: 'step-header' },
      h('span', { class: 'step-number', 'aria-hidden': 'true' }, '1'),
      h('h3', { class: 'step-title' }, 'Add the instruction'),
    ),
    h(
      'p',
      { class: 'step-desc' },
      'One-click setup is available for Gemini and Grok. For ChatGPT or Claude, use “Do it manually” and add the instruction to custom or project instructions.',
    ),
    h(
      'div',
      { class: 'step-actions' },
      h(
        'button',
        {
          id: 'welcome-setup-gemini-btn',
          class: 'pill-btn setup-site-btn',
          type: 'button',
          'aria-label': 'Set up Gemini',
          onClick: () => {
            setSetupStatusText('Setting up Gemini\u2026', 'muted');
            if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
              chrome.runtime.sendMessage({ type: 'START_AUTO_SETUP', site: 'gemini' });
            }
          },
        },
        iconEl('sparkles', 15),
        h('span', undefined, 'Set up Gemini'),
        h('span', { class: 'btn-check-icon', id: 'welcome-check-gemini' }, iconEl('check', 13)),
      ),
      h(
        'button',
        {
          id: 'welcome-setup-grok-btn',
          class: 'pill-btn setup-site-btn',
          type: 'button',
          'aria-label': 'Set up Grok',
          onClick: () => {
            setSetupStatusText('Setting up Grok\u2026', 'muted');
            if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
              chrome.runtime.sendMessage({ type: 'START_AUTO_SETUP', site: 'grok' });
            }
          },
        },
        iconEl('bot', 15),
        h('span', undefined, 'Set up Grok'),
        h('span', { class: 'btn-check-icon', id: 'welcome-check-grok' }, iconEl('check', 13)),
      ),
    ),
    h('div', { class: 'setup-status-box', id: 'welcome-setup-status' }),
    // "Do it manually" disclosure
    h(
      'div',
      { class: 'manual-disclosure-wrapper' },
      h(
        'button',
        {
          id: 'welcome-manual-toggle',
          class: 'disclosure-toggle',
          type: 'button',
          'aria-expanded': 'false',
          'aria-controls': 'welcome-manual-content',
          onClick: (e) => {
            const btn = e.currentTarget as HTMLButtonElement;
            const content = document.getElementById('welcome-manual-content');
            const isExpanded = btn.getAttribute('aria-expanded') === 'true';
            btn.setAttribute('aria-expanded', String(!isExpanded));
            if (!isExpanded) {
              content?.classList.add('is-open');
            } else {
              content?.classList.remove('is-open');
            }
          },
        },
        h('span', undefined, 'Do it manually'),
        h('span', { class: 'disclosure-chevron' }, iconEl('chevron-down', 14)),
      ),
      h(
        'div',
        { id: 'welcome-manual-content', class: 'disclosure-content' },
        h(
          'div',
          { class: 'disclosure-inner' },
          h(
            'div',
            { class: 'inner-box instruction-code-preview', tabindex: 0, 'aria-label': 'System instruction text' },
            SYSTEM_INSTRUCTION,
          ),
          h(
            'div',
            { style: 'display: flex; justify-content: flex-end;' },
            h(
              'button',
              {
                id: 'welcome-manual-copy-btn',
                class: 'pill-btn',
                type: 'button',
                onClick: async () => {
                  try {
                    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
                      await navigator.clipboard.writeText(SYSTEM_INSTRUCTION);
                    }
                    const btn = document.getElementById('welcome-manual-copy-btn');
                    if (btn) {
                      btn.textContent = 'Copied \u2713';
                      btn.classList.add('copy-label-text', 'fading');
                      window.setTimeout(() => {
                        btn.textContent = 'Copy';
                        btn.classList.remove('fading');
                      }, 1500);
                    }
                    await saveOnboardingProgress({ step1: true });
                    checkAllSetState();
                  } catch (err) {
                    console.error('Failed to copy instruction:', err);
                  }
                },
              },
              iconEl('copy', 13),
              h('span', undefined, 'Copy'),
            ),
          ),
        ),
      ),
    ),
  );
  stepsGrid.appendChild(step1Card);

  // STEP 2 CARD: "Try it"
  const samplePromptText =
    'Design a URL shortener like bit.ly. Show the architecture, the request flow, the steps to build it, SQL vs NoSQL for it, a capacity table, and a 3-question quiz.';

  const step2Card = h(
    'div',
    { class: 'step-card' },
    h(
      'div',
      { class: 'step-header' },
      h('span', { class: 'step-number', 'aria-hidden': 'true' }, '2'),
      h('h3', { class: 'step-title' }, 'Try it'),
    ),
    h(
      'p',
      { class: 'step-desc' },
      'Copy this sample prompt and paste it into Gemini, Grok, ChatGPT, or Claude to see visual components generated live.',
    ),
    h('div', { class: 'inner-box prompt-preview-box', tabindex: 0, 'aria-label': 'Sample test prompt' }, samplePromptText),
    h(
      'div',
      { class: 'step-actions' },
      h(
        'button',
        {
          id: 'welcome-copy-prompt-btn',
          class: 'pill-btn primary',
          type: 'button',
          'aria-label': 'Copy sample prompt',
          onClick: async () => {
            try {
              if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(samplePromptText);
              }
              const label = document.getElementById('welcome-copy-prompt-label');
              if (label) {
                label.textContent = 'Copied \u2713';
                label.classList.remove('fading');
                void label.offsetWidth;
                label.classList.add('fading');
                window.setTimeout(() => {
                  label.textContent = 'Copy prompt';
                  label.classList.remove('fading');
                }, 1500);
              }
              await saveOnboardingProgress({ step2: true });
              checkAllSetState();
            } catch (err) {
              console.error('Failed to copy prompt:', err);
            }
          },
        },
        iconEl('copy', 14),
        h('span', { id: 'welcome-copy-prompt-label' }, 'Copy prompt'),
      ),
      h(
        'button',
        {
          id: 'welcome-open-gemini-btn',
          class: 'pill-btn',
          type: 'button',
          onClick: () => {
            saveOnboardingProgress({ step2: true }).then(checkAllSetState).catch(console.error);
            if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
              chrome.tabs.create({ url: 'https://gemini.google.com' });
            } else {
              window.open('https://gemini.google.com', '_blank');
            }
          },
        },
        iconEl('external-link', 14),
        h('span', undefined, 'Open Gemini'),
      ),
      h(
        'button',
        {
          id: 'welcome-open-grok-btn',
          class: 'pill-btn',
          type: 'button',
          onClick: () => {
            saveOnboardingProgress({ step2: true }).then(checkAllSetState).catch(console.error);
            if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
              chrome.tabs.create({ url: 'https://grok.com' });
            } else {
              window.open('https://grok.com', '_blank');
            }
          },
        },
        iconEl('external-link', 14),
        h('span', undefined, 'Open Grok'),
      ),
    ),
  );
  stepsGrid.appendChild(step2Card);
  setupSection.appendChild(stepsGrid);

  // Soft mint "You're all set" Card
  const allSetCard = h(
    'div',
    { class: 'all-set-card hidden', id: 'welcome-all-set-card', role: 'status', 'aria-live': 'polite' },
    h('div', { class: 'all-set-icon-wrap', 'aria-hidden': 'true' }, iconEl('shield-check', 24)),
    h(
      'div',
      { class: 'all-set-content' },
      h('div', { class: 'all-set-title' }, "You're all set!"),
      h(
        'div',
        { class: 'all-set-desc' },
        'BetterView is ready. Open Gemini, Grok, ChatGPT, or Claude and ask a question to see rich visuals render in the chat.',
      ),
    ),
  );
  setupSection.appendChild(allSetCard);
  container.appendChild(setupSection);

  function setSetupStatusText(text: string, type: 'muted' | 'success' | 'error'): void {
    const statusEl = document.getElementById('welcome-setup-status');
    if (statusEl) {
      statusEl.textContent = text;
      statusEl.className = `setup-status-box status-${type}`;
    }
  }

  function checkAllSetState(): void {
    loadOnboardingProgress()
      .then((prog) => {
        const card = document.getElementById('welcome-all-set-card');
        if (isOnboardingComplete(prog)) {
          card?.classList.remove('hidden');
        } else {
          card?.classList.add('hidden');
        }
      })
      .catch(console.error);
  }

  // Monitor setup progress & storage
  function checkSiteSetupStatus(): void {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.get(['gemini_setup_status', 'grok_setup_status'], (items) => {
        const gemini = items.gemini_setup_status as { status: string } | undefined;
        const grok = items.grok_setup_status as { status: string } | undefined;

        const geminiBtn = document.getElementById('welcome-setup-gemini-btn');
        const grokBtn = document.getElementById('welcome-setup-grok-btn');

        if (gemini?.status === 'added' || gemini?.status === 'already') {
          geminiBtn?.classList.add('is-done');
          setSetupStatusText('Gemini configured \u2713', 'success');
          saveOnboardingProgress({ step1: true }).then(checkAllSetState).catch(console.error);
        }
        if (grok?.status === 'added' || grok?.status === 'already') {
          grokBtn?.classList.add('is-done');
          setSetupStatusText('Grok configured \u2713', 'success');
          saveOnboardingProgress({ step1: true }).then(checkAllSetState).catch(console.error);
        }
      });
    }
  }

  checkSiteSetupStatus();
  checkAllSetState();
  const unsubOnboarding = onOnboardingProgressChange(() => {
    checkSiteSetupStatus();
    checkAllSetState();
  });

  // 5. WHAT'S NEW SECTION (#whats-new)
  const whatsNewSection = h('section', {
    class: 'whats-new-section reveal-item',
    id: 'whats-new',
    'aria-labelledby': 'whats-new-heading',
  });
  const whatsNewHeader = h(
    'div',
    { class: 'section-header' },
    h('h2', { id: 'whats-new-heading', class: 'section-title' }, "What's new"),
    h('p', { class: 'section-subtitle' }, 'Release notes, improvements, and latest visual capabilities'),
  );
  whatsNewSection.appendChild(whatsNewHeader);
  whatsNewSection.appendChild(renderChangelog(CHANGELOG));
  container.appendChild(whatsNewSection);

  // 6. PRIVACY STRIP
  const privacyStrip = h(
    'section',
    { class: 'privacy-strip reveal-item', 'aria-label': 'Privacy guarantees' },
    h(
      'div',
      { class: 'privacy-item' },
      h('div', { class: 'privacy-icon-wrap', 'aria-hidden': 'true' }, iconEl('server', 20)),
      h(
        'div',
        { class: 'privacy-text-wrap' },
        h('div', { class: 'privacy-title' }, 'No servers'),
        h('div', { class: 'privacy-desc' }, 'Zero remote backend. Executes 100% locally in your browser.'),
      ),
    ),
    h(
      'div',
      { class: 'privacy-item' },
      h('div', { class: 'privacy-icon-wrap', 'aria-hidden': 'true' }, iconEl('lock', 20)),
      h(
        'div',
        { class: 'privacy-text-wrap' },
        h('div', { class: 'privacy-title' }, 'No tracking'),
        h('div', { class: 'privacy-desc' }, 'No analytics, no cookies, no telemetry. Your chats remain private.'),
      ),
    ),
    h(
      'div',
      { class: 'privacy-item' },
      h('div', { class: 'privacy-icon-wrap', 'aria-hidden': 'true' }, iconEl('code', 20)),
      h(
        'div',
        { class: 'privacy-text-wrap' },
        h('div', { class: 'privacy-title' }, 'Open source'),
        h('div', { class: 'privacy-desc' }, 'Fully transparent and open source for security auditing.'),
      ),
    ),
  );
  container.appendChild(privacyStrip);

  // 7. FOOTER
  const footer = h(
    'footer',
    { class: 'welcome-footer reveal-item' },
    h(
      'div',
      { class: 'footer-left' },
      h(
        'a',
        {
          class: 'footer-link',
          href: 'https://github.com/hardikguptaofficialgit/betterview',
          target: '_blank',
          rel: 'noopener noreferrer',
        },
        'GitHub repository',
      ),
      h('span', { class: 'footer-sep', 'aria-hidden': 'true' }, '\u00B7'),
      h('span', { class: 'version-tag' }, `v${manifestVersion}`),
    ),
    h('div', { class: 'footer-author' }, 'Made by Hardik Gupta'),
  );
  container.appendChild(footer);

  // Staggered reveal motion with IntersectionObserver
  const revealItems = container.querySelectorAll<HTMLElement>('.reveal-item');
  if (prefersReducedMotion || typeof IntersectionObserver === 'undefined') {
    revealItems.forEach((el) => el.classList.add('is-revealed'));
  } else {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-revealed');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -20px 0px' },
    );
    revealItems.forEach((el) => observer.observe(el));
  }

  // Handle URL hash navigation (e.g. #whats-new)
  if (window.location.hash) {
    const targetEl = document.querySelector(window.location.hash);
    if (targetEl) {
      window.setTimeout(() => {
        targetEl.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }

  return () => {
    isDemoDestroyed = true;
    unsubSettings();
    unsubOnboarding();
    if (cleanupCurrentDemo) {
      cleanupCurrentDemo();
    }
    if (demoTimerId !== null) {
      window.clearTimeout(demoTimerId);
    }
    if (typingTimerId !== null) {
      window.clearTimeout(typingTimerId);
    }
  };
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initWelcomePage();
    });
  } else {
    initWelcomePage();
  }
}

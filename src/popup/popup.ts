import './popup.css';
import { loadSettings, saveSettings, onSettingsChange, Settings } from '../shared/settings';
import { SYSTEM_INSTRUCTION } from '../shared/systemInstruction';

document.addEventListener('DOMContentLoaded', () => {
  const statusLine = document.getElementById('status-line');
  const copyBtn = document.getElementById('copy-btn') as HTMLButtonElement | null;
  const textarea = document.getElementById('system-instruction') as HTMLTextAreaElement | null;
  const toggleRender = document.getElementById('toggle-render') as HTMLInputElement | null;
  const toggleAutoInject = document.getElementById('toggle-autoinject') as HTMLInputElement | null;
  const themeSelect = document.getElementById('theme-select') as HTMLSelectElement | null;
  const logoImg = document.getElementById('logo-img') as HTMLImageElement | null;
  const logoSource = document.getElementById('logo-source') as HTMLSourceElement | null;

  if (textarea) {
    textarea.value = SYSTEM_INSTRUCTION;
  }

  const setupGeminiBtn = document.getElementById('setup-gemini-btn') as HTMLButtonElement | null;
  const setupGeminiStatus = document.getElementById('setup-gemini-status');
  const setupGrokBtn = document.getElementById('setup-grok-btn') as HTMLButtonElement | null;
  const setupGrokStatus = document.getElementById('setup-grok-status');

  function renderSetupStatus(el: HTMLElement | null, data?: { status: string }): void {
    if (!el) return;
    if (!data) {
      el.textContent = '';
      el.className = 'setup-status';
      return;
    }
    if (data.status === 'added') {
      el.textContent = '✓ Added';
      el.className = 'setup-status status-success';
    } else if (data.status === 'already') {
      el.textContent = '✓ Already set up';
      el.className = 'setup-status status-success';
    } else if (data.status === 'failed') {
      el.textContent = "Couldn't do it, use Copy";
      el.className = 'setup-status status-error';
    }
  }

  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    chrome.storage.local.get(['gemini_setup_status', 'grok_setup_status'], (items) => {
      renderSetupStatus(setupGeminiStatus, items.gemini_setup_status as { status: string } | undefined);
      renderSetupStatus(setupGrokStatus, items.grok_setup_status as { status: string } | undefined);
    });

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local') {
        if (changes.gemini_setup_status) {
          renderSetupStatus(setupGeminiStatus, changes.gemini_setup_status.newValue as { status: string } | undefined);
        }
        if (changes.grok_setup_status) {
          renderSetupStatus(setupGrokStatus, changes.grok_setup_status.newValue as { status: string } | undefined);
        }
      }
    });
  }

  if (setupGeminiBtn) {
    setupGeminiBtn.addEventListener('click', () => {
      if (setupGeminiStatus) {
        setupGeminiStatus.textContent = 'Opening...';
        setupGeminiStatus.className = 'setup-status';
      }
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage({ type: 'START_AUTO_SETUP', site: 'gemini' });
      }
    });
  }

  if (setupGrokBtn) {
    setupGrokBtn.addEventListener('click', () => {
      if (setupGrokStatus) {
        setupGrokStatus.textContent = 'Opening...';
        setupGrokStatus.className = 'setup-status';
      }
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage({ type: 'START_AUTO_SETUP', site: 'grok' });
      }
    });
  }

  let copyTimeoutId: number | null = null;
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(SYSTEM_INSTRUCTION);
        copyBtn.textContent = 'Copied ✓';
        if (copyTimeoutId !== null) {
          window.clearTimeout(copyTimeoutId);
        }
        copyTimeoutId = window.setTimeout(() => {
          copyBtn.textContent = 'Copy';
          copyTimeoutId = null;
        }, 1500);
      } catch (err) {
        console.error('Failed to copy system instruction:', err);
      }
    });
  }

  if (statusLine) {
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
      try {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          const tab = tabs && tabs[0];
          const url = tab?.url || '';
          if (url.includes('gemini.google.com') || url.includes('grok.com')) {
            statusLine.textContent = 'Active on this tab ✓';
            statusLine.className = 'status-line status-active';
          } else {
            statusLine.textContent = 'Open Gemini or Grok to use';
            statusLine.className = 'status-line status-muted';
          }
        });
      } catch {
        statusLine.textContent = 'Open Gemini or Grok to use';
        statusLine.className = 'status-line status-muted';
      }
    } else {
      statusLine.textContent = 'Open Gemini or Grok to use';
      statusLine.className = 'status-line status-muted';
    }
  }

  function applySettingsToUI(s: Settings): void {
    if (toggleRender) {
      toggleRender.checked = s.renderEnabled;
    }
    if (toggleAutoInject) {
      toggleAutoInject.checked = s.autoInject;
    }
    if (themeSelect) {
      themeSelect.value = s.theme;
    }
    if (s.theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
      if (logoImg) logoImg.src = '/brand/logo-horizontal-black.png';
      if (logoSource) logoSource.srcset = '/brand/logo-horizontal-black.png';
    } else if (s.theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      if (logoImg) logoImg.src = '/brand/logo-horizontal-white.png';
      if (logoSource) logoSource.srcset = '/brand/logo-horizontal-white.png';
    } else {
      document.documentElement.removeAttribute('data-theme');
      if (logoImg) logoImg.src = '/brand/logo-horizontal-black.png';
      if (logoSource) logoSource.srcset = '/brand/logo-horizontal-white.png';
    }
  }

  loadSettings().then(applySettingsToUI).catch(console.error);

  onSettingsChange(applySettingsToUI);

  if (toggleRender) {
    toggleRender.addEventListener('change', () => {
      saveSettings({ renderEnabled: toggleRender.checked }).catch(console.error);
    });
  }

  if (toggleAutoInject) {
    toggleAutoInject.addEventListener('change', () => {
      saveSettings({ autoInject: toggleAutoInject.checked }).catch(console.error);
    });
  }

  if (themeSelect) {
    themeSelect.addEventListener('change', () => {
      const theme = themeSelect.value as Settings['theme'];
      saveSettings({ theme }).catch(console.error);
      applySettingsToUI({
        renderEnabled: toggleRender?.checked ?? true,
        autoInject: toggleAutoInject?.checked ?? false,
        theme,
      });
    });
  }
});

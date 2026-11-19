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

  if (textarea) {
    textarea.value = SYSTEM_INSTRUCTION;
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
          if (url.startsWith('https://gemini.google.com/') || url.startsWith('https://grok.com/')) {
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
    } else if (s.theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
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
      if (theme === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
      } else if (theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
      } else {
        document.documentElement.removeAttribute('data-theme');
      }
    });
  }
});

import { loadSettings } from '../shared/settings';

async function init(): Promise<void> {
  try {
    const settings = await loadSettings();
    if (settings.renderEnabled) {
      console.log(`[IUI] content script loaded on ${window.location.hostname}`);
    }
  } catch (err) {
    console.error('[IUI] Initialization failed:', err);
  }
}

init();

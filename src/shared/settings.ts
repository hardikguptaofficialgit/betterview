export interface Settings {
  renderEnabled: boolean;
  autoInject: boolean;
  theme: 'auto' | 'light' | 'dark';
  watermark: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  renderEnabled: true,
  autoInject: false,
  theme: 'auto',
  watermark: true,
};

export function loadSettings(): Promise<Settings> {
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.sync) {
      resolve({ ...DEFAULT_SETTINGS });
      return;
    }
    chrome.storage.sync.get({ ...DEFAULT_SETTINGS } as Record<string, unknown>, (items) => {
      if (chrome.runtime?.lastError) {
        resolve({ ...DEFAULT_SETTINGS });
        return;
      }
      resolve({
        renderEnabled: typeof items.renderEnabled === 'boolean' ? items.renderEnabled : DEFAULT_SETTINGS.renderEnabled,
        autoInject: typeof items.autoInject === 'boolean' ? items.autoInject : DEFAULT_SETTINGS.autoInject,
        theme: items.theme === 'light' || items.theme === 'dark' || items.theme === 'auto' ? items.theme : DEFAULT_SETTINGS.theme,
        watermark: typeof items.watermark === 'boolean' ? items.watermark : DEFAULT_SETTINGS.watermark,
      });
    });
  });
}

export function saveSettings(p: Partial<Settings>): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.sync) {
      resolve();
      return;
    }
    chrome.storage.sync.set(p, () => {
      if (chrome.runtime?.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

export function onSettingsChange(cb: (s: Settings) => void): () => void {
  if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.onChanged) {
    return () => {};
  }
  const listener = (_changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
    if (areaName === 'sync') {
      loadSettings().then(cb).catch(() => {});
    }
  };
  chrome.storage.onChanged.addListener(listener);
  return () => {
    chrome.storage.onChanged.removeListener(listener);
  };
}

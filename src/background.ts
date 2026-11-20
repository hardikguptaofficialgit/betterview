export function handleInstalled(details: { reason: string; previousVersion?: string }): void {
  if (details.reason === 'install') {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.set({ pendingTour: true });
    }
    if (typeof chrome !== 'undefined' && chrome.tabs?.query) {
      chrome.tabs.query({}, (tabs) => {
        const hasSiteTab = tabs.some(
          (t) =>
            t.url &&
            (t.url.includes('gemini.google.com') || t.url.includes('grok.com')),
        );
        if (!hasSiteTab && chrome.tabs.create) {
          chrome.tabs.create({ url: 'https://gemini.google.com/app' });
        }
      });
    } else if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
      chrome.tabs.create({ url: 'https://gemini.google.com/app' });
    }
  } else if (details.reason === 'update') {
    const version =
      (typeof chrome !== 'undefined' && chrome.runtime?.getManifest?.()?.version) || '0.1.0';
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.set({
        pendingUpdateModal: true,
        lastSeenVersion: details.previousVersion || version,
        hasUpdateDot: true,
      });
    }
    if (typeof chrome !== 'undefined' && chrome.action?.setBadgeText) {
      chrome.action.setBadgeText({ text: '\u2022' });
      if (chrome.action.setBadgeBackgroundColor) {
        chrome.action.setBadgeBackgroundColor({ color: '#1E6B48' });
      }
    }
  }
}

if (typeof chrome !== 'undefined' && chrome.runtime?.onInstalled) {
  chrome.runtime.onInstalled.addListener(handleInstalled);
}

if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message && message.type === 'START_AUTO_SETUP') {
      const site = message.site;
      const url =
        site === 'gemini'
          ? 'https://gemini.google.com/saved-info#betterview-setup'
          : 'https://grok.com/?_s=personality#betterview-setup';
      if (typeof chrome.tabs !== 'undefined' && chrome.tabs.create) {
        chrome.tabs.create({ url });
      }
      sendResponse({ ok: true });
      return true;
    }
  });
}

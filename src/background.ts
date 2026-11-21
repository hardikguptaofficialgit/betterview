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

export function handleMessage(
  message: { type?: string; site?: string },
  _sender?: unknown,
  sendResponse?: (response?: unknown) => void,
): boolean | void {
  if (message && message.type === 'START_AUTO_SETUP') {
    const site = message.site;
    if (site !== 'gemini' && site !== 'grok') {
      sendResponse?.({ ok: false, error: 'Unsupported setup target' });
      return;
    }
    const url =
      site === 'gemini'
        ? 'https://gemini.google.com/saved-info'
        : 'https://grok.com/#betterview-setup';
    const openSetupTab = () => {
      if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
        chrome.tabs.create({ url }, (tab) => sendResponse?.({ ok: true, tabId: tab?.id }));
      } else {
        sendResponse?.({ ok: false, error: 'Could not open setup tab' });
      }
    };
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      // Do not let the new tab race the storage marker; the content script
      // checks both this marker and the URL hash when it starts.
      chrome.storage.local.set({ pendingSetup: { site, ts: Date.now() } }, openSetupTab);
    } else {
      openSetupTab();
    }
    return true;
  }
}

if (typeof chrome !== 'undefined' && chrome.runtime?.onInstalled) {
  chrome.runtime.onInstalled.addListener(handleInstalled);
}

if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener(handleMessage);
}

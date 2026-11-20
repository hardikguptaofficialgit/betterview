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

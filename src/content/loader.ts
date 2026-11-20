(async () => {
  await import(chrome.runtime.getURL('content-main.js'));
})().catch((e) => console.error('[BetterView] load failed', e));

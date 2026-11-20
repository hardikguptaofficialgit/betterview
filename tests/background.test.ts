import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleInstalled } from '../src/background';

describe('Background onInstalled handler', () => {
  let localStore: Record<string, unknown> = {};
  let createdTabs: Array<{ url: string }> = [];
  let badgeText = '';
  let badgeBgColor = '';

  beforeEach(() => {
    localStore = {};
    createdTabs = [];
    badgeText = '';
    badgeBgColor = '';

    (globalThis as unknown as { chrome: unknown }).chrome = {
      storage: {
        local: {
          set: vi.fn((data: Record<string, unknown>, cb?: () => void) => {
            Object.assign(localStore, data);
            cb?.();
          }),
        },
      },
      tabs: {
        create: vi.fn((opt: { url: string }) => {
          createdTabs.push(opt);
        }),
      },
      action: {
        setBadgeText: vi.fn((opt: { text: string }) => {
          badgeText = opt.text;
        }),
        setBadgeBackgroundColor: vi.fn((opt: { color: string }) => {
          badgeBgColor = opt.color;
        }),
      },
      runtime: {
        getURL: vi.fn((path: string) => `chrome-extension://dummy-id/${path}`),
        getManifest: vi.fn(() => ({ version: '0.1.0' })),
      },
    };
  });

  it('opens welcome.html in a new tab when reason is install', () => {
    handleInstalled({ reason: 'install' });

    expect(chrome.tabs.create).toHaveBeenCalledWith({
      url: 'chrome-extension://dummy-id/welcome.html',
    });
    expect(localStore.hasUpdateDot).toBeUndefined();
    expect(badgeText).toBe('');
  });

  it('stores lastSeenVersion and sets badge dot when reason is update', () => {
    handleInstalled({ reason: 'update', previousVersion: '0.0.9' });

    expect(chrome.tabs.create).not.toHaveBeenCalled();
    expect(localStore.lastSeenVersion).toBe('0.0.9');
    expect(localStore.hasUpdateDot).toBe(true);
    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: '\u2022' });
    expect(chrome.action.setBadgeBackgroundColor).toHaveBeenCalledWith({ color: '#1E6B48' });
  });

  it('uses manifest version as fallback if previousVersion is omitted on update', () => {
    handleInstalled({ reason: 'update' });

    expect(localStore.lastSeenVersion).toBe('0.1.0');
    expect(localStore.hasUpdateDot).toBe(true);
    expect(badgeText).toBe('\u2022');
  });

  it('ignores other install reasons without side-effects', () => {
    handleInstalled({ reason: 'chrome_update' });

    expect(chrome.tabs.create).not.toHaveBeenCalled();
    expect(badgeText).toBe('');
    expect(Object.keys(localStore).length).toBe(0);
  });
});

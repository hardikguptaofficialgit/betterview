// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  loadOnboardingProgress,
  saveOnboardingProgress,
  isOnboardingComplete,
  onOnboardingProgressChange,
  ONBOARDING_STORAGE_KEY,
} from '../src/welcome/onboarding';

describe('Onboarding progress state', () => {
  let localStore: Record<string, unknown> = {};
  let listeners: Array<(changes: Record<string, { newValue?: unknown }>, area: string) => void> = [];

  beforeEach(() => {
    localStore = {};
    listeners = [];

    (globalThis as unknown as { chrome: unknown }).chrome = {
      storage: {
        local: {
          get: vi.fn((keys: string[], cb: (res: Record<string, unknown>) => void) => {
            const res: Record<string, unknown> = {};
            for (const k of keys) {
              if (k in localStore) res[k] = localStore[k];
            }
            cb(res);
          }),
          set: vi.fn((data: Record<string, unknown>, cb?: () => void) => {
            Object.assign(localStore, data);
            for (const listener of listeners) {
              const changes: Record<string, { newValue?: unknown }> = {};
              for (const [k, v] of Object.entries(data)) {
                changes[k] = { newValue: v };
              }
              listener(changes, 'local');
            }
            cb?.();
          }),
        },
        onChanged: {
          addListener: vi.fn((fn: (changes: Record<string, { newValue?: unknown }>, area: string) => void) => {
            listeners.push(fn);
          }),
          removeListener: vi.fn((fn: (changes: Record<string, { newValue?: unknown }>, area: string) => void) => {
            listeners = listeners.filter((l) => l !== fn);
          }),
        },
      },
    };
  });

  it('loads default progress as false for step1 and step2', async () => {
    const progress = await loadOnboardingProgress();
    expect(progress).toEqual({ step1: false, step2: false });
    expect(isOnboardingComplete(progress)).toBe(false);
  });

  it('marks step1 true automatically when gemini is configured', async () => {
    localStore.gemini_setup_status = { status: 'added' };
    const progress = await loadOnboardingProgress();
    expect(progress.step1).toBe(true);
    expect(progress.step2).toBe(false);
    expect(isOnboardingComplete(progress)).toBe(false);
  });

  it('marks step1 true automatically when grok is configured', async () => {
    localStore.grok_setup_status = { status: 'already' };
    const progress = await loadOnboardingProgress();
    expect(progress.step1).toBe(true);
    expect(progress.step2).toBe(false);
  });

  it('saves and loads step updates', async () => {
    await saveOnboardingProgress({ step2: true });
    expect(localStore[ONBOARDING_STORAGE_KEY]).toEqual({ step1: false, step2: true });

    let progress = await loadOnboardingProgress();
    expect(progress.step2).toBe(true);
    expect(progress.step1).toBe(false);
    expect(isOnboardingComplete(progress)).toBe(false);

    await saveOnboardingProgress({ step1: true });
    progress = await loadOnboardingProgress();
    expect(progress.step1).toBe(true);
    expect(progress.step2).toBe(true);
    expect(isOnboardingComplete(progress)).toBe(true);
  });

  it('notifies listeners when onboarding state changes in storage', async () => {
    const callback = vi.fn();
    const unsub = onOnboardingProgressChange(callback);

    await saveOnboardingProgress({ step1: true });
    // await macro tasks
    await new Promise((r) => setTimeout(r, 10));

    expect(callback).toHaveBeenCalledWith(expect.objectContaining({ step1: true }));
    unsub();
  });
});

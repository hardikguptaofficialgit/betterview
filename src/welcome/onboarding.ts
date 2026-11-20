export interface OnboardingProgress {
  step1: boolean;
  step2: boolean;
}

export const ONBOARDING_STORAGE_KEY = 'betterview_onboarding_progress';

export function getInitialOnboardingProgress(): OnboardingProgress {
  return {
    step1: false,
    step2: false,
  };
}

export async function loadOnboardingProgress(): Promise<OnboardingProgress> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return getInitialOnboardingProgress();
  }

  return new Promise((resolve) => {
    chrome.storage.local.get([ONBOARDING_STORAGE_KEY, 'gemini_setup_status', 'grok_setup_status'], (items) => {
      const saved = items[ONBOARDING_STORAGE_KEY] as Partial<OnboardingProgress> | undefined;
      const gemini = items.gemini_setup_status as { status: string } | undefined;
      const grok = items.grok_setup_status as { status: string } | undefined;

      const autoStep1 = Boolean(
        gemini?.status === 'added' ||
        gemini?.status === 'already' ||
        grok?.status === 'added' ||
        grok?.status === 'already',
      );

      resolve({
        step1: Boolean(saved?.step1 || autoStep1),
        step2: Boolean(saved?.step2),
      });
    });
  });
}

export async function saveOnboardingProgress(
  update: Partial<OnboardingProgress>,
): Promise<OnboardingProgress> {
  const current = await loadOnboardingProgress();
  const next: OnboardingProgress = {
    ...current,
    ...update,
  };

  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    await new Promise<void>((resolve) => {
      chrome.storage.local.set({ [ONBOARDING_STORAGE_KEY]: next }, () => resolve());
    });
  }

  return next;
}

export function isOnboardingComplete(progress: OnboardingProgress): boolean {
  return Boolean(progress.step1 && progress.step2);
}

export function onOnboardingProgressChange(cb: (progress: OnboardingProgress) => void): () => void {
  if (typeof chrome === 'undefined' || !chrome.storage?.onChanged) {
    return () => {};
  }

  const listener = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
    if (areaName === 'local') {
      if (changes[ONBOARDING_STORAGE_KEY] || changes.gemini_setup_status || changes.grok_setup_status) {
        loadOnboardingProgress().then(cb).catch(console.error);
      }
    }
  };

  chrome.storage.onChanged.addListener(listener);
  return () => {
    chrome.storage.onChanged.removeListener(listener);
  };
}

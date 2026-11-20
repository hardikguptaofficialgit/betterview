export const TOTAL_TOUR_STEPS = 4;

export function getNextStep(current: number, total = TOTAL_TOUR_STEPS): number {
  return Math.min(current + 1, total - 1);
}

export function getPrevStep(current: number): number {
  return Math.max(current - 1, 0);
}

export function clampStep(step: number, total = TOTAL_TOUR_STEPS): number {
  return Math.max(0, Math.min(step, total - 1));
}

export function shouldShowTour(storage: {
  pendingTour?: boolean;
  tourSeen?: boolean;
}): boolean {
  return Boolean(storage.pendingTour && !storage.tourSeen);
}

export function shouldShowUpdateModal(storage: {
  pendingUpdateModal?: boolean;
  updateModalSeen?: boolean;
}): boolean {
  return Boolean(storage.pendingUpdateModal && !storage.updateModalSeen);
}

export function canOpenTourOnTab(url?: string): boolean {
  if (!url) return false;
  return url.includes('gemini.google.com') || url.includes('grok.com');
}

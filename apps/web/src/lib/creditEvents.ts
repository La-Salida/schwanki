export const CREDITS_CHANGED = "schwanki:credits-changed";
export function notifyCreditsChanged(): void { window.dispatchEvent(new Event(CREDITS_CHANGED)); }

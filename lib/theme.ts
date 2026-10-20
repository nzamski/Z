// Theme: light, dark, or the system setting (default). Per browser (localStorage). The inline
// script in the root layout sets <html data-theme> before first paint and, on "system", follows
// OS changes; without JS there is no data-theme and the CSS falls back to prefers-color-scheme.
export const THEMES = ["system", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];
export const THEME_KEY = "z-theme";

// Kept tiny and dependency-free: it runs as an inline <script> in <head>.
export const themeScript = `(function(){var d=document.documentElement,m=matchMedia("(prefers-color-scheme: dark)");function a(){var t;try{t=localStorage.getItem("${THEME_KEY}")}catch(e){}d.dataset.theme=t==="light"||t==="dark"?t:m.matches?"dark":"light"}a();m.addEventListener("change",a);window.__zApplyTheme=a})();`;

export function readTheme(): Theme {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

// A tiny external store for useSyncExternalStore: this tab's changes, and other tabs' (storage).
const listeners = new Set<() => void>();

export function subscribeTheme(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== THEME_KEY) return;
    (window as { __zApplyTheme?: () => void }).__zApplyTheme?.();
    cb();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function setTheme(t: Theme) {
  try {
    if (t === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, t);
  } catch {}
  (window as { __zApplyTheme?: () => void }).__zApplyTheme?.();
  for (const cb of listeners) cb();
}

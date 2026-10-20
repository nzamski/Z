// Desktop (Chrome) notifications while Z is open in a tab (docs/notifications.md). Web push is out:
// it needs the browser vendor's push service, which the air-gapped network can't reach.
// Opt-in per browser: the permission, plus our own switch so it can be turned off again.
const KEY = "z-desktop-notifications";

export const desktopSupported = () => typeof window !== "undefined" && "Notification" in window;

export function desktopEnabled() {
  if (!desktopSupported() || Notification.permission !== "granted") return false;
  try {
    return localStorage.getItem(KEY) === "on";
  } catch {
    return false;
  }
}

export function setDesktopEnabled(on: boolean) {
  try {
    if (on) localStorage.setItem(KEY, "on");
    else localStorage.removeItem(KEY);
  } catch {}
}

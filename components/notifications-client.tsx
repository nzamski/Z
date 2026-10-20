"use client";
// Client parts of /notifications: mark read on view, and the desktop-notifications switch.
import { useEffect, useState, useSyncExternalStore } from "react";
import { markNotificationsReadAction } from "@/app/actions";
import { READ_EVENT } from "@/components/notification-bell";
import { desktopEnabled, desktopSupported, setDesktopEnabled } from "@/lib/desktop-notifications";
import { he } from "@/lib/i18n/he";

/** Marks everything up to the newest shown notification read, once, and clears the bell. */
export function MarkRead({ upTo }: { upTo: string }) {
  useEffect(() => {
    markNotificationsReadAction(upTo).then(() => window.dispatchEvent(new Event(READ_EVENT)));
  }, [upTo]);
  return null;
}

type State = "unsupported" | "denied" | "on" | "off";
const T = he.notifications;

function current(): State {
  if (!desktopSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  return desktopEnabled() ? "on" : "off";
}

export function DesktopToggle() {
  const [, rerender] = useState(0);
  // Browser-only state: the server (and hydration) render nothing until mounted.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  if (!mounted) return null;
  const state = current();
  const toggle = async () => {
    const p =
      state === "on"
        ? "off"
        : Notification.permission === "granted"
          ? "granted"
          : await Notification.requestPermission();
    setDesktopEnabled(p === "granted");
    rerender((n) => n + 1);
  };
  const hint =
    state === "unsupported"
      ? T.desktopUnsupported
      : state === "denied"
        ? T.desktopDenied
        : T.desktopHint;
  return (
    <div className="flex items-center justify-between gap-4 border-b border-neutral-200 px-4 py-3 text-start text-sm dark:border-neutral-800">
      <div className="min-w-0">
        <div id="desktop-label" className="font-medium">
          {T.desktop}
        </div>
        <div className="text-xs text-muted">{hint}</div>
      </div>
      {/* The thumb starts at the inline start and slides to the end; RTL flips the direction. */}
      <button
        role="switch"
        aria-checked={state === "on"}
        aria-labelledby="desktop-label"
        disabled={state === "unsupported" || state === "denied"}
        onClick={toggle}
        className="group relative h-6 w-11 shrink-0 rounded-full bg-neutral-300 transition-colors aria-checked:bg-sky-600 disabled:opacity-50 dark:bg-neutral-700"
      >
        <span className="absolute start-0.5 top-0.5 size-5 rounded-full bg-white shadow transition-transform group-aria-checked:translate-x-5 rtl:group-aria-checked:-translate-x-5" />
      </button>
    </div>
  );
}

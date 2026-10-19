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
  const enable = async () => {
    const p =
      Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    setDesktopEnabled(p === "granted");
    rerender((n) => n + 1);
  };
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-neutral-200 px-4 py-3 text-start text-sm dark:border-neutral-800">
      <span className="font-medium">{T.desktop}:</span>
      {state === "unsupported" && <span className="text-muted">{T.desktopUnsupported}</span>}
      {state === "denied" && <span className="text-muted">{T.desktopDenied}</span>}
      {(state === "on" || state === "off") && (
        <>
          <span className="text-muted">{state === "on" ? T.desktopOn : T.desktopOff}</span>
          <button
            onClick={() => {
              if (state === "on") {
                setDesktopEnabled(false);
                rerender((n) => n + 1);
              } else enable();
            }}
            className="rounded-full border border-neutral-400 px-3 py-1 font-medium transition-colors hover:bg-neutral-500/10"
          >
            {state === "on" ? T.desktopDisable : T.desktopEnable}
          </button>
          <span className="w-full text-xs text-muted">{T.desktopHint}</span>
        </>
      )}
    </div>
  );
}

// Grouping for the notifications page (pure; docs/notifications.md): likes on the same post or
// comment, and new followers, collapse into one entry with the newest first.
import type { NotificationRow } from "@/lib/services";

export type NotificationItem = NotificationRow & {
  actors: { handle: string; displayName: string }[]; // newest first, unique
  count: number; // notifications in the group
};

const GROUPED = new Set(["like_post", "like_comment", "follow"]);

export function groupNotifications(rows: NotificationRow[]): NotificationItem[] {
  const out: NotificationItem[] = [];
  const groups = new Map<string, NotificationItem>();
  for (const r of rows) {
    const key = GROUPED.has(r.type) ? `${r.type}:${r.commentId ?? r.postId ?? ""}` : null;
    const g = key ? groups.get(key) : undefined;
    if (g) {
      g.count++;
      g.unread ||= r.unread;
      if (r.actor && !g.actors.some((a) => a.handle === r.actor!.handle)) g.actors.push(r.actor);
      continue;
    }
    const item = { ...r, actors: r.actor ? [r.actor] : [], count: 1 };
    out.push(item);
    if (key) groups.set(key, item);
  }
  return out;
}

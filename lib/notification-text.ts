// What a notification says, and where it leads (docs/notifications.md). Shared by the inbox page
// and desktop notifications; no DB imports.
import { he } from "@/lib/i18n/he";
import type { NotificationItem } from "@/lib/notifications";

const T = he.notifications;

function who(n: NotificationItem) {
  const [first, second] = n.actors.map((a) => a.displayName);
  if (!first) return T.someone;
  if (n.actors.length === 1) return first;
  if (n.actors.length === 2) return T.two(first, second);
  return T.many(first, n.actors.length - 1);
}

export function notificationText(n: NotificationItem): string {
  const many = n.actors.length > 1;
  switch (n.type) {
    case "comment":
      return T.comment(who(n));
    case "reply":
      return T.reply(who(n));
    case "author_liked":
      return T.authorLiked(who(n));
    case "like_post":
      return many ? T.likePostMany(who(n)) : T.likePost(who(n));
    case "like_comment":
      return many ? T.likeCommentMany(who(n)) : T.likeComment(who(n));
    case "follow":
      return many ? T.followMany(who(n)) : T.follow(who(n));
    case "mention_post":
      return T.mentionPost(who(n));
    case "mention_comment":
      return T.mentionComment(who(n));
    case "removed_post":
      return T.removedPost;
    case "removed_comment":
      return T.removedComment;
    case "restored_post":
      return T.restoredPost;
    case "restored_comment":
      return T.restoredComment;
    case "report":
      return n.commentId ? T.reportComment(who(n)) : T.reportPost(who(n));
    case "poll_ended":
      return n.actors.length ? T.pollEnded(who(n)) : T.yourPollEnded; // no actor: your own
  }
}

/** The text the notification is about (a comment, or the post's preview), if any. */
export function notificationSnippet(n: NotificationItem) {
  if (n.type === "follow") return null;
  return n.commentId ? n.commentBody : n.postPreview;
}

export function notificationHref(n: NotificationItem) {
  if (n.type === "follow") return n.actors[0] ? `/u/${n.actors[0].handle}` : "/";
  if (n.type === "report") return "/admin#reports";
  if (n.commentId && n.postId) return `/p/${n.postId}#c-${n.commentId}`;
  return n.postId ? `/p/${n.postId}` : "/notifications";
}

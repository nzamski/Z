# Notifications

Added 2026-10-19 at the user's request. Code: writes and reads in `lib/services.ts` (sections
"notification writes" and "notifications: reads"), grouping `lib/notifications.ts`, wording
`lib/notification-text.ts`, bell `components/notification-bell.tsx`, page
`app/notifications/page.tsx`, poll `app/api/notifications/route.ts`, mentions `lib/mentions.ts` +
`lib/markdown.ts`, autocomplete `components/mention-suggest.tsx`, desktop alerts
`lib/desktop-notifications.ts`. Table: `drizzle/0015_notifications.sql`.

## What notifies whom

| Event                                       | Recipient            | Type                                                                |
| ------------------------------------------- | -------------------- | ------------------------------------------------------------------- |
| Top-level comment on a post                 | the post's author    | `comment`                                                           |
| Reply to a comment                          | the comment's author | `reply`                                                             |
| The post's author likes your comment        | the comment's author | `author_liked` (instead of `like_comment`)                          |
| Like on a post / comment                    | its author           | `like_post` / `like_comment`                                        |
| Follow                                      | the followed user    | `follow`                                                            |
| `@handle` in a post / comment               | the mentioned user   | `mention_post` / `mention_comment`                                  |
| A moderator removes / restores your content | its author           | `removed_*` / `restored_*` (with the reason; the admin isn't named) |

- Never for your own actions. A comment that both answers your post and mentions you notifies once.
- Each notification is written in the same transaction as its action. Undoing the action
  (unlike, unfollow) soft-deletes it; deleting a post or comment hides its notifications, and
  restoring it brings them back. Moderation notices always show.
- Mentions: at most 10 people per post or comment; an edit (within the post's hour) notifies only
  people who weren't mentioned before. Not inside code or links, not in e-mail addresses.
  `@handle` renders as a link to the profile.

## Seeing them

- **Bell** in the header with the unread count (capped at 100, shown as "99+"). It asks
  `/api/notifications` every 60 s and when the tab becomes visible.
- **`/notifications`**: newest first, 100 per page. Likes on the same post/comment and new
  followers collapse into one entry ("Dana and 3 others liked your post"). Opening the page marks
  everything up to the newest shown entry read; the entries stay highlighted for that visit.
- **Desktop (Chrome) notifications**: opt-in on `/notifications` (asks the browser's permission).
  While Z is open in a tab that isn't in front, a new notification also pops up on the desktop;
  clicking it opens the item. Per browser (localStorage).
  There is no notification when no Z tab is open: real web push goes through the browser
  vendor's push service (Google's, for Chrome), which the air-gapped network can't reach.
- **Autocomplete**: typing `@` and a letter in the composer suggests people (people search,
  including fuzzy matches); ↑/↓, Enter or Tab, Esc.

## Not done

- Per-type settings, muting a thread, e-mail or chat digests.
- The unread count for someone with thousands of unread notifications takes ~20 ms (`seed:large`
  worst case: the bitmap scan reads them all before the limit); fine at one poll a minute.

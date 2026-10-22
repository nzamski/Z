# Saved, liked and replies

Added 2026-10-22.

- **Bookmarks** (`bookmarks` table, migration 0021): save any post or comment for yourself. The
  bookmark button sits at the far end of a post's or comment's action row. Private: nobody else
  sees what you saved, and saving notifies no one. One active row per person and post/comment;
  unsaving soft-deletes it (`setBookmark`).
- **`/saved`** (rail: שמורים; phones: the account menu): two tabs, saved (most recently saved
  first) and liked (posts and comments you liked, most recently liked first). Deleted or removed
  content drops out. 30 per page, "more" is a plain `?cursor=` link (`savedPage`, `likedPage`).
- **Profile tabs**: posts (the feed, pinned on top) and replies (`?tab=replies`, `repliesPage`):
  the user's comments, newest first.
- Comments outside their thread use `CommentCard` (`components/comment-card.tsx`): whom it
  answers (linking to the post), the body, like and save; the card opens `/c/<id>`.

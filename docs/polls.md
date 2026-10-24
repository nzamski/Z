# Polls

X-style polls on posts (added 2026-10-21). The post's text is the question.

- **Creating:** the poll button in the new-post composer (home and the "new post" popup, not comments
  or edits) adds 2–4 options (`POLL_OPTIONS_MAX`, up to `POLL_OPTION_MAX` characters each, no
  duplicates; blank fields are dropped) and a duration in days, hours and minutes, from 5 minutes to 7 days (`POLL_MINUTES`,
  `lib/limits.ts`; default one day).
- **Storage:** `posts.poll_options` (text[]) and `posts.poll_ends_at`, both null without a poll
  (`posts_poll_ck`). Votes are rows in `poll_votes` (`option` = the option's index), one active vote
  per person per post (`poll_votes_active_uq`). Editing a post keeps its poll.
- **Voting:** `votePoll` (`lib/services.ts`): final, one per person (a second vote is ignored),
  only while `poll_ends_at > now()` on the database's clock (else `poll_closed`), not on deleted or
  removed posts. Authors don't vote on their own polls.
- **Reading:** `postCols` returns `poll` as one JSON value: options, counts per option, `mine` (the
  viewer's option or null), `open` and `endsAt`. The card (`components/poll.tsx`) shows buttons until
  you vote, and results with percentages after you vote, when the poll ends, or to its author. A vote
  shows at once (`useOptimistic`), then the refresh brings the real counts.
- **Ranking:** For You boosts polls the viewer can still vote in (open at the feed's snapshot, not
  theirs, no vote of theirs from before the snapshot): ×1.5, or ×2 in the last 6 hours
  (`pollBoost`, `pollEndingSoonBoost`, `pollEndingSoonHours` in `RANKING`; docs/ranking.md). A vote
  cast while scrolling doesn't change the score until the next snapshot, so pages stay stable.

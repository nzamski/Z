# Topics (#tags)

Added 2026-10-21 at the user's request. Code: rules `lib/tags.ts`, links in posts `lib/markdown.ts`
(a shared link rule with @mentions), filing and queries `lib/services.ts` (section "topics", plus
`setPostTags`, `taggedWith`, `followsTopic`), pages `app/t/[tag]/page.tsx` and
`app/topics/page.tsx`, autocomplete `components/mention-suggest.tsx`. Tables:
`drizzle/0016_topics.sql`.

## What a tag is

`#` then a letter (Hebrew or Latin), then letters, digits, `_` and single inner `-`s, up to 30
characters (`TAG_MAX`). Not after a letter, digit, `#`, `&` or `/` (so not `page#section` or
`&#123;`), not `#123` (issue numbers), not inside code or links. One spelling per topic: tags are
lowercased and NFC-normalized (`#K8s` is `#k8s`). At most 10 per post (`TAGS_MAX`). Only posts are
filed under topics, not comments: topic pages and the feed are made of posts.

## How posts are filed

`post_tags (post_id, tag)` holds a post's topics, written in the post's transaction by
`setPostTags`: on create, and on every edit, where tags that left the body are soft-deleted and new
ones added (one active row per post and tag). A deleted or removed post keeps its rows, but every
read joins live posts, so it drops out of topic pages, counts and suggestions.

## Pages and reads

- `/t/<tag>`: the topic's posts, newest first or most liked (`?sort=top`, the old Top tab's order),
  with its post count and a follow button. An invalid tag in the URL is a plain message.
- `/topics` (account menu): the topics you follow and this week's popular ones, each with a follow
  button.
- Searching `#tag` goes to the topic page instead of a text search.
- The composer suggests existing topics after `#`, most used first.

## Following a topic

`topic_follows (user_id, tag)`, soft-deleted on unfollow. Posts under a topic you follow get
`topicBoost` (1.5) in For You, below `followBoost` (2.0) for people you follow; they don't stack.

## Later

Popular topics and who to follow in a sidebar beside the feed (decided 2026-10-21); topic follow
counts; merging two spellings of one topic (an admin action).

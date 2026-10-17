// Runs every feed/thread query once against the dev DB; pair with auto_explain to see plans.
// Usage: see docs/ranking.md ("Query plans").
import { sql as raw } from "@/db/client";
import { feedPage, getThread } from "@/lib/services";

const [viewer] = await raw<{ id: string }[]>`
  select follower_id id from follows where deleted_at is null
  group by 1 order by count(*) desc limit 1`;
const [busy] = await raw<{ id: string; author_id: string }[]>`
  select id, author_id from posts order by comment_count desc limit 1`;
for (const view of ["forYou", "following", "latest"] as const) {
  const p1 = await feedPage(viewer.id, { view });
  await feedPage(viewer.id, { view, cursor: p1.next });
}
await feedPage(viewer.id, { view: "latest", authorId: busy.author_id });
await getThread(busy.id, null);
await raw.end();

// The admins' usage dashboard (docs/stats.md): read-only aggregates computed on request from the
// tables themselves; the only data kept just for it is daily_visits (one row per user per day).
// Days are counted in STATS_TIMEZONE. Activity (posts, comments) counts what was written, deleted
// or not; likes count the ones still standing.
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { STATS_TIMEZONE } from "@/lib/limits";

export const STATS_DAYS = 30;
const TZ = STATS_TIMEZONE;

export type DayCount = { day: string; n: number }; // day: YYYY-MM-DD

export type UsageStats = Awaited<ReturnType<typeof usageStats>>;

// Fills the days with no rows, oldest first, ending today.
function series(rows: { day: string; n: number }[], today: string, days = STATS_DAYS): DayCount[] {
  const byDay = new Map(rows.map((r) => [r.day, r.n]));
  const end = new Date(`${today}T00:00:00Z`);
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(end.getTime() - (days - 1 - i) * 86_400_000).toISOString().slice(0, 10);
    return { day: d, n: byDay.get(d) ?? 0 };
  });
}

const one = async <T>(q: ReturnType<typeof sql>) =>
  (await db.execute<T & Record<string, unknown>>(q))[0];
const rows = async <T>(q: ReturnType<typeof sql>) =>
  (await db.execute<T & Record<string, unknown>>(q)) as unknown as T[];

export async function usageStats() {
  const local = sql`(now() at time zone ${TZ})`;
  // Midnight STATS_DAYS-1 days ago, local time, as a timestamptz.
  const since = sql`((date_trunc('day', ${local}) - make_interval(days => ${STATS_DAYS - 1}))
    at time zone ${TZ})`;
  const dayOf = (col: string) =>
    sql.raw(`to_char((${col} at time zone '${TZ}')::date, 'YYYY-MM-DD')`);

  const { today } = await one<{ today: string }>(
    sql`select to_char(${local}::date, 'YYYY-MM-DD') as today`,
  );

  const [people, active, visits, postsByDay, commentsByDay, likesByDay, newUsers] =
    await Promise.all([
      one<{ registered: number; onboarded: number }>(sql`
      select count(*)::int as registered, count(onboarded_at)::int as onboarded
      from users where deleted_at is null`),
      one<{ today: number; week: number; month: number }>(sql`
      select
        count(distinct user_id) filter (where day = ${local}::date)::int as today,
        count(distinct user_id) filter (where day > ${local}::date - 7)::int as week,
        count(distinct user_id) filter (where day > ${local}::date - 30)::int as month
      from daily_visits where deleted_at is null and day > ${local}::date - 30`),
      rows<DayCount>(sql`
      select to_char(day, 'YYYY-MM-DD') as day, count(*)::int as n from daily_visits
      where deleted_at is null and day > ${local}::date - ${STATS_DAYS}::int group by day`),
      rows<DayCount>(sql`
      select ${dayOf("created_at")} as day, count(*)::int as n from posts
      where created_at >= ${since} group by 1`),
      rows<DayCount>(sql`
      select ${dayOf("created_at")} as day, count(*)::int as n from comments
      where created_at >= ${since} group by 1`),
      rows<DayCount>(sql`
      select day, sum(n)::int as n from (
        select ${dayOf("created_at")} as day, count(*) as n from likes
          where created_at >= ${since} and deleted_at is null group by 1
        union all
        select ${dayOf("created_at")} as day, count(*) as n from comment_likes
          where created_at >= ${since} and deleted_at is null group by 1) x
      group by day`),
      // Finished the welcome, per week (Monday-based, local), the last 8 weeks.
      rows<{ week: string; n: number }>(sql`
      select to_char(date_trunc('week', onboarded_at at time zone ${TZ}), 'YYYY-MM-DD') as week,
        count(*)::int as n
      from users
      where deleted_at is null and onboarded_at >= ((date_trunc('week', ${local}) - interval '7 weeks')
        at time zone ${TZ})
      group by 1 order by 1`),
    ]);

  // Conversation: posts of the period that got a comment from someone else, how fast, and
  // question-like posts ("?") whose author liked an answer.
  const conversationQ = one<{
    posts: number;
    commented: number;
    median_minutes: number | null;
    questions: number;
    answered: number;
  }>(sql`
    with p as (
      select p.id, p.created_at, p.body like '%?%' as question,
        (select min(c.created_at) from comments c
          where c.post_id = p.id and c.author_id <> p.author_id and c.deleted_at is null) as first_reply,
        exists (select 1 from comments c where c.post_id = p.id and c.author_liked_at is not null
          and c.deleted_at is null) as answered
      from posts p where p.created_at >= ${since} and p.deleted_at is null)
    select count(*)::int as posts,
      count(first_reply)::int as commented,
      (percentile_cont(0.5) within group (order by extract(epoch from first_reply - created_at) / 60))::float8
        as median_minutes,
      count(*) filter (where question)::int as questions,
      count(*) filter (where question and answered)::int as answered
    from p`);

  // Who uses what, in the period: distinct people.
  const featuresQ = one<{
    polls: number;
    voters: number;
    topics: number;
    mentions: number;
    bookmarks: number;
    pins: number;
    answers: number;
    reports: number;
  }>(sql`
    select
      (select count(distinct author_id) from posts
        where poll_options is not null and created_at >= ${since})::int as polls,
      (select count(distinct user_id) from poll_votes where created_at >= ${since})::int as voters,
      (select count(distinct p.author_id) from post_tags t join posts p on p.id = t.post_id
        where t.created_at >= ${since})::int as topics,
      (select count(distinct actor_id) from notifications
        where type in ('mention_post', 'mention_comment') and created_at >= ${since})::int as mentions,
      (select count(distinct user_id) from bookmarks where created_at >= ${since})::int as bookmarks,
      (select count(distinct author_id) from posts where pinned_at >= ${since})::int as pins,
      (select count(distinct p.author_id) from comments c join posts p on p.id = c.post_id
        where c.author_liked_at >= ${since})::int as answers,
      (select count(distinct reporter_id) from reports where created_at >= ${since})::int as reports`);

  const topicsQ = rows<{ tag: string; posts: number }>(sql`
    select t.tag, count(*)::int as posts from post_tags t join posts p on p.id = t.post_id
    where t.deleted_at is null and p.deleted_at is null and p.created_at >= ${since}
    group by t.tag order by posts desc, t.tag limit 10`);

  // Top contributors: most posts + comments in the period (live ones), with the likes those got
  // and how many of their comments a post's author liked.
  const contributorsQ = rows<{
    handle: string;
    display_name: string;
    posts: number;
    comments: number;
    likes: number;
    answers: number;
  }>(sql`
    with w as (
      select author_id, 1 as post, 0 as comment, like_count as likes, 0 as answer from posts
        where created_at >= ${since} and deleted_at is null
      union all
      select author_id, 0, 1, like_count, (author_liked_at is not null)::int from comments
        where created_at >= ${since} and deleted_at is null)
    select u.handle, u.display_name, sum(post)::int as posts, sum(comment)::int as comments,
      sum(likes)::int as likes, sum(answer)::int as answers
    from w join users u on u.id = w.author_id
    where u.deleted_at is null and u.handle is not null
    group by u.id, u.handle, u.display_name
    order by sum(post) + sum(comment) desc, sum(likes) desc, u.handle
    limit 10`);

  const [conversation, features, topics, contributors] = await Promise.all([
    conversationQ,
    featuresQ,
    topicsQ,
    contributorsQ,
  ]);

  return {
    today,
    people,
    active,
    visits: series(visits, today),
    posts: series(postsByDay, today),
    comments: series(commentsByDay, today),
    likes: series(likesByDay, today),
    newUsers,
    conversation: {
      posts: conversation.posts,
      commented: conversation.commented,
      medianMinutes: conversation.median_minutes,
      questions: conversation.questions,
      answered: conversation.answered,
    },
    features,
    topics,
    contributors: contributors.map((c) => ({
      handle: c.handle,
      displayName: c.display_name,
      posts: c.posts,
      comments: c.comments,
      likes: c.likes,
      answers: c.answers,
    })),
  };
}

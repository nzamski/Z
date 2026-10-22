// Dev seed. All people and content are fictional.
//   npm run seed        ~12 users, ~60 posts
//   npm run seed:large  ~200 users, ~10k posts, deep and huge threads (perf checks only)
// Wipes the dev database first; refuses to run in production.
import { randomBytes } from "node:crypto";
import postgres from "postgres";
import { computePreview } from "../lib/preview";
import { RANKS, SERVICE_TYPES } from "../lib/service-info";

if (process.env.NODE_ENV === "production") throw new Error("seed is dev-only");
const large = process.argv.includes("--large");
const sql = postgres(process.env.DATABASE_URL!, { onnotice: () => {} });

// Deterministic PRNG so every run produces the same data (mulberry32).
let state = 42;
const rand = () => {
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const int = (n: number) => Math.floor(rand() * n);
const pick = <T,>(a: readonly T[]) => a[int(a.length)];
// Heavy-tailed count: most values small, a few large (likes, follows).
const pareto = (max: number, alpha = 1.3) =>
  Math.min(max, Math.floor(1 / Math.pow(1 - rand(), 1 / alpha)) - 1);

// UUIDv7 stamped with the row's own (backdated) created_at, so id order matches time order.
function uuidv7(ms: number) {
  const b = randomBytes(16);
  b.writeUIntBE(ms, 0, 6);
  b[6] = (b[6] & 0x0f) | 0x70;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = b.toString("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

const NOW = Date.now();
const HOUR = 3_600_000;

// ---------- content ----------

const FIRST = [
  "דנה",
  "יוסי",
  "נועה",
  "אורי",
  "מיכל",
  "עמית",
  "שירה",
  "איתי",
  "רותם",
  "גל",
  "טל",
  "ליאור",
  "הדס",
  "עידו",
  "מאיה",
  "רועי",
  "ענבל",
  "אלון",
  "יעל",
  "תומר",
];
const LAST = [
  "לוי",
  "כהן",
  "מזרחי",
  "בן דוד",
  "אברהם",
  "שפירא",
  "פרץ",
  "ביטון",
  "אזולאי",
  "פרידמן",
  "גולן",
  "רוזן",
  "חדד",
  "קפלן",
  "שגיא",
];
const BIOS = [
  "אוהב/ת Postgres יותר מדי.",
  "בונה מערכות שלא נופלות בשלוש בלילה.",
  "מעבירה צוותים ל-CI פנימי.",
  "תמיד בעד פחות קוד.",
  "מחפש/ת שותפים לפרויקטי קוד פתוח פנימיים.",
  "",
];

const SHORT = [
  "סיימנו להעביר את כל ה-CI שלנו ל-runners פנימיים. זמן build ירד מ-14 דקות ל-5. מי שרוצה את ה-template, תגיבו ואשתף.",
  "טיפ ל-Postgres: אינדקס חלקי עם WHERE deleted_at IS NULL חוסך המון מקום כשהרבה שורות מחוקות רכות.",
  "מחפשת מישהו שכבר הריץ Keycloak מאחורי OpenShift router עם X-Forwarded headers. נתקענו על redirect URI.",
  "שאלה לראשי צוותים: איך אתם מודדים זמן onboarding של מפתח חדש? אצלנו זה לוקח כחודש עד ה-PR הראשון.",
  "פרסמנו מדריך פנימי לבניית images ב-air gap: skopeo, checksums ו-SBOM. מוזמנים להשתמש ולשפר.",
  "ניסינו pgvector מול שירות חיפוש נפרד. ל-2 מיליון וקטורים Postgres הספיק בהחלט, ובלי עוד רכיב לתחזק.",
  "מישהו כבר עבד עם Helm hooks לריצת migrations? מתלבטים בין hook Job ל-init container.",
  "תזכורת: kubectl rollout undo הוא לא תוכנית rollback. migrations צריכות להיות תואמות לגרסה הקודמת.",
  "העברנו את הלוגים ל-JSON מובנה. החיפוש בתקלות התקצר מחצי שעה לשתי דקות.",
  "מחפשים מתנדבים לסקירת קוד של ספריית ה-auth המשותפת. כל זוג עיניים עוזר.",
  "הדאשבורד החדש של זמני תגובה עלה. ה-p99 שלנו היה גרוע ממה שחשבנו 😅",
  "למי שבונה פיצ'רים עם RTL: תשתמשו ב-ms- וב-ps- של Tailwind ולא ב-ml-. חוסך כאב ראש.",
  "סדנת TypeScript מתקדם ביום חמישי. נדבר על generics, narrowing ולמה any זה לא תשובה.",
  "שאלה: מה אתם עושים עם secrets בסביבת פיתוח? .env מקומי או משהו מרכזי?",
  "סגרנו רבעון בלי אף incident של P1. כל הכבוד לצוות התורנות!",
  "כתבתי סקריפט קטן שמזהה תלויות לא בשימוש ב-package.json. הוריד לנו 40 חבילות.",
  "מישהו השווה בין Vitest ל-Jest על monorepo גדול? אצלנו Vitest מהיר פי 3.",
  "המלצה: לפני שמוסיפים cache, תמדדו. חצי מהבעיות שלנו היו N+1 queries.",
  "חיפשנו דרך לשתף ידע בין יחידות בלי עוד קבוצת צ'אט. אז הנה אנחנו 🙂",
  "שדרגנו ל-Postgres 16. ה-logical replication השתפר משמעותית.",
  "פתחנו ריפו פנימי של Terraform modules מאושרים. PRs מתקבלים בברכה.",
  "השבוע למדתי ש-EXPLAIN ANALYZE על טבלה ריקה לא אומר כלום. צריך נתונים אמיתיים.",
  "שאלה לאנשי דאטה: איך אתם מנהלים schema evolution בטבלאות אנליטיות?",
  "מחר בעשר: הדגמה של כלי ה-feature flags החדש. פתוח לכולם.",
  // Markdown (posts and comments render it; bios don't).
  "שאלה: ה-init container של ה-migrations נופל אצלנו עם **permission denied**.\n\n\`\`\`sh\nnode migrate.mjs\n\`\`\`\n\nמישהו נתקל? ה-UID אקראי (restricted SCC).",
  "שלושה דברים שכדאי לבדוק לפני שמוסיפים אינדקס:\n\n1. האם השאילתה באמת איטית (\`EXPLAIN ANALYZE\`)\n2. כמה כתיבות יש לטבלה\n3. האם אינדקס **חלקי** מספיק\n\n> אינדקס שלא משתמשים בו הוא רק עוד כתיבה.",
];

const LONG = [
  `איך העברנו 30 שירותים ל-OpenShift בלי downtime

אחרי שלושה חודשים של עבודה, סיימנו. הנה מה שלמדנו.

1. להתחיל מהשירות הכי משעמם
בחרנו שירות פנימי שאף אחד לא שם לב כשהוא נופל. זה נתן לנו מקום לטעות.

2. restricted SCC זה לא באג
רוב הבעיות היו images שמניחים UID קבוע. הפתרון:

\`\`\`dockerfile
RUN chgrp -R 0 /app && chmod -R g=u /app
USER 1001
\`\`\`

3. probes אמיתיים
- readiness בודק תלויות
- liveness בודק רק שהתהליך חי
- startup נותן זמן לשירותים איטיים

4. מה הייתי עושה אחרת
הייתי משקיע יותר מוקדם ב-observability. בלי מטריקות, כל migration הוא ניחוש.

שאלות? תגיבו כאן.`,
  `מדריך: חיפוש טקסט מלא בעברית ב-Postgres

הקונפיגורציה simple לא מבינה תחיליות בעברית (ו, ה, ב, ל, מ, ש, כ). הנה מה שעשינו.

SELECT id FROM posts
WHERE to_tsvector('simple', body) @@ (
  to_tsquery('simple', 'שרת') || to_tsquery('simple', 'השרת')
);

מגבלות
1. אין stemming
2. מילים עם שתי תחיליות דורשות יותר וריאציות
3. זה לא מחליף מנוע חיפוש אמיתי, אבל זה מספיק לפיילוט

צעדים הבאים
אם pg_trgm זמין, אפשר להוסיף חיפוש fuzzy. ${"נמשיך לעדכן כאן ככל שנלמד יותר. ".repeat(6)}`,
  `רטרוספקטיבה: התקלה של יום שלישי

${"בשעה 03:12 קיבלנו התראה על latency גבוה בשירות ההזדהות. התורן התחיל לבדוק ומצא שה-connection pool מלא. ".repeat(4)}

ציר זמן
- 03:12 התראה ראשונה
- 03:20 זיהוי pool מלא
- 03:41 הגדלת pool זמנית
- 04:05 מציאת השאילתה הבעייתית

שורש הבעיה
שאילתה ללא אינדקס על טבלה שגדלה פי 10 בחודש האחרון.

CREATE INDEX CONCURRENTLY comments_post_idx ON comments (post_id, created_at);

פעולות
1. ניטור על גודל טבלאות
2. בדיקת query plans ב-CI
3. ${"תיעוד נהלי תורנות מעודכן. ".repeat(5)}`,
  `10 דברים שהייתי רוצה לדעת כמפתח חדש ביחידה

1. תשאלו מוקדם. אף אחד לא מצפה שתדעו הכל.
2. תקראו קוד לפני שאתם כותבים. רוב מה שאתם צריכים כבר קיים.
3. PR קטן עדיף על PR מושלם.
4. תלמדו git לעומק. rebase, bisect, reflog.
5. תכתבו בדיקות לבאגים לפני שאתם מתקנים אותם.
6. תעשו תורנות. אין דרך טובה יותר להכיר את המערכת.
7. תתעדו מה שלמדתם. הבא אחריכם יודה לכם.
8. תכירו אנשים מיחידות אחרות. זה בדיוק למה Z קיים.
9. אל תפחדו למחוק קוד.
10. תנוחו. ${"שחיקה היא באג ארגוני, לא כישלון אישי. ".repeat(4)}`,
];

const OPENERS = [
  "שאלה לכולם:",
  "עדכון קטן:",
  "טיפ:",
  "למדתי היום ש",
  "המלצה:",
  "מישהו נתקל ב",
  "סיכום השבוע:",
  "רעיון:",
];
const TOPICS = [
  "Kafka",
  "Postgres",
  "Redis",
  "Kubernetes",
  "Terraform",
  "Grafana",
  "Prometheus",
  "Next.js",
  "Python",
  "Go",
  "Rust",
  "Airflow",
  "Spark",
  "Keycloak",
  "Ansible",
  "GitLab CI",
  "ArgoCD",
  "Elasticsearch",
];
const MIDDLES = [
  "הגדרות ברירת המחדל של {t} לא מתאימות לעומסים שלנו",
  "שדרוג {t} עבר חלק יותר ממה שציפינו",
  "הוספנו ניטור על {t} וגילינו צוואר בקבוק",
  "כתבנו מדריך התקנה של {t} בסביבה מנותקת",
  "אנחנו מחפשים מישהו עם ניסיון ב-{t}",
  "החלפנו פתרון ישן ב-{t} וזה חסך לנו המון זמן",
];
const ENDINGS = [
  "מי שרוצה פרטים, תגיבו.",
  "אשמח לשמוע איך זה אצלכם.",
  "הקוד בריפו הפנימי.",
  "נעדכן בהמשך.",
  "",
  "תודה לכל מי שעזר!",
];
const COMMENTS = [
  "תודה, מאוד עוזר!",
  "אצלנו זה עבד אחרת, אשמח להשוות.",
  "אפשר לינק לריפו?",
  "מסכים לגמרי.",
  "ניסיתם עם הגדרה אחרת?",
  "בדיוק נתקלנו בזה השבוע.",
  "+1",
  "יש לזה תיעוד?",
  "אפשר לקבוע שיחה על זה?",
  "מעניין, לא חשבתי על זה ככה.",
  "זה עובד גם ב-air gap?",
  "כל הכבוד לצוות!",
];

const fill = (s: string) => s.replace("{t}", pick(TOPICS));
const usedBodies = new Set<string>();
// Unique until the combinations run out (~5k), then repeats are fine (seed:large only).
const generatedPost = () => {
  for (let i = 0; i < 20; i++) {
    const b = [pick(OPENERS), fill(pick(MIDDLES)) + ".", pick(ENDINGS)].filter(Boolean).join(" ");
    if (usedBodies.has(b)) continue;
    usedBodies.add(b);
    return b;
  }
  return [pick(OPENERS), fill(pick(MIDDLES)) + "."].join(" ");
};

// ---------- build ----------

const KEYCLOAK_IDS = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
  "33333333-3333-4333-8333-333333333333",
];

type Row = Record<string, string | number | boolean | Date | null>;
const BASES = ["בסיס הדמיה צפון", "בסיס הדמיה מרכז", "בסיס הדמיה דרום", "עבודה מהבית"];
const N_USERS = large ? 200 : 12;
const N_POSTS = large ? 10_000 : 60;
const DAYS = large ? 60 : 40;

// Recent-heavy spread: most posts in the last week, a tail back to DAYS days.
const postTime = () => NOW - Math.floor(Math.pow(rand(), 2.5) * DAYS * 24 * HOUR) - 60_000;

const users: Row[] = Array.from({ length: N_USERS }, (_, i) => {
  const first = FIRST[i % FIRST.length];
  const last = LAST[(i * 7 + Math.floor(i / FIRST.length)) % LAST.length];
  // Joined dates spread over ~2 years, all before their first post.
  const created = NOW - (DAYS + 30 + ((i * 53) % 700)) * 24 * HOUR + i * 60_000;
  return {
    id: uuidv7(created),
    created_at: new Date(created),
    updated_at: new Date(created),
    onboarded_at: new Date(created), // seeded people skip the first-login welcome
    // First 3 match the fixed user ids in dev/keycloak/realm-z.json, so a real login maps onto them.
    keycloak_sub: i < 3 ? KEYCLOAK_IDS[i] : `seed-${i}`,
    handle: i < 3 ? ["dana", "yossi", "noa"][i] : `user${i}`,
    display_name: `${first} ${last}`,
    bio: pick(BIOS),
    avatar_seed: String(i),
    // Service details (lib/service-info.ts) for about two thirds; fictional contact on reserved
    // ranges (050-000xxxx, example.test).
    ...(i % 3 !== 2
      ? {
          rank: RANKS[(i * 5) % RANKS.length],
          service_type: SERVICE_TYPES[i % SERVICE_TYPES.length],
          service_start: new Date(NOW - (200 + ((i * 97) % 5000)) * 24 * HOUR)
            .toISOString()
            .slice(0, 10),
          // Regular service ends: some still ahead (days left), some past.
          service_end:
            SERVICE_TYPES[i % SERVICE_TYPES.length] === "regular"
              ? new Date(NOW + (((i * 131) % 900) - 150) * 24 * HOUR).toISOString().slice(0, 10)
              : null,
          civic_phone: `050-000${String(1000 + i).slice(-4)}`,
          civic_email: `${i < 3 ? ["dana", "yossi", "noa"][i] : `user${i}`}@example.test`,
        }
      : {
          rank: null,
          service_type: null,
          service_start: null,
          service_end: null,
          civic_phone: "",
          civic_email: "",
        }),
  };
});
const uid = (i: number) => users[i].id as string;
// Popularity weights so a few authors are prolific and widely followed.
const weights = users.map((_, i) => 1 / (i + 1) ** 0.8);
const total = weights.reduce((a, b) => a + b, 0);
const popular = () => {
  let r = rand() * total;
  for (let i = 0; i < weights.length; i++) if ((r -= weights[i]) <= 0) return i;
  return weights.length - 1;
};

const posts: Row[] = [];
for (let i = 0; i < N_POSTS; i++) {
  const longEvery = large ? 50 : 15;
  const body =
    i % longEvery === 0
      ? LONG[(i / longEvery) % LONG.length]
      : !large && i < SHORT.length
        ? SHORT[i]
        : large && rand() < 0.3
          ? pick(SHORT)
          : generatedPost();
  const t = postTime();
  posts.push({
    id: uuidv7(t),
    created_at: new Date(t),
    updated_at: new Date(t),
    author_id: uid(rand() < 0.5 ? popular() : int(N_USERS)),
    body,
    ...(({ preview, hasMore }) => ({ preview, has_more: hasMore }))(computePreview(body)),
  });
}

const comments: Row[] = [];
const addComment = (post: Row, parent: Row | null, after: number) => {
  const t = Math.min(NOW - 1000, after + int(6 * HOUR) + 1000);
  const c: Row = {
    id: uuidv7(t),
    created_at: new Date(t),
    updated_at: new Date(t),
    post_id: post.id,
    author_id: uid(int(N_USERS)),
    parent_comment_id: parent?.id ?? null,
    body: pick(COMMENTS),
  };
  comments.push(c);
  return c;
};
const ts = (r: Row) => (r.created_at as Date).getTime();
for (const p of posts) {
  // Ordinary threads: a few top-level comments, some replies.
  const top = pareto(large ? 15 : 6, 1.1);
  for (let k = 0; k < top; k++) {
    let parent = addComment(p, null, ts(p));
    while (rand() < 0.35) parent = addComment(p, parent, ts(parent));
  }
}
if (large) {
  // A few pathological threads for query-plan checks: >20 levels deep, and 500+ comments.
  for (let k = 0; k < 5; k++) {
    let parent: Row | null = null;
    const p = posts[k * 7];
    for (let d = 0; d < 25; d++) parent = addComment(p, parent, parent ? ts(parent) : ts(p));
  }
  for (let k = 0; k < 3; k++) {
    const p = posts[100 + k];
    const thread: Row[] = [];
    for (let n = 0; n < 600; n++) {
      const parent = thread.length && rand() < 0.6 ? pick(thread) : null;
      thread.push(addComment(p, parent, parent ? ts(parent) : ts(p)));
    }
  }
}
// Some deleted comments with replies, to exercise "[deleted]" placeholders.
const parentIds = new Set(comments.map((c) => c.parent_comment_id).filter(Boolean));
for (const c of comments.filter((c) => parentIds.has(c.id)).slice(0, large ? 50 : 3))
  c.deleted_at = new Date(ts(c) + HOUR);

const likes: Row[] = [];
for (const p of posts) {
  const n = pareto(Math.min(N_USERS - 1, large ? 150 : 11), 0.9);
  const seen = new Set<number>();
  while (seen.size < n) seen.add(popular());
  for (const u of seen) {
    const t = Math.min(NOW - 1000, ts(p) + int(48 * HOUR));
    likes.push({
      id: uuidv7(t),
      created_at: new Date(t),
      updated_at: new Date(t),
      user_id: uid(u),
      post_id: p.id,
    });
  }
}

const follows: Row[] = [];
for (let f = 0; f < N_USERS; f++) {
  const n = Math.max(1, pareto(Math.min(N_USERS - 1, large ? 60 : 8), 1));
  const seen = new Set<number>();
  for (let tries = 0; seen.size < n && tries < n * 10; tries++) {
    const e = popular();
    if (e !== f) seen.add(e);
  }
  for (const e of seen) {
    const t = NOW - int(DAYS * 24 * HOUR);
    follows.push({
      id: uuidv7(t),
      created_at: new Date(t),
      updated_at: new Date(t),
      follower_id: uid(f),
      followee_id: uid(e),
    });
  }
}

// Comment likes. On question-like posts, the post's author often likes one answer: the
// "liked by the author" mark that puts it first.
const commentLikes: Row[] = [];
const likedComment = new Set<string>(); // `${commentId}:${userId}`
const likeComment = (c: Row, u: number) => {
  likedComment.add(`${c.id}:${uid(u)}`);
  const t = Math.min(NOW - 1000, ts(c) + int(24 * HOUR) + 1000);
  commentLikes.push({
    id: uuidv7(t),
    created_at: new Date(t),
    updated_at: new Date(t),
    user_id: uid(u),
    comment_id: c.id,
  });
  return t;
};
const live = comments.filter((c) => !c.deleted_at);
for (const c of live) {
  const seen = new Set<number>();
  const n = pareto(large ? 20 : 4, 1.4) - 1;
  while (seen.size < n) seen.add(popular());
  for (const u of seen) likeComment(c, u);
}
const postsById = new Map(posts.map((p) => [p.id, p]));
const byPost = Map.groupBy(
  live.filter((c) => !c.parent_comment_id),
  (c) => c.post_id as string,
);
for (const [postId, tops] of byPost) {
  const post = postsById.get(postId)!;
  const question = /שאלה|\?/.test(post.body as string);
  if (!(question ? rand() < 0.8 : rand() < 0.3)) continue;
  const answer = tops.find((c) => c.author_id !== post.author_id);
  if (!answer) continue;
  const authorIndex = users.findIndex((u) => u.id === post.author_id);
  if (likedComment.has(`${answer.id}:${post.author_id}`)) continue;
  answer.author_liked_at = new Date(likeComment(answer, authorIndex));
}

// Experience (docs/experience.md): a current role and one or two earlier ones for most people.
const ROLES = [
  "מפתח/ת Backend",
  "ראש צוות",
  "מהנדס/ת DevOps",
  "אנליסט/ית נתונים",
  "ארכיטקט/ית",
  "מנהל/ת מוצר",
];
const ORGS = ["צוות הדמיה א", "מדור פיתוח הדמיה", "ענף תשתיות הדמיה", "צוות נתונים הדמיה"];
const ym = (monthsAgo: number) => {
  const d = new Date(NOW);
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - monthsAgo);
  return d.toISOString().slice(0, 10);
};
const experiences: Row[] = users.flatMap((u, i) => {
  if (i % 4 === 3) return [];
  const n = 1 + (i % 3);
  let end: number | null = null;
  let start = 4 + ((i * 7) % 20);
  return Array.from({ length: n }, (_, k) => {
    const row = {
      user_id: u.id,
      title: ROLES[(i + k) % ROLES.length],
      organization: ORGS[(i * 3 + k) % ORGS.length],
      location: BASES[(i + k) % BASES.length],
      start_month: ym(start),
      end_month: end === null ? null : ym(end),
    };
    end = start + 1;
    start = end + 6 + ((i + k) % 18);
    return row;
  });
});

// ---------- write ----------

async function insert(table: string, rows: Row[]) {
  const cols = [...new Set(rows.flatMap(Object.keys))];
  const full = rows.map((r): Row => Object.fromEntries(cols.map((c) => [c, r[c] ?? null])));
  for (let i = 0; i < full.length; i += 2000) {
    await sql`insert into ${sql(table)} ${sql(full.slice(i, i + 2000), ...cols)}`;
  }
}

const started = Date.now();
// Every table (a new one needs no change here): the seed replaces the whole dev database.
const tables = await sql`select tablename from pg_tables where schemaname = 'public'`;
await sql`truncate ${sql(tables.map((t) => t.tablename as string))}`;
await insert("users", users);
await insert("posts", posts);
// Parents must exist before replies: comments were generated parent-first, insert in that order.
await insert("comments", comments);
await insert("likes", likes);
await insert("comment_likes", commentLikes);
await insert("follows", follows);
await insert("experiences", experiences);
// dana moderates in dev (docs/moderation.md), so /admin can be tried right after seeding.
await sql`insert into admins (user_id) values (${uid(0)})`;
await sql`
  update posts p set
    like_count = (select count(*) from likes l where l.post_id = p.id and l.deleted_at is null),
    comment_count = (select count(*) from comments c where c.post_id = p.id and c.deleted_at is null)`;
await sql`
  update comments c set like_count = l.n
  from (select comment_id, count(*)::int as n from comment_likes where deleted_at is null
    group by comment_id) l
  where l.comment_id = c.id`;
// Notifications for what the seed did (as the services would have written them). Older than a
// day: already read.
await sql`
  insert into notifications (recipient_id, actor_id, type, post_id, comment_id, created_at, updated_at)
  select coalesce(pc.author_id, p.author_id), c.author_id,
    case when c.parent_comment_id is null then 'comment' else 'reply' end,
    c.post_id, c.id, c.created_at, c.created_at
  from comments c join posts p on p.id = c.post_id
    left join comments pc on pc.id = c.parent_comment_id
  where c.deleted_at is null and c.author_id <> coalesce(pc.author_id, p.author_id)
  union all
  select p.author_id, l.user_id, 'like_post', p.id, null, l.created_at, l.created_at
  from likes l join posts p on p.id = l.post_id where l.user_id <> p.author_id
  union all
  select c.author_id, l.user_id,
    case when l.user_id = p.author_id then 'author_liked' else 'like_comment' end,
    c.post_id, c.id, l.created_at, l.created_at
  from comment_likes l join comments c on c.id = l.comment_id join posts p on p.id = c.post_id
  where l.user_id <> c.author_id and c.deleted_at is null
  union all
  select f.followee_id, f.follower_id, 'follow', null, null, f.created_at, f.created_at
  from follows f`;
await sql`update notifications set read_at = created_at + interval '1 hour'
  where created_at < now() - interval '1 day'`;
// Visits for the usage dashboard: each person on some of the last 30 days, the busier ones on more
// (deterministic: a hash of who and when).
await sql`
  insert into daily_visits (user_id, day)
  select u.id, d::date
  from (select id, row_number() over (order by created_at) as rank from users) u
    cross join generate_series(current_date - 29, current_date, interval '1 day') d
  where abs(hashtext(u.id::text || d::text)) % 100 < 85 - u.rank % 60`;
await sql`analyze`; // fresh planner stats, so EXPLAIN on seed data reflects real plans
await sql.end();

console.log(
  `seeded ${users.length} users, ${posts.length} posts, ${comments.length} comments, ` +
    `${likes.length} likes, ${follows.length} follows in ${((Date.now() - started) / 1000).toFixed(1)}s`,
);

import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import {
  restoreCommentAction,
  restorePostAction,
  revokeAdminAction,
  unsuspendUserAction,
} from "@/app/actions";
import { GrantAdminForm } from "@/components/grant-admin-form";
import { Loading } from "@/components/loading";
import { ModerateButton } from "@/components/moderate-button";
import { requireAdmin } from "@/lib/auth/viewer";
import { dateTime, snippet } from "@/lib/format";
import { he } from "@/lib/i18n/he";
import { listAdmins, moderationLog, suspendedUsers } from "@/lib/services";
import type { Metadata } from "next";

const heading =
  "border-b border-neutral-200 px-4 py-3 text-start text-lg font-bold dark:border-neutral-800";
const row =
  "flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-neutral-200 px-4 py-3 text-start dark:border-neutral-800";

const Person = (u: { handle: string | null; displayName: string }) =>
  u.handle ? (
    <Link href={`/u/${encodeURIComponent(u.handle)}`} className="hover:underline">
      <b>{u.displayName}</b>{" "}
      <span className="text-muted" dir="ltr">
        @{u.handle}
      </span>
    </Link>
  ) : (
    <b>{u.displayName}</b>
  );

// Moderation (docs/moderation.md): admins, suspended users and the audit log. 404 for non-admins.
async function Admin() {
  await connection();
  const viewer = await requireAdmin();
  const [adminList, suspended, log] = await Promise.all([
    listAdmins(),
    suspendedUsers(),
    moderationLog(),
  ]);
  return (
    <>
      <h1 className="sr-only">{he.moderation.title}</h1>
      <section aria-labelledby="admins-title">
        <h2 id="admins-title" className={heading}>
          {he.moderation.admins}
        </h2>
        <ul>
          {adminList.map((a) => (
            <li key={a.id} className={row}>
              <span>
                <Person {...a} /> {a.id === viewer.id && he.moderation.you}
              </span>
              <span className="flex gap-4 text-sm text-muted">
                <span>{he.moderation.since(dateTime(a.since))}</span>
                {a.id !== viewer.id && (
                  <ModerateButton
                    label={he.moderation.revoke}
                    danger
                    action={revokeAdminAction.bind(null, a.id)}
                  />
                )}
              </span>
            </li>
          ))}
        </ul>
        <GrantAdminForm />
      </section>

      <section aria-labelledby="suspended-title">
        <h2 id="suspended-title" className={heading}>
          {he.moderation.suspended}
        </h2>
        {suspended.length ? (
          <ul>
            {suspended.map((u) => (
              <li key={u.id} className={row}>
                <Person {...u} />
                <span className="flex gap-4 text-sm text-muted">
                  <span>{he.moderation.since(dateTime(u.since!))}</span>
                  <ModerateButton
                    label={he.moderation.unsuspend}
                    action={unsuspendUserAction.bind(null, u.id)}
                  />
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 py-3 text-start text-muted">{he.moderation.noSuspended}</p>
        )}
      </section>

      <section aria-labelledby="log-title">
        <h2 id="log-title" className={heading}>
          {he.moderation.log}
        </h2>
        {log.length ? (
          <ul>
            {log.map((e) => (
              <li
                key={e.id}
                className="space-y-1 border-b border-neutral-200 px-4 py-3 text-start text-sm dark:border-neutral-800"
              >
                <div className="flex flex-wrap gap-x-2 text-muted">
                  <span>{dateTime(e.at)}</span>
                  <span>•</span>
                  <span>{e.actor ? <Person {...e.actor} /> : he.moderation.commandLine}</span>
                </div>
                <div>
                  <b>{he.moderation.actions[e.action]}</b>
                  {": "}
                  {e.post && (
                    <Link href={`/p/${e.post.id}`} className="text-link hover:underline">
                      {snippet(e.post.preview)}
                    </Link>
                  )}
                  {e.comment && (
                    <Link
                      href={`/p/${e.comment.postId}#c-${e.comment.id}`}
                      className="text-link hover:underline"
                    >
                      {snippet(e.comment.body)}
                    </Link>
                  )}
                  {e.user && <Person {...e.user} />}
                </div>
                <p className="whitespace-pre-wrap wrap-break-word">{e.reason}</p>
                {e.detail && (
                  <p className="whitespace-pre-wrap wrap-break-word text-muted">
                    {he.moderation.was(e.detail)}
                  </p>
                )}
                {e.action === "remove_post" && e.post?.removedAt && (
                  <div className="text-muted">
                    <ModerateButton
                      label={he.moderation.restore}
                      action={restorePostAction.bind(null, e.post.id)}
                    />
                  </div>
                )}
                {e.action === "remove_comment" && e.comment?.removedAt && (
                  <div className="text-muted">
                    <ModerateButton
                      label={he.moderation.restore}
                      action={restoreCommentAction.bind(null, e.comment.id)}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 py-3 text-start text-muted">{he.moderation.logEmpty}</p>
        )}
      </section>
    </>
  );
}

export const metadata: Metadata = { title: he.titles.admin };

export default function Page() {
  return (
    <main>
      <Suspense fallback={<Loading />}>
        <Admin />
      </Suspense>
    </main>
  );
}

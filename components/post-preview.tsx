"use client";
// Feed preview with inline "read more" (PLAN.md §6.3). The full body is fetched only on demand;
// without JS (or with ctrl/cmd-click) the link opens the post page.
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { getPostBodyAction } from "@/app/actions";
import { he } from "@/lib/i18n/he";
import { renderMarkdown } from "@/lib/markdown";

export function PostPreview(p: { id: string; preview: string; hasMore: boolean }) {
  const [body, setBody] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <>
      {/* Safe: markdown-it runs with html disabled (lib/markdown.ts). */}
      <div
        className="md mt-1"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(body ?? p.preview) }}
      />
      {p.hasMore && body === null && (
        <a
          href={`/p/${p.id}`}
          aria-busy={pending}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey) return;
            e.preventDefault();
            start(async () => {
              const r = await getPostBodyAction(p.id);
              if (r) setBody(r);
              else router.push(`/p/${p.id}`); // deleted or failed: the page explains
            });
          }}
          className="mt-1 inline-block text-sm text-sky-600 hover:underline"
        >
          {pending ? he.feed.loading : `${he.post.readMore}…`}
        </a>
      )}
    </>
  );
}

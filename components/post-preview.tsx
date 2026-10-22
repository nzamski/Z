"use client";
// Feed preview with inline "show more": the full body is fetched only on demand.
// Without JS (or with ctrl/cmd-click) the link opens the post page instead.
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { getPostBodyAction } from "@/app/actions";
import { Spinner } from "@/components/loading";
import { Markdown } from "@/components/markdown";
import { he } from "@/lib/i18n/he";

export function PostPreview(p: { id: string; preview: string; hasMore: boolean }) {
  const [body, setBody] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const more = p.hasMore && body === null;
  return (
    <>
      <Markdown text={body ?? (more ? `${p.preview}…` : p.preview)} className="mt-1" />
      {more && (
        <a
          href={`/p/${p.id}`}
          aria-busy={pending}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey) return;
            e.preventDefault();
            start(async () => {
              const full = await getPostBodyAction(p.id);
              if (full !== null) setBody(full);
              else router.push(`/p/${p.id}`); // deleted or failed: the page explains
            });
          }}
          className="mt-1 inline-block text-sm text-link hover:underline"
        >
          {pending ? <Spinner className="size-4" /> : he.post.readMore}
        </a>
      )}
    </>
  );
}

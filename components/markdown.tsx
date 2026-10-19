import { renderMarkdown } from "@/lib/markdown";

/**
 * A post or comment body as markdown (bios stay PlainText). Used by server and client components.
 * Safe to inject: lib/markdown.ts escapes raw HTML and refuses dangerous links.
 */
export function Markdown({ text, className = "" }: { text: string; className?: string }) {
  return (
    <div className={`md ${className}`} dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }} />
  );
}

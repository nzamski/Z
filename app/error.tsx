"use client";
// Unexpected failure while rendering a page: say so in Hebrew and offer a retry (Next 16: `retry`).
import Link from "next/link";
import { useEffect } from "react";
import { he } from "@/lib/i18n/he";

export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => console.error(error), [error]);
  return (
    <main className="space-y-4 p-8 text-center">
      <p>{he.pages.error}</p>
      <div className="flex justify-center gap-4 text-sm">
        <button
          onClick={() => retry()}
          className="rounded-full bg-foreground px-4 py-1.5 font-medium text-background transition-opacity hover:opacity-85"
        >
          {he.pages.retry}
        </button>
        <Link href="/" className="px-2 py-1.5 text-link hover:underline">
          {he.pages.home}
        </Link>
      </div>
    </main>
  );
}

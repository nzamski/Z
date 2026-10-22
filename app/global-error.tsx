"use client";
// The root layout itself failed: it is replaced, so this brings its own <html>/<body> (Hebrew,
// RTL) and styles.
import Link from "next/link";
import { useEffect } from "react";
import { he } from "@/lib/i18n/he";
import "./globals.css";

export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => console.error(error), [error]);
  return (
    <html lang="he" dir="rtl">
      <body className="min-h-full antialiased">
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
      </body>
    </html>
  );
}

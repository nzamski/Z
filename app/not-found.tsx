import Link from "next/link";
import { he } from "@/lib/i18n/he";
import type { Metadata } from "next";

// Root segment: the layout's title template doesn't apply here (see app/page.tsx).
export const metadata: Metadata = {
  title: { absolute: `${he.titles.notFound} / ${he.appName}` },
};

export default function NotFound() {
  return (
    <main className="space-y-4 p-8 text-center">
      <p>{he.pages.notFound}</p>
      <Link href="/" className="text-sm text-link hover:underline">
        {he.pages.home}
      </Link>
    </main>
  );
}

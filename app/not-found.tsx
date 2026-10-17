import Link from "next/link";
import { he } from "@/lib/i18n/he";

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

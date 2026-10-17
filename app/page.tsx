import { he } from "@/lib/i18n/he";

const tabs = [he.nav.forYou, he.nav.following, he.nav.latest];

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 border-x border-neutral-200 dark:border-neutral-800">
      <header className="sticky top-0 border-b border-neutral-200 bg-background/90 px-4 py-3 backdrop-blur dark:border-neutral-800">
        <h1 className="text-start text-2xl font-bold">{he.appName}</h1>
        <p className="text-start text-sm text-neutral-500">{he.tagline}</p>
        <nav className="mt-3 flex gap-6 text-sm font-medium">
          {tabs.map((t) => (
            <span key={t} className="pb-1 first:border-b-2 first:border-current">
              {t}
            </span>
          ))}
        </nav>
      </header>
      <p className="ps-4 pt-8 text-start text-neutral-500">{he.shell.empty}</p>
    </main>
  );
}

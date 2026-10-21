import { Suspense } from "react";
import type { Metadata } from "next";
import localFont from "next/font/local";
import { Header } from "@/components/header";
import { NavRail } from "@/components/nav-rail";
import { SideBar } from "@/components/side-bar";
import { he } from "@/lib/i18n/he";
import { themeScript } from "@/lib/theme";
import "./globals.css";

const heebo = localFont({
  src: "./fonts/Heebo-Variable.ttf",
  variable: "--font-heebo",
  weight: "100 900",
});

export const metadata: Metadata = {
  // Each page sets its part; the tab reads e.g. "בית / Z" (like X's "Home / X").
  title: { default: he.appName, template: `%s / ${he.appName}` },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // data-theme is set by the inline script before React hydrates (lib/theme.ts).
    <html
      lang="he"
      dir="rtl"
      className={`${heebo.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full">
        <a
          href="#content"
          className="sr-only z-50 rounded-md bg-background px-3 py-2 focus:not-sr-only focus:fixed focus:start-2 focus:top-2"
        >
          {he.nav.skip}
        </a>
        {/* Wide screens: navigation rail | feed | sidebar (start to end). Phones: the feed column
            only, with navigation in its header. */}
        <div className="flex w-full justify-center">
          <aside className="sticky top-0 hidden h-screen w-20 shrink-0 lg:block xl:w-64">
            <Suspense>
              <NavRail />
            </Suspense>
          </aside>
          <div className="min-h-screen w-full max-w-2xl min-w-0 border-x border-neutral-200 dark:border-neutral-800">
            <Header />
            <div id="content" tabIndex={-1} className="outline-none">
              {children}
            </div>
          </div>
          <aside className="sticky top-0 hidden h-screen w-80 shrink-0 overflow-y-auto xl:block">
            <Suspense>
              <SideBar />
            </Suspense>
          </aside>
        </div>
      </body>
    </html>
  );
}

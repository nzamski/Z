import type { Metadata } from "next";
import localFont from "next/font/local";
import { Header } from "@/components/header";
import { he } from "@/lib/i18n/he";
import "./globals.css";

const heebo = localFont({
  src: "./fonts/Heebo-Variable.ttf",
  variable: "--font-heebo",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: he.appName,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="he" dir="rtl" className={`${heebo.variable} h-full antialiased`}>
      <body className="min-h-full">
        <a
          href="#content"
          className="sr-only z-50 rounded-md bg-background px-3 py-2 focus:not-sr-only focus:fixed focus:start-2 focus:top-2"
        >
          {he.nav.skip}
        </a>
        <div className="mx-auto min-h-screen w-full max-w-2xl border-x border-neutral-200 dark:border-neutral-800">
          <Header />
          <div id="content" tabIndex={-1} className="outline-none">
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}

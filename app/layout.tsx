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
        <div className="mx-auto min-h-screen w-full max-w-2xl border-x border-neutral-200 dark:border-neutral-800">
          <Header />
          {children}
        </div>
      </body>
    </html>
  );
}

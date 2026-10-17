import type { Metadata } from "next";
import localFont from "next/font/local";
import { he } from "@/lib/i18n/he";
import "./globals.css";

const heebo = localFont({
  src: "./fonts/Heebo-Variable.ttf",
  variable: "--font-heebo",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: he.appName,
  description: he.tagline,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="he" dir="rtl" className={`${heebo.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

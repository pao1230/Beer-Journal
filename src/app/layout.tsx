import type { Metadata, Viewport } from "next";
import { BottomNav, TopNav } from "@/components/nav";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Brewing Journal", template: "%s · Brewing Journal" },
  description: "Personal homebrewing journal: recipes, brew sessions, problems and lessons learned.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#b45309",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col font-sans">
        <TopNav />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-24 lg:pb-10">{children}</main>
        <BottomNav />
      </body>
    </html>
  );
}

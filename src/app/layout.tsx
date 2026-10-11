import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans_Thai, Prompt } from "next/font/google";
import { BottomNav, TopNav } from "@/components/nav";
import { I18nProvider } from "@/lib/i18n/client";
import { getI18n } from "@/lib/i18n/server";
import "./globals.css";

const prompt = Prompt({ subsets: ["latin", "thai"], weight: ["500", "600", "700"], variable: "--font-prompt" });
const plexThai = IBM_Plex_Sans_Thai({
  subsets: ["latin", "thai"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-thai",
});
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex-mono" });

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  const name = t("Brewing Journal");
  return {
    title: { default: name, template: `%s · ${name}` },
    description: t("Personal homebrewing journal: recipes, brew sessions, problems and lessons learned."),
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#2b5a6b" },
    { media: "(prefers-color-scheme: dark)", color: "#121a18" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { locale } = await getI18n();
  return (
    <html lang={locale} className={`h-full antialiased ${prompt.variable} ${plexThai.variable} ${plexMono.variable}`}>
      <body className="flex min-h-full flex-col font-sans">
        <I18nProvider locale={locale}>
          <TopNav />
          <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-24 lg:pb-10">{children}</main>
          <BottomNav />
        </I18nProvider>
      </body>
    </html>
  );
}

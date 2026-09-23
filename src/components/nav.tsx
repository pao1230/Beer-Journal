"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition } from "react";
import { BookOpen, GitCompare, Home, Lightbulb, History, Package, Plus, Wheat, Wrench } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { setLocale } from "@/lib/i18n/actions";
import { cn } from "@/lib/utils";

const desktop = [
  { href: "/", label: "Dashboard" },
  { href: "/recipes", label: "Recipes" },
  { href: "/ingredients", label: "Ingredients" },
  { href: "/inventory", label: "Inventory" },
  { href: "/brews", label: "Brews" },
  { href: "/compare", label: "Compare" },
  { href: "/lessons", label: "Lessons" },
  { href: "/equipment", label: "Equipment" },
];

const mobile = [
  { href: "/", label: "Home", icon: Home },
  { href: "/recipes", label: "Recipes", icon: BookOpen },
  { href: "/brews/new", label: "Brew", icon: Plus },
  { href: "/brews", label: "History", icon: History },
  { href: "/lessons", label: "Lessons", icon: Lightbulb },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/brews") return pathname.startsWith("/brews") && pathname !== "/brews/new";
  return pathname.startsWith(href);
}

function LanguageSwitch() {
  const { locale, t } = useI18n();
  const [pending, startTransition] = useTransition();
  const next = locale === "th" ? "en" : "th";
  return (
    <button
      type="button"
      onClick={() => startTransition(() => setLocale(next))}
      disabled={pending}
      aria-label={t("Switch language")}
      title={t("Switch language")}
      className="shrink-0 rounded-md border border-border px-2 py-1 text-xs font-semibold hover:bg-muted disabled:opacity-50"
    >
      {next === "th" ? "ไทย" : "EN"}
    </button>
  );
}

export function TopNav() {
  const pathname = usePathname();
  const { t } = useI18n();
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-4 sm:gap-4">
        <Link href="/" className="min-w-0 truncate font-bold whitespace-nowrap">
          🍺 {t("Brewing Journal")}
        </Link>
        <nav className="hidden gap-0.5 lg:flex">
          {desktop.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "rounded-md px-2.5 py-1.5 text-sm whitespace-nowrap hover:bg-muted",
                isActive(pathname, l.href) && "bg-muted font-semibold",
              )}
            >
              {t(l.label)}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1">
          {[
            { href: "/ingredients", label: "Ingredients", Icon: Wheat },
            { href: "/inventory", label: "Inventory", Icon: Package },
            { href: "/compare", label: "Compare", Icon: GitCompare },
            { href: "/equipment", label: "Equipment", Icon: Wrench },
          ].map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              aria-label={t(label)}
              title={t(label)}
              className={cn("rounded-md p-1.5 hover:bg-muted sm:p-2 lg:hidden", pathname.startsWith(href) && "bg-muted text-primary")}
            >
              <Icon className="size-5" />
            </Link>
          ))}
          <LanguageSwitch />
        </div>
      </div>
    </header>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const { t } = useI18n();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] lg:hidden">
      {mobile.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            "flex flex-col items-center gap-0.5 py-2 text-xs text-muted-foreground",
            (href === "/brews/new" ? pathname === href : isActive(pathname, href)) &&
              "font-semibold text-primary",
          )}
        >
          <Icon className="size-5" />
          {t(label)}
        </Link>
      ))}
    </nav>
  );
}

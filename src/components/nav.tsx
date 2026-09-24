"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  BookOpen,
  GitCompare,
  History,
  Home,
  LayoutDashboard,
  Lightbulb,
  Menu,
  Package,
  Plus,
  Wheat,
  Wrench,
  X,
} from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { setLocale } from "@/lib/i18n/actions";
import { cn } from "@/lib/utils";

const pages = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/recipes", label: "Recipes", icon: BookOpen },
  { href: "/ingredients", label: "Ingredients", icon: Wheat },
  { href: "/inventory", label: "Inventory", icon: Package },
  { href: "/brews", label: "Brews", icon: History },
  { href: "/compare", label: "Compare", icon: GitCompare },
  { href: "/lessons", label: "Lessons", icon: Lightbulb },
  { href: "/equipment", label: "Equipment", icon: Wrench },
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

/** EN ⇄ ไทย switch: the knob sits under the active language. */
function LanguageToggle() {
  const { locale, t } = useI18n();
  const [pending, startTransition] = useTransition();
  const thai = locale === "th";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={thai}
      aria-label={t("Switch language")}
      title={t("Switch language")}
      onClick={() => startTransition(() => setLocale(thai ? "en" : "th"))}
      disabled={pending}
      className="relative grid shrink-0 grid-cols-2 rounded-full border border-border bg-muted p-0.5 text-xs font-semibold disabled:opacity-60"
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-full bg-card shadow-sm transition-transform duration-200",
          thai && "translate-x-full",
        )}
      />
      <span className={cn("relative z-10 px-2 py-0.5", thai ? "text-muted-foreground" : "text-primary")}>
        EN
      </span>
      <span className={cn("relative z-10 px-2 py-0.5", thai ? "text-primary" : "text-muted-foreground")}>
        ไทย
      </span>
    </button>
  );
}

export function TopNav() {
  const pathname = usePathname();
  const { t } = useI18n();
  // The menu belongs to the page it was opened on, so navigating closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const close = () => setOpenOn(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenOn(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-4 sm:gap-4">
          <Link href="/" className="min-w-0 truncate font-bold whitespace-nowrap">
            🍺 {t("Brewing Journal")}
          </Link>
          <nav className="hidden gap-0.5 lg:flex">
            {pages.map((l) => (
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
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <LanguageToggle />
            <button
              type="button"
              onClick={() => setOpenOn(open ? null : pathname)}
              aria-expanded={open}
              aria-controls="mobile-menu"
              aria-label={t(open ? "Close menu" : "Open menu")}
              className="rounded-md p-1.5 hover:bg-muted lg:hidden"
            >
              {open ? <X className="size-6" /> : <Menu className="size-6" />}
            </button>
          </div>
        </div>
        {open && (
          <nav
            id="mobile-menu"
            aria-label={t("Menu")}
            className="absolute inset-x-0 top-full border-b border-border bg-card shadow-lg lg:hidden"
          >
            <ul className="mx-auto grid max-w-5xl gap-1 p-3 sm:grid-cols-2">
              {pages.map(({ href, label, icon: Icon }) => (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={close}
                    aria-current={isActive(pathname, href) ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2.5 hover:bg-muted",
                      isActive(pathname, href) && "bg-muted font-semibold text-primary",
                    )}
                  >
                    <Icon className="size-5" />
                    {t(label)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </header>
      {/* Outside the header: its backdrop-blur would otherwise pin a fixed child to the header box. */}
      {open && (
        <div aria-hidden className="fixed inset-0 top-14 z-[25] bg-black/30 lg:hidden" onClick={close} />
      )}
    </>
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

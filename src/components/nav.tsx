"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Home, Lightbulb, History, Plus, Wheat, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

const desktop = [
  { href: "/", label: "Dashboard" },
  { href: "/recipes", label: "Recipes" },
  { href: "/ingredients", label: "Ingredients" },
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

export function TopNav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-6 px-4">
        <Link href="/" className="font-bold whitespace-nowrap">
          🍺 Brewing Journal
        </Link>
        <nav className="hidden gap-1 md:flex">
          {desktop.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm hover:bg-muted",
                isActive(pathname, l.href) && "bg-muted font-semibold",
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex gap-1 md:hidden">
          <Link href="/ingredients" aria-label="Ingredients" className="rounded-md p-2 hover:bg-muted">
            <Wheat className="size-5" />
          </Link>
          <Link href="/equipment" aria-label="Equipment" className="rounded-md p-2 hover:bg-muted">
            <Wrench className="size-5" />
          </Link>
        </div>
      </div>
    </header>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden">
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
          {label}
        </Link>
      ))}
    </nav>
  );
}

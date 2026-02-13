"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { Home } from "lucide-react";

type NavItem = { href: string; label: string; icon?: LucideIcon };

const navItems: NavItem[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/planung", label: "Planung" },
  { href: "/werkstatt", label: "Werkstatt" },
  { href: "/auswertung", label: "Auswertung" },
  { href: "/benutzer", label: "Benutzer" },
];

export function Header() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between gap-4 border-b bg-background px-6 py-4">
      <Link
        href="/"
        className="flex shrink-0 items-center focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded"
        aria-label="Zur Startseite"
      >
        <Image
          src="/logo.png"
          alt="R+R Metallbau AG"
          width={160}
          height={64}
          className="h-14 w-auto object-contain"
          priority
        />
      </Link>
      <nav className="flex flex-wrap items-center gap-2">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === "/"
              ? pathname === "/"
              : pathname.startsWith(href);
          return (
            <Button
              key={href}
              asChild
              variant={isActive ? "default" : "outline"}
              size="default"
            >
              <Link
                href={href}
                className={cn(
                  "flex items-center gap-2",
                  isActive && "pointer-events-none"
                )}
              >
                {Icon && <Icon className="h-4 w-4" />}
                {label}
              </Link>
            </Button>
          );
        })}
      </nav>
    </header>
  );
}

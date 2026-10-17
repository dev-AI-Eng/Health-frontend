"use client";

/**
 * The application shell: sidebar, header, theme and session controls.
 *
 * A sidebar rather than a top nav. The sections here are destinations a
 * receptionist moves between all day, and a vertical list keeps every one
 * visible, leaves the full width for a table of appointments, and has room to
 * grow — M4 adds reporting, M6 adds surgery, and a top bar runs out of space.
 *
 * It collapses to a sheet below `lg`, because a clinic's front desk is
 * sometimes a tablet.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import {
  CalendarDays,
  FileCheck2,
  Inbox,
  LayoutDashboard,
  Loader2,
  Menu,
  Moon,
  MessagesSquare,
  PhoneCall,
  Stethoscope,
  Sun,
  Upload,
  Users,
} from "lucide-react";
import { cn } from "cn";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import type { Locale } from "@/lib/i18n";
import { LOCALE_COOKIE } from "@/lib/i18n";

const ICONS = {
  overview: LayoutDashboard,
  patients: Users,
  doctors: Stethoscope,
  appointments: CalendarDays,
  pending: Inbox,
  import: Upload,
  audit: FileCheck2,
  handsets: PhoneCall,
  conversation: MessagesSquare,
} as const;

/**
 * One sidebar destination, with its label already resolved.
 *
 * The label arrives as a string rather than a copy key and a translator,
 * because a function cannot cross the server/client boundary -- React can only
 * serialise data. The layout looks every label up and passes the words.
 */
export interface NavItem {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
}

/** The words the shell shows. Resolved on the server. */
export interface ShellLabels {
  clinic: string;
  signIn: string;
  signOut: string;
  admin: string;
}

function NavLinks({
  items,
  pending,
  onNavigate,
}: {
  items: readonly NavItem[];
  pending: number;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="grid gap-1">
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        // Exact for the overview, prefix for the rest, so /appointments/new
        // keeps Citas highlighted rather than nothing.
        const active =
          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        const count = item.icon === "pending" ? pending : 0;

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            <span className="flex-1 truncate">{item.label}</span>
            {count > 0 ? (
              <Badge
                variant="secondary"
                className="status-held h-5 min-w-5 justify-center px-1.5 text-[11px] ring-1 ring-inset"
              >
                {count > 99 ? "99+" : count}
              </Badge>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

function Wordmark() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className="bg-primary text-primary-foreground grid size-8 shrink-0 place-items-center rounded-lg text-sm font-semibold">
        C
      </span>
      <span className="truncate text-[15px] font-semibold tracking-tight">
        Clinic Scheduler
      </span>
    </Link>
  );
}

/**
 * Light and dark, remembered on this browser.
 *
 * A class on `<html>` and a cookie, rather than `next-themes`: every page here
 * renders on the server, and the cookie means the first paint is already in the
 * right theme instead of flashing light and correcting itself.
 */
function ThemeToggle({ theme }: { theme: "light" | "dark" }) {
  const [current, setCurrent] = useState(theme);
  const next = current === "dark" ? "light" : "dark";
  const Icon = current === "dark" ? Sun : Moon;

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={next === "dark" ? "Modo oscuro" : "Modo claro"}
      onClick={() => {
        document.cookie = `dashboard_theme=${next}; path=/; max-age=31536000; samesite=lax`;
        document.documentElement.classList.toggle("dark", next === "dark");
        setCurrent(next);
      }}
    >
      <Icon className="size-4" />
    </Button>
  );
}

function LocaleToggle({ locale }: { locale: Locale }) {
  const [pending, start] = useTransition();
  const next: Locale = locale === "es" ? "en" : "es";

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      aria-label={next === "en" ? "Switch to English" : "Cambiar a español"}
      onClick={() => {
        document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
        // The server renders the language, so the page is re-fetched rather
        // than re-rendered from what the browser already holds.
        start(() => window.location.reload());
      }}
      className="font-mono text-xs"
    >
      {pending ? <Loader2 className="size-3.5 animate-spin" /> : next.toUpperCase()}
    </Button>
  );
}

/**
 * Who you are signed in as, and the way out.
 *
 * `staff` is not a lesser user: it is the default, and the badge says what it
 * can see rather than what it cannot. The point a receptionist needs is "the
 * numbers on screen are masked", not "you lack a permission".
 */
function SessionBadge({
  role,
  labels,
  signOut,
}: {
  role: "staff" | "admin";
  labels: ShellLabels;
  signOut: () => Promise<{ ok: boolean; message: string }>;
}) {
  const [pending, start] = useTransition();

  if (role === "staff") {
    return (
      <Button variant="outline" size="sm" asChild>
        <Link href="/sign-in">{labels.signIn}</Link>
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Badge className="status-confirmed ring-1 ring-inset">{labels.admin}</Badge>
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await signOut();
            if (result.ok) {
              toast.success(result.message);
              window.location.reload();
            } else {
              toast.error(result.message);
            }
          })
        }
      >
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : labels.signOut}
      </Button>
    </div>
  );
}

export function Shell({
  children,
  locale,
  theme,
  role,
  clinicName,
  pendingCount,
  nav,
  labels,
  signOut,
}: {
  children: React.ReactNode;
  locale: Locale;
  theme: "light" | "dark";
  role: "staff" | "admin";
  clinicName: string | null;
  pendingCount: number;
  nav: readonly NavItem[];
  labels: ShellLabels;
  /** A Server Action, which React can pass across the boundary. */
  signOut: () => Promise<{ ok: boolean; message: string }>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-svh">
      {/* The sidebar, fixed on a desktop. */}
      <aside className="bg-sidebar border-sidebar-border hidden w-64 shrink-0 flex-col border-r lg:flex">
        <div className="flex h-16 items-center px-5">
          <Wordmark />
        </div>
        <div className="flex-1 px-3 py-2">
          <NavLinks items={nav} pending={pendingCount} />
        </div>
        {clinicName ? (
          <div className="px-5 py-4">
            <Separator className="mb-4" />
            <p className="text-muted-foreground text-xs">{labels.clinic}</p>
            <p className="truncate text-sm font-medium">{clinicName}</p>
          </div>
        ) : null}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-background/80 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-30 flex h-16 items-center gap-3 border-b px-4 backdrop-blur sm:px-6">
          {/* Below lg the sidebar becomes a sheet. */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Menú">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetTitle className="sr-only">Clinic Scheduler</SheetTitle>
              <div className="flex h-16 items-center px-5">
                <Wordmark />
              </div>
              <div className="px-3">
                <NavLinks items={nav} pending={pendingCount} onNavigate={() => setOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>

          <div className="min-w-0 flex-1 lg:hidden">
            <Wordmark />
          </div>

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <SessionBadge role={role} labels={labels} signOut={signOut} />
            <Separator orientation="vertical" className="hidden h-6 sm:block" />
            <LocaleToggle locale={locale} />
            <ThemeToggle theme={theme} />
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}

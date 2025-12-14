'use client';

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, BarChart3, Home, Package, Settings, Store } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const navLinks = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/stores", label: "Stores", icon: Store },
  { href: "/products", label: "Products", icon: Package },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

const mainTabs = navLinks.map((l) => l.href);

function usePageTitle(pathname: string) {
  if (pathname.startsWith("/stores/")) return "Store Detail";
  if (pathname.startsWith("/stores")) return "Stores";
  if (pathname.startsWith("/products")) return "Products";
  return "Dashboard";
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const title = usePageTitle(pathname);
  const showBack = !mainTabs.includes(pathname);

  return (
    <div className="flex h-screen flex-col bg-black text-slate-100 md:flex-row md:overflow-hidden">
      {/* Sidebar (desktop) */}
      <aside className="hidden w-full flex-none border-r border-slate-900/80 bg-black/80 px-4 py-6 backdrop-blur md:block md:w-64">
        <nav className="flex flex-col gap-2">
          {navLinks.map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition",
                  "border border-transparent hover:border-slate-800 hover:bg-slate-900/60",
                  active && "border-slate-800 bg-slate-900/80 text-white",
                )}
              >
                <Icon className="h-4 w-4" />
                {link.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Content column */}
      <div className="flex flex-1 flex-grow flex-col md:overflow-hidden">
        {/* Top header (mobile only) */}
        <header className="md:hidden border-b border-slate-900/80 bg-black/80 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
            {showBack && (
              <Button
                variant="outline"
                size="sm"
                className="border-slate-800"
                onClick={() => router.back()}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <div className="flex flex-col">
              <span className="text-xs uppercase tracking-[0.25em] text-slate-500">
                Penevan
              </span>
              <span className="text-base font-semibold text-white">{title}</span>
            </div>
          </div>
        </header>

        <main className="flex flex-1 flex-col overflow-y-auto px-4 pb-24 pt-4 sm:px-6 lg:px-8">
          {children}
        </main>

        {/* Bottom mobile nav */}
        <nav className="fixed bottom-0 left-0 right-0 z-50 flex border-t border-slate-900 bg-black/90 px-2 py-2 backdrop-blur md:hidden">
          {navLinks.map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold transition",
                  active ? "text-white" : "text-slate-400 hover:text-white",
                )}
              >
                <Icon className={cn("h-5 w-5", active ? "text-white" : "text-slate-400")} />
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

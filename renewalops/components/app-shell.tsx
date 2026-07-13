"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type AppShellProps = {
  children: ReactNode;
  title?: string;
  description?: string;
  [key: string]: unknown;
};

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/clients", label: "Clients" },
  { href: "/contracts", label: "Contracts" },
  { href: "/renewals", label: "Renewals" },
  { href: "/notifications", label: "Notifications" },
  { href: "/reports", label: "Reports" },
  { href: "/settings", label: "Settings" },
];

export function AppShell({ children, title, description }: AppShellProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="flex min-h-screen">
        <aside className="w-64 border-r bg-white">
          <div className="border-b px-6 py-5">
            <h1 className="text-xl font-bold text-blue-700">RenewalOps</h1>
            <p className="text-xs text-slate-500">Renewal management</p>
          </div>

          <nav className="space-y-1 px-3 py-4">
            {navItems.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block rounded-md px-3 py-2 text-sm font-medium ${
                    isActive
                      ? "bg-blue-50 text-blue-700"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="absolute bottom-0 w-64 border-t bg-white p-4 text-sm text-slate-600">
            <div className="mb-2">Help</div>
            <div>Logout</div>
          </div>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="flex h-16 items-center justify-between border-b bg-white px-6">
            <div className="w-full max-w-md">
              <input
                type="text"
                placeholder="Search clients, contracts, emails..."
                className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-600">Notifications</span>
              <div className="rounded-full bg-slate-100 px-3 py-2 text-sm">
                John Doe
              </div>
            </div>
          </header>

          <main className="flex-1 p-6">
            {(title || description) && (
              <div className="mb-6">
                {title && <h2 className="text-2xl font-bold">{title}</h2>}
                {description && (
                  <p className="mt-1 text-sm text-slate-600">{description}</p>
                )}
              </div>
            )}

            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
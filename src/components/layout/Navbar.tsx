"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Menu, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/demo", label: "Demo" },
  { href: "/metrics", label: "Metrics" },
  { href: "/upload", label: "Upload" },
  { href: "/about", label: "About" },
];

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-[#0a0a0a]/90 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2.5 group"
            onClick={() => setMobileOpen(false)}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10 border border-red-500/30 group-hover:bg-red-500/20 transition-colors duration-200">
              <Activity className="h-4 w-4 text-red-400" />
            </div>
            <span className="font-bold text-lg tracking-tight leading-none">
              <span className="text-red-400">Tuner</span>
              <span className="text-white">Data</span>
            </span>
            <span className="rounded-full bg-red-500/10 border border-red-500/20 px-2 py-0.5 text-[10px] font-semibold text-red-400 uppercase tracking-widest">
              Beta
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden sm:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "px-4 py-2 rounded-md text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-red-500/15 text-red-400 border border-red-500/25"
                      : "text-zinc-400 hover:text-white hover:bg-white/5"
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
            <Link
              href="/demo"
              className="ml-3 px-4 py-2 rounded-md text-sm font-semibold bg-red-600 text-white hover:bg-red-500 transition-colors duration-200 shadow-lg shadow-red-900/30"
            >
              Try Demo →
            </Link>
          </nav>

          {/* Mobile menu toggle */}
          <button
            className="sm:hidden p-2 rounded-md text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="sm:hidden border-t border-white/5 bg-[#0a0a0a] px-4 py-3 space-y-1">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "block px-4 py-2.5 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "bg-red-500/15 text-red-400"
                    : "text-zinc-400 hover:text-white hover:bg-white/5"
                )}
              >
                {link.label}
              </Link>
            );
          })}
          <Link
            href="/demo"
            onClick={() => setMobileOpen(false)}
            className="block mt-2 px-4 py-2.5 rounded-md text-sm font-semibold bg-red-600 text-white text-center"
          >
            Try Demo →
          </Link>
        </div>
      )}
    </header>
  );
}

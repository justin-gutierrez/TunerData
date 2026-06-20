import Link from "next/link";
import { Activity } from "lucide-react";
import { ContactWidgets } from "./ContactWidgets";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/demo", label: "Demo" },
  { href: "/metrics", label: "Metrics" },
  { href: "/upload", label: "Upload" },
  { href: "/about", label: "About" },
];

export function Footer() {
  return (
    <footer className="mt-auto border-t border-white/5 bg-[#0a0a0a]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid sm:grid-cols-3 gap-8 mb-8">
          {/* Brand */}
          <div>
            <Link href="/" className="inline-flex items-center gap-2 group mb-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-500/10 border border-red-500/30">
                <Activity className="h-3.5 w-3.5 text-red-400" />
              </div>
              <span className="font-bold text-base leading-none">
                <span className="text-red-400">Tuner</span>
                <span className="text-white">Data</span>
              </span>
            </Link>
            <p className="text-xs text-zinc-600 leading-relaxed max-w-xs">
              Browser-based automotive datalog validation for remote tuning workflows.
              Detect WOT pull windows, enforce tuner rules, generate compliance reports — 100% client-side.
            </p>
          </div>

          {/* Navigation */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 mb-3">
              Navigation
            </p>
            <ul className="space-y-2">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-zinc-500 hover:text-zinc-200 transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Tech stack */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 mb-3">
              Built with
            </p>
            <ul className="space-y-2">
              {[
                "Next.js 16 App Router",
                "TypeScript",
                "Tailwind CSS v4",
                "Recharts",
                "Framer Motion",
                "Vitest",
              ].map((tech) => (
                <li key={tech} className="text-sm text-zinc-500">
                  {tech}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Disclaimer + copyright */}
        <div className="border-t border-white/5 pt-6 space-y-3">
          <div className="rounded-lg border border-amber-500/15 bg-amber-500/5 px-4 py-3">
            <p className="text-xs text-amber-500/80 leading-relaxed text-center">
              <strong className="text-amber-400">Safety disclaimer:</strong> For
              closed-course, dyno, and educational use only. This tool validates
              datalog structure and procedure compliance — it does not provide
              tuning advice, engine calibration guidance, or driving instructions.
              Never use performance modifications on public roads. All tuning
              activities must comply with applicable laws and be performed by
              qualified professionals.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-[11px] text-zinc-700">
              © {new Date().getFullYear()} TunerData — Portfolio project. No real
              customer data is processed or stored.
            </p>
            <div className="flex items-center gap-4">
              <ContactWidgets />
              <span className="text-zinc-800 text-xs hidden sm:inline">·</span>
              <span className="text-[11px] text-zinc-700 hidden sm:inline">
                100% client-side processing
              </span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

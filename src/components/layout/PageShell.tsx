import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageShellProps {
  children: ReactNode;
  className?: string;
  /** Apply the subtle dot-grid background pattern */
  withGrid?: boolean;
}

export function PageShell({ children, className, withGrid }: PageShellProps) {
  return (
    <main
      className={cn(
        "mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-10",
        withGrid && "bg-grid",
        className
      )}
    >
      {children}
    </main>
  );
}

/** Full-bleed wrapper — no max-width or horizontal padding */
export function PageShellFull({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <main className={cn("w-full flex-1 flex flex-col", className)}>
      {children}
    </main>
  );
}

/** Section heading + optional sub-label */
export function SectionHeader({
  label,
  title,
  description,
  centered,
}: {
  label?: string;
  title: string;
  description?: string;
  centered?: boolean;
}) {
  return (
    <div className={cn("mb-10", centered && "text-center")}>
      {label && (
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-red-400">
          {label}
        </p>
      )}
      <h2 className="text-2xl sm:text-3xl font-bold text-slate-100">{title}</h2>
      {description && (
        <p className="mt-3 text-slate-400 max-w-2xl leading-relaxed">
          {description}
        </p>
      )}
    </div>
  );
}

import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface CardProps {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Card({ title, actions, children, className }: CardProps) {
  return (
    <section
      className={cn(
        "rounded-lg border border-neutral-200 bg-white shadow-sm",
        className,
      )}
    >
      {(title || actions) && (
        <header className="flex items-center justify-between gap-4 border-b border-neutral-100 px-6 py-4">
          {title && (
            <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>
          )}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className="px-6 py-4">{children}</div>
    </section>
  );
}

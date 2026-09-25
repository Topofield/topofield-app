import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface CardProps {
  title?: ReactNode;
  /** Subtítulo bajo el título, dentro de la cabecera. */
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Card({ title, description, actions, children, className }: CardProps) {
  return (
    <section
      className={cn(
        "rounded-lg border border-rule bg-card shadow-sm",
        className,
      )}
    >
      {(title || description || actions) && (
        <header className="flex items-center justify-between gap-4 border-b border-rule px-6 py-4">
          {(title || description) && (
            <div>
              {title && (
                <h2 className="text-lg font-semibold">{title}</h2>
              )}
              {description && (
                <p className="mt-1 text-sm text-ink-2">{description}</p>
              )}
            </div>
          )}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className="px-6 py-4">{children}</div>
    </section>
  );
}

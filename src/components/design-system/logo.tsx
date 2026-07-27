import { cn } from "@/lib/utils/cn";

/** Isotipo: vértice geodésico — triángulo de control con su punto de estación. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={cn("h-6 w-6", className)}
    >
      <path
        d="M12 3.5 21 20H3L12 3.5Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="14.5" r="2.25" fill="currentColor" />
    </svg>
  );
}

/** Marca completa: isotipo y palabra. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark className="h-6 w-6 text-primary-500" />
      <span className="font-display text-lg font-bold text-primary-700">
        TopoField
      </span>
    </span>
  );
}

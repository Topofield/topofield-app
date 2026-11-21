import type { ReactNode } from "react";
import Link from "next/link";
import { Logo, ThemeSelect } from "@/components/design-system";
import { readThemeChoice } from "@/lib/theme-server";

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const theme = await readThemeChoice();
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <ThemeSelect initial={theme} className="absolute top-3 right-3" />
      <header className="mb-6 text-center">
        <h1>
          {/* A la página de presentación (Fase 45). */}
          <Link href="/" className="inline-flex" aria-label="TopoField, página de presentación">
            <Logo className="justify-center text-2xl" />
          </Link>
        </h1>
        <p className="text-sm text-ink-2">
          Plataforma para procesos topográficos
        </p>
      </header>
      <main className="w-full max-w-md">{children}</main>
    </div>
  );
}

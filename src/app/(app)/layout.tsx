import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button, Logo, LogoMark, ThemeSelect } from "@/components/design-system";
import { EquipmentCatalogProvider } from "@/components/equipment/catalog-context";
import { createClient } from "@/lib/supabase/server";
import { getEquipment } from "@/lib/supabase/queries";
import { todayInBogota } from "@/lib/utils/format";
import { readThemeChoice } from "@/lib/theme-server";
import { signOutAction } from "./actions";

/**
 * Chrome de las pantallas autenticadas (dashboard, proyectos): header con marca,
 * correo del usuario y cierre de sesión. El proxy ya protege estas rutas; la
 * comprobación de `user` aquí es defensa adicional.
 */
export default async function AppLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const theme = await readThemeChoice();
  // El catálogo de equipos para los formularios de equipo (Fase 25).
  const equipment = await getEquipment(supabase);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-rule bg-card">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3">
          {/* En el teléfono, solo el isotipo: con «Equipos» (Fase 25) la
              palabra ya no cabe junto a los enlaces y el cierre de sesión. */}
          <Link
            href="/dashboard"
            aria-label="TopoField — ir al dashboard"
            className="shrink-0 rounded-md transition-opacity hover:opacity-80"
          >
            <LogoMark className="h-6 w-6 text-mira-strong sm:hidden" />
            <Logo className="hidden sm:inline-flex" />
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <span data-user-email className="hidden text-sm text-ink-2 sm:inline">
              {user.email}
            </span>
            {/* Visible también en móvil, al contrario que el correo: la ayuda
                hace falta sobre todo en el teléfono, en campo. */}
            <Link
              href="/equipos"
              className="text-sm font-medium text-ink underline-offset-2 hover:underline"
            >
              Equipos
            </Link>
            <Link
              href="/manual"
              className="text-sm font-medium text-ink underline-offset-2 hover:underline"
            >
              Manual
            </Link>
            <ThemeSelect initial={theme} />
            <form action={signOutAction}>
              <Button type="submit" variant="ghost" size="sm" className="whitespace-nowrap">
                Cerrar sesión
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <EquipmentCatalogProvider equipment={equipment} today={todayInBogota()}>
          {children}
        </EquipmentCatalogProvider>
      </main>
    </div>
  );
}

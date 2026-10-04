import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { EquipmentCatalogProvider } from "@/components/equipment/catalog-context";
import { AppBar } from "@/components/navigation/app-bar";
import { createClient } from "@/lib/supabase/server";
import { getEquipment } from "@/lib/supabase/queries";
import { todayInBogota } from "@/lib/utils/format";
import { readThemeChoice } from "@/lib/theme-server";
import { signOutAction } from "./actions";

/**
 * Chrome de las pantallas autenticadas (dashboard, proyectos): la barra fija
 * con la marca, Equipos, Manual y el menú de cuenta (Fase 33). El proxy ya
 * protege estas rutas; la comprobación de `user` aquí es defensa adicional.
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
      <AppBar email={user.email ?? ""} theme={theme} signOut={signOutAction} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-8">
        <EquipmentCatalogProvider equipment={equipment} today={todayInBogota()}>
          {children}
        </EquipmentCatalogProvider>
      </main>
    </div>
  );
}

import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppBar } from "@/components/navigation/app-bar";
import { createClient } from "@/lib/supabase/server";
import { readThemeChoice } from "@/lib/theme-server";
import { signOutAction } from "./actions";

/**
 * Chrome de las pantallas autenticadas (dashboard, proyectos): la barra fija
 * con la marca, el Manual y el menú de cuenta (Fase 33). El proxy ya
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

  return (
    <div className="flex min-h-screen flex-col">
      <AppBar email={user.email ?? ""} theme={theme} signOut={signOutAction} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-8">
        {children}
      </main>
    </div>
  );
}

import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button, Logo } from "@/components/design-system";
import { createClient } from "@/lib/supabase/server";
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

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3">
          <Link
            href="/dashboard"
            aria-label="TopoField — ir al dashboard"
            className="rounded-md transition-opacity hover:opacity-80"
          >
            <Logo />
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-neutral-500 sm:inline">
              {user.email}
            </span>
            {/* Visible también en móvil, al contrario que el correo: la ayuda
                hace falta sobre todo en el teléfono, en campo. */}
            <Link
              href="/manual"
              className="text-sm font-medium text-primary-600 transition-colors hover:text-primary-700"
            >
              Manual
            </Link>
            <form action={signOutAction}>
              <Button type="submit" variant="ghost" size="sm">
                Cerrar sesión
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        {children}
      </main>
    </div>
  );
}

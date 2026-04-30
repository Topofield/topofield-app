import { redirect } from "next/navigation";
import { Button, Card } from "@/components/design-system";
import { createClient } from "@/lib/supabase/server";
import { signOutAction } from "./actions";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Defensa adicional al proxy: si por algún motivo llegas aquí sin user,
  // redirige sin renderizar.
  if (!user) {
    redirect("/sign-in");
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-12">
      <Card
        title="Dashboard"
        actions={
          <form action={signOutAction}>
            <Button type="submit" variant="ghost" size="sm">
              Cerrar sesión
            </Button>
          </form>
        }
      >
        <p className="text-neutral-700">
          Bienvenido, <span className="font-medium">{user.email}</span>.
        </p>
        <p className="mt-2 text-sm text-neutral-500">
          Esta es una pantalla provisional de la Fase 1 (Setup). El dashboard
          real con proyectos y KPIs se implementa en la Fase 2.
        </p>
      </Card>
    </div>
  );
}

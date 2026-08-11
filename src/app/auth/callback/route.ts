import { NextResponse, type NextRequest } from "next/server";
import { crearProyectoDemo } from "@/lib/demo/crear-proyecto-demo";
import { createClient } from "@/lib/supabase/server";

/**
 * Vuelta del enlace de confirmación de correo.
 *
 * `@supabase/ssr` usa PKCE, así que el enlace trae un `code` que hay que
 * canjear por una sesión: hasta que eso ocurre el usuario no está autenticado.
 * Por eso es una Route Handler y no una página, y por eso `/auth/callback`
 * tiene que ser ruta pública en `proxy.ts`.
 *
 * Es también el momento exacto en que sabemos que un usuario confirma su cuenta
 * por primera vez, así que aquí se le crea el proyecto de ejemplo.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const errorDescription = searchParams.get("error_description");

  if (errorDescription) {
    return NextResponse.redirect(
      `${origin}/sign-in?error=${encodeURIComponent(errorDescription)}`,
    );
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/sign-in`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      `${origin}/sign-in?error=${encodeURIComponent(
        "El enlace de confirmación no es válido o ya caducó.",
      )}`,
    );
  }

  // El proyecto de ejemplo es un extra: si falla, el usuario entra igual y
  // encuentra una cuenta vacía, que es el mismo estado que tendría sin esta
  // funcionalidad. Nunca debe dejarlo fuera de su cuenta.
  const userId = data.user?.id;
  if (userId) {
    try {
      await crearProyectoDemo(supabase, userId);
    } catch (e) {
      console.error("No se pudo crear el proyecto de ejemplo:", e);
    }
  }

  return NextResponse.redirect(`${origin}/dashboard`);
}

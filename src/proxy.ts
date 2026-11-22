import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/auth/next-path";
import { updateSession } from "@/lib/supabase/middleware";

// Rutas accesibles sin sesión. `/auth/callback` lo es porque la sesión se
// obtiene justamente ahí, al canjear el código del correo de confirmación.
const PUBLIC_ROUTES = new Set([
  "/sign-in",
  "/sign-up",
  "/sign-up/revisa-tu-correo",
  "/solicitar-invitacion",
  "/auth/callback",
]);

/**
 * Rutas que deben ejecutarse siempre, haya sesión o no.
 *
 * `/auth/callback` canjea el código del correo por una sesión. Si el proxy lo
 * desviara al dashboard por «ya tener sesión» —cosa que ocurre si el usuario
 * vuelve a pulsar el enlace—, el canje no llegaría a ejecutarse y el proyecto
 * de ejemplo no se crearía nunca, sin ningún error visible.
 */
const RUTAS_SIN_DESVIO = new Set(["/auth/callback"]);

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const path = request.nextUrl.pathname;

  if (RUTAS_SIN_DESVIO.has(path)) return response;

  if (!user && !PUBLIC_ROUTES.has(path) && path !== "/") {
    // Al entrar, vuelve a donde iba (Fase 46: el enlace del correo al
    // administrador). El dashboard es el destino por defecto: no hace falta
    // anotarlo.
    const destino = new URL("/sign-in", request.url);
    if (path !== "/dashboard") {
      destino.searchParams.set("next", path + request.nextUrl.search);
    }
    return NextResponse.redirect(destino);
  }

  if (user && (PUBLIC_ROUTES.has(path) || path === "/")) {
    const next =
      path === "/sign-in" ? safeNextPath(request.nextUrl.searchParams.get("next")) : null;
    return NextResponse.redirect(new URL(next ?? "/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

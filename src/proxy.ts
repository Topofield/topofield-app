import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Rutas accesibles sin sesión. `/auth/callback` lo es porque la sesión se
// obtiene justamente ahí, al canjear el código del correo de confirmación.
const PUBLIC_ROUTES = new Set([
  "/sign-in",
  "/sign-up",
  "/sign-up/revisa-tu-correo",
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
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  if (user && (PUBLIC_ROUTES.has(path) || path === "/")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

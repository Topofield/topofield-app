import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Helper que se llama desde `src/proxy.ts` (Next 16) para refrescar el token
 * de Supabase en cada request y exponer el usuario actual al proxy para que
 * decida redirecciones según sesión.
 *
 * Devuelve la response (con cookies actualizadas) y el user (o null si no hay sesión).
 */
export async function updateSession(
  request: NextRequest,
): Promise<{ response: NextResponse; user: User | null }> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Importante: getUser() refresca el token si caducó y emite las cookies nuevas
  // vía el callback setAll de arriba.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user };
}

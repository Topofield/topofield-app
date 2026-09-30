// Nombre del responsable de un cierre (Fase 22).
//
// `closed_by` guarda el id del usuario, y el informe y el Excel lo imprimían
// tal cual: un UUID. Se resuelve contra `profiles`. RLS deja leer solo el
// perfil propio, lo que basta mientras cada proyecto tenga un único dueño
// (un solo rol, CLAUDE.md): quien cerró es siempre el usuario de la sesión.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;

interface ProfileName {
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
}

/** Nombre para mostrar: el completo, o nombre y apellido, o el correo. Pura. */
export function responsibleLabel(profile: ProfileName | null, email: string | null): string | null {
  const full = profile?.full_name?.trim();
  if (full) return full;
  const parts = [profile?.first_name, profile?.last_name].map((s) => s?.trim()).filter(Boolean);
  if (parts.length > 0) return parts.join(" ");
  return email?.trim() || null;
}

/** Nombre de cada id de usuario que se pueda resolver. */
export async function responsibleNames(
  supabase: Client,
  ids: (string | null | undefined)[],
): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  const names = new Map<string, string>();
  if (unique.length === 0) return names;

  const [{ data: profiles }, { data: auth }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, first_name, last_name").in("id", unique),
    supabase.auth.getUser(),
  ]);
  for (const id of unique) {
    const profile = profiles?.find((p) => p.id === id) ?? null;
    const email = auth.user?.id === id ? (auth.user.email ?? null) : null;
    const label = responsibleLabel(profile, email);
    if (label) names.set(id, label);
  }
  return names;
}

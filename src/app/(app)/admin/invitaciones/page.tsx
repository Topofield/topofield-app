import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { CopyCodeButton } from "@/components/admin/copy-code-button";
import { Badge, Button, Card, EmptyState, PageHeader } from "@/components/design-system";
import { formatInviteCode } from "@/lib/auth/invite-code";
import { createClient } from "@/lib/supabase/server";
import { formatSavedAt } from "@/lib/utils/format";
import type { Database } from "@/types/database";
import { aceptarInvitacionAction, rechazarInvitacionAction } from "./actions";

export const metadata: Metadata = { title: "Invitaciones — TopoField" };

type Invitacion = Database["public"]["Tables"]["invitations"]["Row"];

/**
 * Las solicitudes de invitación (Fase 46). Solo para el administrador: a
 * cualquier otro, 404 —ni siquiera sabe que la página existe—. Las políticas
 * de la tabla dicen lo mismo: aunque llegara aquí, no leería nada.
 */
export default async function InvitacionesPage() {
  const supabase = await createClient();
  const { data: esAdmin } = await supabase.rpc("is_admin");
  if (!esAdmin) notFound();

  const { data, error } = await supabase
    .from("invitations")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`No se pudieron leer las solicitudes: ${error.message}`);

  const todas = data ?? [];
  const pendientes = todas.filter((i) => i.status === "pending");
  const aceptadas = todas.filter((i) => i.status === "approved" || i.status === "used");
  const rechazadas = todas.filter((i) => i.status === "rejected");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Invitaciones" }]}
        title="Invitaciones"
        subtitle="Acepte una solicitud para generar su código y compártalo con esa persona. El correo de la solicitud no se verifica: comparta el código solo con quien reconoce."
      />

      <Card title={`Pendientes (${pendientes.length})`}>
        {pendientes.length === 0 ? (
          <EmptyState title="No hay solicitudes pendientes" description="Cuando alguien pida una invitación, le llegará un correo y aparecerá aquí." />
        ) : (
          <ul className="flex flex-col divide-y divide-rule">
            {pendientes.map((i) => (
              <Solicitud key={i.id} inv={i}>
                <form action={aceptarInvitacionAction}>
                  <input type="hidden" name="id" value={i.id} />
                  <Button type="submit" size="sm">
                    Aceptar
                  </Button>
                </form>
                <form action={rechazarInvitacionAction}>
                  <input type="hidden" name="id" value={i.id} />
                  <Button type="submit" variant="secondary" size="sm">
                    Rechazar
                  </Button>
                </form>
              </Solicitud>
            ))}
          </ul>
        )}
      </Card>

      <Card title={`Aceptadas (${aceptadas.length})`}>
        {aceptadas.length === 0 ? (
          <p className="text-sm text-ink-2">Todavía no ha aceptado ninguna.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-rule">
            {aceptadas.map((i) => (
              <Solicitud key={i.id} inv={i}>
                {i.status === "used" ? (
                  <Badge tone="success">Cuenta creada{i.used_at ? ` · ${formatSavedAt(i.used_at)}` : ""}</Badge>
                ) : (
                  <>
                    <code className="rounded-md border border-rule bg-paper px-2.5 py-1 font-mono text-base font-semibold tracking-wider">
                      {formatInviteCode(i.code ?? "")}
                    </code>
                    <CopyCodeButton code={formatInviteCode(i.code ?? "")} />
                  </>
                )}
              </Solicitud>
            ))}
          </ul>
        )}
      </Card>

      {rechazadas.length > 0 && (
        <Card title={`Rechazadas (${rechazadas.length})`}>
          <ul className="flex flex-col divide-y divide-rule">
            {rechazadas.map((i) => (
              <Solicitud key={i.id} inv={i} />
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

/** Una solicitud: quién, de dónde, para qué; a la derecha, lo que se puede hacer. */
function Solicitud({ inv, children }: { inv: Invitacion; children?: ReactNode }) {
  return (
    <li className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="font-medium">
          {inv.first_name} {inv.last_name}
          {inv.company && <span className="font-normal text-ink-2"> · {inv.company}</span>}
        </p>
        <p className="text-sm break-all text-ink-2">{inv.email}</p>
        {inv.purpose && <p className="mt-1 max-w-prose text-sm whitespace-pre-wrap">{inv.purpose}</p>}
        <p className="mt-1 text-xs text-ink-3">Solicitada el {formatSavedAt(inv.created_at)}</p>
      </div>
      {children && <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>}
    </li>
  );
}

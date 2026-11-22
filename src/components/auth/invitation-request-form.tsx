"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Alert, Button, Input, Textarea } from "@/components/design-system";
import {
  solicitarInvitacionAction,
  type SolicitudState,
} from "@/app/(auth)/solicitar-invitacion/actions";
import { HONEYPOT_FIELD, INVITATION_LIMITS } from "@/lib/validators/invitation";

const INICIAL: SolicitudState = {};

/** El formulario de «Solicitar invitación» y, al enviarlo, su confirmación. */
export function InvitationRequestForm() {
  const [state, formAction, isPending] = useActionState(solicitarInvitacionAction, INICIAL);
  const errores = state.fieldErrors ?? {};

  if (state.sent) {
    return (
      <div className="flex flex-col gap-4" role="status">
        <p className="text-ink">
          Recibimos su solicitud. Si se aprueba, le haremos llegar un código de
          invitación.
        </p>
        <p className="text-sm text-ink-2">
          Con el código, cree su cuenta en{" "}
          <Link href="/sign-up" className="font-medium text-ink underline decoration-mira-strong underline-offset-2">
            Crear cuenta
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state.error && <Alert variant="error">{state.error}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Nombre"
          name="first_name"
          autoComplete="given-name"
          maxLength={INVITATION_LIMITS.name}
          defaultValue={state.values?.first_name}
          error={errores.first_name}
          required
        />
        <Input
          label="Apellido"
          name="last_name"
          autoComplete="family-name"
          maxLength={INVITATION_LIMITS.name}
          defaultValue={state.values?.last_name}
          error={errores.last_name}
          required
        />
      </div>
      <Input
        label="Correo"
        name="email"
        type="email"
        autoComplete="email"
        maxLength={INVITATION_LIMITS.email}
        defaultValue={state.values?.email}
        error={errores.email}
        helperText="Con este correo creará su cuenta."
        required
      />
      <Input
        label="Empresa o entidad (opcional)"
        name="company"
        autoComplete="organization"
        maxLength={INVITATION_LIMITS.company}
        defaultValue={state.values?.company}
        error={errores.company}
      />
      <Textarea
        label="¿Para qué quiere usar TopoField? (opcional)"
        name="purpose"
        rows={3}
        maxLength={INVITATION_LIMITS.purpose}
        defaultValue={state.values?.purpose}
        error={errores.purpose}
      />
      {/* El campo trampa: fuera de la vista y del teclado; lo llenan los robots. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Sitio web
          <input type="text" name={HONEYPOT_FIELD} tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <Button type="submit" size="lg" disabled={isPending}>
        {isPending ? "Enviando…" : "Solicitar invitación"}
      </Button>
    </form>
  );
}

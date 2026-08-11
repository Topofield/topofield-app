"use client";

import { useActionState, useState } from "react";
import { Alert, Button, Input } from "@/components/design-system";
import { signUpAction, type SignUpState } from "@/app/(auth)/sign-up/actions";

const INITIAL_STATE: SignUpState = {};

/**
 * Formulario de registro.
 *
 * Usa `useActionState` —y no `<form action>` plano— para no perder lo escrito
 * cuando falla: con el código de invitación, el error más probable («código
 * incorrecto») no tiene nada que ver con los demás campos, y obligar a
 * teclearlos otra vez sería gratuito. Mismo patrón que el asistente de
 * proyecto.
 */
export function SignUpForm() {
  const [state, formAction, isPending] = useActionState(
    signUpAction,
    INITIAL_STATE,
  );
  const fieldErrors = state.fieldErrors ?? {};

  // La contraseña se controla en el cliente y nunca vuelve del servidor: así
  // sobrevive a un error —el más probable es «código no válido», que no tiene
  // nada que ver con ella— sin que el servidor tenga que devolverla.
  const [password, setPassword] = useState("");

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error && <Alert variant="error">{state.error}</Alert>}

      <Input
        label="Código de invitación"
        name="invite_code"
        type="text"
        autoComplete="off"
        defaultValue={state.values?.invite_code}
        error={fieldErrors.invite_code}
        helperText="Necesita una invitación para crear una cuenta."
      />
      <Input
        label="Nombre"
        name="first_name"
        type="text"
        autoComplete="given-name"
        defaultValue={state.values?.first_name}
        error={fieldErrors.first_name}
      />
      <Input
        label="Apellido"
        name="last_name"
        type="text"
        autoComplete="family-name"
        defaultValue={state.values?.last_name}
        error={fieldErrors.last_name}
      />
      <Input
        label="Correo"
        name="email"
        type="email"
        autoComplete="email"
        defaultValue={state.values?.email}
        error={fieldErrors.email}
      />
      <Input
        label="Contraseña"
        name="password"
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={fieldErrors.password}
        helperText="Mínimo 6 caracteres."
      />

      <Button type="submit" variant="primary" size="lg" disabled={isPending}>
        {isPending ? "Creando cuenta…" : "Crear cuenta"}
      </Button>
    </form>
  );
}

"use client";

import { useActionState, useState } from "react";
import { Alert, Button, Input } from "@/components/design-system";
import { signUpAction, type SignUpState } from "@/app/(auth)/sign-up/actions";
import { MIN_PASSWORD } from "@/lib/validators/sign-up";

const INITIAL_STATE: SignUpState = { step: "invitacion" };

/**
 * Registro con invitación (Fase 46): primero el correo y el código; si la
 * invitación existe, la contraseña. Los dos pasos son el mismo formulario y
 * la misma acción, que dice en `state.step` cuál toca.
 *
 * La contraseña se controla en el cliente y nunca vuelve del servidor: así
 * sobrevive a un error sin que el servidor tenga que devolverla.
 */
export function SignUpForm() {
  const [state, formAction, isPending] = useActionState(signUpAction, INITIAL_STATE);
  const fieldErrors = state.fieldErrors ?? {};
  const [password, setPassword] = useState("");
  const enContrasena = state.step === "contrasena";

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state.error && <Alert variant="error">{state.error}</Alert>}
      <input type="hidden" name="step" value={state.step} />

      {enContrasena ? (
        <>
          <input type="hidden" name="email" value={state.values?.email ?? ""} />
          <input type="hidden" name="invite_code" value={state.values?.invite_code ?? ""} />
          <Alert variant="success">
            Invitación encontrada para <strong className="font-semibold">{state.values?.email}</strong>.
            Elija una contraseña para su cuenta.
          </Alert>
          <Input
            label="Contraseña"
            name="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={fieldErrors.password}
            helperText={`Mínimo ${MIN_PASSWORD} caracteres.`}
            autoFocus
            required
          />
          <Button type="submit" size="lg" disabled={isPending}>
            {isPending ? "Creando cuenta…" : "Crear cuenta"}
          </Button>
        </>
      ) : (
        <>
          <Input
            label="Correo"
            name="email"
            type="email"
            autoComplete="email"
            defaultValue={state.values?.email}
            error={fieldErrors.email}
            helperText="El mismo con el que solicitó la invitación."
            required
          />
          <Input
            label="Código de invitación"
            name="invite_code"
            type="text"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="ABCD-EFGH"
            defaultValue={state.values?.invite_code}
            error={fieldErrors.invite_code}
            required
          />
          <Button type="submit" size="lg" disabled={isPending}>
            {isPending ? "Comprobando…" : "Continuar"}
          </Button>
        </>
      )}
    </form>
  );
}

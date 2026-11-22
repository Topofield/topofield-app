import Link from "next/link";
import { Alert, Button, Card, Input } from "@/components/design-system";
import { safeNextPath } from "@/lib/auth/next-path";
import { signInAction } from "./actions";

interface SignInPageProps {
  searchParams: Promise<{ error?: string; next?: string }>;
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const { error, next } = await searchParams;
  const destino = safeNextPath(next);

  return (
    <Card title="Iniciar sesión">
      <form action={signInAction} className="flex flex-col gap-4">
        {destino && <input type="hidden" name="next" value={destino} />}
        {error && <Alert variant="error">{error}</Alert>}
        <Input
          label="Correo"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
        <Input
          label="Contraseña"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          minLength={6}
        />
        <Button type="submit" variant="primary" size="lg">
          Entrar
        </Button>
      </form>
      <div className="mt-4 flex flex-col gap-1 text-sm text-ink-2">
        <p>
          ¿Tiene un código de invitación?{" "}
          <Link href="/sign-up" className="font-medium text-ink underline decoration-mira-strong underline-offset-2">
            Crear cuenta
          </Link>
        </p>
        <p>
          ¿No tiene cuenta?{" "}
          <Link href="/solicitar-invitacion" className="font-medium text-ink underline decoration-mira-strong underline-offset-2">
            Solicite una invitación
          </Link>
        </p>
      </div>
    </Card>
  );
}

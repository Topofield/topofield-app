import Link from "next/link";
import { Alert, Button, Card, Input } from "@/components/design-system";
import { signInAction } from "./actions";

interface SignInPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const { error } = await searchParams;

  return (
    <Card title="Iniciar sesión">
      <form action={signInAction} className="flex flex-col gap-4">
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
      <p className="mt-4 text-sm text-neutral-500">
        ¿No tienes cuenta?{" "}
        <Link href="/sign-up" className="font-medium text-primary-600">
          Regístrate
        </Link>
      </p>
    </Card>
  );
}

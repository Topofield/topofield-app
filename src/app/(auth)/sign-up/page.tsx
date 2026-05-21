import Link from "next/link";
import { Alert, Button, Card, Input } from "@/components/design-system";
import { signUpAction } from "./actions";

interface SignUpPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const { error } = await searchParams;

  return (
    <Card title="Crear cuenta">
      <form action={signUpAction} className="flex flex-col gap-4">
        {error && <Alert variant="error">{error}</Alert>}
        <Input
          label="Nombre"
          name="first_name"
          type="text"
          autoComplete="given-name"
          required
        />
        <Input
          label="Apellido"
          name="last_name"
          type="text"
          autoComplete="family-name"
          required
        />
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
          autoComplete="new-password"
          required
          minLength={6}
          helperText="Mínimo 6 caracteres."
        />
        <Button type="submit" variant="primary" size="lg">
          Crear cuenta
        </Button>
      </form>
      <p className="mt-4 text-sm text-neutral-500">
        ¿Ya tienes cuenta?{" "}
        <Link href="/sign-in" className="font-medium text-primary-600">
          Inicia sesión
        </Link>
      </p>
    </Card>
  );
}

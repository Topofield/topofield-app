import Link from "next/link";
import { Card } from "@/components/design-system";
import { SignUpForm } from "@/components/auth/sign-up-form";

export default function SignUpPage() {
  return (
    <Card title="Crear cuenta">
      <SignUpForm />
      <p className="mt-4 text-sm text-ink-2">
        ¿Ya tienes cuenta?{" "}
        <Link href="/sign-in" className="font-medium text-ink underline decoration-mira-strong underline-offset-2">
          Inicia sesión
        </Link>
      </p>
    </Card>
  );
}

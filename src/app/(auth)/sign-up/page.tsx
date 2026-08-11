import Link from "next/link";
import { Card } from "@/components/design-system";
import { SignUpForm } from "@/components/auth/sign-up-form";

export default function SignUpPage() {
  return (
    <Card title="Crear cuenta">
      <SignUpForm />
      <p className="mt-4 text-sm text-neutral-500">
        ¿Ya tienes cuenta?{" "}
        <Link href="/sign-in" className="font-medium text-primary-600">
          Inicia sesión
        </Link>
      </p>
    </Card>
  );
}

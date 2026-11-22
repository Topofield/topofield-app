import Link from "next/link";
import { Card } from "@/components/design-system";
import { SignUpForm } from "@/components/auth/sign-up-form";

export default function SignUpPage() {
  return (
    <Card title="Crear cuenta">
      <SignUpForm />
      <div className="mt-4 flex flex-col gap-1 text-sm text-ink-2">
        <p>
          ¿No tiene código?{" "}
          <Link href="/solicitar-invitacion" className="font-medium text-ink underline decoration-mira-strong underline-offset-2">
            Solicite una invitación
          </Link>
        </p>
        <p>
          ¿Ya tiene cuenta?{" "}
          <Link href="/sign-in" className="font-medium text-ink underline decoration-mira-strong underline-offset-2">
            Inicie sesión
          </Link>
        </p>
      </div>
    </Card>
  );
}

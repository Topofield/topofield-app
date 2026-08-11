import Link from "next/link";
import { Card } from "@/components/design-system";

export const metadata = {
  title: "Revise su correo — TopoField",
};

/**
 * Pantalla posterior al registro.
 *
 * Con la confirmación de correo activa, `signUp` no deja sesión iniciada: el
 * usuario tiene que pulsar el enlace que le llega antes de poder entrar.
 */
export default function RevisaTuCorreoPage() {
  return (
    <Card title="Revise su correo">
      <div className="flex flex-col gap-4 text-neutral-800">
        <p>
          Le enviamos un mensaje para confirmar su cuenta. Ábralo y pulse el
          enlace para terminar el registro.
        </p>
        <p className="text-sm text-neutral-500">
          Si no lo encuentra, revise la carpeta de correo no deseado. El enlace
          caduca, así que si tarda mucho tendrá que registrarse de nuevo.
        </p>
        <p className="text-sm">
          <Link href="/sign-in" className="font-medium text-primary-600">
            Volver a iniciar sesión
          </Link>
        </p>
      </div>
    </Card>
  );
}

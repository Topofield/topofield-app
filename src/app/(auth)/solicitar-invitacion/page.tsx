import Link from "next/link";
import { Card } from "@/components/design-system";
import { InvitationRequestForm } from "@/components/auth/invitation-request-form";

export const metadata = {
  title: "Solicitar invitación — TopoField",
};

export default function SolicitarInvitacionPage() {
  return (
    <Card
      title="Solicitar invitación"
      description="TopoField funciona por invitación. Cuéntenos quién es y le responderemos con un código para crear su cuenta."
    >
      <InvitationRequestForm />
      <p className="mt-4 text-sm text-ink-2">
        ¿Ya tiene un código?{" "}
        <Link href="/sign-up" className="font-medium text-ink underline decoration-mira-strong underline-offset-2">
          Crear cuenta
        </Link>
      </p>
    </Card>
  );
}

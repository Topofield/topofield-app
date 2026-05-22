import Link from "next/link";
import { buttonClasses } from "@/components/design-system";

export default function ProjectNotFound() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <h1 className="text-2xl font-bold text-neutral-900">
        Proyecto no encontrado
      </h1>
      <p className="text-sm text-neutral-500">
        El proyecto no existe o no tienes acceso a él.
      </p>
      <Link href="/dashboard" className={buttonClasses()}>
        Volver al dashboard
      </Link>
    </div>
  );
}

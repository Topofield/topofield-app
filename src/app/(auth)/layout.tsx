import type { ReactNode } from "react";
import { Logo } from "@/components/design-system";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <header className="mb-6 text-center">
        <h1>
          <Logo className="justify-center text-2xl" />
        </h1>
        <p className="text-sm text-neutral-500">
          Plataforma para procesos topográficos
        </p>
      </header>
      <main className="w-full max-w-md">{children}</main>
    </div>
  );
}

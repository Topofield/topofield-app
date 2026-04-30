import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 px-4 py-12">
      <header className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-primary-700">TopoField</h1>
        <p className="text-sm text-neutral-500">
          Plataforma para procesos topográficos
        </p>
      </header>
      <main className="w-full max-w-md">{children}</main>
    </div>
  );
}

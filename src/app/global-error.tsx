"use client";

import { IconAlertTriangle } from "@tabler/icons-react";
import "./globals.css";

// Único boundary que repete <html>/<body>: o root layout não o envolve. Pega o que fura
// (app)/error.tsx — falha no próprio layout raiz (ver docs/42-auditoria-frontend-ux.md,
// ganho rápido 1). Sem fonte local nem layout.tsx aqui de propósito: se o root layout é
// quem quebrou, importar de volta o que pode ter quebrado não é seguro.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
            <IconAlertTriangle className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-medium">O sistema não conseguiu abrir</h1>
          <p className="max-w-sm text-sm text-gray-500">
            Recarregue a página. Se o problema continuar, fale com um administrador.
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Tentar de novo
          </button>
        </div>
      </body>
    </html>
  );
}

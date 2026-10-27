"use client";

import { IconAlertTriangle } from "@tabler/icons-react";
import { Botao } from "@/components/Botao";
import "./globals.css";

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
          <Botao tamanho="lg" onClick={reset} className="mt-2">
            Tentar de novo
          </Botao>
        </div>
      </body>
    </html>
  );
}

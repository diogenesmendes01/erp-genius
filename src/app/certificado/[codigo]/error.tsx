"use client";

import { IconAlertTriangle } from "@tabler/icons-react";
import { EstadoRota } from "@/components/EstadoRota";

export default function ErroCertificado({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
      <EstadoRota
        icone={IconAlertTriangle}
        titulo="Não foi possível conferir o certificado agora"
        texto="A consulta falhou. Isto não indica que o certificado seja inválido. Tente de novo em instantes; se continuar, fale com a Secretaria da Escola Genius."
        acao={{ onClick: reset, rotulo: "Tentar de novo" }}
      />
    </main>
  );
}

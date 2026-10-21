"use client";

import { IconAlertTriangle } from "@tabler/icons-react";
import { EstadoRota } from "@/components/EstadoRota";

// Erro da validação pública de certificado (docs/43 §6 item 10). Sem este arquivo, uma falha da consulta
// caía no global-error ("fale com um administrador"), texto de equipe para quem não é da escola. E não pode
// parecer "código inválido": quem confere não deve concluir que o certificado é falso por uma falha nossa.
// Formato da página pública, "Tentar de novo" e a saída (a Secretaria). Sem error.message nem digest.
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

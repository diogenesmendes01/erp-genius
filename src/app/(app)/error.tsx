"use client";

import { IconAlertTriangle } from "@tabler/icons-react";
import { EstadoRota } from "@/components/EstadoRota";

export default function ErrorApp({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <EstadoRota
      icone={IconAlertTriangle}
      titulo="Não foi possível carregar esta tela"
      texto="A consulta falhou ou o servidor não respondeu. Seus dados não foram alterados. Tente de novo; se repetir, fale com um administrador."
      acao={{ onClick: reset, rotulo: "Tentar de novo" }}
    />
  );
}

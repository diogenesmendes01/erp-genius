"use client";

import { IconAlertTriangle } from "@tabler/icons-react";
import { EstadoRota } from "@/components/EstadoRota";

// Boundary de erro do shell da equipe (ver docs/42-auditoria-frontend-ux.md, ganho rápido 1).
// Qualquer throw de uma página dentro de (app) cai aqui — dentro da Sidebar, não na tela
// genérica do Next. Não renderiza error.message nem digest: mensagem só teria valor de
// depuração e pode vazar detalhe interno (ver achado N1 do relatório).
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

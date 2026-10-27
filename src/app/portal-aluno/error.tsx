"use client";

import { IconAlertTriangle } from "@tabler/icons-react";
import { EstadoRota } from "@/components/EstadoRota";

export default function ErrorPortalAluno() {
  return (
    <EstadoRota
      icone={IconAlertTriangle}
      titulo="Não foi possível abrir esta página"
      texto="Pode ter sido uma instabilidade passageira ou sua sessão pode ter expirado. Entre novamente para continuar."
      acao={{ href: "/portal-aluno/entrar", rotulo: "Entrar de novo" }}
    />
  );
}

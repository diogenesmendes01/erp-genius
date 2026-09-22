"use client";

import { IconAlertTriangle } from "@tabler/icons-react";
import { EstadoRota } from "@/components/EstadoRota";

// Boundary de erro do portal — cobre falha de banco/rede (não o caso normal de cookie
// morto, que agora é tratado por redirect no guard de página — ver
// src/server/portal-aluno/sessao.ts). Texto de aluno, não de operador
// (ver docs/42-auditoria-frontend-ux.md, achado N1 e ganho rápido 1).
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

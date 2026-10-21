import { IconFileUnknown } from "@tabler/icons-react";
import { EstadoRota } from "@/components/EstadoRota";

// Cobre URL que não entra em nenhum grupo de rota (ex.: /blabla) — sem sessão, sem Sidebar.
// Destino é /login porque quem cai aqui pode ser visitante (ver docs/42-auditoria-frontend-ux.md,
// ganho rápido 1).
export default function NaoEncontradoRaiz() {
  return (
    <EstadoRota
      icone={IconFileUnknown}
      titulo="Página não encontrada"
      texto="Este endereço não existe ou foi removido."
      acao={{ href: "/login", rotulo: "Ir para o início" }}
    />
  );
}

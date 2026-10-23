import type { UsuarioSessao } from "@/server/_shared/sessao";
import { carregarDetalhesPainel } from "./painel-detalhes";

export type AbaDados = "detalhes" | "oportunidades" | "atividade";

/** Só Detalhes foi entregue. Abas futuras não consultam domínios nem habilitam UI. */
export async function carregarAbaPainel(u: UsuarioSessao, atendimentoId: string, aba: AbaDados): Promise<unknown | null> {
  return aba === "detalhes" ? carregarDetalhesPainel(u, atendimentoId) : null;
}

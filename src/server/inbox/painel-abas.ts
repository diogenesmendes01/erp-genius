import type { UsuarioSessao } from "@/server/_shared/sessao";
import { carregarOportunidadesPainel } from "./painel-oportunidades";
import { carregarDetalhesPainel } from "./painel-detalhes";

export type AbaDados = "detalhes" | "oportunidades" | "atividade";

/** Abas entregues consultam seus próprios produtores; Atividade permanece sem dados. */
export async function carregarAbaPainel(u: UsuarioSessao, atendimentoId: string, aba: AbaDados): Promise<unknown | null> {
  return aba === "detalhes" ? carregarDetalhesPainel(u, atendimentoId) : aba === "oportunidades" ? carregarOportunidadesPainel(u, atendimentoId) : null;
}

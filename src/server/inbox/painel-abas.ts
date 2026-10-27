import type { UsuarioSessao } from "@/server/_shared/sessao";
import {carregarAtividadePainel} from "./painel-atividade";
import { carregarOportunidadesPainel } from "./painel-oportunidades";
import { carregarDetalhesPainel } from "./painel-detalhes";

export type AbaDados = "detalhes" | "oportunidades" | "atividade";

export async function carregarAbaPainel(u: UsuarioSessao, atendimentoId: string, aba: AbaDados): Promise<unknown | null> {
  return aba === "detalhes" ? carregarDetalhesPainel(u, atendimentoId) : aba === "oportunidades" ? carregarOportunidadesPainel(u, atendimentoId) : aba === "atividade" ? carregarAtividadePainel(u, atendimentoId) : null;
}

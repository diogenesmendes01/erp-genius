import type { AcaoAgenteIATipo, OrigemEnvio } from "@prisma/client";
import { ACAO_AGENTE_IA_LABEL } from "@/lib/labels";

export type AutorPrevia = "aria" | "voce" | "pessoa" | "sugestao";

export function autorDaPrevia(
  m: { direcao: "ENTRADA" | "SAIDA"; origem: OrigemEnvio | null; autorId: string | null; autorNome: string | null; criadoEm: Date } | null,
  sugestao: { acao: AcaoAgenteIATipo; criadoEm: Date } | null,
  usuarioId: string,
): { autor: AutorPrevia | null; rotulo: string | null } {
  if (sugestao && (!m || sugestao.criadoEm > m.criadoEm)) return { autor: "sugestao", rotulo: ACAO_AGENTE_IA_LABEL[sugestao.acao] };
  if (!m || m.direcao === "ENTRADA") return { autor: null, rotulo: null };
  if (m.origem === "IA") return { autor: "aria", rotulo: null };
  if (m.autorId === usuarioId) return { autor: "voce", rotulo: null };
  const nome = m.autorNome?.trim();
  if ((m.origem === "HUMANO" || m.origem === "CELULAR") && nome) return { autor: "pessoa", rotulo: nome.split(/\s+/)[0]! };
  return { autor: null, rotulo: null };
}

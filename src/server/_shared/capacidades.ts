import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ErroPermissao, type UsuarioSessao } from "./sessao";

export const CAPACIDADES_ADICIONAIS = {
  "financeiro.aprovar_acertos": "Aprovar acertos e compensações financeiras",
  "financeiro.executar_devolucoes": "Executar devoluções financeiras aprovadas",
  "dados.exportar_alunos": "Exportar alunos (campos já autorizados)",
  "dados.exportar_leads": "Exportar leads (carteira autorizada)",
  "pagamento.caixa": "Registrar recebimento no caixa",
  "comissao.configurar": "Configurar política de comissão",
} as const;
export type CapacidadeAdicional = keyof typeof CAPACIDADES_ADICIONAIS;

/** Concessões são relidas; sessão antiga não conserva permissão revogada. */
export async function exigirCapacidade(usuario: UsuarioSessao, capacidade: CapacidadeAdicional) {
  const atual = await prisma.usuario.findUnique({
    where: { id: usuario.id }, select: { ativo: true, papeis: true, permissoes: true },
  });
  if (!atual?.ativo || (!atual.papeis.includes(Papel.ADMINISTRADOR) && !atual.permissoes.includes(capacidade))) {
    throw new ErroPermissao("Você não tem a permissão específica para esta operação.");
  }
}

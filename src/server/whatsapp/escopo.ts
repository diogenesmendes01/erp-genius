import { Papel, type Prisma } from "@prisma/client";
import type { UsuarioSessao } from "@/server/_shared";
import { escopoComercialAtual } from "@/server/_shared/escopo-comercial";
import { prisma } from "@/lib/prisma";
import { escopoTurmasDocente } from "@/server/diario/permissoes";

// Doc 36/37: transporte e acesso são dimensões diferentes. Escopo de número só serve
// para listagens operacionais do canal. Mensagens/arquivos exigem escopoAtendimentos.

export const PAPEIS_INBOX: Papel[] = [
  Papel.ADMINISTRADOR,
  Papel.GERENTE_COMERCIAL,
  Papel.VENDEDOR,
  Papel.FINANCEIRO,
  Papel.SECRETARIA_ACADEMICA,
  Papel.PROFESSOR,
  Papel.GERENTE_PEDAGOGICO,
];

export function escopoNumeros(usuario: UsuarioSessao): Prisma.NumeroWhatsAppWhereInput {
  if (usuario.papeis.includes(Papel.ADMINISTRADOR)) return {};
  const ors: Prisma.NumeroWhatsAppWhereInput[] = [];
  if (
    usuario.papeis.includes(Papel.FINANCEIRO) ||
    usuario.papeis.includes(Papel.SECRETARIA_ACADEMICA)
  ) {
    ors.push({ finalidade: "COBRANCA" });
  }
  if (usuario.papeis.includes(Papel.GERENTE_COMERCIAL)) ors.push({ finalidade: "VENDAS" });
  if (usuario.papeis.includes(Papel.VENDEDOR)) ors.push({ donoId: usuario.id });
  if (ors.length === 0) return { id: "__sem_acesso__" }; // fail-closed: não casa com nada
  return { OR: ors };
}

/** O transporte nunca concede leitura das mensagens. Cada finalidade tem seus vínculos. */
export async function escopoAtendimentos(
  usuario: Pick<UsuarioSessao, "id" | "papeis">,
  opcoes: { enviar?: boolean; agora?: Date } = {},
): Promise<Prisma.AtendimentoWhatsAppWhereInput> {
  const agora = opcoes.agora ?? new Date();
  const ativo: Prisma.AtendimentoWhatsAppWhereInput = opcoes.enviar ? {
    encerradoEm: null, conversa: { numero: { ativo: true } },
    OR: [{ finalidade: { not: "FINANCEIRO" } }, { matriculaId: { not: null } }],
  } : {};
  if (usuario.papeis.includes(Papel.ADMINISTRADOR)) return ativo;
  const ors: Prisma.AtendimentoWhatsAppWhereInput[] = [];
  const participante = { participantes: { some: {
    usuarioId: usuario.id, inicio: { lte: agora }, fim: { gt: agora }, revogadoEm: null,
    ...(opcoes.enviar ? { podeEnviar: true } : {}),
  } } };
  if (usuario.papeis.some((p) => p === Papel.VENDEDOR || p === Papel.GERENTE_COMERCIAL)) {
    ors.push({ finalidade: "COMERCIAL", OR: [
      { lead: { is: await escopoComercialAtual({ ...usuario, nome: "" }) } },
      { leadId: null, responsavelId: usuario.id },
      participante,
    ] });
  }
  if (usuario.papeis.includes(Papel.FINANCEIRO) || usuario.papeis.includes(Papel.SECRETARIA_ACADEMICA)) {
    ors.push({ finalidade: "FINANCEIRO", alunoId: { not: null } });
  }
  if (usuario.papeis.includes(Papel.SECRETARIA_ACADEMICA)) {
    ors.push({ finalidade: "SECRETARIA" }, { finalidade: "PEDAGOGICO" });
  }
  if (usuario.papeis.includes(Papel.GERENTE_PEDAGOGICO)) ors.push({ finalidade: "PEDAGOGICO" });
  if (usuario.papeis.includes(Papel.PROFESSOR)) {
    const vinculos = await prisma.alocacaoTurma.findMany({ where: { ativa: true, turma: escopoTurmasDocente(usuario.id, agora) }, select: { alunoId: true, turmaId: true } });
    // Vínculo ATUAL: o diário próprio é outra capacidade, não acesso perpétuo à inbox.
    ors.push({ finalidade: "PEDAGOGICO", encerradoEm: null, OR: [
      ...vinculos.map((v) => ({ alunoId: v.alunoId, turmaId: v.turmaId })),
      { lead: { is: { professorExperimentalId: usuario.id, etapa: "EXPERIMENTAL_AGENDADA" } }, turmaId: null },
    ] });
  }
  return { AND: [ativo, ors.length ? { OR: ors } : { id: "__sem_acesso__" }] };
}

export async function escopoConversas(usuario: UsuarioSessao): Promise<Prisma.ConversaWhatsAppWhereInput> {
  return { atendimentos: { some: await escopoAtendimentos(usuario) } };
}

/** Consulta de transporte legada. Não usar para autorizar mensagem ou arquivo. */
export function usuarioVeNumero(
  usuario: { id: string; papeis: Papel[] },
  numero: { donoId: string | null; finalidade: string },
): boolean {
  if (usuario.papeis.includes(Papel.ADMINISTRADOR)) return true;
  if (
    numero.finalidade === "COBRANCA" &&
    (usuario.papeis.includes(Papel.FINANCEIRO) || usuario.papeis.includes(Papel.SECRETARIA_ACADEMICA))
  ) {
    return true;
  }
  if (numero.finalidade === "VENDAS" && usuario.papeis.includes(Papel.GERENTE_COMERCIAL)) return true;
  if (usuario.papeis.includes(Papel.VENDEDOR) && numero.donoId === usuario.id) return true;
  return false;
}

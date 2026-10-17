import { Papel, type Prisma } from "@prisma/client";
import type { UsuarioSessao } from "@/server/_shared";
import { escopoComercialAtual } from "@/server/_shared/escopo-comercial";
import { prisma } from "@/lib/prisma";
import { escopoTurmasDocente } from "@/server/diario/permissoes";
import { ehGerenteDoSetor, setoresDoUsuario, type Setor } from "./setor";
import { whereNumeroServeSetor } from "./numero-setor";
import { donosDeLinhaVisiveis, whereLinhasDosDonos } from "./linha-comercial";

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

/** Fila do setor: atendimento aberto, sem responsável, em número que serve o setor. */
export function ramoFilaDoSetor(setor: Setor): Prisma.AtendimentoWhatsAppWhereInput {
  return { finalidade: setor, responsavelId: null, encerradoEm: null, conversa: { numero: whereNumeroServeSetor(setor) } };
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
      // Numa linha comercial o acesso sem lead vem da POSSE ATUAL da linha (abaixo): o responsável
      // gravado na criação não pode manter acesso depois de troca de dono ou linha desativada.
      { leadId: null, responsavelId: usuario.id, conversa: { numero: { finalidade: { not: "VENDAS" } } } },
      participante,
    ] });
    // Linha comercial (SPEC-ERP-005, LC-D02): dono atual da linha e gerente da equipe do dono veem
    // TODAS as conversas da linha, com ou sem lead. Só o conteúdo da conversa — painel do lead,
    // ficha de aluno e financeiro seguem as próprias regras (LC-L01/LC-L02).
    const donos = await donosDeLinhaVisiveis(usuario);
    if (donos.length) ors.push(whereLinhasDosDonos(donos));
  }
  // Participante vale para qualquer setor, sem filtrar por finalidade.
  ors.push(participante);
  // Setor: gerente vê todo o setor; os demais, o que é seu + a fila. O PEDAGOGICO do professor é
  // só a turma (ramo abaixo): sem responsável próprio nem fila.
  const papeisSemProfessor = usuario.papeis.filter((p) => p !== Papel.PROFESSOR);
  for (const setor of setoresDoUsuario(papeisSemProfessor)) {
    if (ehGerenteDoSetor(usuario.papeis, setor)) ors.push({ finalidade: setor });
    else {
      // COMERCIAL: o responsável gravado NÃO concede acesso (LC-D02) — vale só o ramo comercial
      // acima (carteira / sem lead fora da linha VENDAS) e a posse atual da linha; aqui só a fila.
      if (setor !== "COMERCIAL") ors.push({ finalidade: setor, responsavelId: usuario.id });
      // Fila COMERCIAL só sem lead: com lead, o acesso é a carteira (ramo comercial acima);
      // fila não pode vazar lead de outro vendedor.
      ors.push(setor === "COMERCIAL" ? { ...ramoFilaDoSetor(setor), leadId: null } : ramoFilaDoSetor(setor));
    }
  }
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

/**
 * Ponto único da Q4 (provisória): grupo SEM turma é visto por quem atende algum setor do número
 * do grupo. Se o produto decidir outra regra, trocar aqui e ajustar o teste.
 */
export const GRUPO_SEM_TURMA_PARA_SETORES_DO_NUMERO = true;

/** Escopo de grupos: com turma, docente alocado ou setor PEDAGOGICO; sem turma, setores do número. */
export async function escopoGrupos(
  usuario: Pick<UsuarioSessao, "id" | "papeis">,
  agora: Date = new Date(),
): Promise<Prisma.GrupoWhatsAppWhereInput> {
  if (usuario.papeis.includes(Papel.ADMINISTRADOR)) return {};
  const ors: Prisma.GrupoWhatsAppWhereInput[] = [];
  if (usuario.papeis.includes(Papel.PROFESSOR)) {
    ors.push({ turma: { is: escopoTurmasDocente(usuario.id, agora) } });
  }
  // O PEDAGOGICO do professor é só a turma dele (acima); os demais papéis do setor veem toda turma.
  const setores = setoresDoUsuario(usuario.papeis.filter((p) => p !== Papel.PROFESSOR));
  if (setores.includes("PEDAGOGICO")) ors.push({ turmaId: { not: null } });
  if (GRUPO_SEM_TURMA_PARA_SETORES_DO_NUMERO && setores.length) {
    ors.push({ turmaId: null, numero: { OR: setores.map(whereNumeroServeSetor) } });
  }
  return ors.length ? { OR: ors } : { id: "__sem_acesso__" };
}

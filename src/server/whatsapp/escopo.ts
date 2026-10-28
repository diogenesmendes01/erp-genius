import { Papel, type Prisma } from "@prisma/client";
import type { UsuarioSessao } from "@/server/_shared";
import { escopoComercialAtual } from "@/server/_shared/escopo-comercial";
import { prisma } from "@/lib/prisma";
import { escopoTurmasDocente } from "@/server/diario/permissoes";
import { ehGerenteDoSetor, setoresVisiveisNoInbox, type Setor } from "./setor";
import { whereNumeroServeSetor } from "./numero-setor";
import { donosDeLinhaVisiveis, whereLinhasDosDonos } from "./linha-comercial";

export type Db = Prisma.TransactionClient | typeof prisma;

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
  if (ors.length === 0) return { id: "__sem_acesso__" };
  return { OR: ors };
}

export function ramoFilaDoSetor(setor: Setor): Prisma.AtendimentoWhatsAppWhereInput {
  return { finalidade: setor, responsavelId: null, encerradoEm: null, conversa: { numero: whereNumeroServeSetor(setor) } };
}

export function ramoAcessoTransferido(usuarioId: string): Prisma.AtendimentoWhatsAppWhereInput {
  return {
    encerradoEm: null, responsavelId: usuarioId, conversa: { numero: { finalidade: { not: "VENDAS" } } },
    acessosTransferidos: { some: { usuarioId, revogadoEm: null } },
  };
}

export async function escopoAtendimentos(
  usuario: Pick<UsuarioSessao, "id" | "papeis">,
  opcoes: { enviar?: boolean; agora?: Date; db?: Db } = {},
): Promise<Prisma.AtendimentoWhatsAppWhereInput> {
  const agora = opcoes.agora ?? new Date();
  const db = opcoes.db ?? prisma;
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
      { lead: { is: await escopoComercialAtual({ ...usuario, nome: "" }, db) } },
      { leadId: null, responsavelId: usuario.id, conversa: { numero: { finalidade: { not: "VENDAS" } } } },
      participante,
      ramoAcessoTransferido(usuario.id),
    ] });
    const donos = await donosDeLinhaVisiveis(usuario, db);
    if (donos.length) ors.push(whereLinhasDosDonos(donos));
  }
  ors.push(participante);
  const papeisSemProfessor = usuario.papeis.filter((p) => p !== Papel.PROFESSOR);
  for (const setor of setoresVisiveisNoInbox(papeisSemProfessor)) {
    if (ehGerenteDoSetor(usuario.papeis, setor)) ors.push({ finalidade: setor });
    else {
      if (setor !== "COMERCIAL") ors.push({ finalidade: setor, responsavelId: usuario.id });
      ors.push(setor === "COMERCIAL" ? { ...ramoFilaDoSetor(setor), leadId: null } : ramoFilaDoSetor(setor));
    }
  }
  if (usuario.papeis.includes(Papel.PROFESSOR)) {
    const vinculos = await db.alocacaoTurma.findMany({ where: { ativa: true, turma: escopoTurmasDocente(usuario.id, agora) }, select: { alunoId: true, turmaId: true } });
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

export const GRUPO_SEM_TURMA_PARA_SETORES_DO_NUMERO = true;

export async function escopoGrupos(
  usuario: Pick<UsuarioSessao, "id" | "papeis">,
  agora: Date = new Date(),
): Promise<Prisma.GrupoWhatsAppWhereInput> {
  if (usuario.papeis.includes(Papel.ADMINISTRADOR)) return {};
  const ors: Prisma.GrupoWhatsAppWhereInput[] = [];
  if (usuario.papeis.includes(Papel.PROFESSOR)) {
    ors.push({ turma: { is: escopoTurmasDocente(usuario.id, agora) } });
  }
  const setores = setoresVisiveisNoInbox(usuario.papeis.filter((p) => p !== Papel.PROFESSOR));
  if (setores.includes("PEDAGOGICO")) ors.push({ turmaId: { not: null } });
  if (GRUPO_SEM_TURMA_PARA_SETORES_DO_NUMERO && setores.length) {
    ors.push({ turmaId: null, numero: { OR: setores.map(whereNumeroServeSetor) } });
  }
  return ors.length ? { OR: ors } : { id: "__sem_acesso__" };
}

export async function grupoNovoNoEscopo(
  usuario: Pick<UsuarioSessao, "id" | "papeis">,
  alvo: { numeroId: string; turmaId: string | null },
  agora: Date = new Date(),
): Promise<boolean> {
  if (usuario.papeis.includes(Papel.ADMINISTRADOR)) return true;
  const setores = setoresVisiveisNoInbox(usuario.papeis.filter((p) => p !== Papel.PROFESSOR));
  if (alvo.turmaId) {
    if (setores.includes("PEDAGOGICO")) return true;
    if (!usuario.papeis.includes(Papel.PROFESSOR)) return false;
    return (await prisma.turma.count({ where: { AND: [{ id: alvo.turmaId }, escopoTurmasDocente(usuario.id, agora)] } })) > 0;
  }
  if (!GRUPO_SEM_TURMA_PARA_SETORES_DO_NUMERO || !setores.length) return false;
  return (await prisma.numeroWhatsApp.count({ where: { id: alvo.numeroId, OR: setores.map(whereNumeroServeSetor) } })) > 0;
}

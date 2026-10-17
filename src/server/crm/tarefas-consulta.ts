import { prisma } from "@/lib/prisma";
import type { UsuarioSessao } from "@/server/_shared/sessao";
import { listarItensAgenda, type ItemAgenda, type TarefaLista } from "./mensagens-agendadas";
import { capacidadesCrm } from "./permissoes";
import { escopoTarefas } from "./tarefas";

const incluirResponsavel = { responsavel: { select: { id: true, nome: true } } } as const;

/** Itens da lista: o intervalo (tarefas e mensagens) mais as tarefas abertas sem data. */
export async function listarItensLista(usuario: UsuarioSessao, intervalo: { de: string; ate: string }, equipe: boolean): Promise<ItemAgenda[]> {
  if (!usuario?.id) return [];
  const [itens, semData] = await Promise.all([
    listarItensAgenda(usuario, intervalo, equipe),
    prisma.tarefa.findMany({
      where: { AND: [await escopoTarefas(usuario, equipe), { dataCivil: null, status: "ABERTA" }] },
      include: incluirResponsavel,
      orderBy: { criadoEm: "asc" },
      take: 200,
    }),
  ]);
  return [...itens, ...semData.map((tarefa): ItemAgenda => ({ tipo: "tarefa", tarefa }))];
}

/** Uma tarefa, só se estiver no escopo do usuário (inclusive a equipe, quando a capacidade existe). */
export async function obterTarefa(usuario: UsuarioSessao, id: string): Promise<TarefaLista | null> {
  if (!usuario?.id || !id) return null;
  const equipe = capacidadesCrm(usuario.papeis).has("tarefas.equipe");
  return prisma.tarefa.findFirst({ where: { AND: [{ id }, await escopoTarefas(usuario, equipe)] }, include: incluirResponsavel });
}

/** Quem pode receber tarefas do usuário: a própria equipe (o administrador vê todos os ativos). */
export async function listarResponsaveisPossiveis(usuario: UsuarioSessao): Promise<{ id: string; nome: string }[]> {
  if (!usuario?.id || !capacidadesCrm(usuario.papeis).has("tarefas.equipe")) return [];
  const admin = usuario.papeis.includes("ADMINISTRADOR");
  return prisma.usuario.findMany({
    where: { ativo: true, ...(admin ? {} : { gerenteComercialId: usuario.id }) },
    select: { id: true, nome: true },
    orderBy: { nome: "asc" },
    take: 200,
  });
}

/** Fuso de exibição preferido do usuário (null = sem preferência). */
export async function fusoExibicaoDoUsuario(usuario: UsuarioSessao): Promise<string | null> {
  if (!usuario?.id) return null;
  const u = await prisma.usuario.findUnique({ where: { id: usuario.id }, select: { fusoExibicao: true } });
  return u?.fusoExibicao ?? null;
}

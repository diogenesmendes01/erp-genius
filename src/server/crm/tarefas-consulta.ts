import type { Db } from "@/server/whatsapp/escopo";
import { prisma } from "@/lib/prisma";
import type { UsuarioSessao } from "@/server/_shared/sessao";
import { listarItensAgenda, type ItemAgenda, type TarefaLista } from "./mensagens-agendadas";
import { capacidadesCrm } from "./permissoes";
import { escopoTarefas } from "./tarefas";

const incluirResponsavel = { responsavel: { select: { id: true, nome: true } } } as const;

export async function listarItensLista(usuario: UsuarioSessao, intervalo: { de: string; ate: string }, equipe: boolean): Promise<ItemAgenda[]> {
  if (!usuario?.id) return [];
  const escopo = await escopoTarefas(usuario, equipe);
  const [itens, antigas, semData] = await Promise.all([
    listarItensAgenda(usuario, intervalo, equipe),
    prisma.tarefa.findMany({
      where: { AND: [escopo, { dataCivil: { lt: intervalo.de }, status: "ABERTA" }] },
      include: incluirResponsavel,
      orderBy: [{ dataCivil: "asc" }, { inicioEm: { sort: "asc", nulls: "last" } }, { criadoEm: "asc" }],
      take: 200,
    }),
    prisma.tarefa.findMany({
      where: { AND: [escopo, { dataCivil: null, status: "ABERTA" }] },
      include: incluirResponsavel,
      orderBy: { criadoEm: "asc" },
      take: 200,
    }),
  ]);
  const comoItem = (tarefa: (typeof semData)[number]): ItemAgenda => ({ tipo: "tarefa", tarefa });
  return [...antigas.map(comoItem), ...itens, ...semData.map(comoItem)];
}

export async function obterTarefa(usuario: UsuarioSessao, id: string): Promise<TarefaLista | null> {
  if (!usuario?.id || !id) return null;
  const equipe = capacidadesCrm(usuario.papeis).has("tarefas.equipe");
  return prisma.tarefa.findFirst({ where: { AND: [{ id }, await escopoTarefas(usuario, equipe)] }, include: incluirResponsavel });
}

export async function listarResponsaveisPossiveis(usuario: UsuarioSessao, db: Db = prisma): Promise<{ id: string; nome: string }[]> {
  if (!usuario?.id || !capacidadesCrm(usuario.papeis).has("tarefas.equipe")) return [];
  const admin = usuario.papeis.includes("ADMINISTRADOR");
  return db.usuario.findMany({
    where: { ativo: true, ...(admin ? {} : { gerenteComercialId: usuario.id }) },
    select: { id: true, nome: true },
    orderBy: { nome: "asc" },
    take: 200,
  });
}

export async function fusoExibicaoDoUsuario(usuario: UsuarioSessao): Promise<string | null> {
  if (!usuario?.id) return null;
  const u = await prisma.usuario.findUnique({ where: { id: usuario.id }, select: { fusoExibicao: true } });
  return u?.fusoExibicao ?? null;
}

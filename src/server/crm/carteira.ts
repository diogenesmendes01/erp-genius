import { Papel, type EtapaLead, type CorTag, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { exigirSessaoComPapel, executarAcao, ErroRegra, type Resultado } from "@/server/_shared";
import type { UsuarioSessao } from "@/server/_shared/sessao";
import { escopoComercialAtual } from "@/server/_shared/escopo-comercial";
import { dataCivilInstitucional } from "@/server/operacao/fuso";
import { palavrasDaBuscaLeads } from "@/server/comercial/filtros";
import { atribuirDono } from "@/server/comercial/acoes";

export type FiltrosCarteira = {
  donoId: string;
  busca: string;
  semInteracaoDias: "" | "7" | "15" | "30";
  emTurma: boolean;
  tipo: "todos" | "pf" | "pj";
};

export type LinhaCarteira = {
  oportunidadeId: string;
  pessoaId: string | null;
  empresaId: string | null;
  nome: string;
  tipo: "pf" | "pj";
  etapa: EtapaLead;
  dono: { id: string; nome: string } | null;
  diasSemInteracao: number;
  turmaAtiva: string | null;
  tags: { id: string; nome: string; cor: CorTag }[];
};

type ParametrosUrl = Record<string, string | string[] | undefined>;
const um = (v: string | string[] | undefined) => ((Array.isArray(v) ? v[0] : v) ?? "").trim();

/** Filtros da URL de /carteira; valor fora das opções vira o padrão. */
export function lerFiltrosCarteira(p: ParametrosUrl): FiltrosCarteira {
  const dias = um(p.semInteracao);
  const tipo = um(p.tipo);
  return {
    donoId: um(p.dono).slice(0, 64),
    busca: um(p.busca).slice(0, 100),
    semInteracaoDias: dias === "7" || dias === "15" || dias === "30" ? dias : "",
    emTurma: um(p.emTurma) === "1",
    tipo: tipo === "pf" || tipo === "pj" ? tipo : "todos",
  };
}

export type VendedorCarteira = { id: string; nome: string; total: number; cobertoPor: string | null };

export const TEXTO_CONSEQUENCIA_REATRIBUICAO =
  "Os atendimentos comerciais abertos passam para o novo responsável e as mensagens agendadas pelo responsável anterior são canceladas.";

export const MAX_LOTE_CARTEIRA = 50;
/** Corte de linhas devolvidas pela carteira; `total` continua contando todas. */
export const MAX_LINHAS_CARTEIRA = 500;
const FUSO_PADRAO = "America/Sao_Paulo";

const diasCivis = (de: string, ate: string) =>
  Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000);

function diaMes(instante: Date, fuso: string): string {
  const p = new Intl.DateTimeFormat("pt-BR", { timeZone: fuso, day: "2-digit", month: "2-digit" }).formatToParts(instante);
  const v = (t: string) => p.find((x) => x.type === t)!.value;
  return `${v("day")}/${v("month")}`;
}

export async function carregarCarteira(
  usuario: UsuarioSessao,
  f: FiltrosCarteira,
): Promise<{ vendedores: VendedorCarteira[]; linhas: LinhaCarteira[]; total: number }> {
  const agora = new Date();
  const config = await prisma.configuracaoOperacional.findUnique({ where: { id: "escola" }, select: { fusoInstitucional: true } });
  const fuso = config?.fusoInstitucional ?? FUSO_PADRAO;
  const hoje = dataCivilInstitucional(agora, fuso);

  // Oportunidades abertas e matriculadas (tudo, menos perdidas), dentro do escopo comercial.
  const escopoAberto: Prisma.OportunidadeWhereInput = { AND: [await escopoComercialAtual(usuario), { etapa: { not: "PERDIDO" } }] };
  const palavras = palavrasDaBuscaLeads(f.busca);
  const where: Prisma.OportunidadeWhereInput = {
    AND: [
      escopoAberto,
      ...(f.donoId ? [{ vendedorDonoId: f.donoId }] : []),
      ...(f.tipo !== "todos" ? [{ b2b: f.tipo === "pj" }] : []),
      ...(f.emTurma ? [{ matricula: { is: { alocacoes: { some: { ativa: true } } } } }] : []),
      ...palavras.map((palavra) => {
        const contem = { contains: palavra, mode: "insensitive" as const };
        return { OR: [{ nome: contem }, { codigo: contem }] };
      }),
    ],
  };

  const [brutas, totaisPorDono, coberturas] = await Promise.all([
    prisma.oportunidade.findMany({
      where,
      orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
      select: {
        id: true, nome: true, b2b: true, etapa: true, pessoaId: true, empresaId: true, criadoEm: true,
        vendedor: { select: { id: true, nome: true } },
        pessoa: { select: { tags: { select: { tag: { select: { id: true, nome: true, cor: true } } } } } },
        matricula: { select: { alocacoes: { where: { ativa: true }, take: 1, select: { turma: { select: { nome: true } } } } } },
      },
    }),
    prisma.oportunidade.groupBy({ by: ["vendedorDonoId"], where: escopoAberto, _count: { _all: true } }),
    prisma.coberturaCarteira.findMany({
      where: { inicio: { lte: agora }, fim: { gt: agora }, revogadaEm: null },
      select: { titularId: true, substitutoId: true, fim: true, substituto: { select: { nome: true } } },
      orderBy: { fim: "asc" },
    }),
  ]);

  // Último Evento de cada oportunidade -> dias civis sem interação no fuso institucional.
  const ids = brutas.map((o) => o.id);
  const ultimos = ids.length
    ? await prisma.evento.groupBy({ by: ["agregadoId"], where: { agregadoTipo: "Lead", agregadoId: { in: ids } }, _max: { criadoEm: true } })
    : [];
  const ultimoPor = new Map(ultimos.map((u) => [u.agregadoId, u._max.criadoEm]));
  const minimo = f.semInteracaoDias ? Number(f.semInteracaoDias) : 0;

  const todas = brutas
    .map((o): LinhaCarteira => ({
      oportunidadeId: o.id,
      pessoaId: o.pessoaId,
      empresaId: o.empresaId,
      nome: o.nome,
      tipo: o.b2b ? "pj" : "pf",
      etapa: o.etapa,
      dono: o.vendedor,
      diasSemInteracao: Math.max(0, diasCivis(dataCivilInstitucional(ultimoPor.get(o.id) ?? o.criadoEm, fuso), hoje)),
      turmaAtiva: o.matricula?.alocacoes[0]?.turma.nome ?? null,
      tags: (o.pessoa?.tags ?? []).map((t) => t.tag),
    }))
    .filter((l) => l.diasSemInteracao >= minimo);
  const linhas = todas.sort((a, b) => b.diasSemInteracao - a.diasSemInteracao || (a.oportunidadeId < b.oportunidadeId ? -1 : 1)).slice(0, MAX_LINHAS_CARTEIRA);

  // Vendedores que o usuário enxerga: ele mesmo, os que cobre, a equipe (gerente) ou todos (admin).
  const admin = usuario.papeis.includes(Papel.ADMINISTRADOR);
  const ehVendedor = usuario.papeis.includes(Papel.VENDEDOR);
  const ehGerente = usuario.papeis.includes(Papel.GERENTE_COMERCIAL);
  const rotulo = new Map<string, string>();
  const coberta = new Set<string>();
  if (ehVendedor && !admin) {
    const eu = await prisma.usuario.findUnique({ where: { id: usuario.id }, select: { id: true, nome: true } });
    if (eu) rotulo.set(eu.id, eu.nome);
    const minhas = coberturas.filter((c) => c.substitutoId === usuario.id);
    const titulares = await prisma.usuario.findMany({ where: { id: { in: minhas.map((c) => c.titularId) } }, select: { id: true, nome: true } });
    for (const c of minhas) {
      const t = titulares.find((x) => x.id === c.titularId);
      if (!t || rotulo.has(t.id)) continue;
      rotulo.set(t.id, `${t.nome} (cobertura até ${diaMes(c.fim, fuso)})`);
      coberta.add(t.id);
    }
  }
  if (admin || ehGerente) {
    const equipe = await prisma.usuario.findMany({
      where: { ativo: true, papeis: { has: Papel.VENDEDOR }, ...(admin ? {} : { gerenteComercialId: usuario.id }) },
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    });
    for (const m of equipe) if (!rotulo.has(m.id)) rotulo.set(m.id, m.nome);
  }
  const totalDe = new Map(totaisPorDono.map((t) => [t.vendedorDonoId, t._count._all]));
  const vendedores = [...rotulo.entries()].map(([id, nome]) => ({
    id,
    nome,
    total: totalDe.get(id) ?? 0,
    cobertoPor: coberturas.find((c) => c.titularId === id)?.substituto.nome ?? null,
  }));

  return { vendedores, linhas, total: todas.length };
}

export async function reatribuirEmLote(input: {
  ids: string[];
  vendedorId: string;
  motivo: string;
}): Promise<Resultado<{ feitas: number; jaEram: number; recusadas: { id: string; motivo: string }[] }>> {
  return executarAcao(async () => {
    await exigirSessaoComPapel(Papel.GERENTE_COMERCIAL);
    const motivo = (input.motivo ?? "").trim();
    if (motivo.length < 5) throw new ErroRegra("Informe o motivo (mínimo 5 caracteres).");
    if (motivo.length > 1000) throw new ErroRegra("O motivo deve ter no máximo 1.000 caracteres.");
    const unicos = [...new Set(input.ids)];
    if (unicos.length === 0) throw new ErroRegra("Selecione ao menos uma oportunidade.");
    if (unicos.length > MAX_LOTE_CARTEIRA) throw new ErroRegra(`Selecione no máximo ${MAX_LOTE_CARTEIRA} oportunidades.`);
    // `atribuirDono` devolve ok sem mudar nada (nem gravar Evento) quando a oportunidade já é do destino:
    // essas não contam como reatribuídas. O dono só é lido para contar; a visibilidade continua em `atribuirDono`.
    const donos = await prisma.oportunidade.findMany({ where: { id: { in: unicos } }, select: { id: true, vendedorDonoId: true } });
    const donoAntes = new Map(donos.map((o) => [o.id, o.vendedorDonoId]));
    let feitas = 0;
    let jaEram = 0;
    const recusadas: { id: string; motivo: string }[] = [];
    for (const id of unicos) {
      const r = await atribuirDono(id, input.vendedorId, motivo);
      if (!r.ok) recusadas.push({ id, motivo: r.erro });
      else if (donoAntes.get(id) === input.vendedorId) jaEram += 1;
      else feitas += 1;
    }
    return { feitas, jaEram, recusadas };
  });
}

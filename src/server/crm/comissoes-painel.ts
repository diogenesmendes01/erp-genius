import { Papel, Prisma, type StatusComissao } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { UsuarioSessao } from "@/server/_shared/sessao";
import { escopoComissoes } from "@/server/financeiro/consultas";
import { escopoComercialAtual } from "@/server/_shared/escopo-comercial";
import { dataCivilInstitucional } from "@/server/operacao/fuso";
import { nomeCompleto } from "@/lib/nome";

export type PeriodoComissao = "mes" | "mes_anterior" | "trimestre" | "ano";

export type LinhaComissao = {
  id: string; nome: string; produto: string; vendedor: string; base: string; percentual: string | null;
  valor: string; moeda: string; status: StatusComissao; competencia: Date;
};

export type PainelComissoes = {
  totais: { moeda: string; status: StatusComissao; valor: string }[];
  porVendedor: { vendedorId: string; nome: string; moeda: string; valor: string; quantidade: number }[];
  porPolitica: { politicaId: string | null; rotulo: string; moeda: string; valor: string }[];
  evolucao: { mes: string; moeda: string; valor: string }[];
  matriculadasSemComissao: { oportunidadeId: string; nome: string }[];
  linhas: LinhaComissao[];
  possuiMais: boolean;
};

export const LINHAS_POR_PAGINA_COMISSOES = 50;
const FUSO_PADRAO = "America/Sao_Paulo";

/** Instante em que a data civil (AAAA-MM-DD) começa no fuso informado. */
function inicioDoDia(dataCivil: string, fuso: string): Date {
  const alvo = Date.parse(`${dataCivil}T00:00:00Z`);
  let t = alvo;
  for (let i = 0; i < 3; i++) {
    const p = new Intl.DateTimeFormat("en", { timeZone: fuso, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date(t));
    const v = (k: string) => Number(p.find((x) => x.type === k)!.value);
    const visto = Date.UTC(v("year"), v("month") - 1, v("day"), v("hour"), v("minute"), v("second"));
    t -= visto - alvo;
  }
  return new Date(t);
}

/** Intervalo [de, ate) do período, em meses civis do fuso institucional. */
export function intervaloDoPeriodo(periodo: PeriodoComissao, agora: Date, fuso: string): { de: Date; ate: Date } {
  const [ano, mes] = dataCivilInstitucional(agora, fuso).split("-").map(Number);
  const dia1 = (a: number, m: number) => { const d = new Date(Date.UTC(a, m - 1, 1)); return d.toISOString().slice(0, 10); };
  const [de, ate] =
    periodo === "mes" ? [dia1(ano, mes), dia1(ano, mes + 1)]
    : periodo === "mes_anterior" ? [dia1(ano, mes - 1), dia1(ano, mes)]
    : periodo === "trimestre" ? [dia1(ano, mes - 2), dia1(ano, mes + 1)]
    : [dia1(ano, 1), dia1(ano + 1, 1)];
  return { de: inicioDoDia(de, fuso), ate: inicioDoDia(ate, fuso) };
}

const dinheiro = (v: Prisma.Decimal | null | undefined) => (v ?? new Prisma.Decimal(0)).toFixed(2);
const porMoedaEStatus = (a: { moeda: string; status?: string }, b: { moeda: string; status?: string }) =>
  a.moeda.localeCompare(b.moeda) || (a.status ?? "").localeCompare(b.status ?? "");

/**
 * Pendências de comissão: segue o filtro de vendedor do painel (dentro do escopo, em AND), mas não o
 * período, porque uma matrícula sem comissão continua pendente até ser resolvida; a tela avisa isso.
 */
async function matriculadasSemComissao(usuario: UsuarioSessao, vendedorId?: string) {
  const todos = usuario.papeis.includes(Papel.ADMINISTRADOR) || usuario.papeis.includes(Papel.FINANCEIRO);
  if (!todos && !usuario.papeis.includes(Papel.GERENTE_COMERCIAL)) return [];
  // Escopo comercial padrão (coberturas vigentes + equipe de gerenteComercialId); FINANCEIRO vê tudo, mas
  // escopoComercialAtual o trataria como sem acesso, por isso o {} explícito.
  const donos: Prisma.OportunidadeWhereInput = todos ? {} : await escopoComercialAtual(usuario);
  // Matrícula cancelada ou encerrada não gera comissão a cobrar: não entra como pendência.
  const vigente: Prisma.MatriculaWhereInput = { status: { notIn: ["CANCELADA", "ENCERRADA"] }, comissoes: { none: {} } };
  const ops = await prisma.oportunidade.findMany({
    where: { AND: [donos, { etapa: "MATRICULADO", matricula: { is: vigente } }, ...(vendedorId ? [{ vendedorDonoId: vendedorId }] : [])] },
    select: { id: true, nome: true }, orderBy: [{ criadoEm: "desc" }, { id: "asc" }], take: 200,
  });
  return ops.map((o) => ({ oportunidadeId: o.id, nome: o.nome }));
}

export async function carregarPainelComissoes(
  usuario: UsuarioSessao,
  f: { periodo: PeriodoComissao; vendedorId?: string; produtoId?: string; pagina: number },
): Promise<PainelComissoes> {
  const config = await prisma.configuracaoOperacional.findUnique({ where: { id: "escola" }, select: { fusoInstitucional: true } });
  const fuso = config?.fusoInstitucional ?? FUSO_PADRAO;
  const { de, ate } = intervaloDoPeriodo(f.periodo, new Date(), fuso);
  // Q7: base TAXA_MATRICULA e competência na aprovação; com base mensalidade/ganho, mudar a fonte de LinhaComissao.base.
  const where: Prisma.ComissaoWhereInput = { AND: [
    escopoComissoes(usuario),
    { OR: [{ aprovadaEm: { gte: de, lt: ate } }, { aprovadaEm: null, criadoEm: { gte: de, lt: ate } }] },
    ...(f.vendedorId ? [{ vendedorId: f.vendedorId }] : []),
    ...(f.produtoId ? [{ matricula: { produtoId: f.produtoId } }] : []),
  ] };
  const pagina = Math.max(1, Math.floor(f.pagina) || 1);
  const semEstorno: Prisma.ComissaoWhereInput = { AND: [where, { status: { not: "ESTORNADA" } }] };

  const [totais, porVendedor, porPolitica, paraEvolucao, linhasBrutas, semComissao] = await Promise.all([
    prisma.comissao.groupBy({ by: ["moeda", "status"], where, _sum: { valor: true } }),
    prisma.comissao.groupBy({ by: ["vendedorId", "moeda"], where: semEstorno, _sum: { valor: true }, _count: { _all: true } }),
    prisma.comissao.groupBy({ by: ["politicaId", "moeda"], where: semEstorno, _sum: { valor: true } }),
    prisma.comissao.findMany({ where: semEstorno, select: { moeda: true, valor: true, aprovadaEm: true, criadoEm: true } }),
    prisma.comissao.findMany({
      where, orderBy: [{ aprovadaEm: { sort: "desc", nulls: "last" } }, { criadoEm: "desc" }, { id: "asc" }],
      skip: (pagina - 1) * LINHAS_POR_PAGINA_COMISSOES, take: LINHAS_POR_PAGINA_COMISSOES + 1,
      select: {
        id: true, percentual: true, valor: true, moeda: true, status: true, aprovadaEm: true, criadoEm: true, tipo: true,
        vendedor: { select: { nome: true } }, politica: { select: { base: true } },
        matricula: { select: {
          aluno: { select: { primeiroNome: true, sobrenome: true } }, lead: { select: { nome: true } },
          produto: { select: { idioma: { select: { nome: true } }, modalidade: { select: { nome: true } } } },
        } },
      },
    }),
    matriculadasSemComissao(usuario, f.vendedorId),
  ]);

  const nomesVendedores = new Map((await prisma.usuario.findMany({ where: { id: { in: porVendedor.map((g) => g.vendedorId) } }, select: { id: true, nome: true } })).map((u) => [u.id, u.nome]));
  const idsPolitica = porPolitica.map((g) => g.politicaId).filter((id): id is string => !!id);
  const politicas = new Map((await prisma.politicaComissao.findMany({
    where: { id: { in: idsPolitica } },
    select: { id: true, versao: true, percentual: true, valorFixo: true, pais: { select: { nome: true } }, produto: { select: { idioma: { select: { nome: true } }, modalidade: { select: { nome: true } } } } },
  })).map((p) => [p.id, `${p.produto.idioma.nome} · ${p.produto.modalidade.nome} · ${p.pais.nome} · v${p.versao} · ${p.percentual ? `${p.percentual.toString()}% da taxa` : `${dinheiro(p.valorFixo)} fixo`}`]));

  const mesesDe = new Map<string, Prisma.Decimal>();
  for (const c of paraEvolucao) {
    const mes = dataCivilInstitucional(c.aprovadaEm ?? c.criadoEm, fuso).slice(0, 7);
    const chave = `${mes}|${c.moeda}`;
    mesesDe.set(chave, (mesesDe.get(chave) ?? new Prisma.Decimal(0)).plus(c.valor));
  }

  const possuiMais = linhasBrutas.length > LINHAS_POR_PAGINA_COMISSOES;
  return {
    totais: totais.map((g) => ({ moeda: g.moeda, status: g.status, valor: dinheiro(g._sum.valor) })).sort(porMoedaEStatus),
    porVendedor: porVendedor.map((g) => ({ vendedorId: g.vendedorId, nome: nomesVendedores.get(g.vendedorId) ?? "", moeda: g.moeda, valor: dinheiro(g._sum.valor), quantidade: g._count._all }))
      .sort((a, b) => a.moeda.localeCompare(b.moeda) || Number(b.valor) - Number(a.valor) || a.nome.localeCompare(b.nome)),
    porPolitica: porPolitica.map((g) => ({ politicaId: g.politicaId, rotulo: g.politicaId ? politicas.get(g.politicaId) ?? "Política removida" : "Sem política", moeda: g.moeda, valor: dinheiro(g._sum.valor) }))
      .sort((a, b) => a.moeda.localeCompare(b.moeda) || a.rotulo.localeCompare(b.rotulo)),
    evolucao: [...mesesDe].map(([chave, valor]) => { const [mes, moeda] = chave.split("|"); return { mes, moeda, valor: dinheiro(valor) }; })
      .sort((a, b) => a.mes.localeCompare(b.mes) || a.moeda.localeCompare(b.moeda)),
    matriculadasSemComissao: semComissao,
    linhas: linhasBrutas.slice(0, LINHAS_POR_PAGINA_COMISSOES).map((c) => ({
      id: c.id,
      nome: c.matricula.lead?.nome ?? nomeCompleto(c.matricula.aluno),
      produto: `${c.matricula.produto.idioma.nome} · ${c.matricula.produto.modalidade.nome}`,
      vendedor: c.vendedor.nome,
      base: c.politica?.base ?? "TAXA_MATRICULA",
      percentual: c.tipo === "PERCENTUAL" ? dinheiro(c.percentual) : null,
      valor: dinheiro(c.valor), moeda: c.moeda, status: c.status, competencia: c.aprovadaEm ?? c.criadoEm,
    })),
    possuiMais,
  };
}

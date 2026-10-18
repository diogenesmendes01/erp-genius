import { Papel, type AcaoAgenteIATipo, type EtapaLead, type Prisma, type StatusAcaoAgenteIA } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { exigirSessao, ErroPermissao, type UsuarioSessao } from "../_shared";
import { escopoComercialAtual } from "../_shared/escopo-comercial";
import { capacidadesAria } from "./permissoes-tela";

// Consultas de leitura da tela da Aria (Task 26): visão geral e histórico.

const POR_PAGINA = 50;
const DIA_MS = 86_400_000;

export type VisaoGeralAria = {
  conversas: number;
  /** handoffs / conversas; null sem conversas. */
  taxaHandoff: number | null;
  etapasAvancadas: number;
  tarefasCriadas: number;
  camposPreenchidos: number;
  tempoMedioAteHandoffMin: number | null;
  /** aprovadas / (aprovadas + rejeitadas); null sem decisões. */
  aprovadasSemEdicao: number | null;
  /** desfeitas / (executadas + aprovadas + desfeitas); null sem ações aplicadas. */
  desfeitas: number | null;
  /** Só para quem tem `verProvedor`. */
  custoUsd: number | null;
  volume: { dia: string; resolvidas: number; comHandoff: number }[];
};

export type ItemHistoricoAria = {
  id: string;
  quando: string;
  acao: AcaoAgenteIATipo;
  contato: string;
  etapa: EtapaLead | null;
  confianca: number;
  status: StatusAcaoAgenteIA;
  podeDesfazer: boolean;
  motivoIrreversivel: string | null;
  decididaPor: string | null;
};

async function exigirVer(): Promise<UsuarioSessao> {
  const u = await exigirSessao();
  if (!capacidadesAria(u).has("ver")) throw new ErroPermissao("Sem acesso à Aria.");
  return u;
}

// ---- fuso institucional -------------------------------------------------------------------

function partes(d: Date, fuso: string) {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: fuso, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  const o: Record<string, number> = {};
  for (const p of f.formatToParts(d)) if (p.type !== "literal") o[p.type] = Number(p.value);
  return o as { year: number; month: number; day: number; hour: number; minute: number; second: number };
}

const diaDe = (d: Date, fuso: string) => {
  const p = partes(d, fuso);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
};

/** Instante UTC da meia-noite local de `y-m-d` no fuso. */
function meiaNoite(y: number, m: number, d: number, fuso: string): Date {
  const alvo = Date.UTC(y, m - 1, d);
  let t = alvo;
  for (let i = 0; i < 2; i++) {
    const p = partes(new Date(t), fuso);
    t -= Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - alvo;
  }
  return new Date(t);
}

async function fusoInstitucional(): Promise<string> {
  const c = await prisma.configuracaoOperacional.findUnique({ where: { id: "escola" }, select: { fusoInstitucional: true } });
  const fuso = c?.fusoInstitucional;
  if (!fuso) return "UTC";
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: fuso });
    return fuso;
  } catch {
    return "UTC";
  }
}

// ---- escopo -------------------------------------------------------------------------------

/** null = sem restrição (Administrador); senão, ids das oportunidades visíveis. */
async function leadsVisiveis(u: UsuarioSessao): Promise<string[] | null> {
  if (u.papeis.includes(Papel.ADMINISTRADOR)) return null;
  const ops = await prisma.oportunidade.findMany({ where: await escopoComercialAtual(u), select: { id: true } });
  return ops.map((o) => o.id);
}

const MOVIDAS: StatusAcaoAgenteIA[] = ["EXECUTADA", "APROVADA"];

// ---- visão geral --------------------------------------------------------------------------

export async function visaoGeralAria(i: { dias: 1 | 7 | 30; agora?: Date }): Promise<VisaoGeralAria> {
  const u = await exigirVer();
  const agora = i.agora ?? new Date();
  const fuso = await fusoInstitucional();
  const hoje = partes(agora, fuso);
  const inicio = meiaNoite(hoje.year, hoje.month, hoje.day, fuso);
  const desde = new Date(inicio.getTime() - (i.dias - 1) * DIA_MS);
  // Mudança de horário de verão pode deslocar 1h: recalcula a meia-noite do primeiro dia.
  const pd = partes(new Date(desde.getTime() + 12 * 3_600_000), fuso);
  const de = meiaNoite(pd.year, pd.month, pd.day, fuso);
  const periodo = { gte: de, lte: agora };

  const visiveis = await leadsVisiveis(u);
  const escopoAtendimento: Prisma.AtendimentoWhatsAppWhereInput | undefined = visiveis ? { leadId: { in: visiveis } } : undefined;
  const turnoWhere: Prisma.TurnoAgenteIAWhereInput = {
    tipo: "ATENDIMENTO",
    resultado: { in: ["RESPONDEU", "SUGERIU", "HANDOFF"] },
    criadoEm: periodo,
    ...(escopoAtendimento ? { atendimento: escopoAtendimento } : {}),
  };
  const acaoWhere: Prisma.AcaoAgenteIAWhereInput = {
    criadoEm: periodo,
    ...(visiveis ? { OR: [{ oportunidadeId: { in: visiveis } }, { oportunidadeId: null, atendimento: { leadId: { in: visiveis } } }] } : {}),
  };

  const [turnos, acoes] = await Promise.all([
    prisma.turnoAgenteIA.findMany({ where: turnoWhere, select: { atendimentoId: true, resultado: true, criadoEm: true }, orderBy: { criadoEm: "asc" } }),
    prisma.acaoAgenteIA.groupBy({ by: ["acao", "status"], where: acaoWhere, _count: { _all: true } }),
  ]);

  const conta = (f: (a: AcaoAgenteIATipo, s: StatusAcaoAgenteIA) => boolean) =>
    acoes.filter((a) => f(a.acao, a.status)).reduce((s, a) => s + a._count._all, 0);
  const aplicada = (tipo: AcaoAgenteIATipo) => conta((a, s) => a === tipo && MOVIDAS.includes(s));

  const handoffs = turnos.filter((t) => t.resultado === "HANDOFF");
  const volumeMap = new Map<string, { resolvidas: number; comHandoff: number }>();
  for (let k = 0; k < i.dias; k++) {
    const p = partes(new Date(de.getTime() + k * DIA_MS + 12 * 3_600_000), fuso);
    volumeMap.set(`${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`, { resolvidas: 0, comHandoff: 0 });
  }
  for (const t of turnos) {
    const v = volumeMap.get(diaDe(t.criadoEm, fuso));
    if (!v) continue;
    if (t.resultado === "HANDOFF") v.comHandoff++;
    else v.resolvidas++;
  }

  // Tempo até o handoff: do primeiro turno do atendimento (no período) até o turno de handoff.
  const primeiro = new Map<string, number>();
  const duracoes: number[] = [];
  for (const t of turnos) {
    const chave = t.atendimentoId ?? "";
    if (!primeiro.has(chave)) primeiro.set(chave, t.criadoEm.getTime());
    if (t.resultado === "HANDOFF") duracoes.push((t.criadoEm.getTime() - primeiro.get(chave)!) / 60_000);
  }

  const aprovadas = conta((_, s) => s === "APROVADA");
  const rejeitadas = conta((_, s) => s === "REJEITADA");
  const desfeitas = conta((_, s) => s === "DESFEITA");
  const aplicadas = conta((_, s) => MOVIDAS.includes(s));

  let custoUsd: number | null = null;
  if (capacidadesAria(u).has("verProvedor")) {
    const soma = await prisma.chamadaIA.aggregate({ _sum: { custoMicroUsd: true }, where: { criadoEm: periodo } });
    custoUsd = (soma._sum.custoMicroUsd ?? 0) / 1_000_000;
  }

  return {
    conversas: turnos.length,
    taxaHandoff: turnos.length ? handoffs.length / turnos.length : null,
    etapasAvancadas: aplicada("MOVER_ETAPA"),
    tarefasCriadas: aplicada("CRIAR_TAREFA"),
    camposPreenchidos: aplicada("ATUALIZAR_CAMPO"),
    tempoMedioAteHandoffMin: duracoes.length ? duracoes.reduce((a, b) => a + b, 0) / duracoes.length : null,
    aprovadasSemEdicao: aprovadas + rejeitadas ? aprovadas / (aprovadas + rejeitadas) : null,
    desfeitas: aplicadas + desfeitas ? desfeitas / (aplicadas + desfeitas) : null,
    custoUsd,
    volume: [...volumeMap].map(([dia, v]) => ({ dia, ...v })),
  };
}

// ---- histórico ----------------------------------------------------------------------------

const RESULTADOS: Record<"PENDENTES" | "EXECUTADAS" | "REJEITADAS" | "DESFEITAS", StatusAcaoAgenteIA[]> = {
  PENDENTES: ["SUGERIDA"],
  EXECUTADAS: ["EXECUTADA", "APROVADA"],
  REJEITADAS: ["REJEITADA"],
  DESFEITAS: ["DESFEITA"],
};

function lerCursor(c: string): { criadoEm: Date; id: string } | null {
  const [iso, id] = c.split("|");
  const d = new Date(iso ?? "");
  return id && !Number.isNaN(d.getTime()) ? { criadoEm: d, id } : null;
}

export async function historicoAria(f: {
  busca?: string;
  acao?: AcaoAgenteIATipo;
  etapa?: EtapaLead;
  resultado?: keyof typeof RESULTADOS;
  cursor?: string;
}): Promise<{ itens: ItemHistoricoAria[]; proximo: string | null }> {
  const u = await exigirVer();
  const cap = capacidadesAria(u);
  const visiveis = await leadsVisiveis(u);
  const e: Prisma.AcaoAgenteIAWhereInput[] = [];

  if (visiveis) e.push({ OR: [{ oportunidadeId: { in: visiveis } }, { oportunidadeId: null, atendimento: { leadId: { in: visiveis } } }] });
  if (f.acao) e.push({ acao: f.acao });
  if (f.etapa) e.push({ etapaNoMomento: f.etapa });
  if (f.resultado) e.push({ status: { in: RESULTADOS[f.resultado] } });
  const busca = f.busca?.trim();
  if (busca) {
    const leads = await prisma.oportunidade.findMany({
      where: { OR: [{ nome: { contains: busca, mode: "insensitive" } }, { telefoneE164: { contains: busca } }], ...(visiveis ? { id: { in: visiveis } } : {}) },
      select: { id: true },
      take: 500,
    });
    const ids = leads.map((l) => l.id);
    e.push({ OR: [{ oportunidadeId: { in: ids } }, { atendimento: { leadId: { in: ids } } }] });
  }
  const cur = f.cursor ? lerCursor(f.cursor) : null;
  if (cur) e.push({ OR: [{ criadoEm: { lt: cur.criadoEm } }, { criadoEm: cur.criadoEm, id: { lt: cur.id } }] });

  const linhas = await prisma.acaoAgenteIA.findMany({
    where: { AND: e },
    orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
    take: POR_PAGINA + 1,
    include: { atendimento: { select: { leadId: true } } },
  });
  const pagina = linhas.slice(0, POR_PAGINA);

  const leadIds = [...new Set(pagina.map((a) => a.oportunidadeId ?? a.atendimento?.leadId).filter((x): x is string => !!x))];
  const userIds = [...new Set(pagina.map((a) => a.decididaPorId).filter((x): x is string => !!x))];
  const [leads, usuarios] = await Promise.all([
    leadIds.length ? prisma.oportunidade.findMany({ where: { id: { in: leadIds } }, select: { id: true, nome: true } }) : [],
    userIds.length ? prisma.usuario.findMany({ where: { id: { in: userIds } }, select: { id: true, nome: true } }) : [],
  ]);
  const nomeLead = new Map(leads.map((l) => [l.id, l.nome]));
  const nomeUsuario = new Map(usuarios.map((x) => [x.id, x.nome]));

  const itens = pagina.map((a): ItemHistoricoAria => {
    const leadId = a.oportunidadeId ?? a.atendimento?.leadId ?? null;
    return {
      id: a.id,
      quando: a.criadoEm.toISOString(),
      acao: a.acao,
      contato: (leadId && nomeLead.get(leadId)) || "Contato sem cadastro",
      etapa: a.etapaNoMomento,
      confianca: a.confianca,
      status: a.status,
      podeDesfazer: cap.has("decidirHistorico") && a.reversivel && MOVIDAS.includes(a.status),
      motivoIrreversivel: a.reversivel ? null : a.motivoIrreversivel,
      decididaPor: a.decididaPorId ? nomeUsuario.get(a.decididaPorId) ?? null : null,
    };
  });
  const ultima = pagina[pagina.length - 1];
  return { itens, proximo: linhas.length > POR_PAGINA && ultima ? `${ultima.criadoEm.toISOString()}|${ultima.id}` : null };
}

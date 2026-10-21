import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ArgsPaginados } from "@/test/consulta-paginada";

// Filas de trabalho por cursor nos dois sentidos (E4, decisão de 10/10/2026). Na página numerada, quem
// resolve itens da página 1 desloca a página 2 e quem avança pula registros. Para cada fila:
// - ida e volta devolvem os mesmos itens (`depois` do último, `antes` do primeiro);
// - a primeira página não tem anterior e a última não tem próxima;
// - RESOLVER UM ITEM DA PRIMEIRA PÁGINA (e até o próprio item âncora) NÃO FAZ O PRÓXIMO "Próxima" PULAR NINGUÉM;
// - a ordem termina no id e nenhuma leitura usa `skip`/OFFSET;
// - cursor com formato inválido, ou os dois sentidos juntos, é erro antes de consultar.
//
// O Prisma é de mentira e nunca toca o banco. `findMany` aplica o corte do cursor do `where`
// (`findManyComOnde`, src/test/consulta-paginada.ts) sobre as linhas que a fila mostraria agora; resolver
// é tirar a linha dessa lista. A âncora (`findUnique`/`findFirst` por id) é procurada em todas as linhas:
// um item resolvido continua existindo. Na SQL crua, o mock acha o cursor entre os valores do SQL, confere
// que o operador (`>`/`<`) corresponde ao sentido de leitura (`ORDER BY … ASC|DESC`) e devolve as linhas
// depois (ou antes) da posição do cursor na ordem natural da fila, até o LIMIT.

type Direcao = "asc" | "desc";
type Linha = Record<string, unknown> & { id: string };

const estado = vi.hoisted(() => ({
  papeis: ["ADMINISTRADOR", "FINANCEIRO", "SECRETARIA_ACADEMICA", "GERENTE_PEDAGOGICO", "PROFESSOR"],
  todas: {} as Record<string, Linha[]>,
  raw: [] as Record<string, unknown>[],
  rawNatural: "asc" as "asc" | "desc",
  rawId: (linha: Record<string, unknown>) => String(linha.id),
  resolvidos: new Set<string>(),
  chamadas: [] as { modelo: string; args: ArgsPaginados }[],
  sqls: [] as string[],
}));

vi.mock("@/lib/prisma", async () => {
  const { buscarPorId, findManyComOnde } = await import("@/test/consulta-paginada");
  const usuario = () => ({ id: "u", nome: "Usuária", ativo: true, papeis: estado.papeis });
  const visiveis = (linhas: Linha[]) => linhas.filter((l) => !estado.resolvidos.has(l.id));
  const queryRaw = async (primeiro: unknown, ...resto: unknown[]) => {
    const sql = primeiro as { strings?: readonly string[]; values?: unknown[] };
    const partes = Array.isArray(primeiro) ? (primeiro as readonly string[]) : sql.strings ?? [];
    const valores = Array.isArray(primeiro) ? resto : sql.values ?? [];
    const texto = partes.join("?");
    if (!/\bLIMIT\s*\?/.test(texto)) return [usuario()];
    estado.sqls.push(texto);
    if (/\bOFFSET\b/.test(texto)) throw new Error("fila por cursor não usa OFFSET");
    const take = valores[partes.findIndex((p, i) => i < valores.length && /LIMIT\s*$/.test(p))] as number;
    const ids = estado.raw.map(estado.rawId);
    const leitura: Direcao = /\bDESC\b/i.test(texto.slice(texto.lastIndexOf("ORDER BY"))) ? "desc" : "asc";
    const i = valores.findIndex((v) => typeof v === "string" && ids.includes(v));
    const linhas = estado.raw.filter((l) => !estado.resolvidos.has(estado.rawId(l)));
    if (i < 0) return (leitura === estado.rawNatural ? linhas : [...linhas].reverse()).slice(0, take);
    const op = [...partes[i].matchAll(/(?<![<>!])([<>])(?![<>=])/g)].pop()?.[1];
    const depois = leitura === estado.rawNatural;
    const esperado = (estado.rawNatural === "asc") === depois ? ">" : "<";
    if (op !== esperado) throw new Error(`operador do cursor ${op} não corresponde ao sentido (${depois ? "depois" : "antes"} em ordem ${estado.rawNatural})`);
    const posicao = ids.indexOf(valores[i] as string);
    const corte = linhas.filter((l) => (depois ? ids.indexOf(estado.rawId(l)) > posicao : ids.indexOf(estado.rawId(l)) < posicao));
    return (depois ? corte : corte.reverse()).slice(0, take);
  };
  const modelo = (nome: string) => {
    const daFila = () => estado.todas[nome];
    return {
      findMany: async (args: ArgsPaginados = {}) => {
        estado.chamadas.push({ modelo: nome, args });
        return daFila() ? findManyComOnde(visiveis(daFila()))(args) : [];
      },
      findUnique: async (args: { where?: unknown } = {}) => (nome === "usuario" ? usuario() : daFila() ? buscarPorId(daFila())(args) : null),
      findFirst: async (args: { where?: unknown } = {}) => (daFila() ? buscarPorId(daFila())(args) : null),
      count: async () => 0,
    };
  };
  const prisma: Record<string, unknown> = new Proxy({} as Record<string, unknown>, {
    get: (_alvo, chave) => {
      if (chave === "$transaction") return async (fn: (tx: unknown) => unknown) => fn(prisma);
      if (chave === "$executeRaw") return async () => 0;
      if (chave === "$queryRaw") return queryRaw;
      if (typeof chave !== "string" || chave === "then") return undefined;
      return modelo(chave);
    },
  });
  return { prisma };
});
vi.mock("@/server/_shared", async (original) => ({
  ...(await original<typeof import("@/server/_shared")>()),
  exigirSessaoComPapel: async () => ({ id: "u", nome: "Usuária", papeis: estado.papeis }),
}));
vi.mock("@/server/avaliacoes/recuperacao-agenda-consulta-tx", () => ({ agendasRecuperacaoAutorizadasTx: async () => new Map() }));
vi.mock("@/server/avaliacoes/segunda-chamada-tx", () => ({ estadoSegundaChamadaTx: async () => ({ pendente: true, saldo: 1, statusMatricula: "ATIVA", ativa: true }) }));
vi.mock("@/server/matricula/continuidade-estado-tx", () => ({ carregarContinuidadeMensalTx: async () => ({
  plano: { cobertura: { inicio: "2026-11-01", fim: "2026-11-30" }, vencimento: "2026-11-05", status: "PRONTA_PARA_EMISSAO" },
  oferta: { estado: "SEM_RELATO" }, comprovacaoOferta: { estado: "COMPROVADA_POR_AGENDA" }, motivo: "Prévia informativa",
}) }));
vi.mock("@/server/matricula/desistencia-administrativa", () => ({
  consultarDecisaoAdministrativaDesistencia: async ({ matriculaId }: { matriculaId: string }) => ({ ok: true, dado: {
    matricula: { id: matriculaId, codigo: null }, exigeAprovacaoAdministrativa: true,
    pedidos: [{ id: `pedido-${matriculaId}`, versao: 1, motivo: "Pedido", registradorNome: "Secretaria", atual: true, podeAprovar: false, podeDecidir: false, decisao: null }],
  } }),
}));
vi.mock("@/server/academico/estado", async (original) => ({
  ...(await original<typeof import("@/server/academico/estado")>()),
  carregarEstadoAcademico: async () => ({ origem: null }),
}));
vi.mock("@/server/academico/regras", async (original) => ({
  ...(await original<typeof import("@/server/academico/regras")>()),
  impedimentoEstadoAcademico: () => "Conferência pendente.",
}));

import { listarDesistenciasFinanceiras } from "./matricula/desistencia-financeiro-consulta";
import { listarPendenciasAdministrativasDesistencia } from "./matricula/desistencia-administrativa-fila";
import { consultarFilaContinuidadeMensal } from "./matricula/continuidade-fila";
import { consultarFilaEnviosPortalAluno } from "./portal-aluno/fila-envios";
import { consultarAvisosAlteracaoAgenda } from "./comunicacoes-agenda/consultas";
import { listarTentativasRecuperacaoDesignadas } from "./avaliacoes/recuperacao-fila-docente";
import { listarSegundasChamadasSemAgenda } from "./avaliacoes/segunda-chamada-fila-agenda";
import { listarExcecoesGravacao } from "./diario/excecao-consulta";
import { consultarAvisosDiario } from "./diario/avisos-pendencias-diario";
import { listarRegularizacoesAula } from "./diario/regularizacao-consultas";
import { listarFilaSolicitacoesAcademicas } from "./academico/consultas";

type Nav = { depois?: string; antes?: string };
type PaginaLida = { ids: string[]; temAnterior: boolean; temProxima: boolean; anterior: string | null; proxima: string | null };
type Resultado<T> = { ok: boolean; dado?: T; erro?: string };
const dado = <T,>(r: Resultado<T>): T => {
  if (!r.ok || !r.dado) throw new Error(`consulta falhou: ${r.erro}`);
  return r.dado;
};
const nav = (d: { temAnterior: boolean; temProxima: boolean; anterior: string | null; proxima: string | null }) => ({ temAnterior: d.temAnterior, temProxima: d.temProxima, anterior: d.anterior, proxima: d.proxima });

const passado = Date.parse("2026-09-01T12:00:00.000Z");
const quando = new Date(passado);
const turma = { codigo: "T", nome: null, modalidade: { nome: "Regular" }, nivel: { codigo: "A1", idioma: { nome: "Inglês" } }, diasHorario: null };

/**
 * Ordem natural da fila e as linhas na ordem em que ela as mostra (índice 0 primeiro):
 * - "id-asc"/"id-desc": só pelo id;
 * - { campo }: (campo desc, id desc), sete itens por instante — o id desempata, e o último item de cada página
 *   (a âncora do cursor) cai no meio ou no começo de um empate.
 */
type Ordem = "id-asc" | "id-desc" | { campo: string };
function gerar(quantidade: number, ordem: Ordem, extra: (id: string, i: number) => Record<string, unknown>): Linha[] {
  return Array.from({ length: quantidade }, (_, i) => {
    const id = `f${String(ordem === "id-asc" ? i : quantidade - 1 - i).padStart(3, "0")}`;
    const campo = typeof ordem === "object" ? { [ordem.campo]: new Date(passado - Math.floor(i / 7) * 60_000) } : {};
    return { ...extra(id, i), ...campo, id };
  });
}

type Caso = {
  nome: string;
  porPagina: number;
  /** Modelo do Prisma ou SQL crua (com a ordem natural e o id de cada linha crua). */
  fonte: { modelo: string } | { raw: Direcao; id: (linha: Record<string, unknown>) => string; campoId: string };
  ordem: Ordem;
  linha: (id: string, i: number) => Record<string, unknown>;
  ler: (n: Nav) => Promise<PaginaLida>;
  /** Como a linha fica depois de resolvida, quando o filtro da fila olha um campo dela (a âncora tem de continuar achável). */
  resolver?: (linha: Linha) => void;
};

const CASOS: Caso[] = [
  {
    nome: "desistências para conferência financeira", porPagina: 20, fonte: { modelo: "matricula" }, ordem: "id-asc",
    linha: () => ({ codigo: null, pedidosDesistenciaPreparacao: [] }),
    ler: async (n) => { const d = dado(await listarDesistenciasFinanceiras(n)); return { ids: d.itens.map((i) => i.id), ...nav(d) }; },
  },
  {
    nome: "desistências pendentes de decisão administrativa (SQL)", porPagina: 20, fonte: { raw: "asc", id: (l) => l.matriculaId as string, campoId: "matriculaId" }, ordem: "id-asc",
    linha: (id) => ({ matriculaId: id, pedidoId: `pedido-${id}` }),
    ler: async (n) => { const d = dado(await listarPendenciasAdministrativasDesistencia(n)); return { ids: d.itens.map((i) => i.id), ...nav(d) }; },
  },
  {
    nome: "continuidade mensal", porPagina: 20, fonte: { modelo: "matricula" }, ordem: "id-asc",
    linha: () => ({ codigo: null, aluno: { primeiroNome: "Ana", sobrenome: null } }),
    ler: async (n) => { const d = dado(await consultarFilaContinuidadeMensal(n)); return { ids: d.itens.map((i) => i.matriculaId), ...nav(d) }; },
  },
  {
    nome: "envios de acesso ao portal", porPagina: 20, fonte: { modelo: "solicitacaoEnvioPortalAluno" }, ordem: "id-asc",
    linha: () => ({ finalidade: "CONVITE", situacao: "INCERTO", criadoEm: quando, atualizadoEm: quando, conta: { aluno: { primeiroNome: "Ana", sobrenome: null } }, conciliacoes: [] }),
    ler: async (n) => { const d = dado(await consultarFilaEnviosPortalAluno(n)); return { ids: d.itens.map((i) => i.id), ...nav(d) }; },
  },
  {
    nome: "avisos de alteração na agenda", porPagina: 20, fonte: { modelo: "avisoAlteracaoAgenda" }, ordem: "id-desc",
    linha: () => ({ matriculaId: "m", canal: "EMAIL", situacao: "PREPARADO", criadoEm: quando, atualizadoEm: quando, aluno: { primeiroNome: "Ana", sobrenome: null }, itens: [] }),
    ler: async (n) => { const d = dado(await consultarAvisosAlteracaoAgenda(n)); return { ids: d.itens.map((i) => i.id), ...nav(d) }; },
  },
  {
    nome: "pendências operacionais dos avisos", porPagina: 20, fonte: { modelo: "pendenciaAvisoAgenda" }, ordem: "id-desc",
    linha: () => ({ matriculaId: "m", motivo: "CONTATO_INDISPONIVEL", situacao: "PENDENTE", criadoEm: quando, resolvidaEm: null, observacaoResolucao: null, matricula: { codigo: null, aluno: { primeiroNome: "Ana", sobrenome: null } }, resolvidaPor: null }),
    ler: async (n) => {
      const d = dado(await consultarAvisosAlteracaoAgenda({ depoisPendencias: n.depois, antesPendencias: n.antes }));
      return { ids: d.pendencias.map((i) => i.id), temAnterior: d.temAnteriorPendencia, temProxima: d.temProximaPendencia, anterior: d.anteriorPendencia, proxima: d.proximaPendencia };
    },
  },
  {
    nome: "tentativas de recuperação designadas (SQL)", porPagina: 20, fonte: { raw: "asc", id: (l) => l.id as string, campoId: "id" }, ordem: "id-asc",
    linha: () => ({ habilidade: "FALA", primeiroNome: "Ana", sobrenome: null, matriculaCodigo: null, matriculaId: "m", turma: "T", nivel: "A1", realizacaoId: null }),
    ler: async (n) => { const d = dado(await listarTentativasRecuperacaoDesignadas(n)); return { ids: d.itens.map((i) => i.id), ...nav(d) }; },
  },
  {
    nome: "segundas chamadas pendentes de agenda (SQL, criadaEm desc + id)", porPagina: 20, fonte: { raw: "desc", id: (l) => l.propostaSegundaChamadaId as string, campoId: "propostaSegundaChamadaId" }, ordem: { campo: "criadaEm" },
    linha: (id) => ({ propostaSegundaChamadaId: id, alocacaoId: "a", matriculaId: "m", turmaId: "t", codigoAvaliacao: "I1", aluno: "Ana", matriculaCodigo: null, turma: "T", prazoAte: quando, possuiReservaTerminal: false, possuiPendenciaEscola: false }),
    ler: async (n) => { const d = dado(await listarSegundasChamadasSemAgenda(n)); return { ids: d.itens.map((i) => i.propostaSegundaChamadaId), ...nav(d) }; },
  },
  {
    nome: "exceções de gravação (criadoEm desc + id)", porPagina: 30, fonte: { modelo: "excecaoGravacaoEncontro" }, ordem: { campo: "criadoEm" },
    linha: () => ({ encontroId: "e", solicitanteId: "outro", motivo: "Falha", snapshot: {}, solicitante: { nome: "Prof" }, decisao: null, encontro: { inicio: quando, fim: quando, fusoOrigem: "UTC", status: "PREVISTO", diario: null } }),
    ler: async (n) => { const d = dado(await listarExcecoesGravacao(n)); return { ids: d.itens.map((i) => i.id), ...nav(d) }; },
    resolver: (l) => { l.decisao = { aprovada: true, motivo: "Decidida", decididaEm: quando }; },
  },
  {
    nome: "pendências do diário (fim desc + id)", porPagina: 20, fonte: { modelo: "encontroAgenda" }, ordem: { campo: "fim" },
    linha: () => ({ finalidade: "AULA", status: "PREVISTO", inicio: quando, fusoOrigem: "UTC", turmaId: null, professorId: "p", turma: { codigo: "T", nome: null }, professor: { nome: "Prof" }, diario: null, publicacaoGravacao: null, excecoesGravacao: [], designacoesRegularizacaoAula: [] }),
    ler: async (n) => { const d = dado(await consultarAvisosDiario(n)); return { ids: d.itens.map((i) => i.encontroId), ...nav(d) }; },
    resolver: (l) => { l.status = "MINISTRADO"; },
  },
  {
    nome: "regularizações de aula", porPagina: 30, fonte: { modelo: "encontroAgenda" }, ordem: "id-asc",
    linha: () => ({ finalidade: "AULA", status: "PREVISTO", inicio: quando, fim: quando, fusoOrigem: "UTC", professorId: "p", professor: { nome: "Prof" }, turma: { codigo: "T" }, designacoesRegularizacaoAula: [] }),
    ler: async (n) => { const d = dado(await listarRegularizacoesAula(n)); return { ids: d.itens.map((i) => i.id), ...nav(d) }; },
    resolver: (l) => { l.status = "MINISTRADO"; },
  },
  {
    nome: "solicitações acadêmicas abertas (criadoEm desc + id)", porPagina: 50, fonte: { modelo: "solicitacaoMudancaAcademica" }, ordem: { campo: "criadoEm" },
    linha: () => ({ alunoId: "aluno", status: "PENDENTE", motivo: "Motivo", snapshot: null, alocacaoOrigemId: "a", turmaOrigemId: "t1", turmaDestinoId: "t2",
      solicitanteId: "outra", aprovadorId: null, motivoDecisao: null, justificativaDispensaParecer: null, motivoExecucao: null, motivoCancelamento: null,
      decididoEm: null, executadoEm: null, canceladoEm: null, aluno: { primeiroNome: "Ana", sobrenome: null },
      solicitante: { id: "outra", nome: "Secretaria", ativo: true, papeis: ["SECRETARIA_ACADEMICA"] }, aprovador: null, executor: null, cancelador: null,
      turmaOrigem: turma, turmaDestino: turma, pareceres: [] }),
    ler: async (n) => { const d = dado(await listarFilaSolicitacoesAcademicas(n)); return { ids: d.solicitacoes.map((i) => i.id), ...nav(d) }; },
    resolver: (l) => { l.status = "EXECUTADA"; },
  },
];

function preparar(caso: Caso, quantidade: number): string[] {
  const linhas = gerar(quantidade, caso.ordem, caso.linha);
  if ("modelo" in caso.fonte) estado.todas[caso.fonte.modelo] = linhas;
  else {
    const { campoId } = caso.fonte;
    estado.raw = linhas.map(({ id, ...resto }) => ({ ...resto, [campoId]: id }));
    estado.rawNatural = caso.fonte.raw;
    estado.rawId = caso.fonte.id;
  }
  return linhas.map((l) => l.id);
}

describe("filas por cursor nos dois sentidos (E4)", () => {
  beforeEach(() => {
    estado.todas = {};
    estado.raw = [];
    estado.resolvidos = new Set();
    estado.chamadas = [];
    estado.sqls = [];
  });

  it.each(CASOS.map((c) => [c.nome, c] as const))("%s: ida e volta; a primeira sem anterior e a última sem próxima", async (_nome, caso) => {
    const n = caso.porPagina;
    const ids = preparar(caso, n * 2 + 3);

    const p1 = await caso.ler({});
    expect(p1).toMatchObject({ ids: ids.slice(0, n), temAnterior: false, temProxima: true, anterior: null, proxima: ids[n - 1] });
    const p2 = await caso.ler({ depois: p1.proxima! });
    expect(p2).toMatchObject({ ids: ids.slice(n, 2 * n), temAnterior: true, temProxima: true, anterior: ids[n], proxima: ids[2 * n - 1] });
    const p3 = await caso.ler({ depois: p2.proxima! });
    expect(p3).toMatchObject({ ids: ids.slice(2 * n), temAnterior: true, temProxima: false, anterior: ids[2 * n], proxima: null });

    // Volta: a partir do primeiro item visto, as mesmas páginas, na mesma ordem.
    expect((await caso.ler({ antes: p3.anterior! })).ids).toEqual(p2.ids);
    const volta = await caso.ler({ antes: p2.anterior! });
    expect(volta).toEqual(p1);

    // A ordem termina no id e nenhuma leitura pula registros por posição (skip/OFFSET).
    if ("modelo" in caso.fonte) {
      const leituras = estado.chamadas.filter((c) => c.modelo === (caso.fonte as { modelo: string }).modelo);
      expect(leituras.length).toBeGreaterThan(0);
      for (const { args } of leituras) {
        const ordens = Array.isArray(args.orderBy) ? args.orderBy : [args.orderBy ?? {}];
        expect(Object.keys(ordens[ordens.length - 1] ?? {})).toEqual(["id"]);
        expect(args).not.toHaveProperty("skip");
        expect(args.take).toBe(n + 1);
      }
    } else {
      expect(estado.sqls.length).toBeGreaterThan(0);
      for (const sql of estado.sqls) expect(sql).not.toMatch(/OFFSET/);
    }
  });

  it.each(CASOS.map((c) => [c.nome, c] as const))("%s: resolver itens da primeira página (até a âncora) não faz a próxima pular ninguém", async (_nome, caso) => {
    const n = caso.porPagina;
    const ids = preparar(caso, n * 2 + 3);
    const p1 = await caso.ler({});
    // Alguém resolve o 3º item e o último da página (a âncora do cursor): os dois saem da fila (e, onde o filtro da fila
    // olha um campo da linha, o campo muda — a âncora continua existindo, fora da fila).
    for (const id of [ids[2], ids[n - 1]]) {
      estado.resolvidos.add(id);
      const linha = "modelo" in caso.fonte ? estado.todas[caso.fonte.modelo].find((l) => l.id === id) : undefined;
      if (linha) caso.resolver?.(linha);
    }
    const p2 = await caso.ler({ depois: p1.proxima! });
    expect(p2.ids).toEqual(ids.slice(n, 2 * n));
    expect(p2.ids[0]).toBe(ids[n]);
    // Na volta, a página antes de p2 é o começo da fila de agora (sem os resolvidos), cheia e sem anterior.
    const volta = await caso.ler({ antes: p2.anterior! });
    expect(volta.temAnterior).toBe(false);
    expect(volta.ids).toEqual(ids.filter((id) => !estado.resolvidos.has(id)).slice(0, n));
  });

  it.each(CASOS.map((c) => [c.nome, c] as const))("%s: cursor inválido e os dois sentidos juntos são recusados sem consultar a fila", async (_nome, caso) => {
    preparar(caso, 3);
    for (const invalido of [{ depois: "a b" }, { antes: "x".repeat(101) }, { depois: "f001", antes: "f000" }]) {
      await expect(caso.ler(invalido)).rejects.toThrow(/consulta falhou/);
    }
    expect(estado.chamadas.filter((c) => "modelo" in caso.fonte && c.modelo === caso.fonte.modelo)).toEqual([]);
    expect(estado.sqls).toEqual([]);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ArgsPaginados } from "@/test/consulta-paginada";

// Consultas que passaram de cursor "só para frente" para página numerada (E4, docs/43 §6 item 4). Para
// cada uma: a página 1 não tem anterior (é a 1) e tem próxima; a última não tem próxima; ida e volta
// trazem os mesmos registros; nenhuma página repete ou perde registro; a ordem termina no id (ou, na
// consulta SQL crua, LIMIT/OFFSET recebem a janela da página).
//
// O Prisma é de mentira (src/test/consulta-paginada.ts): `findMany` ordena e aplica skip/take sobre as
// linhas do teste; `$queryRaw` devolve a janela LIMIT/OFFSET das linhas cruas ou, sem OFFSET, o usuário
// ativo das conferências de papel. Tudo o mais que cada consulta chama de fora (identificação, agendas,
// estado da segunda chamada, decisão administrativa) é simulado com o mínimo que a tela recebe.

const estado = vi.hoisted(() => ({
  papeis: ["ADMINISTRADOR", "FINANCEIRO", "SECRETARIA_ACADEMICA", "GERENTE_PEDAGOGICO", "PROFESSOR"],
  linhas: {} as Record<string, Record<string, unknown>[]>,
  raw: [] as Record<string, unknown>[],
  chamadas: [] as { modelo: string; args: ArgsPaginados }[],
  janelasRaw: [] as { take: number; skip: number }[],
}));

vi.mock("@/lib/prisma", async () => {
  const { findManyOrdenado } = await import("@/test/consulta-paginada");
  const usuario = () => ({ id: "u", nome: "Usuária", ativo: true, papeis: estado.papeis });
  const queryRaw = async (primeiro: unknown, ...resto: unknown[]) => {
    const sql = primeiro as { strings?: readonly string[]; values?: unknown[] };
    const partes = Array.isArray(primeiro) ? (primeiro as readonly string[]) : sql.strings ?? [];
    const valores = Array.isArray(primeiro) ? resto : sql.values ?? [];
    if (!partes.join("?").includes("OFFSET")) return [usuario()];
    const [take, skip] = valores.slice(-2) as number[];
    estado.janelasRaw.push({ take, skip });
    return estado.raw.slice(skip, skip + take);
  };
  const modelo = (nome: string) => ({
    findMany: async (args: ArgsPaginados = {}) => {
      estado.chamadas.push({ modelo: nome, args });
      return findManyOrdenado(estado.linhas[nome] ?? [])(args);
    },
    findUnique: async () => (nome === "alocacaoTurma" ? { id: "alocacao", matriculaId: "matricula", turmaId: "turma" } : usuario()),
    findFirst: async () => usuario(),
    findFirstOrThrow: async () => usuario(),
    count: async () => 1,
  });
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
vi.mock("@/server/avaliacoes/identificacao", () => ({ identificarMatriculaAvaliacao: async () => ({}) }));
vi.mock("@/server/avaliacoes/regras-tx", () => ({ conferirGestorAvaliacao: async () => undefined }));
vi.mock("@/server/avaliacoes/recuperacao-agenda-consulta-tx", () => ({ agendasRecuperacaoAutorizadasTx: async () => new Map() }));
vi.mock("@/server/avaliacoes/segunda-chamada-tx", () => ({ estadoSegundaChamadaTx: async () => ({ pendente: true, saldo: 1, statusMatricula: "ATIVA", ativa: true }) }));
vi.mock("@/server/matricula/desistencia-administrativa", () => ({
  consultarDecisaoAdministrativaDesistencia: async ({ matriculaId }: { matriculaId: string }) => ({ ok: true, dado: {
    matricula: { id: matriculaId, codigo: null }, exigeAprovacaoAdministrativa: true,
    pedidos: [{ id: `pedido-${matriculaId}`, versao: 1, motivo: "Pedido", registradorNome: "Secretaria", atual: true, podeAprovar: false, podeDecidir: false, decisao: null }],
  } }),
}));

import { listarDesistenciasFinanceiras } from "./matricula/desistencia-financeiro-consulta";
import { listarPendenciasAdministrativasDesistencia } from "./matricula/desistencia-administrativa-fila";
import { consultarAvisosAlteracaoAgenda } from "./comunicacoes-agenda/consultas";
import { listarAutorizacoesComunicacaoAcademica } from "./comunicacoes-agenda/autorizacoes";
import { consultarLotesPreparacaoMigracao } from "./migracao/consultas";
import { listarLinhasConciliacaoFinanceira } from "./migracao/consultas-financeiras";
import { listarExcecoesGravacao } from "./diario/excecao-consulta";
import { listarRegularizacoesAula } from "./diario/regularizacao-consultas";
import { listarPropostasEquivalencia } from "./avaliacoes/equivalencia-consulta";
import { consultarIndisponibilidadesDocentes } from "./agenda/indisponibilidade-consulta";
import { listarAgendasSegundaChamada } from "./avaliacoes/segunda-chamada-agendas";
import { listarSegundasChamadasSemAgenda } from "./avaliacoes/segunda-chamada-fila-agenda";
import { listarTentativasRecuperacaoDesignadas } from "./avaliacoes/recuperacao-fila-docente";
import { consultarHistoricoPreparacaoRecuperacao } from "./avaliacoes/recuperacao-preparacao-historico";

type Pagina = { pagina: number; temProxima: boolean; ids: string[] };
type Resultado<T> = { ok: boolean; dado?: T; erro?: string };
const dado = <T,>(r: Resultado<T>): T => {
  if (!r.ok || !r.dado) throw new Error(`consulta falhou: ${r.erro}`);
  return r.dado;
};
const quando = new Date("2026-09-01T12:00:00.000Z");
const ids = (quantidade: number) => Array.from({ length: quantidade }, (_, i) => `r${String(i).padStart(2, "0")}`);

/** Cada consulta: onde estão as linhas (modelo do Prisma ou SQL cru), como é uma linha e como ler a página. */
type Caso = { nome: string; porPagina: number; modelo: string | null; linha: (id: string) => Record<string, unknown>; ler: (pagina: number) => Promise<Pagina> };

const CASOS: Caso[] = [
  {
    nome: "desistências para conferência financeira", porPagina: 20, modelo: "matricula",
    linha: (id) => ({ id, codigo: null, pedidosDesistenciaPreparacao: [] }),
    ler: async (pagina) => { const d = dado(await listarDesistenciasFinanceiras({ pagina })); return { pagina: d.pagina, temProxima: d.temProxima, ids: d.itens.map((i) => i.id) }; },
  },
  {
    nome: "desistências pendentes de decisão administrativa (SQL)", porPagina: 20, modelo: null,
    linha: (id) => ({ matriculaId: id, pedidoId: `pedido-${id}` }),
    ler: async (pagina) => { const d = dado(await listarPendenciasAdministrativasDesistencia({ pagina })); return { pagina: d.pagina, temProxima: d.temProxima, ids: d.itens.map((i) => i.id) }; },
  },
  {
    nome: "avisos de alteração na agenda", porPagina: 20, modelo: "avisoAlteracaoAgenda",
    linha: (id) => ({ id, matriculaId: "m", canal: "EMAIL", situacao: "PREPARADO", criadoEm: quando, atualizadoEm: quando, aluno: { primeiroNome: "Ana", sobrenome: null }, itens: [] }),
    ler: async (pagina) => { const d = dado(await consultarAvisosAlteracaoAgenda({ pagina })); return { pagina: d.pagina, temProxima: d.temProxima, ids: d.itens.map((i) => i.id) }; },
  },
  {
    nome: "pendências operacionais dos avisos", porPagina: 20, modelo: "pendenciaAvisoAgenda",
    linha: (id) => ({ id, matriculaId: "m", motivo: "CONTATO_INDISPONIVEL", situacao: "PENDENTE", criadoEm: quando, resolvidaEm: null, observacaoResolucao: null, matricula: { codigo: null, aluno: { primeiroNome: "Ana", sobrenome: null } }, resolvidaPor: null }),
    ler: async (pagina) => { const d = dado(await consultarAvisosAlteracaoAgenda({ paginaPendencias: pagina })); return { pagina: d.paginaPendencias, temProxima: d.temProximaPendencia, ids: d.pendencias.map((i) => i.id) }; },
  },
  {
    nome: "histórico de autorizações de comunicação", porPagina: 25, modelo: "autorizacaoComunicacaoAcademica",
    linha: (id) => ({ id, vigenteEm: quando }),
    ler: async (pagina) => { const d = await listarAutorizacoesComunicacaoAcademica({ matriculaId: "m", pagina }); return { pagina: d.pagina, temProxima: d.temProxima, ids: d.itens.map((i) => i.id) }; },
  },
  {
    nome: "lotes preparados da migração", porPagina: 20, modelo: "lotePreparacaoMigracao",
    linha: (id) => ({ id, origem: "Q10", chaveLote: id, estado: "PREPARADO", criadoEm: quando, preparadoPor: { nome: "Admin" }, _count: { linhas: 0, conflitosEntrada: 0 }, linhas: [] }),
    ler: async (pagina) => { const d = dado(await consultarLotesPreparacaoMigracao({ pagina })); return { pagina: d.pagina, temProxima: d.temProxima, ids: d.itens.map((i) => i.id) }; },
  },
  {
    nome: "linhas financeiras da migração", porPagina: 20, modelo: "linhaPreparacaoMigracao",
    linha: (id) => ({ id, propostasConciliacaoFinanceira: [] }),
    ler: async (pagina) => { const d = dado(await listarLinhasConciliacaoFinanceira({ pagina })); return { pagina: d.pagina, temProxima: d.temProxima, ids: d.itens.map((i) => i.id) }; },
  },
  {
    nome: "exceções de gravação", porPagina: 30, modelo: "excecaoGravacaoEncontro",
    linha: (id) => ({ id, encontroId: "e", solicitanteId: "outro", motivo: "Falha", criadoEm: quando, snapshot: {}, solicitante: { nome: "Prof" }, decisao: null, encontro: { inicio: quando, fim: quando, fusoOrigem: "UTC", status: "PREVISTO", diario: null } }),
    ler: async (pagina) => { const d = dado(await listarExcecoesGravacao({ apenasPendentes: false, pagina })); return { pagina: d.pagina, temProxima: d.temProxima, ids: d.itens.map((i) => i.id) }; },
  },
  {
    nome: "regularizações de aula", porPagina: 30, modelo: "encontroAgenda",
    linha: (id) => ({ id, status: "PREVISTO", inicio: quando, fim: quando, fusoOrigem: "UTC", professorId: "p", professor: { nome: "Prof" }, turma: { codigo: "T" }, designacoesRegularizacaoAula: [] }),
    ler: async (pagina) => { const d = dado(await listarRegularizacoesAula({ pagina })); return { pagina: d.pagina, temProxima: d.temProxima, ids: d.itens.map((i) => i.id) }; },
  },
  {
    nome: "propostas de aproveitamento", porPagina: 50, modelo: "propostaEquivalenciaAvaliacao",
    linha: (id) => ({ id, versao: 1, criadaEm: quando, motivo: "Motivo", turmaOrigem: { nome: null, codigo: "A" }, turmaDestino: { nome: null, codigo: "B" }, decisao: null }),
    ler: async (pagina) => { const d = dado(await listarPropostasEquivalencia({ matriculaId: "m", pagina })); return { pagina: d.pagina, temProxima: d.temProxima, ids: d.itens.map((i) => i.id) }; },
  },
  {
    nome: "indisponibilidades docentes", porPagina: 30, modelo: "indisponibilidadeDocente",
    linha: (id) => ({ id, professorId: "p", professor: { nome: "Prof" }, inicio: quando, fim: quando, fusoOrigem: "UTC", motivo: "Motivo", preparadorId: "p", criadoEm: quando, decisao: { aprovada: false, decisorId: "g", motivo: "Não", decididaEm: quando, encontrosAfetados: [], reservasAfetadas: [] } }),
    ler: async (pagina) => { const d = dado(await consultarIndisponibilidadesDocentes({ pagina })); return { pagina: d.pagina, temProxima: d.temProxima, ids: d.itens.map((i) => i.id) }; },
  },
  {
    nome: "agendas de segunda chamada", porPagina: 20, modelo: "reservaSegundaChamada",
    linha: (id) => ({ id, status: "RESERVADA", codigoAvaliacao: "I1", reservadaEm: quando, matricula: { codigo: null, aluno: { primeiroNome: "Ana", sobrenome: null, nomePreferido: null } }, proposta: { turma: { codigo: "T", nome: null } }, agenda: null }),
    ler: async (pagina) => { const d = dado(await listarAgendasSegundaChamada({ pagina })); return { pagina: d.pagina, temProxima: d.temProxima, ids: d.itens.map((i) => i.reservaId) }; },
  },
  {
    nome: "segundas chamadas pendentes de agenda (SQL)", porPagina: 20, modelo: null,
    linha: (id) => ({ propostaSegundaChamadaId: id, alocacaoId: "a", matriculaId: "m", turmaId: "t", codigoAvaliacao: "I1", aluno: "Ana", matriculaCodigo: null, turma: "T", prazoAte: quando, criadaEm: quando, possuiReservaTerminal: false, possuiPendenciaEscola: false }),
    ler: async (pagina) => { const d = dado(await listarSegundasChamadasSemAgenda({ pagina })); return { pagina: d.pagina, temProxima: d.temProxima, ids: d.itens.map((i) => i.propostaSegundaChamadaId) }; },
  },
  {
    nome: "tentativas de recuperação designadas (SQL)", porPagina: 20, modelo: null,
    linha: (id) => ({ id, habilidade: "FALA", primeiroNome: "Ana", sobrenome: null, matriculaCodigo: null, matriculaId: "m", turma: "T", nivel: "A1", realizacaoId: null }),
    ler: async (pagina) => { const d = dado(await listarTentativasRecuperacaoDesignadas({ pagina })); return { pagina: d.pagina, temProxima: d.temProxima, ids: d.itens.map((i) => i.id) }; },
  },
  {
    nome: "histórico de autorizações de preparação", porPagina: 20, modelo: "autorizacaoEspecialPreparacaoRecuperacao",
    linha: (id) => ({ id, motivo: "Motivo", criadaEm: quando, prazoAte: quando, autorizador: { nome: "Gestora" }, _count: { propostasPlano: 0 } }),
    ler: async (pagina) => { const d = dado(await consultarHistoricoPreparacaoRecuperacao({ alocacaoId: "alocacao", pagina })); return { pagina: d.pagina, temProxima: d.temProxima, ids: d.historico.map((i) => i.id) }; },
  },
];

describe("consultas numeradas: ida e volta (E4)", () => {
  beforeEach(() => {
    estado.linhas = {};
    estado.raw = [];
    estado.chamadas = [];
    estado.janelasRaw = [];
  });

  it.each(CASOS.map((c) => [c.nome, c] as const))("%s", async (_nome, caso) => {
    // Duas páginas cheias e uma com 3: a primeira tem próxima, a última não.
    const linhas = ids(caso.porPagina * 2 + 3).map(caso.linha);
    if (caso.modelo) estado.linhas[caso.modelo] = linhas;
    else estado.raw = linhas;

    const p1 = await caso.ler(1), p2 = await caso.ler(2), p3 = await caso.ler(3);
    expect([p1.pagina, p2.pagina, p3.pagina]).toEqual([1, 2, 3]);
    expect([p1.temProxima, p2.temProxima, p3.temProxima]).toEqual([true, true, false]);
    expect([p1.ids.length, p2.ids.length, p3.ids.length]).toEqual([caso.porPagina, caso.porPagina, 3]);

    // Volta: a 2 e a 1, lidas de novo, trazem os mesmos registros na mesma ordem.
    expect((await caso.ler(2)).ids).toEqual(p2.ids);
    expect((await caso.ler(1)).ids).toEqual(p1.ids);

    // Nenhum registro some nem se repete.
    const todos = [...p1.ids, ...p2.ids, ...p3.ids];
    expect(new Set(todos).size).toBe(linhas.length);

    if (caso.modelo) {
      const chamadas = estado.chamadas.filter((c) => c.modelo === caso.modelo);
      // Desempate pelo id: a última ordem é o id.
      for (const { args } of chamadas) {
        const ordens = Array.isArray(args.orderBy) ? args.orderBy : [args.orderBy ?? {}];
        expect(Object.keys(ordens[ordens.length - 1] ?? {})).toEqual(["id"]);
      }
      expect(chamadas.slice(0, 3).map((c) => [c.args.skip, c.args.take])).toEqual([[0, caso.porPagina + 1], [caso.porPagina, caso.porPagina + 1], [caso.porPagina * 2, caso.porPagina + 1]]);
    } else {
      expect(estado.janelasRaw.slice(0, 3)).toEqual([
        { take: caso.porPagina + 1, skip: 0 }, { take: caso.porPagina + 1, skip: caso.porPagina }, { take: caso.porPagina + 1, skip: caso.porPagina * 2 },
      ]);
    }
  });

  it("página fora do intervalo é recusada antes de consultar", async () => {
    expect(await listarDesistenciasFinanceiras({ pagina: 0 })).toMatchObject({ ok: false });
    expect(await listarSegundasChamadasSemAgenda({ pagina: 100001 })).toMatchObject({ ok: false });
    expect(await consultarAvisosAlteracaoAgenda({ paginaPendencias: 1.5 })).toMatchObject({ ok: false });
    expect(estado.chamadas).toEqual([]);
    expect(estado.janelasRaw).toEqual([]);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

// Contadores dos cartões-indicadores em listarFilaCobranca (E4, R2 da #144): o número de cada cartão tem
// de ser o tamanho da lista que o filtro do mesmo cartão devolve (filtros-fila.ts). Sem banco: as
// dependências de leitura são mockadas e a régua (proximaAcao) devolve o estado/atraso de cada cobrança.

const m = vi.hoisted(() => ({
  cobrancas: vi.fn(),
  eventos: vi.fn(),
  templates: vi.fn(),
  intencoes: vi.fn(),
  atendimentos: vi.fn(),
  proximaAcao: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    cobranca: { findMany: m.cobrancas },
    evento: { findMany: m.eventos },
    templateWhatsApp: { findMany: m.templates },
    intencaoMensagem: { findMany: m.intencoes },
    atendimentoWhatsApp: { findMany: m.atendimentos },
  },
}));
vi.mock("./politica", () => ({ carregarPoliticaRegua: async () => ({ degraus: [], templateIdPorPasso: new Map() }) }));
vi.mock("./regua", () => ({ proximaAcao: m.proximaAcao }));
vi.mock("./conferencia", () => ({ suspensoesPorConferencia: async () => new Map() }));
vi.mock("./eventos", () => ({ cicloDoEventoCobranca: () => 1 }));
vi.mock("@/server/financeiro/vencimento-civil", () => ({
  carregarTrilhasVencimentoCivil: async () => ({ vencimentosPorCobranca: new Map(), m01PorCobranca: new Map(), retomadasReprogramadas: [] }),
  incluirFonteVencimentoCivil: {},
  referenciaVencimentoCivil: () => ({ estado: "A_CONFERIR", motivo: "teste" }),
}));
vi.mock("@/server/whatsapp/identidade", () => ({ resolverDestinoCobranca: () => null, INCLUDE_MATRICULA_DESTINO: {} }));
vi.mock("@/server/whatsapp/destinatario-atual", () => ({ contatoCorrespondeDestinoFinanceiro: () => false }));
vi.mock("@/server/whatsapp/render", () => ({ renderizarTemplate: () => ({ corpo: "" }) }));

import { listarFilaCobranca } from "./consultas";
import { filtrarFila, lerFiltrosFila } from "./filtros-fila";

/** Cobranças abertas e o que a régua diz de cada uma (estado, dias de atraso). */
const CASOS: { id: string; estado: string; diasAtraso: number; bloqueado?: boolean }[] = [
  { id: "vence", estado: "futuro", diasAtraso: -2 },
  { id: "vence2", estado: "futuro", diasAtraso: -9 },
  { id: "vence3", estado: "futuro", diasAtraso: -20 },
  // Fronteira: vence hoje — é "A vencer", não "Em atraso".
  { id: "hoje", estado: "acao_devida", diasAtraso: 0 },
  { id: "atraso", estado: "acao_devida", diasAtraso: 5 },
  { id: "atraso2", estado: "acao_devida", diasAtraso: 10 },
  // Atraso ≥ 30 sem acesso bloqueado → precisaBloqueio (Bloquear ⊂ Em atraso).
  { id: "bloqueio", estado: "acao_devida", diasAtraso: 40 },
  // Promessas: uma que vence hoje e uma sobre cobrança atrasada — as duas só em "Promessas".
  { id: "promessa-hoje", estado: "promessa", diasAtraso: 0 },
  { id: "promessa-atrasada", estado: "promessa", diasAtraso: 4 },
  // Entre 15 e 29 dias: Em atraso, ainda não Bloquear (o limiar é 30, não o 15 dos comentários antigos).
  { id: "atraso-medio", estado: "acao_devida", diasAtraso: 20 },
  // Acesso já bloqueado: Em atraso, mas fora de Bloquear (não há mais o que bloquear).
  { id: "ja-bloqueado", estado: "acao_devida", diasAtraso: 45, bloqueado: true },
  // Promessa com atraso ≥ 30: entra em Bloquear (precisaBloqueio não olha o estado) e fica fora de Em atraso.
  { id: "promessa-antiga", estado: "promessa", diasAtraso: 35 },
];

const vencimentoDe = (indice: number) => new Date(Date.UTC(2026, 0, 1 + indice));

const cobranca = (id: string, indice: number, bloqueado = false) => ({
  id, cicloRegua: 1, codigo: `COB-${id}`, tipo: "MENSALIDADE",
  valorNegociado: 100, valorRecebido: null, saldo: null, moeda: "BRL",
  vencimento: vencimentoDe(indice), competencia: "2026-01", matriculaId: `matricula-${id}`,
  matricula: {
    acessoBloqueado: bloqueado,
    aluno: { id: `aluno-${id}`, primeiroNome: "Aluno", sobrenome: id, telefoneE164: null, pais: null },
    pais: { nome: "Brasil" },
    alocacoes: [],
  },
});

describe("listarFilaCobranca — contadores dos cartões (E4, R2 da #144)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.cobrancas.mockResolvedValue(CASOS.map((c, i) => cobranca(c.id, i, c.bloqueado)));
    m.eventos.mockResolvedValue([]);
    m.templates.mockResolvedValue([]);
    m.intencoes.mockResolvedValue([]);
    m.atendimentos.mockResolvedValue([]);
    // A régua de cada cobrança, achada pelo vencimento (cada cobrança tem o seu).
    m.proximaAcao.mockImplementation((entrada: { vencimento: Date }) => {
      const caso = CASOS.find((_, i) => vencimentoDe(i).getTime() === entrada.vencimento.getTime());
      if (!caso) throw new Error(`vencimento inesperado: ${entrada.vencimento.toISOString()}`);
      return { estado: caso.estado, degrau: null, atrasadaNaAcao: false, diasAtraso: caso.diasAtraso, prioridade: 1, promessaAte: null };
    });
  });

  it("a fila chega com o estado e o atraso da régua (a fixture é a que os contadores veem)", async () => {
    const { itens } = await listarFilaCobranca();
    expect(itens.map((i) => [i.id, i.estado, i.diasAtraso, i.precisaBloqueio])).toEqual(
      CASOS.map((c) => [c.id, c.estado, c.diasAtraso, c.id === "bloqueio" || c.id === "promessa-antiga"]),
    );
  });

  it("cada cartão com o número esperado — quem vence hoje conta em A vencer; promessa só em Promessas", async () => {
    const { dashs } = await listarFilaCobranca();
    expect({ aVencer: dashs.aVencer, emAtraso: dashs.emAtraso, bloquear: dashs.bloquear, promessas: dashs.promessas })
      .toEqual({ aVencer: 4, emAtraso: 5, bloquear: 2, promessas: 3 });
  });

  it("o número de cada cartão é o tamanho da lista filtrada pelo mesmo cartão (filtros-fila)", async () => {
    const { itens, dashs } = await listarFilaCobranca();
    // Cópia literal das chaves dos cartões (não itera INDICADORES_FILA).
    for (const indicador of ["aVencer", "emAtraso", "bloquear", "promessas"] as const) {
      expect(dashs[indicador], indicador).toBe(filtrarFila(itens, lerFiltrosFila({ indicador })).length);
    }
  });
});

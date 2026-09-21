import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StatusCobranca, TipoCobranca } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ useState: vi.fn() }));

vi.mock("react", async original => ({ ...(await original<typeof import("react")>()), useState: mocks.useState }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/server/financeiro/acoes", () => ({ registrarCobrancaWhatsApp: vi.fn() }));
vi.mock("@/server/financeiro/cobranca-manual", () => ({ prepararCobrancaManual: vi.fn() }));
vi.mock("@/server/whatsapp/acoes", () => ({ aprovarLoteCobranca: vi.fn(), enfileirarCobrancaWhatsApp: vi.fn() }));
vi.mock("@/server/ajustes/acoes", () => ({ ajustarCobranca: vi.fn() }));
vi.mock("@/server/migracao/conciliacao-financeira", () => ({ decidirConciliacaoFinanceiraMigracao: vi.fn(), proporConciliacaoFinanceiraMigracao: vi.fn() }));
vi.mock("@/components/PagamentoModal", () => ({ PagamentoModal: () => null }));

import { FichaFinanceira, type FichaFinanceiraDados } from "../alunos/[id]/financeiro/FichaFinanceira";
import { FilaCobranca } from "./FilaCobranca";
import { ConferenciaFinanceiraMigracao, type DadosConciliacaoFinanceira } from "./migracao/[linhaId]/ConferenciaFinanceiraMigracao";
import type { DashsCobranca, DegrauFila, FilaCobrancaItem } from "@/server/cobrancas/consultas";
import type { VencimentoVisivel } from "@/lib/vencimento-civil";

const confirmado: VencimentoVisivel = {
  estado: "CONFIRMADO", dataCivil: "2099-03-01", fuso: "Pacific/Kiritimati", origem: "EMISSAO_ENTRADA",
};
const aConferir: VencimentoVisivel = {
  estado: "A_CONFERIR", motivo: "A origem não preserva fuso e data civil.",
};

const item: FilaCobrancaItem = {
  id: "c-confirmada", cicloRegua: 1, codigo: "C-1", tipo: "MENSALIDADE", valorNegociado: 100, valorRecebido: 0, saldo: 100, moeda: "USD",
  vencimento: confirmado, competencia: null, estado: "futuro", passo: "D-7", tipoAcao: "lembrar", template: null, rotuloAcao: null,
  atrasadaNaAcao: false, diasAtraso: -7, prioridade: 1, promessaAte: null, matriculaId: "m", acessoBloqueado: false, precisaBloqueio: false,
  tentativas: 0, ultimaCobrancaEm: null, passosFeitos: [], aluno: { id: "aluno", nome: "Ana", telefone: null }, pais: "Kiribati", turma: null,
  destino: null, respondeuEm: null, envio: null, mensagemSugerida: null,
};
const dashs: DashsCobranca = { aVencer: 1, emAtraso: 0, bloquear: 0, promessas: 0, recebidoHoje: [] };
const regua: DegrauFila[] = [{ passo: "D-7", offsetDias: -7, tipo: "lembrar", rotulo: "Lembrete" }];

const ficha: FichaFinanceiraDados = {
  aluno: { id: "aluno", nome: "Ana", codigo: "A1", pais: "Kiribati" }, responsavelFinanceiro: "Ana", situacaoAtrasado: false, acessoBloqueado: false,
  historico: [], contrato: [], ajustes: [], comissoes: [],
  tiles: { proximoVenc: { valor: 100, moeda: "USD", vencimento: confirmado }, ultimoPago: null, emAberto: [{ moeda: "USD", valor: 100 }], emAtraso: [] },
  cobrancas: [{ id: "c-confirmada", tipo: TipoCobranca.MENSALIDADE, status: StatusCobranca.PENDENTE, valorNegociado: 100, valorRecebido: 0, saldo: 100, moeda: "USD", vencimento: confirmado, pagoEm: null, forma: null, regua: null }, { id: "c-incerta", tipo: TipoCobranca.MENSALIDADE, status: StatusCobranca.PENDENTE, valorNegociado: 100, valorRecebido: 0, saldo: 100, moeda: "USD", vencimento: aConferir, pagoEm: null, forma: null, regua: null }],
  permissoes: { registrarPagamento: false, somenteInformar: false, renegociar: false, perdao: false },
};

const migracao: DadosConciliacaoFinanceira = {
  linha: { id: "linha", linhaOrigem: "financeiro!2", entradaHash: "hash", dadosOrigem: {}, lote: { origem: "legado", chaveLote: "lote" }, mapa: { matriculaId: "m", codigo: "M1", status: "ATIVA", aluno: "Ana" } },
  cobrancas: [{ id: "c-confirmada", codigo: "C-1", status: "PENDENTE", tipo: "MENSALIDADE", moeda: "USD", valorNegociado: "100", valorRecebido: null, saldo: "100", versao: 1, vencimento: confirmado }, { id: "c-incerta", codigo: "C-2", status: "PENDENTE", tipo: "MENSALIDADE", moeda: "USD", valorNegociado: "100", valorRecebido: null, saldo: "100", versao: 1, vencimento: aConferir }],
  recebimentos: [], pagadores: [], propostas: [], podeDecidir: true,
};

function resolverEstadoInicial(inicial: unknown) {
  return typeof inicial === "function" ? (inicial as () => unknown)() : inicial;
}

describe("projeção civil de vencimento nas telas financeiras", () => {
  afterEach(() => vi.clearAllMocks());

  it("mantém a data UTC+14 e expõe origem sem prova como A_CONFERIR", () => {
    let chamadasUseState = 0;
    mocks.useState.mockImplementation((inicial: unknown) => {
      chamadasUseState += 1;
      return [chamadasUseState === 5 ? item : resolverEstadoInicial(inicial), vi.fn()];
    });
    const fila = renderToStaticMarkup(createElement(FilaCobranca, { itens: [item], dashs, regua, podeOperar: false, podeBloquear: false }));
    mocks.useState.mockImplementation((inicial: unknown) => [resolverEstadoInicial(inicial), vi.fn()]);
    const fichaRenderizada = renderToStaticMarkup(createElement(FichaFinanceira, { dados: ficha }));
    const migracaoRenderizada = renderToStaticMarkup(createElement(ConferenciaFinanceiraMigracao, { dados: migracao }));

    for (const html of [fila, fichaRenderizada, migracaoRenderizada]) {
      expect(html).toContain("vence 01/03/2099 · referência Pacific/Kiritimati");
      expect(html).not.toContain("vence 28/02/2099");
    }
    expect(fichaRenderizada).toContain("Vencimento a conferir: A origem não preserva fuso e data civil.");
    expect(migracaoRenderizada).toContain("Vencimento a conferir: A origem não preserva fuso e data civil.");
  });

  it("exibe os instantes administrativos da ficha na preferência sem reinterpretar o vencimento civil", () => {
    const dados: FichaFinanceiraDados = {
      ...ficha,
      historico: [{ id: "historico", quando: "2026-01-01T02:30:00.000Z", label: "Cobrança enviada", autor: "Financeiro" }],
      ajustes: [{ id: "ajuste", tipo: "DESCONTO", valorDe: 100, valorPara: 90, descontoValor: 10, moeda: "USD", motivo: "Ajuste conferido", autor: "Financeiro", criadoEm: "2026-01-01T02:30:00.000Z", vigencia: null }],
      cobrancas: [{ ...ficha.cobrancas[0], regularizacaoIntegral: { escolha: "CREDITO", aplicadaEm: "2026-01-01T02:30:00.000Z", href: "/historico" } }],
    };
    mocks.useState.mockImplementation((inicial: unknown) => [resolverEstadoInicial(inicial), vi.fn()]);
    const preferida = renderToStaticMarkup(createElement(FichaFinanceira, { dados, preferenciaFusoExibicao: "America/Costa_Rica" }));
    const fallback = renderToStaticMarkup(createElement(FichaFinanceira, { dados, preferenciaFusoExibicao: null }));

    expect(preferida).toContain("31/12/2025, 20:30");
    expect(preferida).toContain("horário exibido em America/Costa_Rica; origem UTC");
    expect(fallback).toContain("01/01/2026, 02:30");
    expect(fallback).toContain("horário exibido em UTC; origem UTC");
    expect(preferida).toContain("vence 01/03/2099 · referência Pacific/Kiritimati");
  });
});

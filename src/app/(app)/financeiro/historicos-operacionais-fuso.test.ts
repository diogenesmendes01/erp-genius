import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/server/retomada/acoes", () => ({ solicitarRetomada: vi.fn(), decidirRetomada: vi.fn() }));
vi.mock("@/server/financeiro/acoes", () => ({ salvarTaxasCambio: vi.fn(), atualizarCotacoesAutomatico: vi.fn(), fecharMesComissoes: vi.fn() }));
vi.mock("@/server/comunicacoes-agenda/autorizacoes", () => ({ registrarAutorizacaoComunicacaoAcademica: vi.fn(), revogarAutorizacaoComunicacaoAcademica: vi.fn() }));

import { RetomadasPainel } from "./RetomadasPainel";
import { CambioPainel } from "./FinanceiroPainel";
import { AutorizacoesFormulario } from "../matriculas/[id]/autorizacoes-comunicacao/AutorizacoesFormulario";

const instante = "2026-01-01T02:30:00.000Z";
const contexto = {
  alunoId: "aluno", status: "PAUSADO", impedimento: null, propostaPendenteId: null, dataMinimaReprogramacao: "2026-01-02",
  pausa: { criadoEm: instante, motivo: "Pausa documentada" }, parcelas: [{ cobrancaId: "cobranca", codigo: "M-1", vencimento: "2099-10-05", valorNegociado: 100, valorRecebido: 0, saldo: 100, moeda: "USD" }],
} as never;
const propostas = [{ id: "proposta", alunoId: "aluno", alunoNome: "Ana", opcao: "MANTER_VENCIMENTOS", criadoEm: instante, status: "APROVADA", solicitante: { nome: "Financeiro" }, parcelas: [], aprovador: { nome: "Administração" }, decididoEm: instante, motivoDecisao: "Conferido", motivo: "Retomada", podeDecidir: false, impedimentoAprovacao: null }] as never;

function renderir(preferenciaFusoExibicao: string | null) {
  return renderToStaticMarkup(createElement("section", null,
    createElement(RetomadasPainel, { contexto, propostas, preferenciaFusoExibicao }),
    createElement(CambioPainel, { cotacoes: [{ moeda: "BRL", pivo: false, unidadesPorUsd: 5.12, vigenteEm: instante }] as never, onSalvar: async () => {}, onAtualizarAuto: async () => {}, preferenciaFusoExibicao }),
    createElement(AutorizacoesFormulario, { matriculaId: "matricula", responsaveis: [], preferenciaFusoExibicao, historico: [{ id: "autorizacao", responsavelId: "responsavel", evidencia: "Evidência preservada", vigenteEm: instante, revogadaEm: instante, motivoRevogacao: "Revogação confirmada", responsavel: { nome: "Responsável" }, autorizadaPor: { nome: "Secretaria" }, revogadaPor: { nome: "Administração" } }] }),
  ));
}

describe("históricos operacionais e cotação no fuso pessoal", () => {
  it("renderiza todos os instantes administrativos na preferência sem mudar vencimento civil ou campos", () => {
    const html = renderir("America/Costa_Rica");
    expect(html.match(/31\/12\/2025, 20:30/g)).toHaveLength(6);
    expect(html.match(/horário exibido em America\/Costa_Rica; origem UTC/g)).toHaveLength(6);
    expect(html).toContain("05/10/2099");
    expect(html).toContain('value="5.12"');
  });

  it("usa UTC quando a preferência não está disponível", () => {
    const html = renderir(null);
    expect(html.match(/01\/01\/2026, 02:30/g)).toHaveLength(6);
    expect(html.match(/horário exibido em UTC; origem UTC/g)).toHaveLength(6);
  });
});

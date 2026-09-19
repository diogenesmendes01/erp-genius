import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { FilaCobrancaItem } from "@/server/cobrancas/consultas";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/server/financeiro/acoes", () => ({ registrarCobrancaWhatsApp: vi.fn() }));
vi.mock("@/server/financeiro/cobranca-manual", () => ({ prepararCobrancaManual: vi.fn() }));
vi.mock("@/server/cobrancas/acoes", () => ({ registrarPromessaPagamento: vi.fn() }));
vi.mock("@/server/whatsapp/acoes", () => ({ aprovarLoteCobranca: vi.fn(), enfileirarCobrancaWhatsApp: vi.fn() }));

import { DetalheCobranca } from "./FilaCobranca";

const item: FilaCobrancaItem = {
  conferenciaAte: null,
  id: "cobranca", cicloRegua: 1, codigo: "COB-1", tipo: "MENSALIDADE",
  valorNegociado: 100, valorRecebido: 0, saldo: 100, moeda: "BRL",
  vencimento: { estado: "CONFIRMADO", dataCivil: "2026-01-15", fuso: "Pacific/Kiritimati", origem: "EMISSAO_ENTRADA" }, competencia: "2026-01",
  estado: "acao_devida", passo: "D+3", tipoAcao: "cobrar", template: null,
  rotuloAcao: "Cobrar", atrasadaNaAcao: false, diasAtraso: 3, prioridade: 1,
  promessaAte: "2026-01-02T12:00:00.000Z", matriculaId: "matricula",
  acessoBloqueado: false, precisaBloqueio: false, tentativas: 1, ultimaCobrancaEm: null,
  passosFeitos: [], aluno: { id: "aluno", nome: "Ana Silva", telefone: null }, pais: "Brasil", turma: null,
  destino: { telefone: "+5511999999999", nome: "Ana Silva", viaResponsavel: false },
  respondeuEm: "2026-01-01T03:30:00.000Z",
  envio: { passo: "D+3", status: "DESPACHADA", motivo: null, em: "2026-01-01T02:30:00.000Z" },
  mensagemSugerida: "Olá, Ana.",
};

function detalhe(itemAtual: FilaCobrancaItem, preferenciaFusoExibicao: string | null) {
  return renderToStaticMarkup(createElement(DetalheCobranca, {
    item: itemAtual,
    regua: [{ passo: "D+3", offsetDias: 3, tipo: "cobrar", rotulo: "Cobrar" }],
    podeOperar: false,
    preferenciaFusoExibicao,
    onClose: vi.fn(), onEnviarApi: vi.fn(), onPrepararManual: async () => null,
    onConfirmarManual: async () => false, onPagar: vi.fn(), onPromessa: vi.fn(),
  }));
}

describe("DetalheCobranca", () => {
  it("mantém o vencimento em conferência quando a fonte civil está ausente", () => {
    const html = detalhe({ ...item, vencimento: { estado: "A_CONFERIR", motivo: "Fonte contratual ausente" } }, "America/Costa_Rica");
    expect(html).toContain("Vencimento a conferir: Fonte contratual ausente");
    expect(html).not.toContain("vence 15/01/2026");
  });
  it("renderiza envio e resposta na preferência, sem deslocar vencimento ou competência", () => {
    const html = detalhe(item, "America/Costa_Rica");

    expect(html).toContain("31/12/2025, 20:30");
    expect(html).toContain("31/12/2025, 21:30");
    expect(html).toContain("horário exibido em America/Costa_Rica; origem UTC");
    expect(html).toContain("2026-01");
    expect(html).toContain("vence 15/01/2026");
  });

  it("renderiza a suspensão em UTC sem mudar a promessa civil", () => {
    const html = detalhe({
      ...item,
      estado: "em_conferencia",
      passo: null,
      tipoAcao: null,
      conferenciaAte: "2026-01-01T02:30:00.000Z",
    }, null);

    expect(html).toContain("01/01/2026, 02:30");
    expect(html).toContain("horário exibido em UTC; origem UTC");

    const promessa = detalhe({ ...item, estado: "promessa", passo: null, tipoAcao: null }, null);
    expect(promessa).toContain("Promessa de pagamento até 02/01/2026");
  });
});

import { Papel } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  oportunidades: vi.fn(),
  eventos: vi.fn(),
  mensagens: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    configuracaoOperacional: { findUnique: async () => ({ fusoInstitucional: "America/Sao_Paulo" }) },
    oportunidade: { findMany: mocks.oportunidades, groupBy: async () => [] },
    coberturaCarteira: { findMany: async () => [] },
    usuario: { findMany: async () => [] },
    evento: { groupBy: mocks.eventos },
    $queryRaw: mocks.mensagens,
  },
}));
vi.mock("@/server/_shared/escopo-comercial", () => ({ escopoComercialAtual: async () => ({}) }));

import { carregarCarteira, EVENTOS_DE_CONTATO_SEM_INTERACAO, lerFiltrosCarteira } from "./carteira";

const gerente = { id: "g1", nome: "G", papeis: [Papel.GERENTE_COMERCIAL] };
const op = (id: string) => ({
  id, nome: id, b2b: false, etapa: "NOVO", pessoaId: null, empresaId: null, criadoEm: new Date("2026-09-01T12:00:00Z"),
  vendedor: null, pessoa: null, matricula: null,
});

describe("carregarCarteira: regra \"sem interação\"", () => {
  beforeEach(() => {
    mocks.oportunidades.mockReset().mockResolvedValue([op("o1"), op("o2")]);
    mocks.eventos.mockReset().mockResolvedValue([]);
    mocks.mensagens.mockReset().mockResolvedValue([]);
  });

  it("só a lista positiva de contato conta: interação (ligação), tarefa concluída e experimental (D13)", async () => {
    await carregarCarteira(gerente, lerFiltrosCarteira({}));
    expect(mocks.eventos).toHaveBeenCalledTimes(1);
    const arg = mocks.eventos.mock.calls[0][0];
    expect(arg.where).toEqual({ agregadoTipo: "Lead", agregadoId: { in: ["o1", "o2"] }, tipo: { in: [...EVENTOS_DE_CONTATO_SEM_INTERACAO] } });
    expect([...EVENTOS_DE_CONTATO_SEM_INTERACAO].sort()).toEqual(
      ["ExperimentalAgendada", "ExperimentalConfirmada", "ExperimentalRealizada", "InteracaoRegistrada", "TarefaConcluida"].sort(),
    );
    // Nota, edição de cadastro, reatribuição, tags, documentos e a régua automática não são contato.
    for (const tipo of ["NotaInterna", "LeadEditado", "DatasAtualizadas", "ResumoAtualizado", "LeadAtribuido", "TagAtribuida",
      "DocumentoAnexado", "ReguaComercialEnviada", "EtapaAlterada", "LeadCriado"]) {
      expect(EVENTOS_DE_CONTATO_SEM_INTERACAO).not.toContain(tipo);
    }
  });

  it("mensagem enviada ou recebida no atendimento da oportunidade conta como contato (D13)", async () => {
    const ontem = new Date(Date.now() - 86_400_000);
    mocks.mensagens.mockResolvedValue([{ leadId: "o1", ultima: ontem }]);
    const r = await carregarCarteira(gerente, lerFiltrosCarteira({}));
    expect(mocks.mensagens).toHaveBeenCalledTimes(1);
    // Saída só conta enviada por uma pessoa; régua, lote, gestão e Aria ficam de fora (decisão do dono no #254).
    const sql = (mocks.mensagens.mock.calls[0][0] as { strings?: string[] }).strings?.join("?") ?? String(mocks.mensagens.mock.calls[0][0]);
    expect(sql).toContain("m.origem IN ('HUMANO', 'CELULAR')");
    for (const o of ["CRON", "LOTE", "GESTAO", "'IA'"]) expect(sql).not.toContain(o);
    expect(r.linhas.find((l) => l.oportunidadeId === "o1")!.diasSemInteracao).toBeLessThanOrEqual(1);
    expect(r.linhas.find((l) => l.oportunidadeId === "o2")!.diasSemInteracao).toBeGreaterThan(1);
  });

  it("vale o mais recente entre evento de contato e mensagem", async () => {
    const tresDias = new Date(Date.now() - 3 * 86_400_000);
    const dezDias = new Date(Date.now() - 10 * 86_400_000);
    mocks.eventos.mockResolvedValue([{ agregadoId: "o1", _max: { criadoEm: dezDias } }]);
    mocks.mensagens.mockResolvedValue([{ leadId: "o1", ultima: tresDias }]);
    const r = await carregarCarteira(gerente, lerFiltrosCarteira({}));
    const dias = r.linhas.find((l) => l.oportunidadeId === "o1")!.diasSemInteracao;
    expect(dias).toBeGreaterThanOrEqual(2);
    expect(dias).toBeLessThanOrEqual(3);
  });

  it("sem oportunidades não consulta eventos", async () => {
    mocks.oportunidades.mockResolvedValue([]);
    await carregarCarteira(gerente, lerFiltrosCarteira({}));
    expect(mocks.eventos).not.toHaveBeenCalled();
    expect(mocks.mensagens).not.toHaveBeenCalled();
  });
});

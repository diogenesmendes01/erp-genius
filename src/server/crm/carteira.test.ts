import { Papel, Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  oportunidades: vi.fn(),
  ordenadas: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    configuracaoOperacional: { findUnique: async () => ({ fusoInstitucional: "America/Sao_Paulo" }) },
    oportunidade: { findMany: mocks.oportunidades, groupBy: async () => [] },
    coberturaCarteira: { findMany: async () => [] },
    usuario: { findMany: async () => [] },
    $queryRaw: mocks.ordenadas,
  },
}));
vi.mock("@/server/_shared/escopo-comercial", () => ({ escopoComercialAtual: async () => ({}) }));

import { carregarCarteira, EVENTOS_DE_CONTATO_SEM_INTERACAO, lerFiltrosCarteira } from "./carteira";

const gerente = { id: "g1", nome: "G", papeis: [Papel.GERENTE_COMERCIAL] };
const op = (id: string) => ({ id, nome: id, b2b: false, etapa: "NOVO", pessoaId: null, empresaId: null, vendedor: null, pessoa: null, matricula: null });
// B19: a carteira filtra, ordena e corta no banco (uma consulta em SQL) e só depois busca os detalhes das linhas.
const consulta = () => {
  const [strings, ...valores] = mocks.ordenadas.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
  return Prisma.sql(strings, ...valores);
};
const textoDaConsulta = () => consulta().strings.join("?");

describe("carregarCarteira: regra \"sem interação\"", () => {
  beforeEach(() => {
    mocks.ordenadas.mockReset().mockResolvedValue([{ id: "o2", dias: 12, total: 3 }, { id: "o1", dias: 4, total: 3 }]);
    mocks.oportunidades.mockReset().mockResolvedValue([op("o1"), op("o2")]);
  });

  it("só a lista positiva de contato conta: interação (ligação), tarefa concluída e experimental (D13)", async () => {
    await carregarCarteira(gerente, lerFiltrosCarteira({}));
    expect(mocks.ordenadas).toHaveBeenCalledTimes(1);
    expect(textoDaConsulta()).toMatch(/e\."agregadoTipo" = 'Lead' AND e\."agregadoId" = o\."id"\s+AND e\."tipo" IN \(\?(,\?){4}\)/);
    for (const tipo of EVENTOS_DE_CONTATO_SEM_INTERACAO) expect(consulta().values).toContain(tipo);
    expect([...EVENTOS_DE_CONTATO_SEM_INTERACAO].sort()).toEqual(
      ["ExperimentalAgendada", "ExperimentalConfirmada", "ExperimentalRealizada", "InteracaoRegistrada", "TarefaConcluida"].sort(),
    );
    // Nota, edição de cadastro, reatribuição, tags, documentos e a régua automática não são contato.
    for (const tipo of ["NotaInterna", "LeadEditado", "DatasAtualizadas", "ResumoAtualizado", "LeadAtribuido", "TagAtribuida",
      "DocumentoAnexado", "ReguaComercialEnviada", "EtapaAlterada", "LeadCriado"]) {
      expect(EVENTOS_DE_CONTATO_SEM_INTERACAO).not.toContain(tipo);
      expect(consulta().values).not.toContain(tipo);
    }
  });

  it("mensagem enviada ou recebida no atendimento da oportunidade conta como contato (D13)", async () => {
    await carregarCarteira(gerente, lerFiltrosCarteira({}));
    // Saída só conta enviada por uma pessoa; régua, lote, gestão e Aria ficam de fora (decisão do dono no #254).
    const sql = textoDaConsulta();
    expect(sql).toContain(`m."direcao" = 'ENTRADA' OR (m."status" IN ('ENVIADA', 'ENTREGUE', 'LIDA') AND m."origem" IN ('HUMANO', 'CELULAR'))`);
    expect(sql).toContain(`a."leadId" = o."id"`);
    for (const o of ["CRON", "LOTE", "GESTAO", "'IA'"]) expect(sql).not.toContain(o);
  });

  it("vale o mais recente entre evento de contato e mensagem; sem nenhum, a criação; dias civis no fuso da escola", async () => {
    await carregarCarteira(gerente, lerFiltrosCarteira({ semInteracao: "15" }));
    const sql = textoDaConsulta().replace(/\s+/g, " ");
    expect(sql).toContain(`COALESCE(GREATEST(ev."em", msg."em"), o."criadoEm") AT TIME ZONE 'UTC') AT TIME ZONE ? AS date`);
    expect(sql).toContain(`ORDER BY x."dias" DESC, x."id" COLLATE "C" ASC LIMIT ?`);
    expect(consulta().values).toEqual(expect.arrayContaining(["America/Sao_Paulo", 15, 500]));
  });

  it("linhas na ordem do banco, com os dias e o total calculados lá", async () => {
    const r = await carregarCarteira(gerente, lerFiltrosCarteira({}));
    expect(r.linhas.map((l) => [l.oportunidadeId, l.diasSemInteracao])).toEqual([["o2", 12], ["o1", 4]]);
    expect(r.total).toBe(3);
    expect(mocks.oportunidades.mock.calls[0][0].where.AND[1]).toEqual({ id: { in: ["o2", "o1"] } });
  });

  it("sem linhas no banco não busca detalhes", async () => {
    mocks.ordenadas.mockResolvedValue([]);
    const r = await carregarCarteira(gerente, lerFiltrosCarteira({}));
    expect(mocks.oportunidades).not.toHaveBeenCalled();
    expect(r).toMatchObject({ linhas: [], total: 0 });
  });
});

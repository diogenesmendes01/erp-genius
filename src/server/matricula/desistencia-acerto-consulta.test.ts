import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  class ErroPermissao extends Error {}
  class ErroRegra extends Error {}

  return {
    sessao: { id: "aprovador" },
    prisma: { $transaction: vi.fn() },
    exigirSessaoComPapel: vi.fn(),
    bloquearMatriculas: vi.fn(),
    tx: {
      $queryRaw: vi.fn(),
      usuario: { findUnique: vi.fn() },
      matricula: { findUnique: vi.fn() },
      pedidoDesistenciaPreparacao: { findFirst: vi.fn() },
      condicoesEncerramentoMatricula: { findFirst: vi.fn(), count: vi.fn() },
      efetivacaoPedidoDesistenciaPreparacao: { findUnique: vi.fn() },
      aplicacaoAcertoDesistenciaContratual: { findFirst: vi.fn() },
      propostaAcertoDesistenciaContratual: { findMany: vi.fn() },
    },
    ErroPermissao,
    ErroRegra,
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: h.prisma }));
vi.mock("@/server/_shared", () => ({
  executarAcao: async (acao: () => Promise<unknown>) => {
    try {
      return { ok: true, dado: await acao() };
    } catch (erro) {
      return { ok: false, erro: erro instanceof Error ? erro.message : String(erro) };
    }
  },
  exigirSessaoComPapel: h.exigirSessaoComPapel,
  ErroPermissao: h.ErroPermissao,
  ErroRegra: h.ErroRegra,
}));
vi.mock("@/server/financeiro/recebimentos", () => ({
  bloquearMatriculas: h.bloquearMatriculas,
}));

import { consultarAcertoDesistenciaContratual } from "./desistencia-acerto-consulta";

const matriculaId = "matricula-1";

function proposta(
  id: string,
  indice: number,
  decisao: object | null = null,
) {
  return {
    id,
    pedidoId: "pedido-atual",
    condicoesId: "condicoes-atual",
    anteriorId: null,
    versao: indice + 1,
    motivoReapresentacao: null,
    fotografiaHash: "f".repeat(64),
    criadaEm: new Date(2026, 8, 18, 12, 0, indice),
    preparadorId: "preparador",
    preparador: { nome: "Pessoa preparadora" },
    memoria: { itens: [] },
    decisao,
  };
}

function decisaoAprovada(decisorId = "aprovador") {
  return {
    id: "decisao-1",
    aprovada: true,
    motivo: "Aprovação financeira independente.",
    decisorId,
    decisor: { nome: "Pessoa aprovadora" },
    aplicacao: null,
  };
}

function configurar({
  sessaoId = "aprovador",
  usuario = { papeis: ["ADMINISTRADOR"], permissoes: [] },
  estadoHashAdministrativo = "estado-atual",
  propostas = [proposta("proposta-1", 1, decisaoAprovada())],
  aplicacao = null,
}: {
  sessaoId?: string;
  usuario?: { papeis: string[]; permissoes: string[] };
  estadoHashAdministrativo?: string;
  propostas?: object[];
  aplicacao?: object | null;
} = {}) {
  h.sessao.id = sessaoId;
  h.exigirSessaoComPapel.mockResolvedValue(h.sessao);
  h.bloquearMatriculas.mockResolvedValue(undefined);
  h.prisma.$transaction.mockImplementation(async (acao: (tx: typeof h.tx) => unknown) => acao(h.tx));
  h.tx.usuario.findUnique.mockResolvedValue({ ativo: true, ...usuario });
  h.tx.matricula.findUnique.mockResolvedValue({ id: matriculaId });
  h.tx.pedidoDesistenciaPreparacao.findFirst.mockResolvedValue({
    id: "pedido-atual",
    versao: 3,
    estadoHash: "estado-atual",
    decisaoAdministrativa: {
      id: "decisao-administrativa",
      aprovada: true,
      estadoHash: estadoHashAdministrativo,
    },
  });
  h.tx.condicoesEncerramentoMatricula.findFirst.mockResolvedValue({
    id: "condicoes-atual",
    versao: 2,
  });
  h.tx.condicoesEncerramentoMatricula.count.mockResolvedValue(0);
  h.tx.$queryRaw.mockResolvedValue([{ valida: true }]);
  h.tx.efetivacaoPedidoDesistenciaPreparacao.findUnique.mockResolvedValue(null);
  h.tx.aplicacaoAcertoDesistenciaContratual.findFirst.mockResolvedValue(aplicacao);
  h.tx.propostaAcertoDesistenciaContratual.findMany.mockResolvedValue(propostas);
}

function resultadoDado(resultado: unknown): any {
  expect(resultado).toMatchObject({ ok: true });
  return (resultado as { dado: unknown }).dado;
}

describe("consultarAcertoDesistenciaContratual", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("permite a aplicação ao aprovador autorizado com as duas decisões vigentes", async () => {
    configurar();
    const dado = resultadoDado(await consultarAcertoDesistenciaContratual({ matriculaId }));
    expect(dado.impedimento).toBeNull();
    expect(dado.propostas[0].podeAplicar).toBe(true);
  });

  it("aceita a fonte pré-assinatura validada sem exigir documento aceito na consulta", async () => {
    configurar();
    const dado = resultadoDado(await consultarAcertoDesistenciaContratual({ matriculaId }));
    expect(h.tx.condicoesEncerramentoMatricula.findFirst.mock.calls[0][0].where).not.toHaveProperty("documento");
    expect(dado.podePreparar).toBe(true);
  });

  it("bloqueia preparo e aplicação quando a fonte contratual não é mais válida", async () => {
    configurar();
    h.tx.$queryRaw.mockResolvedValue([{ valida: false }]);
    const dado = resultadoDado(await consultarAcertoDesistenciaContratual({ matriculaId }));
    expect(dado.podePreparar).toBe(false);
    expect(dado.propostas[0].podeAplicar).toBe(false);
  });

  it("não expõe decisões nem aplicação a uma alçada financeira revogada", async () => {
    configurar({
      usuario: { papeis: ["FINANCEIRO"], permissoes: [] },
      propostas: [
        proposta("pendente", 2),
        proposta("aprovada", 1, decisaoAprovada()),
      ],
    });

    const dado = resultadoDado(await consultarAcertoDesistenciaContratual({ matriculaId }));

    expect(dado.propostas).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "pendente", podeDecidir: false }),
        expect.objectContaining({ id: "aprovada", podeAplicar: false }),
      ]),
    );
  });

  it("não permite aplicar quando o aprovador logado é diferente do decisor", async () => {
    configurar({ sessaoId: "outro-aprovador" });

    const dado = resultadoDado(await consultarAcertoDesistenciaContratual({ matriculaId }));

    expect(dado.propostas[0]).toMatchObject({
      id: "proposta-1",
      podeAplicar: false,
    });
  });

  it("bloqueia aplicação se a aprovação administrativa não corresponde ao estado do pedido", async () => {
    configurar({ estadoHashAdministrativo: "estado-administrativo-obsoleto" });

    const dado = resultadoDado(await consultarAcertoDesistenciaContratual({ matriculaId }));

    expect(dado.propostas[0]).toMatchObject({
      id: "proposta-1",
      podeAplicar: false,
    });
  });

  it("bloqueia novo preparo quando uma aplicação fora da primeira página já existe", async () => {
    configurar({
      propostas: Array.from({ length: 21 }, (_, indice) => proposta(`proposta-${indice}`, indice)),
      aplicacao: { id: "aplicacao-da-proposta-mais-antiga" },
    });

    const dado = resultadoDado(await consultarAcertoDesistenciaContratual({ matriculaId }));

    expect(dado.impedimento).toContain("O acerto já foi aplicado");
    expect(dado.podePreparar).toBe(false);
    expect(dado.propostas).toHaveLength(20);
    expect(dado.propostas.every((item: { decisao: unknown }) => item.decisao === null)).toBe(true);
  });

  it("consulta 21 propostas, sinaliza continuidade e devolve somente as 20 recentes", async () => {
    configurar({
      propostas: Array.from({ length: 21 }, (_, indice) => proposta(`proposta-${indice}`, indice)),
    });

    const dado = resultadoDado(await consultarAcertoDesistenciaContratual({ matriculaId }));

    expect(h.tx.propostaAcertoDesistenciaContratual.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 21 }),
    );
    expect(dado.temMaisPropostas).toBe(true);
    expect(dado.propostas).toHaveLength(20);
    expect(dado.propostas.map((item: { id: string }) => item.id)).not.toContain("proposta-20");
  });

  it("oferece reapresentação apenas a partir da última proposta já decidida", async () => {
    configurar({
      propostas: [
        proposta("rejeitada-atual", 2, { ...decisaoAprovada(), aprovada: false }),
        proposta("aprovada-anterior", 1, decisaoAprovada()),
      ],
    });

    const dado = resultadoDado(await consultarAcertoDesistenciaContratual({ matriculaId }));

    expect(dado.podePreparar).toBe(true);
    expect(dado.reapresentacao).toMatchObject({ id: "rejeitada-atual", versao: 3, aprovada: false });
    expect(dado.propostas[1]).toMatchObject({ podeDecidir: false, podeAplicar: false });
  });
});

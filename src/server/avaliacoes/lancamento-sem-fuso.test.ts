import { beforeEach, describe, expect, it, vi } from "vitest";

// D10 (decisão do dono, 19/10/2026; C7 da #170): sem o fuso da escola configurado, o lançamento de avaliação com
// data e hora locais é recusado no servidor, com a mensagem que leva à configuração. Em UTC a data da avaliação
// pode cair no dia errado. A recusa vem depois da sessão e antes de abrir a transação.

const m = vi.hoisted(() => ({ sessao: vi.fn(), fuso: vi.fn(), transacao: vi.fn(), salvarTx: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: m.transacao } }));
vi.mock("@/server/operacao/consultas", () => ({ consultarFusoInstitucional: m.fuso }));
vi.mock("./lancamento-tx", () => ({ salvarLancamentoTx: m.salvarTx, oficializarLancamentoTx: vi.fn(), bloquearLancamento: vi.fn() }));
vi.mock("@/server/_shared", () => {
  class ErroRegra extends Error {}
  class ErroPermissao extends Error {}
  return {
    ErroRegra, ErroPermissao,
    exigirSessaoComPapel: m.sessao,
    executarAcao: async (fn: () => Promise<unknown>) => {
      try { return { ok: true, dado: await fn() }; } catch (e) { if (e instanceof ErroRegra) return { ok: false, erro: e.message }; throw e; }
    },
  };
});

import { salvarLancamentoAvaliacaoLocal } from "./lancamentos";
import { MSG_LANCAMENTO_SEM_FUSO } from "./tempo";

const entrada = {
  alocacaoId: "aloc-1", codigoAvaliacao: "I1", versaoEsperada: 0, chaveIdempotencia: "lancamento-teste-sem-fuso",
  submetida: false, notas: [{ habilidade: "FALA" as const, nota: "7", comentarioAluno: "" }],
  realizadaLocal: "2026-10-10T09:00", fuso: "America/Sao_Paulo",
};

beforeEach(() => {
  vi.clearAllMocks();
  m.sessao.mockResolvedValue({ id: "prof-1", papeis: ["PROFESSOR"] });
  m.transacao.mockImplementation((fn: (tx: unknown) => unknown) => fn({}));
  m.salvarTx.mockResolvedValue({ id: "versao-1" });
});

describe("salvarLancamentoAvaliacaoLocal sem fuso da escola (D10)", () => {
  it("a mensagem diz o porquê e onde configurar", () => {
    expect(MSG_LANCAMENTO_SEM_FUSO).toContain("fuso");
    expect(MSG_LANCAMENTO_SEM_FUSO).toContain("Configuração");
  });

  it("recusa com a mensagem, sem abrir transação nem gravar", async () => {
    m.fuso.mockResolvedValue(null);
    expect(await salvarLancamentoAvaliacaoLocal(entrada)).toEqual({ ok: false, erro: MSG_LANCAMENTO_SEM_FUSO });
    expect(m.sessao).toHaveBeenCalledTimes(1);
    expect(m.transacao).not.toHaveBeenCalled();
    expect(m.salvarTx).not.toHaveBeenCalled();
  });

  it("com o fuso da escola configurado, segue para gravar", async () => {
    m.fuso.mockResolvedValue("America/Sao_Paulo");
    expect(await salvarLancamentoAvaliacaoLocal(entrada)).toEqual({ ok: true, dado: { id: "versao-1" } });
    expect(m.salvarTx).toHaveBeenCalledTimes(1);
    expect(m.salvarTx.mock.calls[0][2]).toMatchObject({ realizadaEm: "2026-10-10T12:00:00.000Z" });
  });
});

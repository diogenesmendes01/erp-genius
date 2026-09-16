import { beforeEach, expect, it, vi } from "vitest";

const dependencias = vi.hoisted(() => ({
  transaction: vi.fn(),
  queryRaw: vi.fn(),
  executeRaw: vi.fn(),
  registrarEvento: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: dependencias.transaction },
}));
vi.mock("@/server/_shared", () => ({
  ErroPermissao: class ErroPermissao extends Error {},
  ErroRegra: class ErroRegra extends Error {},
  executarAcao: async (fn: () => unknown) => fn(),
  exigirSessaoComPapel: vi.fn(),
  registrarEvento: dependencias.registrarEvento,
}));

import { consumirTokenPortalAluno, despacharSolicitacaoPortalAlunoInterna } from "./identidade";

const tx = { $queryRaw: dependencias.queryRaw, $executeRaw: dependencias.executeRaw };
const configuracao = [{ prazoSessaoPortalAlunoMinutos: 30, prazoConvitePortalAlunoMinutos: 60, prazoRecuperacaoPortalAlunoMinutos: 60, prazoValidacaoEmailPortalAlunoMinutos: 60 }];
const solicitacao = [{
  id: "solicitacao-1", contaId: "conta-1", alunoId: "aluno-1", finalidade: "CONVITE", destinatario: "aluno@example.test",
  trocaEmailId: null, situacao: "PREPARADO", ativa: true, email: null, senhaHash: null, recuperacaoAssistida: false,
}];

function prepararMockTransacao(opcoes: { falharConfirmacao?: boolean } = {}) {
  let chamadas = 0;
  dependencias.transaction.mockImplementation(async (callback: (transacao: typeof tx) => Promise<unknown>) => {
    chamadas += 1;
    const resultado = await callback(tx);
    if (chamadas === 2 && opcoes.falharConfirmacao) throw new Error("falha ao confirmar");
    return resultado;
  });
  dependencias.queryRaw.mockResolvedValueOnce(configuracao).mockResolvedValueOnce(solicitacao);
  dependencias.queryRaw.mockResolvedValueOnce([{ email: "aluno@example.test" }]);
  dependencias.executeRaw.mockResolvedValue(1);
}

beforeEach(() => {
  dependencias.transaction.mockReset();
  dependencias.queryRaw.mockReset();
  dependencias.executeRaw.mockReset();
  dependencias.registrarEvento.mockReset();
});

it("recibo Resend validado confirma e audita aceitação sem dados sensíveis", async () => {
  prepararMockTransacao();
  const resultado = await despacharSolicitacaoPortalAlunoInterna("solicitacao-1", async () => ({
    provedor: "RESEND", provedorId: "c4f884a4-96ce-4c22-bd42-806d93b1d1da",
  }));

  expect(resultado).toEqual({ solicitacaoId: "solicitacao-1", situacao: "ENVIADO" });
  expect(dependencias.registrarEvento).toHaveBeenCalledWith(tx, expect.objectContaining({
    tipo: "SolicitacaoEnvioPortalAlunoAceitaPeloProvedor", agregadoId: "aluno-1",
    payload: { solicitacaoEnvioId: "solicitacao-1", provedor: "RESEND", provedorId: "c4f884a4-96ce-4c22-bd42-806d93b1d1da" },
  }));
  expect(JSON.stringify(dependencias.registrarEvento.mock.calls[0]?.[1])).not.toContain("aluno@example.test");
});

it("falha ao confirmar a transação conserva INCERTO mesmo após aceite do provedor", async () => {
  prepararMockTransacao({ falharConfirmacao: true });
  const resultado = await despacharSolicitacaoPortalAlunoInterna("solicitacao-1", async () => ({
    provedor: "RESEND", provedorId: "c4f884a4-96ce-4c22-bd42-806d93b1d1da",
  }));

  expect(resultado).toEqual({ solicitacaoId: "solicitacao-1", situacao: "INCERTO" });
});

it("recibo malformado nunca confirma o envio", async () => {
  prepararMockTransacao();
  const resultado = await despacharSolicitacaoPortalAlunoInterna("solicitacao-1", async () => ({ provedor: "RESEND", provedorId: "não-é-uuid" } as never));
  expect(resultado).toEqual({ solicitacaoId: "solicitacao-1", situacao: "INCERTO" });
  expect(dependencias.transaction).toHaveBeenCalledTimes(1);
});

it.each([null, "outro@example.test"])("não envia convite com contato removido ou alterado: %s", async (email) => {
  prepararMockTransacao();
  dependencias.queryRaw.mockReset();
  dependencias.queryRaw.mockResolvedValueOnce(configuracao).mockResolvedValueOnce(solicitacao).mockResolvedValueOnce([{ email }]);
  const entregar = vi.fn();
  await expect(despacharSolicitacaoPortalAlunoInterna("solicitacao-1", entregar)).rejects.toThrow("contato do aluno mudou");
  expect(entregar).not.toHaveBeenCalled();
  expect(dependencias.executeRaw).not.toHaveBeenCalled();
});

it.each([null, "novo@example.test"])("convite já enviado não ativa contato antigo após mudança: %s", async (email) => {
  dependencias.transaction.mockImplementation(async (callback: (transacao: typeof tx) => Promise<unknown>) => callback(tx));
  dependencias.queryRaw.mockResolvedValueOnce([{
    id: "token-1", contaId: "conta-1", alunoId: "aluno-1", finalidade: "CONVITE",
    destinatario: "aluno@example.test", trocaEmailId: null, expiraEm: new Date(Date.now() + 60_000),
    consumidoEm: null, revogadoEm: null, ativa: true, versaoSessao: 1, emailVerificado: null,
  }]).mockResolvedValueOnce([{ email }]);
  await expect(consumirTokenPortalAluno({ token: "a".repeat(43), senha: "Senha-forte-de-teste-123" })).rejects.toThrow("contato atual");
  expect(dependencias.executeRaw).not.toHaveBeenCalled();
});

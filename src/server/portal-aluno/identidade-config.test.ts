import { beforeEach, expect, it, vi } from "vitest";

// #536 (unitário, sem Docker): ordem config → lockout → bcrypt e ausência de fallback nos prazos.
const mocks = vi.hoisted(() => ({
  configuracao: [] as unknown[],
  queryRaw: vi.fn(),
  bloqueado: vi.fn(),
  registrarFalha: vi.fn(),
  limparFalhas: vi.fn(),
  compare: vi.fn(),
  criarSessao: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: (fn: (tx: unknown) => unknown) => fn({ $queryRaw: mocks.queryRaw, $executeRaw: vi.fn() }) },
}));
vi.mock("./rate-limit", () => ({
  loginPortalBloqueadoTx: mocks.bloqueado,
  registrarFalhaLoginPortal: mocks.registrarFalha,
  limparFalhasLoginPortal: mocks.limparFalhas,
}));
vi.mock("bcryptjs", () => ({ default: { compare: mocks.compare, hash: vi.fn() } }));
vi.mock("./sessao", () => ({ criarSessaoPortalAlunoTx: mocks.criarSessao }));

import { ErroRegra } from "@/server/_shared";
import { ErroConfigPortalIncompleta } from "./erros";
import { entrarPortalAluno } from "./identidade";

const completa = {
  prazoSessaoPortalAlunoMinutos: 60, prazoConvitePortalAlunoMinutos: 120,
  prazoRecuperacaoPortalAlunoMinutos: 90, prazoValidacaoEmailPortalAlunoMinutos: 30,
};
const credenciais = { email: "aluna@example.test", senha: "Senha inicial segura 2026" };

beforeEach(() => {
  vi.clearAllMocks();
  let chamada = 0;
  mocks.queryRaw.mockImplementation(async () => (chamada++ === 0
    ? mocks.configuracao
    : [{ id: "c1", alunoId: "a1", emailVerificado: credenciais.email, senhaHash: "hash", versaoSessao: 1, ativa: true, emailAluno: null }]));
  mocks.bloqueado.mockResolvedValue(false);
  mocks.compare.mockResolvedValue(true);
  mocks.criarSessao.mockResolvedValue({ segredo: "s", expiraEm: new Date() });
});

it.each([
  ["linha escola ausente", [], 4],
  ["um prazo nulo", [{ ...completa, prazoSessaoPortalAlunoMinutos: null }], 1],
  ["prazo zero", [{ ...completa, prazoConvitePortalAlunoMinutos: 0 }], 1],
  ["prazo acima do máximo", [{ ...completa, prazoRecuperacaoPortalAlunoMinutos: 365 * 24 * 60 + 1 }], 1],
  ["todos nulos", [{ prazoSessaoPortalAlunoMinutos: null, prazoConvitePortalAlunoMinutos: null, prazoRecuperacaoPortalAlunoMinutos: null, prazoValidacaoEmailPortalAlunoMinutos: null }], 4],
])("config incompleta (%s) falha antes de lockout, bcrypt e registro de falha", async (_n, configuracao, ausentes) => {
  mocks.configuracao = configuracao;
  const erro = await entrarPortalAluno(credenciais).catch((e: unknown) => e);
  expect(erro).toBeInstanceOf(ErroConfigPortalIncompleta);
  expect(erro).toBeInstanceOf(ErroRegra);
  expect((erro as ErroConfigPortalIncompleta).codigo).toBe("PORTAL_CONFIG_INCOMPLETA");
  expect((erro as ErroConfigPortalIncompleta).camposAusentes).toHaveLength(ausentes);
  expect(mocks.bloqueado).not.toHaveBeenCalled();
  expect(mocks.compare).not.toHaveBeenCalled();
  expect(mocks.registrarFalha).not.toHaveBeenCalled();
  expect(mocks.limparFalhas).not.toHaveBeenCalled();
  expect(mocks.criarSessao).not.toHaveBeenCalled();
});

it("config completa segue o fluxo normal e passa os prazos configurados para a sessão", async () => {
  mocks.configuracao = [completa];
  expect(await entrarPortalAluno(credenciais)).toMatchObject({ autenticado: true });
  expect(mocks.bloqueado.mock.invocationCallOrder[0]).toBeGreaterThan(mocks.queryRaw.mock.invocationCallOrder[0]);
  expect(mocks.compare.mock.invocationCallOrder[0]).toBeGreaterThan(mocks.bloqueado.mock.invocationCallOrder[0]);
  expect(mocks.criarSessao).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ prazos: expect.objectContaining({ sessaoMinutos: 60 }) }));
});

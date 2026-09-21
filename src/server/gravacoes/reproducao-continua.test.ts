import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ sessao: vi.fn(), revalidar: vi.fn(), fonte: vi.fn(), tx: {} }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: async (fn: (tx: object) => unknown) => fn(m.tx) } }));
vi.mock("@/server/portal-aluno/sessao", () => ({ exigirSessaoPortalAluno: m.sessao, revalidarSessaoPortalAlunoTx: m.revalidar }));
vi.mock("./autorizacao", () => ({ autorizarReproducaoGravacaoTx: m.fonte }));
vi.mock("./credenciais", () => ({ obterDriveOrganizacaoId: () => "drive" }));
import { prepararReproducaoContinua } from "./reproducao-continua";
beforeEach(() => {
  vi.resetAllMocks();
  m.sessao.mockResolvedValue({ sessaoId: "s", contaId: "c", alunoId: "a", email: "a@example.test" });
  m.revalidar.mockResolvedValue(undefined);
  m.fonte.mockResolvedValue({ fileId: "video", matriculaId: "matricula", reposicaoId: "reposicao" });
});
it("captura cookies uma vez e relê sessão e direitos a cada conferência", async () => {
  const acesso = await prepararReproducaoContinua("reposicao");
  await acesso.revalidar();
  expect(m.sessao).toHaveBeenCalledTimes(1);
  expect(m.revalidar).toHaveBeenCalledTimes(2);
  expect(m.fonte).toHaveBeenCalledTimes(2);
  expect(m.revalidar).toHaveBeenLastCalledWith(m.tx, expect.objectContaining({ sessaoId: "s" }), expect.any(Date));
  expect(acesso.fonte.driveId).toBe("drive");
});
it("nega sessão revogada antes de consultar novamente o material", async () => {
  const acesso = await prepararReproducaoContinua("reposicao");
  m.revalidar.mockRejectedValueOnce(new Error("revogada"));
  await expect(acesso.revalidar()).rejects.toThrow();
  expect(m.fonte).toHaveBeenCalledTimes(1);
});
it("nega bloqueio acadêmico ou financeiro surgido durante transmissão", async () => {
  const acesso = await prepararReproducaoContinua("reposicao");
  m.fonte.mockRejectedValueOnce(new Error("matrícula bloqueada"));
  await expect(acesso.revalidar()).rejects.toThrow();
});
it.each(["fileId", "driveId", "matriculaId", "reposicaoId"])("interrompe se mudar %s da fonte autorizada", async campo => {
  const acesso = await prepararReproducaoContinua("reposicao");
  m.fonte.mockResolvedValueOnce({ ...acesso.fonte, [campo]: "outra-fonte" });
  await expect(acesso.revalidar()).rejects.toThrow("Reprodução indisponível");
});

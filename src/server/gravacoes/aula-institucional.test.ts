import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ sessao: vi.fn(), carregar: vi.fn(), tx: {} as Record<string, unknown> }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: async (fn: (tx: object) => unknown) => fn(m.tx) } }));
vi.mock("@/server/_shared", () => ({ ErroPermissao: class ErroPermissao extends Error {}, exigirSessaoComPapel: m.sessao }));
vi.mock("@/server/diario/correcao-aula-tx", () => ({ carregarCorrecaoAulaTx: m.carregar }));
vi.mock("./credenciais", () => ({ obterDriveOrganizacaoId: () => "drive-escola" }));

import { prepararVideoAulaInstitucionalContinuo } from "./aula-institucional";

beforeEach(() => {
  vi.resetAllMocks();
  m.sessao.mockResolvedValue({ id: "professor", papeis: ["PROFESSOR"] });
  m.carregar.mockResolvedValue({ snapshot: { gravacao: { tipo: "OFICIAL", publicacaoId: "publicacao" } } });
  m.tx.usuario = { findUnique: vi.fn().mockResolvedValue({ ativo: true, papeis: ["PROFESSOR"] }) };
  m.tx.publicacaoGravacaoAula = { findFirst: vi.fn().mockResolvedValue({ arquivoOficialId: "arquivo", driveOrganizacaoId: "drive-escola" }) };
  m.tx.fonteRevisaoGravacao = { findFirst: vi.fn().mockResolvedValue({
    arquivoOficialId: "arquivo", driveOrganizacaoId: "drive-escola", driveRevisionId: "revisao-1",
    driveRevisionMd5: "a".repeat(32), driveRevisionSize: 10n, mimeType: "video/mp4",
  }) };
});

describe("prepararVideoAulaInstitucionalContinuo", () => {
  it("captura a sessão uma vez e revalida usuário e escopo do diário em cada pull", async () => {
    const acesso = await prepararVideoAulaInstitucionalContinuo("encontro");
    await acesso.revalidar();

    expect(m.sessao).toHaveBeenCalledTimes(1);
    expect((m.tx.usuario as { findUnique: ReturnType<typeof vi.fn> }).findUnique).toHaveBeenCalledTimes(2);
    expect(m.carregar).toHaveBeenCalledTimes(2);
    expect(m.carregar).toHaveBeenLastCalledWith(m.tx, "professor", "encontro", { somenteLeitura: true });
  });

  it.each([
    ["usuário inativo", { ativo: false, papeis: ["PROFESSOR"] }],
    ["papel revogado", { ativo: true, papeis: ["VENDEDOR"] }],
  ])("interrompe o stream quando há %s", async (_caso, atual) => {
    const acesso = await prepararVideoAulaInstitucionalContinuo("encontro");
    (m.tx.usuario as { findUnique: ReturnType<typeof vi.fn> }).findUnique.mockResolvedValueOnce(atual);

    await expect(acesso.revalidar()).rejects.toThrow();
    expect(m.carregar).toHaveBeenCalledTimes(1);
  });

  it("interrompe quando a fonte oficial muda durante o stream", async () => {
    const acesso = await prepararVideoAulaInstitucionalContinuo("encontro");
    (m.tx.fonteRevisaoGravacao as { findFirst: ReturnType<typeof vi.fn> }).findFirst.mockResolvedValueOnce({
      arquivoOficialId: "outro-arquivo", driveOrganizacaoId: "drive-escola", driveRevisionId: "revisao-1",
      driveRevisionMd5: "a".repeat(32), driveRevisionSize: 10n, mimeType: "video/mp4",
    });

    await expect(acesso.revalidar()).rejects.toThrow("Vídeo institucional indisponível");
  });
});

import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { ErroAutenticacao } from "@/server/_shared";
import { revalidarSessaoPortalAlunoTx } from "./sessao";

const capturada = { sessaoId: "sessao-1", contaId: "conta-1", alunoId: "aluno-1", email: "aluno@portal.test" };

function txCom(linhas: unknown[]) {
  return { $queryRaw: vi.fn().mockResolvedValue(linhas) } as unknown as Prisma.TransactionClient;
}

describe("revalidarSessaoPortalAlunoCapturadaTx", () => {
  it("autoriza somente a identidade persistida revalidada, sem ler cookies", async () => {
    const tx = txCom([{ ...capturada, email: "aluno@portal.test", expiraEm: new Date("2099-01-01T00:00:00.000Z") }]);

    await expect(revalidarSessaoPortalAlunoTx(tx, capturada, new Date("2026-01-01T00:00:00.000Z")))
      .resolves.toBeUndefined();
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it.each(["sessão revogada", "sessão expirada", "versão da conta alterada", "conta inativa", "senha ou e-mail removidos", "aluno divergente"]) 
  ("nega snapshot capturado quando a releitura não devolve sessão válida: %s", async () => {
    const tx = txCom([]);

    await expect(revalidarSessaoPortalAlunoTx(tx, capturada)).rejects.toBeInstanceOf(ErroAutenticacao);
  });
});

import { expect, it, vi } from "vitest";
import { ErroRegra } from "@/server/_shared";
import { resolverFonteRevisaoGravacaoTx } from "./fonte-revisao-tx";

const fonte = {
  arquivoOficialId: "arquivo-oficial-1",
  driveOrganizacaoId: "drive-escola-1",
  driveRevisionId: "revisao-fixa-1",
  driveRevisionMd5: "A".repeat(32),
  driveRevisionSize: 9_223_372_036_854_775_807n,
  mimeType: "Video/MP4",
};

it("resolve a última fonte fixa sem consultar a cabeça do Drive", async () => {
  const findFirst = vi.fn().mockResolvedValue(fonte);
  await expect(resolverFonteRevisaoGravacaoTx({ fonteRevisaoGravacao: { findFirst } } as never, { materialReposicaoId: "material-1" }))
    .resolves.toEqual({ fileId: "arquivo-oficial-1", driveId: "drive-escola-1", revisionId: "revisao-fixa-1", md5Checksum: "a".repeat(32), size: "9223372036854775807", mimeType: "video/mp4" });
  expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { materialReposicaoId: "material-1" }, orderBy: { versao: "desc" } }));
});

it("recusa fonte legada ou incompleta para exigir regularização", async () => {
  const ausente = { fonteRevisaoGravacao: { findFirst: vi.fn().mockResolvedValue(null) } } as never;
  await expect(resolverFonteRevisaoGravacaoTx(ausente, { publicacaoAulaId: "publicacao-1" })).rejects.toBeInstanceOf(ErroRegra);
  const incompleta = { fonteRevisaoGravacao: { findFirst: vi.fn().mockResolvedValue({ ...fonte, driveRevisionId: null }) } } as never;
  await expect(resolverFonteRevisaoGravacaoTx(incompleta, { publicacaoAulaId: "publicacao-1" })).rejects.toThrow(/regularização/i);
});
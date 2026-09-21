import { describe, expect, it } from "vitest";
import { ErroRegra } from "@/server/_shared/sessao";
import { mesmaFonteRevisaoDrive, normalizarFonteRevisaoDrive, type FonteRevisaoPersistida } from "./fonte-revisao";

const fonte: FonteRevisaoPersistida = {
  arquivoOficialId: "arquivo_drive-1", driveOrganizacaoId: "drive_escola", driveRevisionId: "rev-1",
  driveRevisionMd5: "A".repeat(32), driveRevisionSize: "9223372036854775807", mimeType: "VIDEO/MP4",
};

describe("fonte de revisão fixa do Drive", () => {
  it("normaliza MD5/MIME e preserva BIGINT sem conversão para number", () => {
    const revisao = normalizarFonteRevisaoDrive(fonte);
    expect(revisao).toEqual({
      fileId: "arquivo_drive-1",
      driveId: "drive_escola",
      revisionId: "rev-1",
      md5Checksum: "a".repeat(32),
      size: "9223372036854775807",
      mimeType: "video/mp4",
    });
  });

  it.each([
    ["arquivo", { arquivoOficialId: "?" }], ["drive curto", { driveOrganizacaoId: "ab" }],
    ["revisão legada", { driveRevisionId: null }], ["MD5", { driveRevisionMd5: "a".repeat(31) }],
    ["tamanho nulo", { driveRevisionSize: null }], ["tamanho zero", { driveRevisionSize: "0" }],
    ["tamanho acima de BIGINT", { driveRevisionSize: "9223372036854775808" }], ["MIME", { mimeType: "text/plain" }],
  ])("recusa %s sem fallback", (_caso, parcial) => {
    expect(() => normalizarFonteRevisaoDrive({ ...fonte, ...parcial })).toThrow(ErroRegra);
    expect(() => normalizarFonteRevisaoDrive({ ...fonte, ...parcial })).toThrow(/revisão.*regularização/i);
  });

  it.each(["arquivoOficialId", "driveOrganizacaoId", "driveRevisionId", "driveRevisionMd5", "driveRevisionSize", "mimeType"] as const)
  ("exige igualdade de %s", (campo) => {
    const valor = campo === "driveRevisionSize" ? "42"
      : campo === "driveRevisionMd5" ? "b".repeat(32)
        : campo === "mimeType" ? "video/webm" : "outro_valor";
    const outro = { ...fonte, [campo]: valor };
    expect(mesmaFonteRevisaoDrive(fonte, outro)).toBe(false);
  });

  it("não considera legada igual mesmo quando file e Drive são iguais", () => {
    expect(() => mesmaFonteRevisaoDrive(fonte, { ...fonte, driveRevisionId: null })).toThrow(/revisão.*regularização/i);
  });
});

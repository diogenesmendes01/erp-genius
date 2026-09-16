import { ErroRegra } from "@/server/_shared/sessao";
import type { RevisaoDriveFixada } from "./drive-revisao";

const ID = /^[A-Za-z0-9_-]{3,500}$/;
const MD5 = /^[a-f0-9]{32}$/i;
const MIME_VIDEO = /^video\/[a-z0-9][a-z0-9!#$&^_.+-]{0,126}$/i;
const BIGINT_MAX = 9_223_372_036_854_775_807n;
const ERRO_REVISAO = "A revisão da gravação exige regularização antes da reprodução.";

export type FonteRevisaoPersistida = {
  arquivoOficialId: string;
  driveOrganizacaoId: string;
  driveRevisionId: string | null;
  driveRevisionMd5: string | null;
  driveRevisionSize: bigint | string | null;
  mimeType: string;
};

function erroRevisao(): never {
  throw new ErroRegra(ERRO_REVISAO);
}

function idSeguro(valor: string | null | undefined): string {
  if (typeof valor !== "string" || !ID.test(valor)) return erroRevisao();
  return valor;
}

function tamanhoSeguro(valor: bigint | string | null): bigint {
  let tamanho: bigint;
  if (typeof valor === "bigint") tamanho = valor;
  else if (typeof valor === "string" && /^(0|[1-9]\d*)$/.test(valor)) {
    try { tamanho = BigInt(valor); } catch { return erroRevisao(); }
  } else return erroRevisao();
  if (tamanho <= 0n || tamanho > BIGINT_MAX) return erroRevisao();
  return tamanho;
}

/** Normaliza somente uma revisão binária já fixada; legado não cai para a cabeça atual. */
export function normalizarFonteRevisaoDrive(fonte: FonteRevisaoPersistida): RevisaoDriveFixada {
  const arquivoOficialId = idSeguro(fonte.arquivoOficialId);
  const driveOrganizacaoId = idSeguro(fonte.driveOrganizacaoId);
  const driveRevisionId = idSeguro(fonte.driveRevisionId);
  if (typeof fonte.driveRevisionMd5 !== "string" || !MD5.test(fonte.driveRevisionMd5)) return erroRevisao();
  if (typeof fonte.mimeType !== "string" || !MIME_VIDEO.test(fonte.mimeType)) return erroRevisao();
  return {
    fileId: arquivoOficialId,
    driveId: driveOrganizacaoId,
    revisionId: driveRevisionId,
    md5Checksum: fonte.driveRevisionMd5.toLowerCase(),
    size: tamanhoSeguro(fonte.driveRevisionSize).toString(),
    mimeType: fonte.mimeType.toLowerCase(),
  };
}

/** Compara a identidade completa; fontes legadas/inválidas falham, sem fallback por fileId. */
export function mesmaFonteRevisaoDrive(a: FonteRevisaoPersistida, b: FonteRevisaoPersistida): boolean {
  const esquerda = normalizarFonteRevisaoDrive(a);
  const direita = normalizarFonteRevisaoDrive(b);
  return esquerda.fileId === direita.fileId
    && esquerda.driveId === direita.driveId
    && esquerda.revisionId === direita.revisionId
    && esquerda.md5Checksum === direita.md5Checksum
    && esquerda.size === direita.size
    && esquerda.mimeType === direita.mimeType;
}

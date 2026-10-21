import { createHash } from "node:crypto";
import { z } from "zod";

// ASSINATURA ELETRÔNICA POR DRIVER (Q155 segue aberta). O ERP fala com o serviço de assinatura só por
// este contrato: criar o envelope a partir do original preservado (deduplicado pela chave da tentativa),
// consultar/conciliar pela chave, cancelar e baixar o assinado. O driver SIMULADO
// (`provedor-assinatura-simulado.ts`) é a única implementação hoje; o fornecedor real entra como outro
// driver NESTE contrato, sem tocar as máquinas de estado de `envio-tx.ts`, `aditivo-envio-tx.ts` e
// `cancelamento-assinatura-tx.ts`. Qual driver vale é decidido por `ASSINATURA_DRIVER`
// (`provedor-assinatura-ativo.ts`).

/** Fornecedores reais (ainda sem driver) e o SIMULADO, que nunca envia nada a ninguém. */
export const FornecedorAssinaturaSchema = z.enum(["ZAPSIGN", "CLICKSIGN", "DOCUSIGN", "SIMULADO"]);
export const AmbienteAssinaturaSchema = z.enum(["SANDBOX", "PRODUCAO"]);
export type FornecedorAssinatura = z.infer<typeof FornecedorAssinaturaSchema>;
export type AmbienteAssinatura = z.infer<typeof AmbienteAssinaturaSchema>;

/** Destino de um processo de assinatura. O SIMULADO só existe em SANDBOX (também por CHECK no banco):
 * assim um envio simulado nunca alcança efeito contratual real, que exige PRODUCAO nos guards. */
export const destinoAssinaturaCoerente = (d: { fornecedor: string; ambiente: string }) => d.fornecedor !== "SIMULADO" || d.ambiente === "SANDBOX";
export const MENSAGEM_DESTINO_SIMULADO = { message: "O serviço simulado só existe no ambiente de teste." };
export const CamposDestinoAssinatura = { fornecedor: FornecedorAssinaturaSchema, ambiente: AmbienteAssinaturaSchema };
export const DestinoAssinaturaSchema = z.object(CamposDestinoAssinatura).refine(destinoAssinaturaCoerente, MENSAGEM_DESTINO_SIMULADO);

export const ROTULO_FORNECEDOR_ASSINATURA: Readonly<Record<string, string>> = Object.freeze({
  ZAPSIGN: "ZapSign", CLICKSIGN: "Clicksign", DOCUSIGN: "DocuSign",
  SIMULADO: "Simulado (nenhum documento sai do ERP)",
});
export const rotuloFornecedorAssinatura = (fornecedor: string) => ROTULO_FORNECEDOR_ASSINATURA[fornecedor] ?? fornecedor;

export type SignatarioEnvelope = { papel: string; etapa: number; nome: string; email: string };
export type EnvelopeParaAssinatura = {
  /** Chave da tentativa: o fornecedor (ou o driver) deve deduplicar por ela. */
  chave: string;
  nome: string;
  pdf: Uint8Array;
  pdfHash: string;
  /** Etapas iguais assinam em paralelo; etapas crescentes, em sequência (Q122: cliente antes da escola). */
  signatarios: SignatarioEnvelope[];
};

/**
 * NAO_CRIADO e AUSENTE exigem prova positiva do fornecedor. Timeout, erro de rede
 * ou resposta ilegível são sempre INCERTO — nunca autorizam repetir a criação.
 */
export type ResultadoCriacaoEnvelope =
  | { resultado: "REGISTRADO"; referenciaExterna: string; evidencia: unknown }
  | { resultado: "NAO_CRIADO"; evidencia: unknown }
  | { resultado: "INCERTO"; evidencia: unknown };
export type SituacaoEnvelope = "EM_ASSINATURA" | "ASSINADO" | "CANCELADO" | "RECUSADO";
export type ResultadoConsultaEnvelope =
  | { resultado: "ENCONTRADO"; referenciaExterna: string; situacao: SituacaoEnvelope; evidencia: unknown }
  | { resultado: "AUSENTE"; evidencia: unknown }
  | { resultado: "INCERTO"; evidencia: unknown };
/** Só CANCELADO prova o cancelamento. */
export type ResultadoCancelamentoEnvelope = { resultado: "CANCELADO" | "NAO_CANCELAVEL" | "INCERTO"; evidencia: unknown };

export interface ProvedorAssinatura {
  fornecedor: FornecedorAssinatura;
  ambiente: AmbienteAssinatura;
  criarEnvelope(envelope: EnvelopeParaAssinatura): Promise<ResultadoCriacaoEnvelope>;
  consultarPorChave(chave: string): Promise<ResultadoConsultaEnvelope>;
  cancelarEnvelope(referenciaExterna: string): Promise<ResultadoCancelamentoEnvelope>;
  baixarAssinado(referenciaExterna: string): Promise<{ pdf: Uint8Array; evidencia: unknown } | null>;
}

export const hashEvidenciaAssinatura = (evidencia: unknown) =>
  createHash("sha256").update(JSON.stringify(evidencia ?? null)).digest("hex");

const excecao = (e: unknown) => ({ resultado: "INCERTO" as const, evidencia: { motivo: "EXCECAO_DRIVER", mensagem: e instanceof Error ? e.message : String(e) } });

/** Exceção do driver nunca prova ausência: vira INCERTO com a mensagem como evidência. */
export async function criarEnvelopeSemPresumir(provedor: ProvedorAssinatura, envelope: EnvelopeParaAssinatura): Promise<ResultadoCriacaoEnvelope> {
  try {
    const r = await provedor.criarEnvelope(envelope);
    if (r.resultado === "REGISTRADO" && !r.referenciaExterna?.trim()) return { resultado: "INCERTO", evidencia: { motivo: "REFERENCIA_VAZIA", original: r.evidencia } };
    return r;
  } catch (e) { return excecao(e); }
}

export async function consultarEnvelopeSemPresumir(provedor: ProvedorAssinatura, chave: string): Promise<ResultadoConsultaEnvelope> {
  try {
    const r = await provedor.consultarPorChave(chave);
    if (r.resultado === "ENCONTRADO" && !r.referenciaExterna?.trim()) return { resultado: "INCERTO", evidencia: { motivo: "REFERENCIA_VAZIA", original: r.evidencia } };
    return r;
  } catch (e) { return excecao(e); }
}

/** Só CANCELADO é prova; recusa, exceção ou dúvida permanecem como resultado incerto a conciliar. */
export async function cancelarEnvelopeSemPresumir(provedor: ProvedorAssinatura, referenciaExterna: string): Promise<ResultadoCancelamentoEnvelope> {
  try { return await provedor.cancelarEnvelope(referenciaExterna); }
  catch (e) { return excecao(e); }
}

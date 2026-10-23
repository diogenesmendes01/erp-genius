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

/** Prazo máximo da chamada de criação do envelope: passado dele, o resultado é INCERTO (a criação pode ter
 * acontecido) e o processo vai para ENVIO_INCERTO. */
export const TIMEOUT_CRIACAO_ENVELOPE_MS = 2 * 60_000;
/** Enquanto a tentativa está ENVIANDO e é mais nova que este prazo, a criação pode estar em voo: a conciliação
 * é recusada, porque um AUSENTE agora devolveria o processo a PREPARADO e abriria um segundo envio. Precisa ser
 * maior que TIMEOUT_CRIACAO_ENVELOPE_MS (folga para as duas transações em volta da chamada). */
export const PRAZO_CONCILIACAO_ENVIANDO_MS = 10 * 60_000;

/** Pode conciliar? ENVIO_INCERTO sempre; ENVIANDO só depois do prazo contado de `iniciadaEm`. */
export function conciliacaoLiberada(estado: string, iniciadaEm: Date | string | null | undefined, agora = new Date()) {
  if (estado === "ENVIO_INCERTO") return { liberada: true as const };
  if (estado !== "ENVIANDO" || !iniciadaEm) return { liberada: false as const, minutos: null };
  const restante = new Date(iniciadaEm).getTime() + PRAZO_CONCILIACAO_ENVIANDO_MS - agora.getTime();
  return restante <= 0 ? { liberada: true as const } : { liberada: false as const, minutos: Math.max(1, Math.ceil(restante / 60_000)) };
}

export const hashEvidenciaAssinatura = (evidencia: unknown) =>
  createHash("sha256").update(JSON.stringify(evidencia ?? null)).digest("hex");

const excecao = (e: unknown) => ({ resultado: "INCERTO" as const, evidencia: { motivo: "EXCECAO_DRIVER", mensagem: e instanceof Error ? e.message : String(e) } });

/** Exceção do driver nunca prova ausência: vira INCERTO com a mensagem como evidência. */
export async function criarEnvelopeSemPresumir(provedor: ProvedorAssinatura, envelope: EnvelopeParaAssinatura, timeoutMs = TIMEOUT_CRIACAO_ENVELOPE_MS): Promise<ResultadoCriacaoEnvelope> {
  let relogio: ReturnType<typeof setTimeout> | undefined;
  try {
    const prazo = new Promise<never>((_, recusar) => { relogio = setTimeout(() => recusar(new Error("TIMEOUT_CRIACAO_ENVELOPE")), timeoutMs); });
    const r = await Promise.race([provedor.criarEnvelope(envelope), prazo]);
    if (r.resultado === "REGISTRADO" && !r.referenciaExterna?.trim()) return { resultado: "INCERTO", evidencia: { motivo: "REFERENCIA_VAZIA", original: r.evidencia } };
    return r;
  } catch (e) { return excecao(e); }
  finally { clearTimeout(relogio); }
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

export type ResultadoConciliacaoEnvio = { resultado: "REGISTRADO" | "NAO_CRIADO" | "INCERTO"; referenciaExterna: string | null; evidencia: unknown };

/**
 * Conciliação do envio a partir da consulta pela chave da tentativa. Só envelope encontrado e ainda válido
 * (em assinatura ou já assinado) confirma o envio; ausência positiva prova que nada foi criado. Envelope
 * CANCELADO ou RECUSADO no serviço NÃO vira ENVIADO: o processo só passa a CANCELADO pelos fluxos que o
 * banco reconhece (substituição ou desistência Q165), então fica INCERTO com o motivo explícito, para
 * conferência humana.
 */
export function resultadoConciliacaoEnvio(consulta: ResultadoConsultaEnvelope): ResultadoConciliacaoEnvio {
  if (consulta.resultado === "AUSENTE") return { resultado: "NAO_CRIADO", referenciaExterna: null, evidencia: consulta.evidencia };
  if (consulta.resultado === "INCERTO") return { resultado: "INCERTO", referenciaExterna: null, evidencia: consulta.evidencia };
  if (consulta.situacao === "EM_ASSINATURA" || consulta.situacao === "ASSINADO") return { resultado: "REGISTRADO", referenciaExterna: consulta.referenciaExterna, evidencia: consulta.evidencia };
  return { resultado: "INCERTO", referenciaExterna: null,
    evidencia: { motivo: consulta.situacao === "CANCELADO" ? "ENVELOPE_CANCELADO_NO_SERVICO" : "ENVELOPE_RECUSADO_NO_SERVICO", referenciaExterna: consulta.referenciaExterna, situacao: consulta.situacao, original: consulta.evidencia } };
}

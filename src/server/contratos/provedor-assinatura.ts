import { createHash } from "node:crypto";
import { z } from "zod";

export const FornecedorAssinaturaSchema = z.enum(["ZAPSIGN", "CLICKSIGN", "DOCUSIGN", "SIMULADO"]);
export const AmbienteAssinaturaSchema = z.enum(["SANDBOX", "PRODUCAO"]);
export type FornecedorAssinatura = z.infer<typeof FornecedorAssinaturaSchema>;
export type AmbienteAssinatura = z.infer<typeof AmbienteAssinaturaSchema>;

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
  chave: string;
  nome: string;
  pdf: Uint8Array;
  pdfHash: string;
  signatarios: SignatarioEnvelope[];
};

export type ResultadoCriacaoEnvelope =
  | { resultado: "REGISTRADO"; referenciaExterna: string; evidencia: unknown }
  | { resultado: "NAO_CRIADO"; evidencia: unknown }
  | { resultado: "INCERTO"; evidencia: unknown };
export type SituacaoEnvelope = "EM_ASSINATURA" | "ASSINADO" | "CANCELADO" | "RECUSADO";
export type ResultadoConsultaEnvelope =
  | { resultado: "ENCONTRADO"; referenciaExterna: string; situacao: SituacaoEnvelope; evidencia: unknown }
  | { resultado: "AUSENTE"; evidencia: unknown }
  | { resultado: "INCERTO"; evidencia: unknown };
export type ResultadoCancelamentoEnvelope = { resultado: "CANCELADO" | "NAO_CANCELAVEL" | "INCERTO"; evidencia: unknown };

export interface ProvedorAssinatura {
  fornecedor: FornecedorAssinatura;
  ambiente: AmbienteAssinatura;
  criarEnvelope(envelope: EnvelopeParaAssinatura): Promise<ResultadoCriacaoEnvelope>;
  consultarPorChave(chave: string): Promise<ResultadoConsultaEnvelope>;
  cancelarEnvelope(referenciaExterna: string): Promise<ResultadoCancelamentoEnvelope>;
  baixarAssinado(referenciaExterna: string): Promise<{ pdf: Uint8Array; evidencia: unknown } | null>;
}

export const TIMEOUT_CRIACAO_ENVELOPE_MS = 2 * 60_000;
export const PRAZO_CONCILIACAO_ENVIANDO_MS = 10 * 60_000;

export function conciliacaoLiberada(estado: string, iniciadaEm: Date | string | null | undefined, agora = new Date()) {
  if (estado === "ENVIO_INCERTO") return { liberada: true as const };
  if (estado !== "ENVIANDO" || !iniciadaEm) return { liberada: false as const, minutos: null };
  const restante = new Date(iniciadaEm).getTime() + PRAZO_CONCILIACAO_ENVIANDO_MS - agora.getTime();
  return restante <= 0 ? { liberada: true as const } : { liberada: false as const, minutos: Math.max(1, Math.ceil(restante / 60_000)) };
}

export const hashEvidenciaAssinatura = (evidencia: unknown) =>
  createHash("sha256").update(JSON.stringify(evidencia ?? null)).digest("hex");

const excecao = (e: unknown) => ({ resultado: "INCERTO" as const, evidencia: { motivo: "EXCECAO_DRIVER", mensagem: e instanceof Error ? e.message : String(e) } });

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

export async function cancelarEnvelopeSemPresumir(provedor: ProvedorAssinatura, referenciaExterna: string): Promise<ResultadoCancelamentoEnvelope> {
  try { return await provedor.cancelarEnvelope(referenciaExterna); }
  catch (e) { return excecao(e); }
}

export type ResultadoConciliacaoEnvio = { resultado: "REGISTRADO" | "NAO_CRIADO" | "INCERTO"; referenciaExterna: string | null; evidencia: unknown };

export function resultadoConciliacaoEnvio(consulta: ResultadoConsultaEnvelope): ResultadoConciliacaoEnvio {
  if (consulta.resultado === "AUSENTE") return { resultado: "NAO_CRIADO", referenciaExterna: null, evidencia: consulta.evidencia };
  if (consulta.resultado === "INCERTO") return { resultado: "INCERTO", referenciaExterna: null, evidencia: consulta.evidencia };
  if (consulta.situacao === "EM_ASSINATURA" || consulta.situacao === "ASSINADO") return { resultado: "REGISTRADO", referenciaExterna: consulta.referenciaExterna, evidencia: consulta.evidencia };
  return { resultado: "INCERTO", referenciaExterna: null,
    evidencia: { motivo: consulta.situacao === "CANCELADO" ? "ENVELOPE_CANCELADO_NO_SERVICO" : "ENVELOPE_RECUSADO_NO_SERVICO", referenciaExterna: consulta.referenciaExterna, situacao: consulta.situacao, original: consulta.evidencia } };
}

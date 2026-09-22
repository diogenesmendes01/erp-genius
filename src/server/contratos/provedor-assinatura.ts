import { createHash } from "node:crypto";
import { z } from "zod";

// ASSINATURA ELETRÔNICA POR DRIVER (Q155 segue aberta): o contrato é criar o envelope a
// partir do original preservado, consultar/conciliar pela chave da tentativa, cancelar e
// baixar o assinado. O driver SIMULADO roda 100% local e só existe em SANDBOX com
// ASSINATURA_DRIVER=simulado. ZapSign/Clicksign/Docusign entram como drivers NESTE
// contrato, sem tocar a máquina de estados de envio-tx.ts.

export const FornecedorAssinaturaSchema = z.enum(["ZAPSIGN", "CLICKSIGN", "DOCUSIGN"]);
export const AmbienteAssinaturaSchema = z.enum(["SANDBOX", "PRODUCAO"]);
export type FornecedorAssinatura = z.infer<typeof FornecedorAssinaturaSchema>;
export type AmbienteAssinatura = z.infer<typeof AmbienteAssinaturaSchema>;

export type SignatarioEnvelope = { papel: string; etapa: number; nome: string; email: string };
export type EnvelopeParaAssinatura = {
  /** Chave da tentativa: o fornecedor (ou o driver) deve deduplicar por ela. */
  chave: string;
  nome: string;
  pdf: Uint8Array;
  pdfHash: string;
  /** Etapas iguais assinam em paralelo; etapas crescentes, em sequência (Q122). */
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

/** Exceção do driver nunca prova ausência: vira INCERTO com a mensagem como evidência. */
export async function criarEnvelopeSemPresumir(provedor: ProvedorAssinatura, envelope: EnvelopeParaAssinatura): Promise<ResultadoCriacaoEnvelope> {
  try {
    const r = await provedor.criarEnvelope(envelope);
    if (r.resultado === "REGISTRADO" && !r.referenciaExterna.trim()) return { resultado: "INCERTO", evidencia: { motivo: "REFERENCIA_VAZIA", original: r.evidencia } };
    return r;
  } catch (e) {
    return { resultado: "INCERTO", evidencia: { motivo: "EXCECAO_DRIVER", mensagem: e instanceof Error ? e.message : String(e) } };
  }
}

export async function consultarEnvelopeSemPresumir(provedor: ProvedorAssinatura, chave: string): Promise<ResultadoConsultaEnvelope> {
  try { return await provedor.consultarPorChave(chave); }
  catch (e) { return { resultado: "INCERTO", evidencia: { motivo: "EXCECAO_DRIVER", mensagem: e instanceof Error ? e.message : String(e) } }; }
}

/** Só CANCELADO é prova; recusa, exceção ou dúvida permanecem como resultado incerto a conciliar. */
export async function cancelarEnvelopeSemPresumir(provedor: ProvedorAssinatura, referenciaExterna: string): Promise<ResultadoCancelamentoEnvelope> {
  try { return await provedor.cancelarEnvelope(referenciaExterna); }
  catch (e) { return { resultado: "INCERTO", evidencia: { motivo: "EXCECAO_DRIVER", mensagem: e instanceof Error ? e.message : String(e) } }; }
}

type EnvelopeSimulado = { referenciaExterna: string; pdfHash: string; situacao: SituacaoEnvelope; signatarios: SignatarioEnvelope[]; pdf: Uint8Array };

/** Driver SIMULADO: memória do processo, referência determinística pela chave. Nenhuma chamada externa. */
export function criarProvedorSimulado(fornecedor: FornecedorAssinatura = "ZAPSIGN", memoria = new Map<string, EnvelopeSimulado>()): ProvedorAssinatura & { assinarTudo(referenciaExterna: string): void } {
  const porReferencia = (ref: string) => [...memoria.values()].find((e) => e.referenciaExterna === ref);
  return {
    fornecedor, ambiente: "SANDBOX",
    async criarEnvelope(envelope) {
      if (createHash("sha256").update(envelope.pdf).digest("hex") !== envelope.pdfHash) return { resultado: "NAO_CRIADO", evidencia: { motivo: "PDF_DIVERGENTE" } };
      if (!envelope.signatarios.length) return { resultado: "NAO_CRIADO", evidencia: { motivo: "SEM_SIGNATARIOS" } };
      const anterior = memoria.get(envelope.chave);
      if (anterior) {
        return anterior.pdfHash === envelope.pdfHash
          ? { resultado: "REGISTRADO", referenciaExterna: anterior.referenciaExterna, evidencia: { simulado: true, repetido: true } }
          : { resultado: "NAO_CRIADO", evidencia: { motivo: "CHAVE_USADA_COM_OUTRO_DOCUMENTO" } };
      }
      const referenciaExterna = `sim_${createHash("sha256").update(envelope.chave).digest("hex").slice(0, 24)}`;
      memoria.set(envelope.chave, { referenciaExterna, pdfHash: envelope.pdfHash, situacao: "EM_ASSINATURA", signatarios: envelope.signatarios, pdf: envelope.pdf });
      return { resultado: "REGISTRADO", referenciaExterna, evidencia: { simulado: true, signatarios: envelope.signatarios.length } };
    },
    async consultarPorChave(chave) {
      const e = memoria.get(chave);
      return e ? { resultado: "ENCONTRADO", referenciaExterna: e.referenciaExterna, situacao: e.situacao, evidencia: { simulado: true } }
        : { resultado: "AUSENTE", evidencia: { simulado: true } };
    },
    async cancelarEnvelope(referenciaExterna) {
      const e = porReferencia(referenciaExterna);
      if (!e) return { resultado: "INCERTO", evidencia: { motivo: "REFERENCIA_DESCONHECIDA" } };
      if (e.situacao === "ASSINADO") return { resultado: "NAO_CANCELAVEL", evidencia: { situacao: e.situacao } };
      e.situacao = "CANCELADO";
      return { resultado: "CANCELADO", evidencia: { simulado: true } };
    },
    async baixarAssinado(referenciaExterna) {
      const e = porReferencia(referenciaExterna);
      return e?.situacao === "ASSINADO" ? { pdf: e.pdf, evidencia: { simulado: true } } : null;
    },
    assinarTudo(referenciaExterna) {
      const e = porReferencia(referenciaExterna);
      if (e && e.situacao === "EM_ASSINATURA") e.situacao = "ASSINADO";
    },
  };
}

const globalSimulado = globalThis as { __assinaturaSimulada?: ReturnType<typeof criarProvedorSimulado> };

/**
 * Driver ativo por env. Sem ASSINATURA_DRIVER não há integração: as telas seguem no
 * fluxo manual (upload do assinado). O simulado é recusado fora de desenvolvimento/teste.
 */
export function provedorAssinaturaAtivo(env: Record<string, string | undefined> = process.env): ProvedorAssinatura | null {
  const driver = env.ASSINATURA_DRIVER?.trim().toLowerCase();
  if (!driver) return null;
  if (driver === "simulado") {
    if (env.NODE_ENV === "production") throw new Error("ASSINATURA_DRIVER=simulado não é permitido em produção.");
    return globalSimulado.__assinaturaSimulada ??= criarProvedorSimulado();
  }
  throw new Error(`ASSINATURA_DRIVER desconhecido: ${driver}. O fornecedor real (Q155) ainda não possui driver.`);
}

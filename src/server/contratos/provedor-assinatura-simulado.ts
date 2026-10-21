import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { registrarEvento } from "@/server/_shared";
import type { ProvedorAssinatura, SignatarioEnvelope, SituacaoEnvelope } from "./provedor-assinatura";

// DRIVER SIMULADO de assinatura eletrônica. Nenhuma chamada externa e nenhum e-mail: o "serviço" é a
// tabela `EnvelopeAssinaturaSimulado` (durável entre reinícios e instâncias, para a conciliação e o
// cancelamento continuarem possíveis depois de um deploy). Os processos criados por ele ficam com
// fornecedor SIMULADO e ambiente SANDBOX — o banco recusa SIMULADO fora de SANDBOX, e os guards de efeito
// contratual exigem PRODUCAO. Só é usado com `ASSINATURA_DRIVER=simulado` (`provedor-assinatura-ativo.ts`).

type EnvelopeSimulado = { referenciaExterna: string; pdfHash: string; pdf: Uint8Array; situacao: SituacaoEnvelope };
type NovoEnvelope = EnvelopeSimulado & { chave: string; nome: string; signatarios: SignatarioEnvelope[] };

/** Onde o simulado guarda os envelopes. `criarSeAusente` devolve o já existente quando a chave se repete. */
export interface ArmazemEnvelopeSimulado {
  criarSeAusente(novo: NovoEnvelope): Promise<{ envelope: EnvelopeSimulado; criado: boolean }>;
  porChave(chave: string): Promise<EnvelopeSimulado | null>;
  porReferencia(referenciaExterna: string): Promise<EnvelopeSimulado | null>;
  /** Transição condicional: só muda se a situação atual for `de`. Devolve a situação resultante. */
  mudarSituacao(referenciaExterna: string, de: SituacaoEnvelope, para: SituacaoEnvelope): Promise<SituacaoEnvelope | null>;
}

/** Referência determinística pela chave: a mesma tentativa sempre aponta para o mesmo envelope. */
export const referenciaSimulada = (chave: string) => `sim_${createHash("sha256").update(chave).digest("hex").slice(0, 24)}`;
const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

export type ProvedorAssinaturaSimulado = ProvedorAssinatura & {
  /** Só para teste/demonstração: marca todas as assinaturas como feitas. */
  simularAssinatura(referenciaExterna: string): Promise<void>;
};

export function criarProvedorSimulado(armazem: ArmazemEnvelopeSimulado): ProvedorAssinaturaSimulado {
  return {
    fornecedor: "SIMULADO", ambiente: "SANDBOX",
    async criarEnvelope(envelope) {
      if (sha256(envelope.pdf) !== envelope.pdfHash) return { resultado: "NAO_CRIADO", evidencia: { simulado: true, motivo: "PDF_DIVERGENTE" } };
      if (!envelope.signatarios.length) return { resultado: "NAO_CRIADO", evidencia: { simulado: true, motivo: "SEM_SIGNATARIOS" } };
      const { envelope: e, criado } = await armazem.criarSeAusente({ chave: envelope.chave, nome: envelope.nome, pdf: envelope.pdf, pdfHash: envelope.pdfHash,
        signatarios: envelope.signatarios, referenciaExterna: referenciaSimulada(envelope.chave), situacao: "EM_ASSINATURA" });
      if (e.pdfHash !== envelope.pdfHash) return { resultado: "NAO_CRIADO", evidencia: { simulado: true, motivo: "CHAVE_USADA_COM_OUTRO_DOCUMENTO" } };
      return { resultado: "REGISTRADO", referenciaExterna: e.referenciaExterna,
        evidencia: criado ? { simulado: true, signatarios: envelope.signatarios.length } : { simulado: true, repetido: true } };
    },
    async consultarPorChave(chave) {
      const e = await armazem.porChave(chave);
      return e ? { resultado: "ENCONTRADO", referenciaExterna: e.referenciaExterna, situacao: e.situacao, evidencia: { simulado: true } }
        : { resultado: "AUSENTE", evidencia: { simulado: true } };
    },
    async cancelarEnvelope(referenciaExterna) {
      const e = await armazem.porReferencia(referenciaExterna);
      if (!e) return { resultado: "INCERTO", evidencia: { simulado: true, motivo: "REFERENCIA_DESCONHECIDA" } };
      if (e.situacao === "CANCELADO") return { resultado: "CANCELADO", evidencia: { simulado: true, repetido: true } };
      if (e.situacao !== "EM_ASSINATURA") return { resultado: "NAO_CANCELAVEL", evidencia: { simulado: true, situacao: e.situacao } };
      const situacao = await armazem.mudarSituacao(referenciaExterna, "EM_ASSINATURA", "CANCELADO");
      return situacao === "CANCELADO" ? { resultado: "CANCELADO", evidencia: { simulado: true } }
        : { resultado: "NAO_CANCELAVEL", evidencia: { simulado: true, situacao } };
    },
    async baixarAssinado(referenciaExterna) {
      const e = await armazem.porReferencia(referenciaExterna);
      return e?.situacao === "ASSINADO" ? { pdf: e.pdf, evidencia: { simulado: true } } : null;
    },
    async simularAssinatura(referenciaExterna) {
      await armazem.mudarSituacao(referenciaExterna, "EM_ASSINATURA", "ASSINADO");
    },
  };
}

/** Armazém em memória: só para testes unitários. */
export function armazemSimuladoEmMemoria(): ArmazemEnvelopeSimulado {
  const porChave = new Map<string, NovoEnvelope>();
  const porReferencia = (ref: string) => [...porChave.values()].find(e => e.referenciaExterna === ref) ?? null;
  return {
    async criarSeAusente(novo) {
      const anterior = porChave.get(novo.chave);
      if (anterior) return { envelope: anterior, criado: false };
      porChave.set(novo.chave, { ...novo });
      return { envelope: porChave.get(novo.chave)!, criado: true };
    },
    async porChave(chave) { return porChave.get(chave) ?? null; },
    async porReferencia(ref) { return porReferencia(ref); },
    async mudarSituacao(ref, de, para) {
      const e = porReferencia(ref);
      if (!e) return null;
      if (e.situacao === de) e.situacao = para;
      return e.situacao;
    },
  };
}

const SITUACOES = new Set<SituacaoEnvelope>(["EM_ASSINATURA", "ASSINADO", "CANCELADO", "RECUSADO"]);
const deLinha = (l: { referenciaExterna: string; pdfHash: string; pdf: Uint8Array; situacao: string }): EnvelopeSimulado => {
  if (!SITUACOES.has(l.situacao as SituacaoEnvelope)) throw new Error("Situação de envelope simulado desconhecida.");
  return { referenciaExterna: l.referenciaExterna, pdfHash: l.pdfHash, pdf: new Uint8Array(l.pdf), situacao: l.situacao as SituacaoEnvelope };
};
const selecao = { id: true, referenciaExterna: true, pdfHash: true, pdf: true, situacao: true } as const;

/** Armazém durável. Cada escrita grava Evento na mesma transação (docs/13). */
export function armazemSimuladoPrisma(): ArmazemEnvelopeSimulado {
  return {
    async criarSeAusente(novo) {
      return prisma.$transaction(async tx => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`envelope-simulado:${novo.chave}`}, 0))`;
        const anterior = await tx.envelopeAssinaturaSimulado.findUnique({ where: { chave: novo.chave }, select: selecao });
        if (anterior) return { envelope: deLinha(anterior), criado: false };
        const linha = await tx.envelopeAssinaturaSimulado.create({ select: selecao, data: {
          chave: novo.chave, referenciaExterna: novo.referenciaExterna, nome: novo.nome, pdf: Buffer.from(novo.pdf), pdfHash: novo.pdfHash,
          signatarios: novo.signatarios as unknown as Prisma.InputJsonArray, situacao: novo.situacao,
        } });
        await registrarEvento(tx, { tipo: "EnvelopeSimuladoCriado", agregadoTipo: "EnvelopeAssinaturaSimulado", agregadoId: linha.id,
          payload: { chave: novo.chave, referenciaExterna: linha.referenciaExterna, pdfHash: novo.pdfHash, signatarios: novo.signatarios.length, simulado: true } });
        return { envelope: deLinha(linha), criado: true };
      });
    },
    async porChave(chave) {
      const l = await prisma.envelopeAssinaturaSimulado.findUnique({ where: { chave }, select: selecao });
      return l ? deLinha(l) : null;
    },
    async porReferencia(referenciaExterna) {
      const l = await prisma.envelopeAssinaturaSimulado.findUnique({ where: { referenciaExterna }, select: selecao });
      return l ? deLinha(l) : null;
    },
    async mudarSituacao(referenciaExterna, de, para) {
      return prisma.$transaction(async tx => {
        const { count } = await tx.envelopeAssinaturaSimulado.updateMany({ where: { referenciaExterna, situacao: de }, data: { situacao: para } });
        const l = await tx.envelopeAssinaturaSimulado.findUnique({ where: { referenciaExterna }, select: { id: true, situacao: true } });
        if (count === 1 && l) await registrarEvento(tx, { tipo: "EnvelopeSimuladoSituacaoAlterada", agregadoTipo: "EnvelopeAssinaturaSimulado", agregadoId: l.id,
          payload: { referenciaExterna, de, para, simulado: true } });
        return (l?.situacao as SituacaoEnvelope | undefined) ?? null;
      });
    },
  };
}

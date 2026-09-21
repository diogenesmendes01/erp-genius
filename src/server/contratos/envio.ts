"use server";
import { z } from "zod";
import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra } from "@/server/_shared";
import { conferirAutor } from "./modelos-tx";
import { iniciarTentativaAssinaturaTx, prepararProcessoEnvioTx, registrarResultadoEnvioTx } from "./envio-tx";
import { consultarEnvelopeSemPresumir, criarEnvelopeSemPresumir, hashEvidenciaAssinatura, provedorAssinaturaAtivo, type ProvedorAssinatura } from "./provedor-assinatura";

const id = z.string().trim().min(1).max(100);
const Enviar = z.object({ matriculaId: id, artefatoId: id, conferenciaId: id }).strict();
const Conciliar = z.object({ matriculaId: id, processoId: id }).strict();
const Signatarios = z.object({ participantes: z.array(z.object({ papel: z.string().min(1), etapa: z.enum(["CLIENTE", "ESCOLA"]), nome: z.string().min(1), email: z.string().email() })).min(1) });

function exigirProvedor(): ProvedorAssinatura {
  const provedor = provedorAssinaturaAtivo();
  if (!provedor) throw new ErroRegra("A integração de assinatura eletrônica não está configurada. Conclua o processo pelo registro manual do documento assinado.");
  return provedor;
}
const chaveTentativa = (tentativaId: string) => `tentativa:${tentativaId}`;

/**
 * A tentativa é confirmada no banco ANTES da chamada externa e o resultado entra em
 * outra transação: falha entre as duas deixa ENVIANDO, nunca um envelope sem registro.
 * Timeout/erro viram ENVIO_INCERTO e só a conciliação autenticada libera nova criação.
 */
export async function enviarContratoParaAssinatura(input: z.input<typeof Enviar>) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA), d = Enviar.parse(input), provedor = exigirProvedor();
    const aberto = await prisma.$transaction(async (tx) => {
      const processo = await prepararProcessoEnvioTx(tx, { ...d, executorId: autor.id, fornecedor: provedor.fornecedor, ambiente: provedor.ambiente });
      const tentativa = await iniciarTentativaAssinaturaTx(tx, { processoId: processo.id, executorId: autor.id });
      const fonte = await tx.processoAssinaturaContratual.findUniqueOrThrow({ where: { id: processo.id },
        select: { matricula: { select: { codigo: true } }, artefato: { select: { pdf: true, pdfHash: true } }, conferencia: { select: { snapshot: true } } } });
      return { ...tentativa, codigo: fonte.matricula.codigo, pdf: fonte.artefato.pdf, pdfHash: fonte.artefato.pdfHash,
        signatarios: Signatarios.parse(fonte.conferencia.snapshot).participantes };
    }, { timeout: 30000 });
    const criado = await criarEnvelopeSemPresumir(provedor, {
      chave: chaveTentativa(aberto.tentativaId), nome: `Contrato ${aberto.codigo ?? d.matriculaId}`, pdf: aberto.pdf, pdfHash: aberto.pdfHash,
      // Q122: cliente/responsáveis assinam antes da escola.
      signatarios: aberto.signatarios.map((p) => ({ ...p, etapa: p.etapa === "CLIENTE" ? 1 : 2 })).sort((a, b) => a.etapa - b.etapa),
    });
    const registrado = await prisma.$transaction((tx) => registrarResultadoEnvioTx(tx, {
      processoId: aberto.processoId, tentativaId: aberto.tentativaId, chave: `criacao:${aberto.tentativaId}`, resultado: criado.resultado,
      referenciaExterna: criado.resultado === "REGISTRADO" ? criado.referenciaExterna : null, evidenciaHash: hashEvidenciaAssinatura(criado.evidencia),
    }), { timeout: 30000 });
    return { processoId: aberto.processoId, tentativa: aberto.numero, estado: registrado.estado };
  });
}

/**
 * Conciliação de ENVIANDO/ENVIO_INCERTO pela chave da tentativa atual. Só a resposta
 * positiva do fornecedor (encontrado ou ausente) muda o estado; dúvida mantém incerto.
 */
export async function conciliarEnvioAssinatura(input: z.input<typeof Conciliar>) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA), d = Conciliar.parse(input), provedor = exigirProvedor();
    const pendente = await prisma.$transaction(async (tx) => {
      await conferirAutor(tx, autor.id);
      const p = await tx.processoAssinaturaContratual.findFirst({ where: { id: d.processoId, matriculaId: d.matriculaId },
        select: { id: true, estado: true, fornecedor: true, ambiente: true, tentativaAtual: true, tentativas: { orderBy: { numero: "desc" }, take: 1, select: { id: true, numero: true, _count: { select: { observacoes: true } } } } } });
      if (!p) throw new ErroRegra("Processo de assinatura indisponível nesta matrícula.");
      if (p.estado !== "ENVIANDO" && p.estado !== "ENVIO_INCERTO") throw new ErroRegra("Este processo não possui envio pendente de conciliação.");
      if (p.fornecedor !== provedor.fornecedor || p.ambiente !== provedor.ambiente) throw new ErroRegra("O processo pertence a outro fornecedor ou ambiente. Concilie pela integração correspondente.");
      const tentativa = p.tentativas[0];
      if (!tentativa || tentativa.numero !== p.tentativaAtual) throw new ErroRegra("Tentativa atual não encontrada para conciliação.");
      return { processoId: p.id, tentativaId: tentativa.id, sequencia: tentativa._count.observacoes + 1 };
    });
    const consulta = await consultarEnvelopeSemPresumir(provedor, chaveTentativa(pendente.tentativaId));
    const resultado = consulta.resultado === "ENCONTRADO" ? "REGISTRADO" as const : consulta.resultado === "AUSENTE" ? "NAO_CRIADO" as const : "INCERTO" as const;
    const registrado = await prisma.$transaction((tx) => registrarResultadoEnvioTx(tx, {
      processoId: pendente.processoId, tentativaId: pendente.tentativaId, chave: `conciliacao:${pendente.tentativaId}:${pendente.sequencia}`, resultado,
      referenciaExterna: consulta.resultado === "ENCONTRADO" ? consulta.referenciaExterna : null, evidenciaHash: hashEvidenciaAssinatura(consulta.evidencia),
    }), { timeout: 30000 });
    return { processoId: pendente.processoId, estado: registrado.estado };
  });
}

/** A tela só oferece o envio quando há driver; sem ele permanece o registro manual. */
export async function consultarIntegracaoAssinatura() {
  return executarAcao(async () => {
    await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA);
    const provedor = provedorAssinaturaAtivo();
    return provedor ? { fornecedor: provedor.fornecedor, ambiente: provedor.ambiente } : null;
  });
}

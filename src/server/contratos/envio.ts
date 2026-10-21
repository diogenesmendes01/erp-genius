"use server";
import { z } from "zod";
import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra } from "@/server/_shared";
import { marcaIdempotencia, repeticaoIdempotente } from "@/server/_shared/idempotencia";
import { conferirAutor } from "./modelos-tx";
import { iniciarTentativaAssinaturaTx, prepararProcessoEnvioTx, registrarResultadoEnvioTx } from "./envio-tx";
import { consultarEnvelopeSemPresumir, criarEnvelopeSemPresumir, hashEvidenciaAssinatura, type ProvedorAssinatura } from "./provedor-assinatura";
import { provedorAssinaturaAtivo } from "./provedor-assinatura-ativo";

const id = z.string().trim().min(1).max(100);
const chave = z.string().trim().min(8).max(200).optional();
const Enviar = z.object({ matriculaId: id, artefatoId: id, conferenciaId: id, chaveIdempotencia: chave }).strict();
const Conciliar = z.object({ matriculaId: id, processoId: id, chaveIdempotencia: chave }).strict();
const Signatarios = z.object({ participantes: z.array(z.object({ papel: z.string().min(1), etapa: z.enum(["CLIENTE", "ESCOLA"]), nome: z.string().min(1), email: z.string().email() })).min(1) });

function exigirProvedor(): ProvedorAssinatura {
  const provedor = provedorAssinaturaAtivo();
  if (!provedor) throw new ErroRegra("A integração de assinatura eletrônica não está configurada. Conclua o processo pelo registro manual do documento assinado.");
  return provedor;
}
const chaveTentativa = (tentativaId: string) => `tentativa:${tentativaId}`;
const CONFLITO = "Esta solicitação já foi usada com outros dados. Atualize a página antes de repetir.";

type Envio = { processoId: string; tentativa: number; estado: string; repetido: boolean };

/**
 * Envio integrado do original do contrato. A tentativa é confirmada no banco ANTES da chamada externa
 * e o resultado entra em outra transação: falha entre as duas deixa ENVIANDO, nunca um envelope sem
 * registro. Timeout/erro viram ENVIO_INCERTO e só a conciliação libera nova criação. A mesma chave de
 * idempotência devolve o estado atual sem chamar o serviço de novo.
 */
export async function enviarContratoParaAssinatura(input: z.input<typeof Enviar>) {
  return executarAcao<Envio>(async () => {
    const autor = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA), { chaveIdempotencia, ...d } = Enviar.parse(input), provedor = exigirProvedor();
    const marca = marcaIdempotencia(chaveIdempotencia, d);
    const aberto = await prisma.$transaction(async (tx) => {
      if (marca) {
        const anterior = await repeticaoIdempotente(tx, { tipo: "TentativaAssinaturaIniciada", agregadoTipo: "Matricula", autorId: autor.id, marca, mensagemConflito: CONFLITO });
        if (anterior) {
          const payload = anterior.payload as { processoId: string; numero: number };
          const atual = await tx.processoAssinaturaContratual.findUniqueOrThrow({ where: { id: payload.processoId }, select: { estado: true } });
          return { repetido: true as const, processoId: payload.processoId, numero: payload.numero, estado: atual.estado };
        }
      }
      const processo = await prepararProcessoEnvioTx(tx, { ...d, executorId: autor.id, fornecedor: provedor.fornecedor, ambiente: provedor.ambiente });
      const tentativa = await iniciarTentativaAssinaturaTx(tx, { processoId: processo.id, executorId: autor.id, ...(marca ? { marca } : {}) });
      const fonte = await tx.processoAssinaturaContratual.findUniqueOrThrow({ where: { id: processo.id },
        select: { fornecedor: true, ambiente: true, matricula: { select: { codigo: true } }, artefato: { select: { pdf: true, pdfHash: true } }, conferencia: { select: { snapshot: true } } } });
      if (fonte.fornecedor !== provedor.fornecedor || fonte.ambiente !== provedor.ambiente) throw new ErroRegra("O processo pertence a outro serviço ou ambiente de assinatura. Use a integração correspondente.");
      return { repetido: false as const, ...tentativa, codigo: fonte.matricula.codigo, pdf: fonte.artefato.pdf, pdfHash: fonte.artefato.pdfHash,
        signatarios: Signatarios.parse(fonte.conferencia.snapshot).participantes };
    }, { timeout: 30000 });
    if (aberto.repetido) return { processoId: aberto.processoId, tentativa: aberto.numero, estado: aberto.estado, repetido: true };
    const criado = await criarEnvelopeSemPresumir(provedor, {
      chave: chaveTentativa(aberto.tentativaId), nome: `Contrato ${aberto.codigo ?? d.matriculaId}`, pdf: new Uint8Array(aberto.pdf), pdfHash: aberto.pdfHash,
      // Q122: cliente/responsáveis assinam antes da escola.
      signatarios: aberto.signatarios.map((p) => ({ ...p, etapa: p.etapa === "CLIENTE" ? 1 : 2 })).sort((a, b) => a.etapa - b.etapa),
    });
    const registrado = await prisma.$transaction((tx) => registrarResultadoEnvioTx(tx, {
      processoId: aberto.processoId, tentativaId: aberto.tentativaId, chave: `criacao:${aberto.tentativaId}`, resultado: criado.resultado,
      referenciaExterna: criado.resultado === "REGISTRADO" ? criado.referenciaExterna : null, evidenciaHash: hashEvidenciaAssinatura(criado.evidencia),
    }), { timeout: 30000 });
    return { processoId: aberto.processoId, tentativa: aberto.numero, estado: registrado.estado, repetido: false };
  });
}

/**
 * Conciliação de ENVIANDO/ENVIO_INCERTO pela chave da tentativa atual. Só a resposta positiva do
 * serviço (encontrado ou ausente) muda o estado; dúvida mantém incerto.
 */
export async function conciliarEnvioAssinatura(input: z.input<typeof Conciliar>) {
  return executarAcao<{ processoId: string; estado: string; repetido: boolean }>(async () => {
    const autor = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA), { chaveIdempotencia, ...d } = Conciliar.parse(input), provedor = exigirProvedor();
    const marca = marcaIdempotencia(chaveIdempotencia, d);
    const pendente = await prisma.$transaction(async (tx) => {
      await conferirAutor(tx, autor.id);
      if (marca) {
        const anterior = await repeticaoIdempotente(tx, { tipo: "ResultadoEnvioAssinaturaRegistrado", agregadoTipo: "Matricula", autorId: autor.id, marca, mensagemConflito: CONFLITO });
        if (anterior) return { repetido: true as const, ...(anterior.payload as { processoId: string; estado: string }) };
      }
      const p = await tx.processoAssinaturaContratual.findFirst({ where: { id: d.processoId, matriculaId: d.matriculaId },
        select: { id: true, estado: true, fornecedor: true, ambiente: true, tentativaAtual: true, tentativas: { orderBy: { numero: "desc" }, take: 1, select: { id: true, numero: true, _count: { select: { observacoes: true } } } } } });
      if (!p) throw new ErroRegra("Processo de assinatura indisponível nesta matrícula.");
      if (p.estado !== "ENVIANDO" && p.estado !== "ENVIO_INCERTO") throw new ErroRegra("Este processo não possui envio pendente de conciliação.");
      if (p.fornecedor !== provedor.fornecedor || p.ambiente !== provedor.ambiente) throw new ErroRegra("O processo pertence a outro serviço ou ambiente de assinatura. Concilie pela integração correspondente.");
      const tentativa = p.tentativas[0];
      if (!tentativa || tentativa.numero !== p.tentativaAtual) throw new ErroRegra("Tentativa atual não encontrada para conciliação.");
      return { repetido: false as const, processoId: p.id, tentativaId: tentativa.id, sequencia: tentativa._count.observacoes + 1 };
    });
    if (pendente.repetido) return { processoId: pendente.processoId, estado: pendente.estado, repetido: true };
    const consulta = await consultarEnvelopeSemPresumir(provedor, chaveTentativa(pendente.tentativaId));
    const resultado = consulta.resultado === "ENCONTRADO" ? "REGISTRADO" as const : consulta.resultado === "AUSENTE" ? "NAO_CRIADO" as const : "INCERTO" as const;
    const registrado = await prisma.$transaction((tx) => registrarResultadoEnvioTx(tx, {
      processoId: pendente.processoId, tentativaId: pendente.tentativaId, chave: `conciliacao:${pendente.tentativaId}:${pendente.sequencia}`, resultado,
      referenciaExterna: consulta.resultado === "ENCONTRADO" ? consulta.referenciaExterna : null, evidenciaHash: hashEvidenciaAssinatura(consulta.evidencia),
      autorId: autor.id, ...(marca ? { marca } : {}),
    }), { timeout: 30000 });
    return { processoId: pendente.processoId, estado: registrado.estado, repetido: false };
  });
}

/** A tela só oferece envio/cancelamento integrados quando há driver; sem ele permanece o registro manual. */
export async function consultarIntegracaoAssinatura() {
  return executarAcao(async () => {
    await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA, Papel.ADMINISTRADOR);
    const provedor = provedorAssinaturaAtivo();
    return provedor ? { fornecedor: provedor.fornecedor, ambiente: provedor.ambiente, simulado: provedor.fornecedor === "SIMULADO" } : null;
  });
}

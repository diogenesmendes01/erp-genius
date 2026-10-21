"use server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra } from "@/server/_shared";
import { Papel } from "@prisma/client";
import { iniciarTentativaAditivoTx, prepararProcessoAditivoTx, registrarResultadoEnvioAditivoTx } from "./aditivo-envio-tx";
import { marcaIdempotencia, repeticaoIdempotente } from "@/server/_shared/idempotencia";
import { conferirAutor } from "./modelos-tx";
import { CamposDestinoAssinatura, consultarEnvelopeSemPresumir, criarEnvelopeSemPresumir, destinoAssinaturaCoerente, hashEvidenciaAssinatura, MENSAGEM_DESTINO_SIMULADO } from "./provedor-assinatura";
import { provedorAssinaturaAtivo } from "./provedor-assinatura-ativo";
const id = z.string().trim().min(1).max(100);
const Preparar = z.object({ ...CamposDestinoAssinatura, matriculaId: id, propostaId: id, artefatoId: id, conferenciaId: id }).strict().refine(destinoAssinaturaCoerente, MENSAGEM_DESTINO_SIMULADO);
export async function prepararProcessoAssinaturaAditivo(input: z.input<typeof Preparar>) { return executarAcao(async () => {
  const ator = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA), d = Preparar.parse(input);
  // O simulado só pode ser escolhido com o driver simulado ligado: fora dele, um processo SIMULADO nunca seria enviado.
  if (d.fornecedor === "SIMULADO" && provedorAssinaturaAtivo()?.fornecedor !== "SIMULADO") throw new ErroRegra("O serviço simulado só está disponível com a integração simulada ligada (ASSINATURA_DRIVER=simulado).");
  return prisma.$transaction(tx => prepararProcessoAditivoTx(tx, ator.id, d), { timeout: 30000 });
}); }
const PaginacaoObservacoes = z.object({
  matriculaId: id, propostaId: id, artefatoId: id,
  paginaTentativas: z.number().int().min(1).max(100000).default(1),
  tentativaObservacoes: z.number().int().min(1).max(100000).optional(),
  paginaObservacoes: z.number().int().min(1).max(100000).default(1),
}).strict();
const ordemObservacoes = [{ observadaEm: "desc" as const }, { id: "desc" as const }];
const selecaoObservacao = { id: true, resultado: true, referenciaExterna: true, observadaEm: true };

export async function consultarProcessoAssinaturaAditivo(input: z.input<typeof PaginacaoObservacoes>) {
  return executarAcao(async () => {
    const ator = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA);
    const d = PaginacaoObservacoes.parse(input);
    return prisma.$transaction(async tx => {
      const fresco = await tx.usuario.findUnique({ where: { id: ator.id }, select: { ativo: true, papeis: true } });
      if (!fresco?.ativo || !fresco.papeis.some(p => p === Papel.SECRETARIA_ACADEMICA || p === Papel.ADMINISTRADOR)) throw new ErroRegra("Permissão de Secretaria necessária.");
      const escopo = { id: d.artefatoId, propostaId: d.propostaId, proposta: { matriculaId: d.matriculaId } };
      if (!await tx.artefatoAditivoContratual.count({ where: escopo })) throw new ErroRegra("Original indisponível nesta matrícula e proposta.");

      const processo = await tx.processoAssinaturaAditivo.findFirst({
        where: { propostaId: d.propostaId, artefatoId: d.artefatoId, proposta: { matriculaId: d.matriculaId } },
        include: { tentativas: {
          orderBy: { numero: "desc" }, skip: (d.paginaTentativas - 1) * 20, take: 21,
          select: { numero: true, revisaoHash: true, iniciadaEm: true, observacoes: { take: 21, orderBy: ordemObservacoes, select: selecaoObservacao } },
        } },
      });
      if (!processo) return null;
      const tentativasDaPagina = processo.tentativas.slice(0, 20);
      const numeroObservacoes = d.tentativaObservacoes ?? tentativasDaPagina[0]?.numero ?? null;
      if (numeroObservacoes != null && !tentativasDaPagina.some(t => t.numero === numeroObservacoes)) {
        throw new ErroRegra("A tentativa solicitada não pertence à página de tentativas exibida.");
      }
      const tentativaObservacoes = numeroObservacoes == null ? null : await tx.tentativaEnvioAditivo.findFirst({
        where: { processoId: processo.id, numero: numeroObservacoes },
        select: { numero: true, observacoes: { skip: (d.paginaObservacoes - 1) * 20, take: 21, orderBy: ordemObservacoes, select: selecaoObservacao } },
      });
      if (numeroObservacoes != null && !tentativaObservacoes) throw new ErroRegra("Tentativa indisponível neste processo de assinatura.");

      return {
        id: processo.id, propostaId: processo.propostaId, artefatoId: processo.artefatoId, conferenciaId: processo.conferenciaId,
        fornecedor: processo.fornecedor, ambiente: processo.ambiente, estado: processo.estado, tentativaAtual: processo.tentativaAtual,
        referenciaExterna: processo.referenciaExterna, criadoEm: processo.criadoEm, paginaTentativas: d.paginaTentativas,
        temMaisTentativas: processo.tentativas.length > 20, tentativaObservacoes: numeroObservacoes, paginaObservacoes: d.paginaObservacoes,
        tentativas: tentativasDaPagina.map(t => {
          const observacoes = t.numero === tentativaObservacoes?.numero ? tentativaObservacoes.observacoes : t.observacoes;
          return { ...t, temMaisObservacoes: observacoes.length > 20, paginaObservacoes: t.numero === tentativaObservacoes?.numero ? d.paginaObservacoes : 1, observacoes: observacoes.slice(0, 20) };
        }),
      };
    });
  });
}

const AlvoProcesso = z.object({ matriculaId: id, propostaId: id, processoId: id, chaveIdempotencia: z.string().trim().min(8).max(200).optional() }).strict();
const SignatariosAditivo = z.object({ participantes: z.array(z.object({ papel: z.string().min(1), etapa: z.enum(["CLIENTE", "ESCOLA"]), identidade: z.object({ nome: z.string().min(1), email: z.string().email() }).passthrough() }).passthrough()).min(1) }).passthrough();
const chaveTentativaAditivo = (tentativaId: string) => `aditivo:${tentativaId}`;
const CONFLITO = "Esta solicitação já foi usada com outros dados. Atualize a página antes de repetir.";

function provedorDoProcesso(processo: { fornecedor: string; ambiente: string }) {
  const provedor = provedorAssinaturaAtivo();
  if (!provedor) throw new ErroRegra("A integração de assinatura eletrônica não está configurada. Conclua o processo pelo registro manual do documento assinado.");
  if (processo.fornecedor !== provedor.fornecedor || processo.ambiente !== provedor.ambiente) throw new ErroRegra("O processo foi preparado para outro serviço ou ambiente de assinatura. Use a integração correspondente.");
  return provedor;
}

/** Mesmo protocolo do contrato (`envio.ts`): tentativa confirmada antes da chamada externa, resultado em outra transação. */
export async function enviarAditivoParaAssinatura(input: z.input<typeof AlvoProcesso>) {
  return executarAcao<{ processoId: string; tentativa: number; estado: string; repetido: boolean }>(async () => {
    const ator = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA), { chaveIdempotencia, ...d } = AlvoProcesso.parse(input);
    const marca = marcaIdempotencia(chaveIdempotencia, d);
    const aberto = await prisma.$transaction(async tx => {
      if (marca) {
        const anterior = await repeticaoIdempotente(tx, { tipo: "TentativaAssinaturaAditivoIniciada", agregadoTipo: "Matricula", autorId: ator.id, marca, mensagemConflito: CONFLITO });
        if (anterior) {
          const payload = anterior.payload as { processoId: string; numero: number };
          const atual = await tx.processoAssinaturaAditivo.findUniqueOrThrow({ where: { id: payload.processoId }, select: { estado: true } });
          return { repetido: true as const, processoId: payload.processoId, numero: payload.numero, estado: atual.estado };
        }
      }
      const processo = await tx.processoAssinaturaAditivo.findFirst({ where: { id: d.processoId, propostaId: d.propostaId, proposta: { matriculaId: d.matriculaId } }, select: { id: true, fornecedor: true, ambiente: true } });
      if (!processo) throw new ErroRegra("Processo de assinatura indisponível nesta matrícula e proposta.");
      const provedor = provedorDoProcesso(processo);
      const tentativa = await iniciarTentativaAditivoTx(tx, ator.id, { processoId: processo.id, ...(marca ? { marca } : {}) });
      const fonte = await tx.processoAssinaturaAditivo.findUniqueOrThrow({ where: { id: processo.id }, select: { proposta: { select: { matricula: { select: { codigo: true } } } }, artefato: { select: { pdf: true, pdfHash: true } }, conferencia: { select: { snapshot: true } } } });
      return { repetido: false as const, ...tentativa, provedor, codigo: fonte.proposta.matricula.codigo, pdf: fonte.artefato.pdf, pdfHash: fonte.artefato.pdfHash, signatarios: SignatariosAditivo.parse(fonte.conferencia.snapshot).participantes };
    }, { timeout: 30000 });
    if (aberto.repetido) return { processoId: aberto.processoId, tentativa: aberto.numero, estado: aberto.estado, repetido: true };
    const criado = await criarEnvelopeSemPresumir(aberto.provedor, { chave: chaveTentativaAditivo(aberto.tentativaId), nome: `Aditivo ${aberto.codigo ?? d.matriculaId}`, pdf: new Uint8Array(aberto.pdf), pdfHash: aberto.pdfHash,
      // Q122: cliente/responsáveis assinam antes da escola.
      signatarios: aberto.signatarios.map(p => ({ papel: p.papel, etapa: p.etapa === "CLIENTE" ? 1 : 2, nome: p.identidade.nome, email: p.identidade.email })).sort((a, b) => a.etapa - b.etapa) });
    const registrado = await prisma.$transaction(tx => registrarResultadoEnvioAditivoTx(tx, { processoId: aberto.processoId, tentativaId: aberto.tentativaId, chave: `criacao:${aberto.tentativaId}`, resultado: criado.resultado,
      referenciaExterna: criado.resultado === "REGISTRADO" ? criado.referenciaExterna : null, evidenciaHash: hashEvidenciaAssinatura(criado.evidencia) }), { timeout: 30000 });
    return { processoId: aberto.processoId, tentativa: aberto.numero, estado: registrado.estado, repetido: false };
  });
}

/** Conciliação de ENVIANDO/ENVIO_INCERTO pela chave da tentativa atual; só resposta conclusiva muda o estado. */
export async function conciliarEnvioAditivo(input: z.input<typeof AlvoProcesso>) {
  return executarAcao<{ processoId: string; estado: string; repetido: boolean }>(async () => {
    const ator = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA), { chaveIdempotencia, ...d } = AlvoProcesso.parse(input);
    const marca = marcaIdempotencia(chaveIdempotencia, d);
    const pendente = await prisma.$transaction(async tx => {
      await conferirAutor(tx, ator.id);
      if (marca) {
        const anterior = await repeticaoIdempotente(tx, { tipo: "ResultadoEnvioAssinaturaAditivoRegistrado", agregadoTipo: "Matricula", autorId: ator.id, marca, mensagemConflito: CONFLITO });
        if (anterior) return { repetido: true as const, ...(anterior.payload as { processoId: string; estado: string }) };
      }
      const p = await tx.processoAssinaturaAditivo.findFirst({ where: { id: d.processoId, propostaId: d.propostaId, proposta: { matriculaId: d.matriculaId } },
        select: { id: true, estado: true, fornecedor: true, ambiente: true, tentativaAtual: true, tentativas: { orderBy: { numero: "desc" }, take: 1, select: { id: true, numero: true, _count: { select: { observacoes: true } } } } } });
      if (!p) throw new ErroRegra("Processo de assinatura indisponível nesta matrícula e proposta.");
      if (p.estado !== "ENVIANDO" && p.estado !== "ENVIO_INCERTO") throw new ErroRegra("Este processo não possui envio pendente de conciliação.");
      const tentativa = p.tentativas[0];
      if (!tentativa || tentativa.numero !== p.tentativaAtual) throw new ErroRegra("Tentativa atual não encontrada para conciliação.");
      return { repetido: false as const, provedor: provedorDoProcesso(p), processoId: p.id, tentativaId: tentativa.id, sequencia: tentativa._count.observacoes + 1 };
    });
    if (pendente.repetido) return { processoId: pendente.processoId, estado: pendente.estado, repetido: true };
    const consulta = await consultarEnvelopeSemPresumir(pendente.provedor, chaveTentativaAditivo(pendente.tentativaId));
    const registrado = await prisma.$transaction(tx => registrarResultadoEnvioAditivoTx(tx, { processoId: pendente.processoId, tentativaId: pendente.tentativaId, chave: `conciliacao:${pendente.tentativaId}:${pendente.sequencia}`,
      resultado: consulta.resultado === "ENCONTRADO" ? "REGISTRADO" : consulta.resultado === "AUSENTE" ? "NAO_CRIADO" : "INCERTO",
      referenciaExterna: consulta.resultado === "ENCONTRADO" ? consulta.referenciaExterna : null, evidenciaHash: hashEvidenciaAssinatura(consulta.evidencia),
      autorId: ator.id, ...(marca ? { marca } : {}) }), { timeout: 30000 });
    return { processoId: pendente.processoId, estado: registrado.estado, repetido: false };
  });
}

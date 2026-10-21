"use server";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra } from "@/server/_shared";
import { conferirAutor } from "./modelos-tx";
import { planejarExigenciasAssinatura } from "./exigencias-assinatura";
import { IdentidadeSignatarioSchema } from "./participantes-schema";
import { ConferirParticipantesAditivoSchema } from "./aditivo-participantes-schema";
import { conferirParticipantesAditivoTx } from "./aditivo-participantes-tx";
import { carregarContextoParticipantesAditivoTx } from "./aditivo-participantes-contexto";
import { hashSubstituicao } from "./substituicao-estado";

const id = z.string().trim().min(1).max(100), pagina = z.number().int().min(1).max(100000).default(1);
const entradaConsulta = z.object({ matriculaId: id, propostaId: id, pagina }).strict();
const entradaFormulario = z.object({ matriculaId: id, propostaId: id, maioridade: z.enum(["MAIOR", "MENOR"]).nullable(), paginaDocumentos: pagina }).strict();
const entradaConferencia = ConferirParticipantesAditivoSchema.innerType().extend({ matriculaId: id }).strict().superRefine((d, ctx) => {
  if (new Set(d.participantes.map(p => p.papel)).size !== d.participantes.length) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Identifique cada papel uma única vez." });
});
const identidadePublica = (valor: unknown) => { const r = IdentidadeSignatarioSchema.strip().safeParse(valor); return r.success ? r.data : null; };

export async function conferirParticipantesAditivo(input: z.input<typeof entradaConferencia>) {
  return executarAcao(async () => {
    const ator = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA), d = entradaConferencia.parse(input);
    return prisma.$transaction(async tx => {
      await conferirAutor(tx, ator.id);
      if (!await tx.propostaAditivoContratual.count({ where: { id: d.propostaId, matriculaId: d.matriculaId } })) throw new ErroRegra("Proposta indisponível nesta matrícula.");
      const { matriculaId, ...entrada } = d;
      void matriculaId;
      return conferirParticipantesAditivoTx(tx, ator.id, entrada);
    }, { timeout: 20000 });
  });
}

export async function consultarFormularioParticipantesAditivo(input: { matriculaId: string; propostaId: string; maioridade: "MAIOR" | "MENOR" | null; paginaDocumentos?: number }) {
  return executarAcao(async () => {
    const ator = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA), d = entradaFormulario.parse(input);
    return prisma.$transaction(async tx => {
      await conferirAutor(tx, ator.id);
      if (!await tx.propostaAditivoContratual.count({ where: { id: d.propostaId, matriculaId: d.matriculaId } })) throw new ErroRegra("Proposta indisponível nesta matrícula.");
      const contexto = await carregarContextoParticipantesAditivoTx(tx, d.propostaId);
      const ultima = await tx.conferenciaParticipantesAditivo.findFirst({ where: { propostaId: d.propostaId }, orderBy: { versao: "desc" }, select: { versao: true } });
      const documentos = await tx.documento.findMany({ where: { arquivado: false, url: { not: "" }, OR: [{ matriculaId: d.matriculaId }, ...(contexto.matricula.leadId ? [{ matriculaId: null, leadId: contexto.matricula.leadId }] : [])] }, orderBy: [{ criadoEm: "desc" }, { id: "desc" }], skip: (d.paginaDocumentos - 1) * 20, take: 21, select: { id: true, nome: true, categoria: true, url: true } });
      const plano = planejarExigenciasAssinatura(contexto.conteudo.assinaturas, { maioridade: d.maioridade, pagador: contexto.tipoPagador });
      const participantesSugeridos = plano.participantesExigidos.map(exigido => ({ ...exigido, automatico: exigido.papel === "ALUNO" || (exigido.papel === "RESPONSAVEL_FINANCEIRO" && contexto.tipoPagador !== "EMPRESA"), identidade: exigido.papel === "ALUNO" ? identidadePublica(contexto.identidadeAluno) : exigido.papel === "RESPONSAVEL_FINANCEIRO" && contexto.tipoPagador !== "EMPRESA" ? identidadePublica(contexto.dadosPagador) : null }));
      return { propostaId: contexto.proposta.id, propostaHash: contexto.proposta.entradaHash, versaoEsperada: ultima?.versao ?? 0,
        regras: contexto.conteudo.assinaturas, contexto: { maioridade: d.maioridade, tipoPagador: contexto.tipoPagador }, plano, participantesSugeridos,
        identidadesAutomaticas: { aluno: identidadePublica(contexto.identidadeAluno), pagador: contexto.tipoPagador === "EMPRESA" ? null : identidadePublica(contexto.dadosPagador) },
        documentos: documentos.filter(documento => documento.url.trim()).slice(0, 20).map(({ id, nome, categoria }) => ({ id, nome, categoria })), paginaDocumentos: d.paginaDocumentos, temProxima: documentos.length > 20 };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 20000 });
  });
}

const historicoSnapshot = z.object({ maioridade: z.object({ classificacao: z.enum(["MAIOR", "MENOR"]), criterio: z.string(), evidenciaDocumentoId: z.string() }).nullable(), documentos: z.array(z.object({ id: z.string(), nome: z.string(), categoria: z.string() }).strip()), participantes: z.array(z.object({ papel: z.string(), etapa: z.enum(["CLIENTE", "ESCOLA"]), origem: z.enum(["ALUNO", "PAGADOR", "REPRESENTANTE_CONFERIDO"]), identidade: IdentidadeSignatarioSchema, representacao: z.object({ descricao: z.string(), evidenciaDocumentoId: z.string() }).optional() }).strip()) }).strip();
export async function consultarConferenciasParticipantesAditivo(input: { matriculaId: string; propostaId: string; pagina?: number }) {
  return executarAcao(async () => {
    const ator = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA), d = entradaConsulta.parse(input);
    return prisma.$transaction(async tx => {
      await conferirAutor(tx, ator.id);
      if (!await tx.propostaAditivoContratual.count({ where: { id: d.propostaId, matriculaId: d.matriculaId } })) throw new ErroRegra("Proposta indisponível nesta matrícula.");
      const registros = await tx.conferenciaParticipantesAditivo.findMany({ where: { propostaId: d.propostaId }, orderBy: [{ versao: "desc" }, { id: "desc" }], skip: (d.pagina - 1) * 20, take: 21, select: { id: true, versao: true, motivo: true, criadaEm: true, revisaoHash: true, autor: { select: { nome: true } }, snapshot: true } });
      return { registros: registros.slice(0, 20).map(r => { if (hashSubstituicao(r.snapshot) !== r.revisaoHash) throw new ErroRegra("A conferência preservada exige conferência de integridade."); const s = historicoSnapshot.parse(r.snapshot), documentos = new Map(s.documentos.map(documento => [documento.id, { id: documento.id, nome: documento.nome, categoria: documento.categoria }])); const evidencia = (evidenciaDocumentoId: string) => { const documento = documentos.get(evidenciaDocumentoId); if (!documento) throw new ErroRegra("A evidência preservada não corresponde à conferência."); return documento; }; return { id: r.id, versao: r.versao, revisaoHash: r.revisaoHash, motivo: r.motivo, criadaEm: r.criadaEm, autor: r.autor.nome, maioridade: s.maioridade ? { classificacao: s.maioridade.classificacao, criterio: s.maioridade.criterio, evidencia: evidencia(s.maioridade.evidenciaDocumentoId) } : null, participantes: s.participantes.map(p => ({ papel: p.papel, etapa: p.etapa, origem: p.origem, identidade: p.identidade, representacao: p.representacao ? { descricao: p.representacao.descricao, evidencia: evidencia(p.representacao.evidenciaDocumentoId) } : null })) }; }), pagina: d.pagina, maisRegistros: registros.length > 20 };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  });
}

"use server";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra, registrarEvento } from "@/server/_shared";
import { bloquearMatriculas } from "@/server/financeiro/recebimentos";
import { conferirAutor } from "./modelos-tx";
import { carregarBasePrevia, hashPrevia } from "./previa-estado";
import { planejarExigenciasAssinatura } from "./exigencias-assinatura";
import { ConferirParticipantesSchema, IdentidadeSignatarioSchema } from "./participantes-schema";

export async function conferirParticipantesContratuais(input: z.input<typeof ConferirParticipantesSchema>) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA), d = ConferirParticipantesSchema.parse(input);
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`participantes-autor:${autor.id}`}, 0))`;
      const previa = await tx.previaDocumentoContratual.findUnique({ where: { id: d.previaId } });
      if (!previa) throw new ErroRegra("Prévia não encontrada.");
      await bloquearMatriculas(tx, [previa.matriculaId]); await conferirAutor(tx, autor.id);
      const repetida = await tx.conferenciaParticipantesContratuais.findUnique({ where: { autorId_chaveIdempotencia: { autorId: autor.id, chaveIdempotencia: d.chaveIdempotencia } } });
      if (repetida) {
        if (repetida.entradaHash !== hashPrevia(d)) throw new ErroRegra("Chave utilizada com outra conferência.");
        return { id: repetida.id, versao: repetida.versao };
      }
      const ultima = await tx.conferenciaParticipantesContratuais.findFirst({ where: { previaId: previa.id }, orderBy: { versao: "desc" } });
      if ((ultima?.versao ?? 0) !== d.versaoEsperada) throw new ErroRegra("Os participantes já receberam outra conferência. Atualize a revisão.");
      const m = await tx.matricula.findUniqueOrThrow({ where: { id: previa.matriculaId }, select: { alunoId: true, leadId: true } });
      await tx.$queryRaw`SELECT id FROM "Aluno" WHERE id = ${m.alunoId} FOR SHARE`;
      const base = await carregarBasePrevia(tx, previa.matriculaId, previa.modeloId);
      if (base.revisaoHash !== previa.conteudoHash) throw new ErroRegra("Dados ou condições mudaram desde a prévia. Revise e registre uma nova antes de conferir participantes.");
      const pagador = await tx.pagadorPreparacaoMatricula.findUniqueOrThrow({ where: { id: base.snapshot.pagadorRegistroId } });
      const tipoPagador = z.enum(["ALUNO", "RESPONSAVEL", "EMPRESA"]).parse(pagador.tipo);
      const plano = planejarExigenciasAssinatura(base.snapshot.assinaturasExigidas, { maioridade: d.maioridade?.classificacao ?? null, pagador: tipoPagador });
      if (plano.pendencias.length) throw new ErroRegra(plano.pendencias.join(" "));
      if (d.participantes.length !== plano.participantesExigidos.length || plano.participantesExigidos.some((p) => !d.participantes.some((v) => v.papel === p.papel))) throw new ErroRegra("Identifique exatamente os papéis exigidos pelo modelo neste caso.");
      const idsDocumentos = [...new Set([...(d.maioridade ? [d.maioridade.evidenciaDocumentoId] : []), ...d.participantes.flatMap((p) => p.representacao ? [p.representacao.evidenciaDocumentoId] : [])])].sort();
      if (idsDocumentos.length) await tx.$queryRaw`SELECT id FROM "Documento" WHERE id IN (${Prisma.join(idsDocumentos)}) ORDER BY id FOR SHARE`;
      const documentos = await tx.documento.findMany({ where: { id: { in: idsDocumentos }, arquivado: false,
        OR: [{ matriculaId: previa.matriculaId }, ...(m.leadId ? [{ matriculaId: null, leadId: m.leadId }] : [])] }, select: { id: true, nome: true, url: true, categoria: true } });
      if (documentos.length !== idsDocumentos.length || documentos.some((p) => !p.url.trim())) throw new ErroRegra("A evidência precisa ser um documento disponível desta contratação.");
      const aluno = await tx.aluno.findUniqueOrThrow({ where: { id: m.alunoId }, select: { primeiroNome: true, sobrenome: true, email: true, documento: true } });
      const participantes = plano.participantesExigidos.map((papel) => {
        const p = d.participantes.find((v) => v.papel === papel.papel)!;
        const usaAluno = p.papel === "ALUNO";
        const usaPagador = p.papel === "RESPONSAVEL_FINANCEIRO" && tipoPagador !== "EMPRESA";
        if (usaAluno || usaPagador) {
          if (p.representacao) throw new ErroRegra("Representação não substitui os dados do aluno ou pagador identificado.");
          const identidade = IdentidadeSignatarioSchema.strip().safeParse(usaAluno
            ? { nome: [aluno.primeiroNome, aluno.sobrenome].filter(Boolean).join(" "), email: aluno.email, documento: aluno.documento }
            : pagador.dados);
          if (!identidade.success) throw new ErroRegra("Complete nome, documento e e-mail do aluno/pagador antes da conferência.");
          if (hashPrevia(identidade.data) !== hashPrevia(p.identidade)) throw new ErroRegra("A identificação revisada difere do aluno/pagador registrado. Atualize a conferência.");
        } else if (!p.representacao) throw new ErroRegra("Registre a representação e sua evidência para a pessoa identificada.");
        return { ...p, etapa: papel.etapa, origem: usaAluno ? "ALUNO" : usaPagador ? "PAGADOR" : "REPRESENTANTE_CONFERIDO" };
      });
      const conferida = await tx.conferenciaParticipantesContratuais.create({ data: { previaId: previa.id, versao: d.versaoEsperada + 1, autorId: autor.id,
        snapshot: { previaHash: previa.conteudoHash, maioridade: d.maioridade, plano, participantes, documentos, identificacoesConferidas: true },
        motivo: d.motivo, chaveIdempotencia: d.chaveIdempotencia, entradaHash: hashPrevia(d) } });
      await registrarEvento(tx, { tipo: "ParticipantesContratuaisConferidos", agregadoTipo: "Matricula", agregadoId: previa.matriculaId, autorId: autor.id,
        payload: { previaId: previa.id, conferenciaId: conferida.id, versao: conferida.versao, papeis: participantes.map((p) => p.papel) } });
      return { id: conferida.id, versao: conferida.versao };
    });
  });
}

export async function consultarConferenciasParticipantes(input: { previaId: string; pagina?: number }) {
  return executarAcao(async () => {
    await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA);
    const d = z.object({ previaId: z.string().min(1), pagina: z.number().int().min(1).max(100000).default(1) }).strict().parse(input);
    const registros = await prisma.conferenciaParticipantesContratuais.findMany({ where: { previaId: d.previaId }, orderBy: { versao: "desc" }, skip: (d.pagina - 1) * 20, take: 21,
      select: { id: true, versao: true, snapshot: true, motivo: true, criadaEm: true, autor: { select: { id: true, nome: true } } } });
    return { registros: registros.slice(0, 20), pagina: d.pagina, temProxima: registros.length > 20 };
  });
}

export async function consultarFormularioParticipantes(input: { previaId: string; maioridade: "MAIOR" | "MENOR" | null }) {
  return executarAcao(async () => {
    await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA);
    const d = z.object({ previaId: z.string().min(1), maioridade: z.enum(["MAIOR", "MENOR"]).nullable() }).strict().parse(input);
    return prisma.$transaction(async (tx) => {
      const previa = await tx.previaDocumentoContratual.findUnique({ where: { id: d.previaId } });
      if (!previa) throw new ErroRegra("Prévia não encontrada.");
      const base = await carregarBasePrevia(tx, previa.matriculaId, previa.modeloId);
      if (base.revisaoHash !== previa.conteudoHash) throw new ErroRegra("A prévia está desatualizada. Registre outra antes de conferir os participantes.");
      const m = await tx.matricula.findUniqueOrThrow({ where: { id: previa.matriculaId }, select: { leadId: true,
        aluno: { select: { primeiroNome: true, sobrenome: true, email: true, documento: true } } } });
      const pagador = await tx.pagadorPreparacaoMatricula.findUniqueOrThrow({ where: { id: base.snapshot.pagadorRegistroId } });
      const tipo = z.enum(["ALUNO", "RESPONSAVEL", "EMPRESA"]).parse(pagador.tipo);
      const plano = planejarExigenciasAssinatura(base.snapshot.assinaturasExigidas, { maioridade: d.maioridade, pagador: tipo });
      const ultima = await tx.conferenciaParticipantesContratuais.findFirst({ where: { previaId: previa.id }, orderBy: { versao: "desc" }, select: { versao: true } });
      const documentos = await tx.documento.findMany({ where: { arquivado: false, OR: [{ matriculaId: previa.matriculaId }, ...(m.leadId ? [{ matriculaId: null, leadId: m.leadId }] : [])] }, orderBy: [{ criadoEm: "desc" }, { id: "desc" }], select: { id: true, nome: true, categoria: true } });
      const participantes = plano.participantesExigidos.map((p) => {
        const automatico = p.papel === "ALUNO" || (p.papel === "RESPONSAVEL_FINANCEIRO" && tipo !== "EMPRESA");
        const dados = p.papel === "ALUNO" ? { nome: [m.aluno.primeiroNome, m.aluno.sobrenome].filter(Boolean).join(" "), email: m.aluno.email, documento: m.aluno.documento } : pagador.dados;
        const identidade = automatico ? IdentidadeSignatarioSchema.strip().safeParse(dados) : null;
        return { ...p, automatico, identidade: identidade?.success ? identidade.data : null };
      });
      return { matriculaId: previa.matriculaId, previaId: previa.id, versaoEsperada: ultima?.versao ?? 0, maioridade: d.maioridade, plano, documentos, participantes };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  });
}

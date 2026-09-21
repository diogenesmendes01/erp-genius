"use server";
import { createHash } from "node:crypto";
import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra, ErroPermissao, registrarEvento } from "@/server/_shared";
import { bloquearMatriculas } from "@/server/financeiro/recebimentos";
import { dataCivilInstitucional, FusoInstitucionalSchema } from "@/server/operacao/fuso";
import { carregarHistoricosContratuais } from "@/server/diario/historico-contratual";
import { situacaoMatriculaNaAula } from "./historico-situacao";

const Entrada = z.object({ alunoId: z.string().min(1), matriculaId: z.string().min(1), programacaoId: z.string().min(1),
  motivo: z.string().trim().min(5).max(2000), evidencia: z.string().trim().min(5).max(2000), chaveIdempotencia: z.string().min(8).max(100) }).strict();

export async function consultarCumprimentosRecomposicao(input: { alunoId: string; matriculaId: string }) {
  return executarAcao(async () => {
    await exigirSessaoComPapel(Papel.FINANCEIRO);
    const d = z.object({ alunoId: z.string().min(1), matriculaId: z.string().min(1) }).strict().parse(input);
    const matricula = await prisma.matricula.findFirst({ where: { id: d.matriculaId, alunoId: d.alunoId }, select: { id: true } });
    if (!matricula) throw new ErroRegra("Matrícula não encontrada para este aluno.");
    const dias = await prisma.diaProgramadoRecomposicao.findMany({ where: { direito: { matriculaId: d.matriculaId } }, orderBy: [{ dataCobertura: "asc" }, { id: "asc" }],
      select: { id: true, dataCobertura: true, direito: { select: { diaOrigem: true, estado: true } },
        conferencias: { orderBy: [{ criadoEm: "asc" }, { id: "asc" }], select: { id: true, preparadorId: true, status: true, motivo: true, evidencia: true,
          motivoDecisao: true, decididaEm: true, preparador: { select: { nome: true } }, decisor: { select: { nome: true } } } } } });
    return dias.map((dia) => ({ id: dia.id, dataCobertura: dia.dataCobertura.toISOString().slice(0, 10), diaOrigem: dia.direito.diaOrigem.toISOString().slice(0, 10), estado: dia.direito.estado,
      conferencias: dia.conferencias.map((c) => ({ ...c, decididaEm: c.decididaEm?.toISOString() ?? null })) }));
  });
}

/** Registra evidência para conferência independente; não baixa o direito. */
export async function prepararCumprimentoRecomposicao(input: z.input<typeof Entrada>) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.FINANCEIRO);
    const d = Entrada.parse(input); const entradaHash = createHash("sha256").update(JSON.stringify(d)).digest("hex");
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`cumprimento:${autor.id}:${d.chaveIdempotencia}`}, 0))`;
      const u = await tx.usuario.findUnique({ where: { id: autor.id }, select: { ativo: true, papeis: true } });
      if (!u?.ativo || !u.papeis.some((p) => p === "FINANCEIRO" || p === "ADMINISTRADOR")) throw new ErroPermissao();
      const repetida = await tx.conferenciaCumprimentoRecomposicao.findUnique({ where: { preparadorId_chaveIdempotencia: { preparadorId: autor.id, chaveIdempotencia: d.chaveIdempotencia } } });
      if (repetida) {
        if (repetida.entradaHash !== entradaHash) throw new ErroRegra("Chave já usada para outra conferência.");
        return { id: repetida.id, status: repetida.status };
      }
      await bloquearMatriculas(tx, [d.matriculaId]);
      const programacao = await tx.diaProgramadoRecomposicao.findFirst({ where: { id: d.programacaoId, direito: { matriculaId: d.matriculaId, compensacao: { matricula: { alunoId: d.alunoId } } } }, include: { direito: true } });
      if (!programacao) throw new ErroRegra("Programação não encontrada para este aluno e matrícula.");
      await tx.$queryRaw`SELECT id FROM "DiaCompensacaoCobertura" WHERE id = ${programacao.direitoId} FOR UPDATE`;
      const direito = await tx.diaCompensacaoCobertura.findUniqueOrThrow({ where: { id: programacao.direitoId } });
      if (direito.estado !== "PENDENTE") throw new ErroRegra("Este direito já possui destinação concluída.");
      const config = await tx.configuracaoOperacional.findUnique({ where: { id: "escola" } });
      const fuso = FusoInstitucionalSchema.safeParse(config?.fusoInstitucional);
      if (!fuso.success) throw new ErroRegra("Configure o fuso institucional antes da conferência.");
      const hoje = dataCivilInstitucional(new Date(), fuso.data);
      if (programacao.dataCobertura.toISOString().slice(0, 10) >= hoje) throw new ErroRegra("Aguarde o término do dia de cobertura antes de conferir seu cumprimento.");
      if (await tx.conferenciaCumprimentoRecomposicao.count({ where: { programacaoId: programacao.id, status: "PENDENTE" } })) throw new ErroRegra("Já existe conferência aguardando decisão para este dia.");
      const snapshot = { matriculaId: d.matriculaId, alunoId: d.alunoId, programacaoId: programacao.id, aplicacaoId: programacao.aplicacaoId,
        dataCobertura: programacao.dataCobertura.toISOString().slice(0, 10), direitoId: direito.id, direitoVersao: direito.versao, estado: direito.estado,
        fuso: fuso.data, conferidoEm: hoje };
      const r = await tx.conferenciaCumprimentoRecomposicao.create({ data: { programacaoId: programacao.id, preparadorId: autor.id, motivo: d.motivo, evidencia: d.evidencia, chaveIdempotencia: d.chaveIdempotencia, entradaHash, snapshot } });
      await registrarEvento(tx, { tipo: "CumprimentoRecomposicaoPreparado", agregadoTipo: "Matricula", agregadoId: d.matriculaId, autorId: autor.id, payload: { conferenciaId: r.id, programacaoId: programacao.id } });
      return { id: r.id, status: r.status };
    });
  });
}

const Decisao = z.object({ alunoId: z.string().min(1), matriculaId: z.string().min(1), conferenciaId: z.string().min(1),
  aprovar: z.boolean(), motivo: z.string().trim().min(5).max(2000), evidenciaConferida: z.boolean() }).strict();

/** Atesta cobertura efetivamente oferecida; passagem do tempo nunca basta. */
export async function decidirCumprimentoRecomposicao(input: z.input<typeof Decisao>) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.FINANCEIRO);
    const d = Decisao.parse(input);
    if (d.aprovar && !d.evidenciaConferida) throw new ErroRegra("Confirme a conferência da evidência de oferta efetiva da cobertura.");
    return prisma.$transaction(async (tx) => {
      await bloquearMatriculas(tx, [d.matriculaId]);
      const u = await tx.usuario.findUnique({ where: { id: autor.id }, select: { ativo: true, papeis: true, permissoes: true } });
      if (!u?.ativo || (!u.papeis.includes("ADMINISTRADOR") && !(u.papeis.includes("FINANCEIRO") && u.permissoes.includes("financeiro.aprovar_acertos")))) throw new ErroPermissao("A decisão exige permissão de aprovação financeira.");
      const r = await tx.conferenciaCumprimentoRecomposicao.findFirst({ where: { id: d.conferenciaId,
        programacao: { direito: { matriculaId: d.matriculaId, compensacao: { matricula: { alunoId: d.alunoId } } } } }, include: { programacao: true } });
      if (!r) throw new ErroRegra("Conferência não encontrada para este aluno e matrícula.");
      if (r.preparadorId === autor.id) throw new ErroRegra("Outra pessoa deve decidir o cumprimento.");
      const status = d.aprovar ? "APROVADA" : "REJEITADA";
      if (r.status !== "PENDENTE") {
        if (r.status === status && r.decisorId === autor.id && r.motivoDecisao === d.motivo) return { id: r.id, status: r.status };
        throw new ErroRegra("Esta conferência já possui decisão registrada.");
      }
      if (d.aprovar) {
        await tx.$queryRaw`SELECT id FROM "DiaCompensacaoCobertura" WHERE id = ${r.programacao.direitoId} FOR UPDATE`;
        const direito = await tx.diaCompensacaoCobertura.findUniqueOrThrow({ where: { id: r.programacao.direitoId } });
        const s = z.object({ matriculaId: z.string(), alunoId: z.string(), programacaoId: z.string(), aplicacaoId: z.string(),
          dataCobertura: z.string(), direitoId: z.string(), direitoVersao: z.number().int(), estado: z.literal("PENDENTE"), fuso: FusoInstitucionalSchema }).parse(r.snapshot);
        const dia = r.programacao.dataCobertura.toISOString().slice(0, 10);
        const config = await tx.configuracaoOperacional.findUnique({ where: { id: "escola" } });
        if (s.matriculaId !== d.matriculaId || s.alunoId !== d.alunoId || s.programacaoId !== r.programacaoId || s.aplicacaoId !== r.programacao.aplicacaoId || s.dataCobertura !== dia || s.direitoId !== direito.id || s.direitoVersao !== direito.versao || direito.estado !== "PENDENTE" || config?.fusoInstitucional !== s.fuso) throw new ErroRegra("A origem mudou. Rejeite e prepare nova conferência.");
        if (dia >= dataCivilInstitucional(new Date(), s.fuso)) throw new ErroRegra("Aguarde o término do dia de cobertura.");
        // Localiza os limites civis sem presumir deslocamento UTC fixo ou dias de 24 horas.
        const limite = (posterior: boolean) => {
          let a = r.programacao.dataCobertura.getTime() - 172800000, b = a + 432000000;
          while (a < b) {
            const meio = Math.floor((a + b) / 2), civil = dataCivilInstitucional(new Date(meio), s.fuso);
            if (posterior ? civil <= dia : civil < dia) a = meio + 1; else b = meio;
          }
          return a;
        };
        const historico = (await carregarHistoricosContratuais(tx, [d.matriculaId])).get(d.matriculaId);
        if (!historico || [limite(false), limite(true) - 1].some((instante) => situacaoMatriculaNaAula(historico, new Date(instante)) !== "ATIVA")) throw new ErroRegra("A situação histórica da matrícula exige conferência: cobertura não pode ser baixada automaticamente.");
        await tx.diaCompensacaoCobertura.update({ where: { id: direito.id }, data: { estado: "RECOMPOSTO", versao: { increment: 1 }, destinacaoReferencia: r.id, destinadoEm: new Date() } });
      }
      const decidida = await tx.conferenciaCumprimentoRecomposicao.update({ where: { id: r.id }, data: { status, decisorId: autor.id, motivoDecisao: d.motivo, decididaEm: new Date() } });
      await registrarEvento(tx, { tipo: "CumprimentoRecomposicaoDecidido", agregadoTipo: "Matricula", agregadoId: d.matriculaId, autorId: autor.id,
        payload: { conferenciaId: r.id, programacaoId: r.programacaoId, status, evidenciaConferida: d.evidenciaConferida, motivo: d.motivo } });
      return { id: decidida.id, status: decidida.status };
    });
  });
}

"use server";
import { createHash } from "node:crypto";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroPermissao, ErroRegra, registrarEvento } from "@/server/_shared";
import { bloquearMatriculas } from "@/server/financeiro/recebimentos";

export async function consultarOcorrenciasParticular(input: { encontroId: string }) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.PROFESSOR);
    const d = z.object({ encontroId: z.string().min(1) }).strict().parse(input);
    return prisma.$transaction(async tx => {
      const u = await tx.usuario.findUnique({ where: { id: autor.id }, select: { ativo: true, papeis: true } });
      const e = await tx.encontroAgenda.findUnique({ where: { id: d.encontroId }, select: { id: true, finalidade: true, turmaId: true, matriculaId: true,
        professorId: true, inicio: true, fim: true, status: true, fusoOrigem: true } });
      if (!u?.ativo || !u.papeis.includes(Papel.PROFESSOR) || !e || e.professorId !== autor.id) throw new ErroPermissao();
      if (e.finalidade !== "AULA" || e.turmaId || !e.matriculaId) return null;
      const historico = await tx.ocorrenciaParticular.findMany({ where: { encontroId: e.id }, orderBy: { versao: "desc" },
        select: { id: true, versao: true, tipo: true, evidencia: true, comunicadoEm: true, criadoEm: true, autor: { select: { nome: true } } } });
      const cancelamento = e.status === "CANCELADO" ? await tx.decisaoCancelamentoParticular.findFirst({ where: { aprovada: true, proposta: { encontroId: e.id } }, select: { proposta: { select: { origem: true } } }, orderBy: { decididaEm: "desc" } }) : null;
      const conferidaFinanceiramente = !!await tx.conferenciaOcorrenciaHoras.count({ where: { encontroId: e.id } });
      return { encontroId: e.id, inicio: e.inicio.toISOString(), fim: e.fim.toISOString(), fuso: e.fusoOrigem,
        conferidaFinanceiramente, podeInformarAula: !conferidaFinanceiramente && ["PREVISTO", "MINISTRADO"].includes(e.status) && e.fim <= new Date(), podeInformarCancelamento: !conferidaFinanceiramente && !!cancelamento, origemCancelamento: cancelamento?.proposta.origem ?? null,
        versaoAtual: historico[0]?.versao ?? 0, historico: historico.map(o => ({ ...o, comunicadoEm: o.comunicadoEm?.toISOString() ?? null, criadoEm: o.criadoEm.toISOString() })) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  });
}

const Entrada = z.object({ encontroId: z.string().min(1), versaoAnterior: z.number().int().nonnegative(),
  tipo: z.enum(["REALIZADA", "FALTA_ALUNO", "CANCELAMENTO_ALUNO", "CANCELAMENTO_ESCOLA"]),
  comunicadoEm: z.string().datetime({ offset: true }).optional(), evidencia: z.string().trim().min(5).max(2000),
  chaveIdempotencia: z.string().min(8).max(100),
}).strict().refine(d => d.tipo.startsWith("CANCELAMENTO") === !!d.comunicadoEm, "Informe a comunicação somente para cancelamentos.");

/** Informe docente versionado. Não confirma cobrança, nota, presença ou consumo de horas. */
export async function registrarOcorrenciaParticular(input: z.input<typeof Entrada>) {
  return executarAcao(async () => {
    const usuario = await exigirSessaoComPapel(Papel.PROFESSOR), d = Entrada.parse(input);
    const hash = createHash("sha256").update(JSON.stringify(d)).digest("hex");
    return prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola', 0))`;
      const inicial = await tx.encontroAgenda.findUnique({ where: { id: d.encontroId }, select: { matriculaId: true } });
      if (!inicial?.matriculaId) throw new ErroRegra("Escolha uma particular contratada.");
      await bloquearMatriculas(tx, [inicial.matriculaId]);
      await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${usuario.id} FOR SHARE`;
      const u = await tx.usuario.findUnique({ where: { id: usuario.id }, select: { ativo: true, papeis: true } });
      await tx.$queryRaw`SELECT id FROM "EncontroAgenda" WHERE id = ${d.encontroId} FOR UPDATE`;
      const e = await tx.encontroAgenda.findUniqueOrThrow({ where: { id: d.encontroId } });
      if (e.finalidade !== "AULA") throw new ErroRegra("Recuperação não é particular contratada.");
      if (!u?.ativo || !u.papeis.includes(Papel.PROFESSOR) || e.professorId !== usuario.id || e.turmaId || e.matriculaId !== inicial.matriculaId) throw new ErroPermissao();
      const existente = await tx.ocorrenciaParticular.findUnique({ where: { autorId_chaveIdempotencia: { autorId: usuario.id, chaveIdempotencia: d.chaveIdempotencia } } });
      if (existente) {
        if (existente.entradaHash !== hash) throw new ErroRegra("Chave usada para outro informe.");
        return { id: existente.id, versao: existente.versao };
      }
      if (await tx.conferenciaOcorrenciaHoras.count({ where: { encontroId: e.id } })) throw new ErroRegra("Informe conferido. Alterações exigem revisão dos efeitos financeiros.");
      const anterior = await tx.ocorrenciaParticular.findFirst({ where: { encontroId: e.id }, orderBy: { versao: "desc" }, select: { versao: true } });
      if ((anterior?.versao ?? 0) !== d.versaoAnterior) throw new ErroRegra("O informe mudou. Confira a versão mais recente.");
      const agora = new Date(), comunicadoEm = d.comunicadoEm ? new Date(d.comunicadoEm) : null;
      if (comunicadoEm && comunicadoEm > agora) throw new ErroRegra("Comunicação não pode ser futura.");
      if (d.tipo.startsWith("CANCELAMENTO")) {
        if (e.status !== "CANCELADO" || !await tx.decisaoCancelamentoParticular.count({ where: { aprovada: true, proposta: { encontroId: e.id, origem: d.tipo === "CANCELAMENTO_ALUNO" ? "ALUNO" : "ESCOLA" } } })) throw new ErroRegra("Registre e obtenha aprovação pedagógica do cancelamento com a mesma origem antes de informar a ocorrência.");
      } else if (!["PREVISTO", "MINISTRADO"].includes(e.status) || e.fim > agora) throw new ErroRegra("Aguarde o término do encontro previsto.");
      const o = await tx.ocorrenciaParticular.create({ data: { encontroId: e.id, matriculaId: inicial.matriculaId, autorId: usuario.id,
        versao: d.versaoAnterior + 1, tipo: d.tipo, inicio: e.inicio, fim: e.fim, comunicadoEm, evidencia: d.evidencia,
        chaveIdempotencia: d.chaveIdempotencia, entradaHash: hash } });
      await registrarEvento(tx, { tipo: "OcorrenciaParticularInformada", agregadoTipo: "Matricula", agregadoId: inicial.matriculaId, autorId: usuario.id,
        payload: { ocorrenciaId: o.id, encontroId: e.id, versao: o.versao, tipo: o.tipo, conferenciaFinanceira: false } });
      return { id: o.id, versao: o.versao };
    });
  });
}

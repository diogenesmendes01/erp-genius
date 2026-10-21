"use server";
import { createHash } from "node:crypto";
import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroPermissao, ErroRegra, registrarEvento } from "@/server/_shared";
import { bloquearMatriculas } from "@/server/financeiro/recebimentos";
import { carregarApuracaoHorasTx } from "./fechamento-horas-tx";
import { resolverPeriodoFechamentoHoras } from "./fechamento-horas-periodo";
import { PreparacaoFechamentoHorasSchema as Entrada } from "./fechamento-horas-schema";


export async function prepararFechamentoHoras(input: z.input<typeof Entrada>) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.FINANCEIRO), d = Entrada.parse(input), periodo = resolverPeriodoFechamentoHoras(d.periodo);
    const entradaHash = createHash("sha256").update(JSON.stringify(d)).digest("hex");
    return prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola',0))`;
      await bloquearMatriculas(tx, [d.matriculaId]);
      await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id=${autor.id} FOR SHARE`;
      const u = await tx.usuario.findUnique({ where: { id: autor.id }, select: { ativo: true, papeis: true } });
      if (!u?.ativo || !u.papeis.some(p => p === Papel.FINANCEIRO || p === Papel.ADMINISTRADOR)) throw new ErroPermissao();
      const m = await tx.matricula.findFirst({ where: { id: d.matriculaId, alunoId: d.alunoId } });
      if (!m) throw new ErroRegra("Matrícula não encontrada para este aluno.");
      const anterior = await tx.rascunhoFechamentoHoras.findUnique({ where: { preparadorId_chaveIdempotencia: { preparadorId: autor.id, chaveIdempotencia: d.chaveIdempotencia } } });
      if (anterior) {
        if (anterior.entradaHash !== entradaHash) throw new ErroRegra("Chave utilizada para outro fechamento.");
        return { id: anterior.id, versao: anterior.versao, emiteCobranca: false as const };
      }
      if (!m.contratoOk || !m.confirmacaoContratoEm || m.contratoDocumentoId !== d.documentoId) throw new ErroRegra("Use o contrato confirmado da matrícula.");
      await tx.$queryRaw`SELECT id FROM "Documento" WHERE id=${d.documentoId} FOR SHARE`;
      if (!await tx.documento.count({ where: { id: d.documentoId, categoria: "CONTRATO", arquivado: false, OR: [{ matriculaId: m.id }, ...(m.leadId ? [{ leadId: m.leadId }] : [])] } })) throw new ErroRegra("Documento contratual indisponível.");
      const intervalo = { matriculaId: m.id, periodoInicio: new Date(periodo.inicioInstante), periodoFimExclusivo: new Date(periodo.fimExclusivo) };
      const ultima = await tx.rascunhoFechamentoHoras.findFirst({ where: intervalo, orderBy: { versao: "desc" }, select: { versao: true } });
      if ((ultima?.versao ?? 0) !== d.versaoAnterior) throw new ErroRegra("O fechamento tem outra versão. Atualize a conferência.");
      const apuracao = await carregarApuracaoHorasTx(tx, { alunoId: d.alunoId, matriculaId: m.id, periodo: { referencia: `${periodo.inicio}/${periodo.fim}`, inicio: periodo.inicioInstante, fimExclusivo: periodo.fimExclusivo }, vencimento: periodo.vencimento, escolha: d.escolha });
      const r = await tx.rascunhoFechamentoHoras.create({ data: { ...intervalo, documentoId: d.documentoId, preparadorId: autor.id, versao: d.versaoAnterior + 1,
        entrada: d, snapshot: { periodo, apuracao }, motivo: d.motivo, chaveIdempotencia: d.chaveIdempotencia, entradaHash } });
      await registrarEvento(tx, { tipo: "FechamentoHorasPreparado", agregadoTipo: "Matricula", agregadoId: m.id, autorId: autor.id,
        payload: { rascunhoId: r.id, versao: r.versao, estadoApuracao: apuracao.estado, total: apuracao.totalApurado, documentoId: d.documentoId } });
      return { id: r.id, versao: r.versao, emiteCobranca: false as const };
    });
  });
}

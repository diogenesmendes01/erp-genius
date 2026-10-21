"use server";
import { Papel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra } from "@/server/_shared";
import { conferirTurmaParaReserva } from "@/server/matricula/reserva-disponibilidade";
import { exigirPrecoPreparacaoAutorizado } from "@/server/matricula/preco-autorizado";

/** Diagnóstico, não autorização de emissão. Operações devem revalidar sob bloqueio. */
export async function consultarPendenciasPreparacao(matriculaId: string) {
  return executarAcao(async () => {
    await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA);
    z.string().min(1).parse(matriculaId);
    return prisma.$transaction(async (tx) => {
      const m = await tx.matricula.findUnique({ where: { id: matriculaId }, select: { status: true, secretariaAssumiuEm: true,
        preparacaoComercial: { select: { regime: true, referencias: true, reservaParticularId: true } },
        reservasVaga: { where: { status: { in: ["ATIVA", "MANTIDA_PENDENCIA"] } }, select: { id: true, status: true, expiraEm: true, turma: { select: { id: true, status: true, capacidade: true } } } },
        pagadoresPreparacao: { orderBy: { versao: "desc" }, take: 1, select: { id: true } } } });
      if (!m) throw new ErroRegra("Matrícula não encontrada.");
      const pendencias: { codigo: string; descricao: string }[] = [];
      const add = (codigo: string, descricao: string) => pendencias.push({ codigo, descricao });
      if (!["RASCUNHO", "AGUARDANDO"].includes(m.status)) add("ESTADO", "A matrícula não está em preparação.");
      if (!m.secretariaAssumiuEm) add("ASSUNCAO", "A Secretaria precisa assumir a matrícula.");
      if (!m.preparacaoComercial) add("PROPOSTA", "Falta o registro da preparação comercial.");
      else {
        try { await exigirPrecoPreparacaoAutorizado(tx, matriculaId); } catch (e) { if (!(e instanceof ErroRegra)) throw e; add("PRECO", e.message); }
        const regra = z.object({ politicaEntrada: z.object({ taxaPreviaAssinatura: z.boolean(), exigirPrimeiraMensalidade: z.boolean().nullable().optional(), adiantamentoHoraExigido: z.boolean().nullable() }) }).safeParse(m.preparacaoComercial.referencias);
        if (!regra.success || (m.preparacaoComercial.regime === "MENSALIDADE" ? regra.data.politicaEntrada.exigirPrimeiraMensalidade == null : regra.data.politicaEntrada.adiantamentoHoraExigido == null)) add("REGRA_ENTRADA", "Complete as regras de entrada desta preparação; a configuração atual não substitui o registro histórico.");
      }
      if (!m.pagadoresPreparacao.length) add("PAGADOR", "Identifique o pagador desta matrícula.");
      const reserva = m.reservasVaga[0];
      if (m.preparacaoComercial?.reservaParticularId) add("AGENDA_PARTICULAR", "A reserva particular está vinculada ao contrato e à emissão inicial. A ativação com consumo dos horários reservados ainda precisa ser concluída.");
      else if (!reserva) add("RESERVA", "A contratação precisa de uma reserva vigente.");
      else {
        if (reserva.status === "MANTIDA_PENDENCIA" || reserva.expiraEm <= new Date()) add("PRAZO_RESERVA", "Resolva a pendência de prazo da reserva antes de avançar.");
        const c = await conferirTurmaParaReserva(tx, reserva.turma, reserva.id);
        const mensagens: Record<string, string> = { TURMA_CONCLUIDA: "A turma está concluída.", AGENDA_NAO_PUBLICADA: "A agenda da turma precisa estar publicada.", PROFESSOR_INAPTO: "Confira o professor designado para os encontros.", DISPONIBILIDADE_NAO_CONFERIDA: "Resolva conflitos de horário ou indisponibilidade docente.", LIMITE_NAO_CONFIGURADO: "Configure a janela de entrada da turma.", JANELA_ENCERRADA: "O prazo de entrada terminou; ingresso com reserva anterior exige decisão pedagógica específica.", RESERVAS_NAO_CONFERIDAS: "Confira as reservas da turma.", SEM_VAGA: "A capacidade da turma não comporta esta contratação." };
        for (const codigo of c.conferencia.impedimentos) add(`AGENDA_${codigo}`, mensagens[codigo] ?? "Confira a disponibilidade da turma.");
      }
      return { pendencias, conferenciasBasicasAtendidas: pendencias.length === 0, emissaoAutorizada: false as const,
        proximasEtapas: "Conferir identificação/documentos, condições de cobrança e participantes contratuais. Este diagnóstico não emite cobranças nem libera assinatura." };
    }, { isolationLevel: "RepeatableRead", timeout: 20000 });
  });
}

"use server";

import { Papel, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, registrarEvento, ErroRegra, ErroPermissao, type Resultado } from "@/server/_shared";
import { exigirConferenciaIndependente } from "@/server/financeiro/regras";
import { reavaliarAcessoAutomaticoMatriculaTx } from "@/server/cobrancas/acesso-aulas";
import { bloquearCalendarioAluno, carregarEstadoRetomada } from "./estado";
import { exigirFluxoGlobalSemMovimentacaoContratual } from "@/server/matricula/limite-legado";
import { DecidirRetomadaSchema, SolicitarRetomadaSchema, dataRetomada, type DecidirRetomadaInput, type SolicitarRetomadaInput } from "./schema";
import { SnapshotRetomadaSchema, exigirSnapshotRetomadaAtual, impedimentoRetomada, montarSnapshotRetomada, validarDatasNaoRetroativas } from "./regras";

const SOLICITANTES: Papel[] = [Papel.SECRETARIA_ACADEMICA, Papel.FINANCEIRO, Papel.ADMINISTRADOR];
const APROVADORES: Papel[] = [Papel.FINANCEIRO, Papel.ADMINISTRADOR];

function revalidar(alunoId: string) {
  revalidatePath("/financeiro", "layout"); revalidatePath("/secretaria"); revalidatePath("/alunos", "layout");
  revalidatePath(`/alunos/${alunoId}/financeiro`);
}

async function exigirUsuarioAtual(tx: Prisma.TransactionClient, id: string, papeis: Papel[]) {
  const usuario = await tx.usuario.findUnique({ where: { id }, select: { ativo: true, papeis: true } });
  if (!usuario?.ativo || !usuario.papeis.some((papel) => papeis.includes(papel))) {
    throw new ErroPermissao("Um dos participantes perdeu a autorização para esta retomada. Rejeite a proposta e solicite uma nova.");
  }
}

export async function solicitarRetomada(alunoId: string, input: SolicitarRetomadaInput): Promise<Resultado<{ propostaId: string }>> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(...SOLICITANTES);
    const dados = SolicitarRetomadaSchema.parse(input);
    if (!alunoId.trim()) throw new ErroRegra("Aluno obrigatório.");
    const propostaId = await prisma.$transaction(async (tx) => {
      await bloquearCalendarioAluno(tx, alunoId);
      await exigirFluxoGlobalSemMovimentacaoContratual(tx, alunoId);
      await exigirUsuarioAtual(tx, autor.id, SOLICITANTES);
      const estado = await carregarEstadoRetomada(tx, alunoId);
      const impedimento = impedimentoRetomada(estado.aluno.status, estado.pausa?.id ?? null, estado.pausaRastreada, estado.matriculas);
      if (impedimento || !estado.pausa) throw new ErroRegra(impedimento ?? "Pausa não encontrada.");
      const pendente = await tx.propostaRetomada.findFirst({ where: { alunoId, status: "PENDENTE" } });
      if (pendente) {
        const anterior = SnapshotRetomadaSchema.safeParse(pendente.snapshot);
        const mesmasDatas = dados.opcao === "MANTER_VENCIMENTOS" || (anterior.success &&
          JSON.stringify([...anterior.data.alvos].sort((a, b) => a.cobrancaId.localeCompare(b.cobrancaId))) === JSON.stringify([...dados.novosVencimentos].sort((a, b) => a.cobrancaId.localeCompare(b.cobrancaId))
            .map((p) => ({ cobrancaId: p.cobrancaId, novoVencimento: dataRetomada(p.vencimento)!.toISOString() }))));
        if (pendente.solicitanteId === autor.id && pendente.pausaId === estado.pausa.id && pendente.opcao === dados.opcao && pendente.motivo === dados.motivo && mesmasDatas) return pendente.id;
        throw new ErroRegra("O aluno já tem uma proposta de retomada pendente. Aguarde a decisão ou solicite a rejeição antes de propor novamente.");
      }
      const snapshot = montarSnapshotRetomada(alunoId, estado.pausa.id, estado.matriculas, dados);
      const proposta = await tx.propostaRetomada.create({ data: {
        alunoId, pausaId: estado.pausa.id, opcao: dados.opcao, motivo: dados.motivo, solicitanteId: autor.id, snapshot,
      } });
      await registrarEvento(tx, { tipo: "RetomadaSolicitada", agregadoTipo: "Aluno", agregadoId: alunoId, autorId: autor.id,
        payload: { propostaId: proposta.id, pausaId: estado.pausa.id, opcao: dados.opcao, motivo: dados.motivo, parcelas: snapshot.alvos } });
      return proposta.id;
    });
    revalidar(alunoId);
    return { propostaId };
  });
}

export async function decidirRetomada(propostaId: string, input: DecidirRetomadaInput): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(...APROVADORES);
    const dados = DecidirRetomadaSchema.parse(input);
    if (!propostaId.trim()) throw new ErroRegra("Proposta obrigatória.");
    const alunoId = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "PropostaRetomada" WHERE id = ${propostaId} FOR UPDATE`;
      const proposta = await tx.propostaRetomada.findUnique({ where: { id: propostaId } });
      if (!proposta) throw new ErroRegra("Proposta não encontrada.");
      exigirConferenciaIndependente(proposta.solicitanteId, autor.id);
      await exigirUsuarioAtual(tx, autor.id, APROVADORES);
      const status = dados.aprovar ? "APROVADA" : "REJEITADA";
      if (proposta.status === status && proposta.aprovadorId === autor.id && proposta.motivoDecisao === dados.motivo) return proposta.alunoId;
      if (proposta.status !== "PENDENTE") throw new ErroRegra("Esta proposta já foi decidida.");
      const agora = new Date();
      if (dados.aprovar) {
        await bloquearCalendarioAluno(tx, proposta.alunoId);
        await exigirFluxoGlobalSemMovimentacaoContratual(tx, proposta.alunoId);
        await exigirUsuarioAtual(tx, autor.id, APROVADORES);
        await exigirUsuarioAtual(tx, proposta.solicitanteId, SOLICITANTES);
        const estado = await carregarEstadoRetomada(tx, proposta.alunoId);
        const impedimento = impedimentoRetomada(estado.aluno.status, estado.pausa?.id ?? null, estado.pausaRastreada, estado.matriculas);
        if (impedimento || !estado.pausa) throw new ErroRegra(impedimento ?? "Pausa não encontrada.");
        const parsed = SnapshotRetomadaSchema.safeParse(proposta.snapshot);
        if (!parsed.success) throw new ErroRegra("Proposta sem calendário verificável. Rejeite-a e solicite uma nova.");
        const snapshot = parsed.data;
        exigirSnapshotRetomadaAtual(snapshot, proposta.alunoId, estado.pausa.id, estado.matriculas);
        if (proposta.pausaId !== estado.pausa.id) throw new ErroRegra("A pausa mudou desde a proposta. Rejeite-a e solicite uma nova.");
        if (proposta.opcao === "REPROGRAMAR_PARCELAS") validarDatasNaoRetroativas(snapshot.alvos, agora);
        const cobrancas = new Map(estado.matriculas.flatMap((m) => m.cobrancas).map((c) => [c.id, c]));
        for (const alvo of snapshot.alvos) {
          const cobranca = cobrancas.get(alvo.cobrancaId)!;
          const restaurar = cobranca.status === "CANCELADA" && cobranca.canceladaPorPausaId === proposta.pausaId;
          const vencimento = proposta.opcao === "REPROGRAMAR_PARCELAS" ? new Date(alvo.novoVencimento) : cobranca.vencimento;
          const mudouVencimento = vencimento.getTime() !== cobranca.vencimento.getTime();
          if (!restaurar && !mudouVencimento) continue;
          const novoStatus = vencimento < agora ? "ATRASADO" : "PENDENTE";
          await tx.cobranca.update({ where: { id: cobranca.id }, data: {
            status: novoStatus, vencimento, versao: { increment: 1 },
            ...(mudouVencimento ? { cicloRegua: { increment: 1 } } : {}),
            ...(restaurar ? { canceladaPorPausaId: null } : {}),
          } });
          await registrarEvento(tx, { tipo: "CobrancaRetomada", agregadoTipo: "Cobranca", agregadoId: cobranca.id, autorId: autor.id,
            payload: { propostaId, pausaId: proposta.pausaId, opcao: proposta.opcao,
              de: { status: cobranca.status, vencimento: cobranca.vencimento.toISOString(), versao: cobranca.versao, cicloRegua: cobranca.cicloRegua },
              para: { status: novoStatus, vencimento: vencimento.toISOString(), versao: cobranca.versao + 1, cicloRegua: cobranca.cicloRegua + Number(mudouVencimento) } } });
          if (mudouVencimento) await registrarEvento(tx, { tipo: "CobrancaRenegociada", agregadoTipo: "Cobranca", agregadoId: cobranca.id, autorId: autor.id,
            payload: { origem: "RETOMADA", propostaId, novoVencimento: vencimento.toISOString(), motivo: proposta.motivo,
              cicloReguaDe: cobranca.cicloRegua, cicloReguaPara: cobranca.cicloRegua + 1, cicloRegua: cobranca.cicloRegua + 1 } });
        }
        await tx.aluno.update({ where: { id: proposta.alunoId }, data: { status: "ATIVO" } });
        await tx.movimentacaoAluno.create({ data: {
          alunoId: proposta.alunoId, tipo: "REATIVACAO", statusOrigem: "PAUSADO", statusDestino: "ATIVO",
          motivo: proposta.motivo, observacao: `Retomada aprovada: ${proposta.id}`, usuarioId: autor.id,
        } });
        for (const matricula of estado.matriculas.filter((m) => m.status === "ATIVA")) {
          await reavaliarAcessoAutomaticoMatriculaTx(tx, matricula.id, agora);
        }
        await registrarEvento(tx, { tipo: "AlunoReativado", agregadoTipo: "Aluno", agregadoId: proposta.alunoId, autorId: autor.id,
          payload: { propostaId, pausaId: proposta.pausaId, opcao: proposta.opcao, solicitanteId: proposta.solicitanteId, motivo: proposta.motivo } });
      }
      await tx.propostaRetomada.update({ where: { id: proposta.id }, data: {
        status, aprovadorId: autor.id, decididoEm: agora, motivoDecisao: dados.motivo,
      } });
      await registrarEvento(tx, { tipo: "RetomadaDecidida", agregadoTipo: "Aluno", agregadoId: proposta.alunoId, autorId: autor.id,
        payload: { propostaId, pausaId: proposta.pausaId, opcao: proposta.opcao, status, solicitanteId: proposta.solicitanteId, motivo: dados.motivo } });
      return proposta.alunoId;
    });
    revalidar(alunoId);
  });
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Papel, StatusCobranca, StatusSolicitacaoAcessoAulas } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  exigirSessaoComPapel,
  registrarEvento,
  executarAcao,
  ErroRegra,
  ErroPermissao,
  type Resultado,
} from "@/server/_shared";
import { bloquearMatriculas } from "@/server/financeiro/recebimentos";
import { exigirConferenciaIndependente } from "@/server/financeiro/regras";
import { acessoEfetivoBloqueado } from "./acesso-aulas-regras";
import { reavaliarAcessoAutomaticoMatriculaTx } from "./acesso-aulas";

// Ações da régua de cobrança (doc 24). O envio do lembrete/cobrança (WhatsApp + passo) fica em
// financeiro/acoes.ts (registrarCobrancaWhatsApp). Aqui: promessa de pagamento e bloqueio.

const PAPEIS_BAIXA: Papel[] = [Papel.FINANCEIRO, Papel.SECRETARIA_ACADEMICA];

const PromessaSchema = z.object({
  ate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}/, "Informe uma data válida (AAAA-MM-DD)."),
});

/**
 * Registra uma promessa de pagamento (doc 24 §D2): a cobrança fica DORMENTE na fila até a data
 * prometida. NÃO altera o vencimento (isso é renegociação, outro fluxo) — só adia via evento.
 */
export async function registrarPromessaPagamento(cobrancaId: string, ate: string): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(...PAPEIS_BAIXA);
    const { ate: ateStr } = PromessaSchema.parse({ ate });
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ateStr)!;
    const ateData = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
    if (isNaN(ateData.getTime())) throw new ErroRegra("Data prometida inválida.");
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    if (ateData < hoje) throw new ErroRegra("A data prometida não pode ser no passado.");

    const cobranca = await prisma.cobranca.findUnique({ where: { id: cobrancaId } });
    if (!cobranca) throw new ErroRegra("Cobrança não encontrada.");
    if (cobranca.status === StatusCobranca.PAGO || cobranca.status === StatusCobranca.CANCELADA)
      throw new ErroRegra("Cobrança já quitada ou cancelada.");

    await prisma.$transaction(async (tx) => {
      await registrarEvento(tx, {
        tipo: "PromessaPagamento",
        agregadoTipo: "Cobranca",
        agregadoId: cobrancaId,
        autorId: autor.id,
        payload: { ate: ateData.toISOString() },
      });
    });
    revalidatePath("/financeiro", "layout");
  });
}

const PedidoAcessoSchema = z.object({ matriculaId: z.string().min(1), bloquear: z.boolean(), motivo: z.string().trim().min(5, "Informe o motivo da solicitação (mínimo 5 caracteres).").max(2000) });

/** Solicitar não restringe: FIN/SEC propõe e outra pessoa da administração decide. */
async function solicitarAcesso(matriculaId: string, bloquear: boolean, motivo?: string): Promise<Resultado<{ solicitacaoId: string }>> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(...PAPEIS_BAIXA);
    const dados = PedidoAcessoSchema.parse({ matriculaId, bloquear, motivo });
    const solicitacaoId = await prisma.$transaction(async (tx) => {
      await bloquearMatriculas(tx, [matriculaId]);
      const matricula = await tx.matricula.findUnique({ where: { id: matriculaId } });
      if (!matricula) throw new ErroRegra("Matrícula não encontrada.");
      if (bloquear && matricula.status !== "ATIVA") throw new ErroRegra("Somente matrícula ativa recebe restrição manual de acesso.");
      if (matricula.acessoBloqueioManual === bloquear) throw new ErroRegra(bloquear ? "Já existe restrição manual nesta matrícula." : "A matrícula não tem restrição manual para liberar.");
      const pendente = await tx.solicitacaoAcessoAulas.findFirst({ where: { matriculaId, status: "PENDENTE" } });
      if (pendente) {
        if (pendente.solicitanteId === autor.id && pendente.bloquear === bloquear && pendente.motivo === dados.motivo && pendente.versaoMatricula === matricula.acessoVersao) return pendente.id;
        throw new ErroRegra("Esta matrícula já tem uma solicitação de acesso aguardando decisão.");
      }
      const pedido = await tx.solicitacaoAcessoAulas.create({ data: {
        matriculaId, bloquear, motivo: dados.motivo, solicitanteId: autor.id, versaoMatricula: matricula.acessoVersao,
      } });
      await registrarEvento(tx, {
        tipo: bloquear ? "RestricaoAulasSolicitada" : "LiberacaoAulasSolicitada", agregadoTipo: "Matricula", agregadoId: matriculaId,
        autorId: autor.id, payload: { solicitacaoId: pedido.id, motivo: dados.motivo, versaoMatricula: matricula.acessoVersao },
      });
      return pedido.id;
    });
    revalidatePath("/financeiro", "layout"); revalidatePath("/alunos", "layout");
    return { solicitacaoId };
  });
}

export async function bloquearAcesso(matriculaId: string, motivo?: string) {
  return solicitarAcesso(matriculaId, true, motivo);
}

export async function desbloquearAcesso(matriculaId: string, motivo?: string) {
  return solicitarAcesso(matriculaId, false, motivo);
}

export async function decidirSolicitacaoAcessoAulas(solicitacaoId: string, input: { aprovar: boolean; motivo: string }): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.ADMINISTRADOR);
    const dados = z.object({ aprovar: z.boolean(), motivo: z.string().trim().min(5, "Informe o motivo da decisão (mínimo 5 caracteres).").max(2000) }).parse(input);
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "SolicitacaoAcessoAulas" WHERE id = ${solicitacaoId} FOR UPDATE`;
      const pedido = await tx.solicitacaoAcessoAulas.findUnique({ where: { id: solicitacaoId }, include: { solicitante: { select: { ativo: true, papeis: true } } } });
      if (!pedido) throw new ErroRegra("Solicitação não encontrada.");
      exigirConferenciaIndependente(pedido.solicitanteId, autor.id);
      const status = dados.aprovar ? StatusSolicitacaoAcessoAulas.APROVADA : StatusSolicitacaoAcessoAulas.REJEITADA;
      if (pedido.status === status && pedido.aprovadorId === autor.id && pedido.motivoDecisao === dados.motivo) return;
      if (pedido.status !== "PENDENTE") throw new ErroRegra("Solicitação já decidida.");
      await bloquearMatriculas(tx, [pedido.matriculaId]);
      const agora = new Date();
      await reavaliarAcessoAutomaticoMatriculaTx(tx, pedido.matriculaId, agora);
      const matricula = await tx.matricula.findUniqueOrThrow({ where: { id: pedido.matriculaId } });
      if (dados.aprovar) {
        if (!pedido.solicitante.ativo || !pedido.solicitante.papeis.some((p) => p === Papel.ADMINISTRADOR || PAPEIS_BAIXA.includes(p))) throw new ErroPermissao("O solicitante perdeu a autorização. Rejeite a solicitação e registre um novo pedido.");
        if (matricula.acessoVersao !== pedido.versaoMatricula) throw new ErroRegra("A situação manual mudou. Rejeite a solicitação e registre um novo pedido.");
        if (pedido.bloquear && matricula.status !== "ATIVA") throw new ErroRegra("A matrícula não está mais ativa.");
        const bloqueado = acessoEfetivoBloqueado(pedido.bloquear, matricula.acessoBloqueioAutomatico);
        await tx.matricula.update({ where: { id: matricula.id }, data: {
          acessoBloqueioManual: pedido.bloquear, acessoBloqueado: bloqueado, acessoVersao: { increment: 1 },
          bloqueadoEm: bloqueado ? matricula.bloqueadoEm ?? agora : null,
        } });
        if (bloqueado !== matricula.acessoBloqueado) await registrarEvento(tx, {
          tipo: bloqueado ? "AcessoBloqueado" : "AcessoDesbloqueado", agregadoTipo: "Matricula", agregadoId: matricula.id, autorId: autor.id,
          payload: { origem: "MANUAL", solicitacaoId: pedido.id, solicitanteId: pedido.solicitanteId, motivo: pedido.motivo, motivoDecisao: dados.motivo },
        });
      }
      await tx.solicitacaoAcessoAulas.update({ where: { id: pedido.id }, data: { status, aprovadorId: autor.id, motivoDecisao: dados.motivo, decididoEm: agora } });
      await registrarEvento(tx, {
        tipo: "SolicitacaoAcessoAulasDecidida", agregadoTipo: "Matricula", agregadoId: matricula.id, autorId: autor.id,
        payload: { solicitacaoId: pedido.id, status, bloquear: pedido.bloquear, solicitanteId: pedido.solicitanteId, motivo: pedido.motivo, motivoDecisao: dados.motivo },
      });
    });
    revalidatePath("/financeiro", "layout"); revalidatePath("/alunos", "layout");
  });
}

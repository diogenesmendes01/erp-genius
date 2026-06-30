"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Papel, StatusCobranca } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  exigirSessaoComPapel,
  registrarEvento,
  executarAcao,
  ErroRegra,
  type Resultado,
} from "@/server/_shared";

// Ações da régua de cobrança (doc 24). O envio do lembrete/cobrança (WhatsApp + passo) fica em
// financeiro/acoes.ts (registrarCobrancaWhatsApp). Aqui: promessa de pagamento e bloqueio.

const PAPEIS_BAIXA: Papel[] = [Papel.FINANCEIRO, Papel.SECRETARIA_ACADEMICA];
// Bloqueio de acesso exige aprovação de nível gerencial (doc 24 §D+15) — NÃO o próprio cobrador.
const PAPEIS_BLOQUEIO: Papel[] = [Papel.GERENTE_COMERCIAL]; // + Admin (passa sempre)

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
    revalidatePath("/financeiro");
  });
}

/**
 * Bloqueia o acesso à aula da matrícula (régua D+15). Flag ortogonal ao status (segue ATIVA, só
 * perde acesso). Exige papel gerencial (aprovação humana, doc 24). Enforcement técnico é Fase 1+.
 */
export async function bloquearAcesso(matriculaId: string, motivo?: string): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(...PAPEIS_BLOQUEIO);
    await prisma.$transaction(async (tx) => {
      // Transição CONDICIONAL e atômica (review §3): só bloqueia quem está desbloqueado.
      // Evita evento duplicado em duplo-clique/double-submit (count==0 → ninguém mudou).
      const { count } = await tx.matricula.updateMany({
        where: { id: matriculaId, acessoBloqueado: false },
        data: { acessoBloqueado: true, bloqueadoEm: new Date() },
      });
      if (count === 0) throw new ErroRegra("Matrícula não encontrada ou acesso já bloqueado.");
      await registrarEvento(tx, {
        tipo: "AcessoBloqueado",
        agregadoTipo: "Matricula",
        agregadoId: matriculaId,
        autorId: autor.id,
        payload: { motivo: motivo || null },
      });
    });
    revalidatePath("/financeiro");
  });
}

/** Reverte o bloqueio de acesso (ex.: aluno regularizou). Mesma alçada do bloqueio. */
export async function desbloquearAcesso(matriculaId: string, motivo?: string): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(...PAPEIS_BLOQUEIO);
    await prisma.$transaction(async (tx) => {
      const { count } = await tx.matricula.updateMany({
        where: { id: matriculaId, acessoBloqueado: true },
        data: { acessoBloqueado: false, bloqueadoEm: null },
      });
      if (count === 0) throw new ErroRegra("Matrícula não encontrada ou acesso não estava bloqueado.");
      await registrarEvento(tx, {
        tipo: "AcessoDesbloqueado",
        agregadoTipo: "Matricula",
        agregadoId: matriculaId,
        autorId: autor.id,
        payload: { motivo: motivo || null },
      });
    });
    revalidatePath("/financeiro");
  });
}

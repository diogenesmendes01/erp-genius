"use server";

import { z } from "zod";
import { Papel } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroRegra, ErroPermissao, registrarEvento } from "@/server/_shared";
import { bloquearMatriculas } from "@/server/financeiro/recebimentos";
import { CoberturaInicialSchema, DataCivilSchema, periodoMensalNaData } from "@/server/matricula/cobertura";
import { carregarFusoInstitucionalTx } from "@/server/operacao/relogio";
import { dataCivilInstitucional } from "@/server/operacao/fuso";

const Entrada = z.object({ matriculaId: z.string().min(1), cobrancaId: z.string().min(1), versaoEsperada: z.number().int().nonnegative(), cobertura: CoberturaInicialSchema, primeiroVencimento: DataCivilSchema, motivo: z.string().trim().min(5).max(2000) }).strict();

/** Completa a preparação; condições já aceitas exigem o fluxo documental de alteração. */
export async function conferirCoberturaInicial(input: z.input<typeof Entrada>) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.SECRETARIA_ACADEMICA);
    const dados = Entrada.parse(input);
    await prisma.$transaction(async (tx) => {
      await bloquearMatriculas(tx, [dados.matriculaId]);
      await tx.$queryRaw`SELECT id FROM "Cobranca" WHERE "matriculaId" = ${dados.matriculaId} ORDER BY id FOR UPDATE`;
      const atual = await tx.usuario.findUnique({ where: { id: autor.id }, select: { ativo: true, papeis: true } });
      if (!atual?.ativo || !atual.papeis.some((p) => p === Papel.SECRETARIA_ACADEMICA || p === Papel.ADMINISTRADOR)) throw new ErroPermissao();
      const m = await tx.matricula.findUnique({ where: { id: dados.matriculaId }, include: { cobrancas: { where: { tipo: "MENSALIDADE" }, include: { recebimentos: { select: { id: true } }, informes: { where: { status: "A_CONFERIR" }, select: { id: true } } } } } });
      if (!m || !m.secretariaAssumiuEm || !["AGUARDANDO", "RASCUNHO"].includes(m.status)) throw new ErroRegra("Assuma a matrícula em preparação antes de conferir a cobertura.");
      if (m.contratoOk || m.confirmacaoContratoEm) throw new ErroRegra("Condições já aceitas exigem alteração contratual autorizada.");
      if (m.cobrancas.length !== 1) throw new ErroRegra("Confira o cronograma antes de alterar a cobertura inicial.");
      const c = m.cobrancas[0];
      if (c.id !== dados.cobrancaId || c.versao !== dados.versaoEsperada) throw new ErroRegra("A mensalidade mudou desde a consulta. Atualize a tela e confira novamente.");
      if (!["PENDENTE", "ATRASADO"].includes(c.status) || c.recebimentos.length || c.informes.length || Number(c.valorRecebido ?? 0) !== 0) throw new ErroRegra("Mensalidade com pagamento ou comprovante exige conferência financeira antes de alterar suas condições.");
      const periodo = periodoMensalNaData(dados.cobertura.referencia === "MES_CIVIL" ? { referencia: "MES_CIVIL" } : { referencia: "CICLO_MATRICULA", dataReferencia: dados.cobertura.inicio }, dados.cobertura.inicio);
      const inicio = new Date(`${periodo.inicio}T00:00:00Z`), fim = new Date(`${periodo.fim}T00:00:00Z`);
      const fuso = await carregarFusoInstitucionalTx(tx);
      if (!fuso) throw new ErroRegra("Configure o fuso institucional antes de conferir o vencimento.");
      const [ano, mes, dia] = dados.primeiroVencimento.split("-").map(Number);
      const vencimento = new Date(ano, mes - 1, dia, 12);
      const status = dados.primeiroVencimento < dataCivilInstitucional(new Date(), fuso) ? "ATRASADO" : "PENDENTE";
      await tx.matricula.update({ where: { id: m.id }, data: { referenciaCobertura: dados.cobertura.referencia, dataReferenciaCobertura: dados.cobertura.referencia === "CICLO_MATRICULA" ? inicio : null } });
      await tx.cobranca.update({ where: { id: c.id }, data: { coberturaInicio: inicio, coberturaFim: fim, vencimento, competencia: dados.primeiroVencimento.slice(0, 7), status, versao: { increment: 1 } } });
      await registrarEvento(tx, { tipo: "CoberturaInicialConferida", agregadoTipo: "Matricula", agregadoId: m.id, autorId: autor.id, payload: {
        motivo: dados.motivo, cobrancaId: c.id,
        anterior: { referencia: m.referenciaCobertura, dataReferencia: m.dataReferenciaCobertura?.toISOString() ?? null, inicio: c.coberturaInicio?.toISOString() ?? null, fim: c.coberturaFim?.toISOString() ?? null, vencimento: c.vencimento.toISOString(), competencia: c.competencia, status: c.status },
        atual: { referencia: dados.cobertura.referencia, inicio: periodo.inicio, fim: periodo.fim, vencimento: dados.primeiroVencimento, status },
      } });
    });
    revalidatePath("/secretaria"); revalidatePath("/alunos", "layout");
  });
}

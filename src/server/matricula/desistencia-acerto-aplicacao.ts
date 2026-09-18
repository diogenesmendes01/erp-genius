"use server";

import { Papel, Prisma, StatusCobranca } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroPermissao, ErroRegra, registrarEvento, type Resultado } from "@/server/_shared";
import { bloquearMatriculas } from "@/server/financeiro/recebimentos";

const entradaSchema = z.object({
  decisaoId: z.string().trim().min(1).max(100),
  chaveIdempotencia: z.string().trim().min(8).max(100),
}).strict();

type Item = { cobrancaId: string; moeda: string; devido: string; saldoDevido: string; creditoApurado: string };

function itensDaMemoria(memoria: Prisma.JsonValue): Item[] {
  const itens = z.array(z.object({
    cobrancaId: z.string(), moeda: z.string(), devido: z.string().regex(/^\d+\.\d{2}$/),
    saldoDevido: z.string().regex(/^\d+\.\d{2}$/), creditoApurado: z.string().regex(/^\d+\.\d{2}$/),
    creditoJaApurado: z.string().regex(/^\d+\.\d{2}$/),
  }).strict()).parse((memoria as { itens?: unknown }).itens);
  return itens;
}

async function exigirExecutorTx(tx: Prisma.TransactionClient, usuarioId: string) {
  const usuario = await tx.usuario.findUnique({ where: { id: usuarioId }, select: { ativo: true, papeis: true, permissoes: true } });
  if (!usuario?.ativo || (!usuario.papeis.includes(Papel.ADMINISTRADOR)
    && (!usuario.papeis.includes(Papel.FINANCEIRO) || !usuario.permissoes.includes("financeiro.aprovar_acertos")))) {
    throw new ErroPermissao();
  }
}

/** Materializa os valores aprovados antes de a Secretaria efetivar a desistência.
 * A migration Q241 confirma no commit cada cobrança, origem e crédito criados. */
export async function aplicarAcertoDesistenciaContratual(input: z.input<typeof entradaSchema>): Promise<Resultado<{ id: string }>> {
  return executarAcao(async () => {
    const sessao = await exigirSessaoComPapel(Papel.FINANCEIRO, Papel.ADMINISTRADOR);
    const dados = entradaSchema.parse(input);
    return prisma.$transaction(async (tx) => {
      const decisao = await tx.decisaoAcertoDesistenciaContratual.findUnique({
        where: { id: dados.decisaoId },
        include: { proposta: { include: { pedido: true } }, aplicacao: true },
      });
      if (!decisao?.aprovada) throw new ErroRegra("A decisão contratual aprovada não foi encontrada.");
      await bloquearMatriculas(tx, [decisao.proposta.pedido.matriculaId]);
      await exigirExecutorTx(tx, sessao.id);
      if (decisao.decisorId !== sessao.id) throw new ErroRegra("A aplicação deve ser executada pela pessoa que aprovou o acerto.");
      const anterior = await tx.aplicacaoAcertoDesistenciaContratual.findUnique({
        where: { executorId_chaveIdempotencia: { executorId: sessao.id, chaveIdempotencia: dados.chaveIdempotencia } },
      });
      if (anterior) {
        if (anterior.decisaoId !== decisao.id) throw new ErroRegra("Chave de idempotência já usada em outra aplicação contratual.");
        return { id: anterior.id };
      }
      if (decisao.aplicacao) throw new ErroRegra("Esta decisão contratual já foi aplicada.");
      const administrativa = await tx.decisaoAdministrativaDesistencia.findUnique({
        where: { pedidoId: decisao.proposta.pedidoId },
        select: { aprovada: true, estadoHash: true, decisorId: true },
      });
      const administrador = administrativa && await tx.usuario.findUnique({ where: { id: administrativa.decisorId }, select: { ativo: true, papeis: true } });
      if (!administrativa?.aprovada || administrativa.estadoHash !== decisao.proposta.estadoHash ||
        administrativa.decisorId === decisao.proposta.pedido.registradorId || !administrador?.ativo || !administrador.papeis.includes(Papel.ADMINISTRADOR)) {
        throw new ErroRegra("A aplicação Q165 exige decisão administrativa aprovada e independente para este pedido.");
      }
      const itens = itensDaMemoria(decisao.proposta.memoria);
      const cobrancas = await tx.cobranca.findMany({
        where: { matriculaId: decisao.proposta.pedido.matriculaId }, orderBy: { id: "asc" },
      });
      if (cobrancas.length !== itens.length) throw new ErroRegra("As cobranças mudaram; prepare novo acerto contratual.");
      const aplicacao = await tx.aplicacaoAcertoDesistenciaContratual.create({ data: {
        decisaoId: decisao.id, executorId: sessao.id, memoria: decisao.proposta.memoria as Prisma.InputJsonObject,
        condicoesHash: decisao.proposta.condicoesHash, fotografiaHash: decisao.proposta.fotografiaHash,
        chaveIdempotencia: dados.chaveIdempotencia,
      } });
      const agora = new Date();
      for (const item of itens) {
        const cobranca = cobrancas.find((atual) => atual.id === item.cobrancaId);
        if (!cobranca || cobranca.moeda !== item.moeda) throw new ErroRegra("A cobrança não corresponde à memória aprovada.");
        const saldo = new Prisma.Decimal(item.saldoDevido);
        await tx.cobranca.update({ where: { id: cobranca.id }, data: {
          valorNegociado: new Prisma.Decimal(item.devido), saldo,
          status: saldo.isZero() ? StatusCobranca.PAGO : (cobranca.vencimento < agora ? StatusCobranca.ATRASADO : StatusCobranca.PENDENTE),
          pagoEm: saldo.isZero() ? (cobranca.pagoEm ?? agora) : null,
          versao: { increment: 1 },
        } });
        const credito = new Prisma.Decimal(item.creditoApurado);
        if (credito.gt(0)) {
          const origem = await tx.origemCreditoAcertoDesistenciaContratual.create({ data: {
            aplicacaoId: aplicacao.id, matriculaId: decisao.proposta.pedido.matriculaId,
            cobrancaId: cobranca.id, valor: credito, moeda: item.moeda,
          } });
          await tx.creditoMatricula.create({ data: {
            matriculaId: decisao.proposta.pedido.matriculaId, origemAcertoDesistenciaContratualId: origem.id,
            valorInicial: credito, moeda: item.moeda,
          } });
        }
      }
      await registrarEvento(tx, { tipo: "AcertoDesistenciaContratualAplicado", agregadoTipo: "Matricula",
        agregadoId: decisao.proposta.pedido.matriculaId, autorId: sessao.id,
        payload: { decisaoId: decisao.id, aplicacaoId: aplicacao.id },
      });
      await tx.$executeRaw`SET CONSTRAINTS ALL IMMEDIATE`;
      return { id: aplicacao.id };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  });
}

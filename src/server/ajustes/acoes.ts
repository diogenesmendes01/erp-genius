"use server";

import { revalidatePath } from "next/cache";
import { Papel, Prisma, TipoAjuste, TipoAprovacao, StatusAprovacao, StatusCobranca, StatusComissao, Vigencia, TipoCobranca } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { nomeCompleto } from "@/lib/nome";
import { exigirSessaoComPapel, registrarEvento, executarAcao, ErroRegra, ErroPermissao, validarDirecaoAjuste, numero, type Resultado, type UsuarioSessao } from "@/server/_shared";
import { exigirEscopoAjuste, exigirEscopoAprovacao } from "@/server/financeiro/acesso";
import { bloquearCobranca, bloquearMatriculas } from "@/server/financeiro/recebimentos";
import { dinheiro, saldoAtual, descontoAcumulado, exigirConferenciaIndependente } from "@/server/financeiro/regras";
import { limitesAtuais, exigeAprovacaoComponente } from "@/server/financeiro/politica";
import { AjusteSchema, DecisaoSchema, type AjusteInput, type DecisaoInput } from "./schema";

function revalidar() {
  revalidatePath("/financeiro"); revalidatePath("/alunos", "layout");
}

const SnapshotSchema = z.object({
  alunoId: z.string(), alunoNome: z.string(), moeda: z.string(),
  valorDe: z.number(), valorPara: z.number(), descontoValor: z.number(),
  tipo: z.nativeEnum(TipoAjuste), exigeDirecao: z.boolean(),
  alvos: z.array(z.object({
    id: z.string(), versao: z.number().int(), valorDe: z.number(), valorPara: z.number(), referencia: z.number(),
    novoVencimento: z.string().nullable(),
  })).min(1),
});
type Snapshot = z.infer<typeof SnapshotSchema>;

async function aplicarAlvos(tx: Prisma.TransactionClient, autor: UsuarioSessao, snapshot: Snapshot, motivo: string, vigencia: Vigencia, aprovacaoId?: string) {
  // Mesma ordem da ativação/negociação: lead, matrícula, cobranças e comissões.
  // A aprovação não pode alterar a base enquanto a ativação monta o cronograma.
  const vinculos = await tx.cobranca.findMany({ where: { id: { in: snapshot.alvos.map((alvo) => alvo.id) } }, select: { matriculaId: true } });
  await bloquearMatriculas(tx, vinculos.map((vinculo) => vinculo.matriculaId));
  for (const alvo of [...snapshot.alvos].sort((a,b) => a.id.localeCompare(b.id))) {
    const cobranca = await bloquearCobranca(tx, alvo.id);
    if (cobranca.versao !== alvo.versao || !cobranca.valorNegociado.equals(alvo.valorDe) || !cobranca.valorOriginal.equals(alvo.referencia)) {
      throw new ErroRegra("A cobrança mudou desde a solicitação. Envie um novo pedido.");
    }
    if (cobranca.status === StatusCobranca.PAGO || cobranca.status === StatusCobranca.CANCELADA) throw new ErroRegra("Cobrança paga ou cancelada não aceita este ajuste.");
    // O fechamento também bloqueia as comissões. Reler após o lock preserva uma
    // comissão que tenha sido paga enquanto este ajuste aguardava sua vez.
    await tx.$queryRaw`SELECT id FROM "Comissao" WHERE "matriculaId" = ${cobranca.matriculaId} ORDER BY id FOR UPDATE`;
    const matricula = await tx.matricula.findUniqueOrThrow({ where: { id: cobranca.matriculaId }, include: { produto: { select: { modalidadeId: true } }, comissoes: true } });
    const valor = dinheiro(alvo.valorPara);
    if (cobranca.valorLiquidadoCredito.gt(0) && valor.lt(dinheiro(cobranca.valorRecebido ?? 0).plus(cobranca.valorLiquidadoCredito))) throw new ErroRegra("O ajuste exige revisar as utilizações de crédito e o valor já liquidado.");
    const saldo = saldoAtual(valor, cobranca.valorRecebido, cobranca.valorLiquidadoCredito);
    const vencimento = alvo.novoVencimento ? new Date(alvo.novoVencimento) : cobranca.vencimento;
    await tx.cobranca.update({ where: { id: cobranca.id }, data: {
      valorNegociado: valor, saldo, versao: { increment: 1 }, vencimento,
      status: snapshot.tipo === TipoAjuste.PERDAO ? StatusCobranca.CANCELADA : saldo.isZero() ? StatusCobranca.PAGO : vencimento < new Date() ? StatusCobranca.ATRASADO : StatusCobranca.PENDENTE,
      pagoEm: saldo.isZero() && snapshot.tipo !== TipoAjuste.PERDAO ? (cobranca.pagoEm ?? new Date()) : null,
    } });
    await tx.ajusteFinanceiro.create({ data: {
      matriculaId: matricula.id, cobrancaId: cobranca.id, tipo: snapshot.tipo,
      valorDe: cobranca.valorNegociado, valorPara: valor, descontoValor: cobranca.valorNegociado.minus(valor),
      descontoPct: descontoAcumulado(cobranca.valorOriginal, valor).toDecimalPlaces(2), moeda: cobranca.moeda,
      vigencia, motivo, autorId: autor.id, aprovacaoId: aprovacaoId ?? null,
      vendedorId: matricula.comissoes[0]?.vendedorId ?? null, paisId: matricula.paisId, modalidadeId: matricula.produto.modalidadeId,
    } });
    if (cobranca.tipo === TipoCobranca.MATRICULA) {
      for (const comissao of matricula.comissoes) {
        // Comissão fixa e comissões já liquidadas preservam seu valor histórico.
        if (comissao.tipo !== "PERCENTUAL" || !([StatusComissao.PENDENTE, StatusComissao.APROVADA] as StatusComissao[]).includes(comissao.status)) continue;
        const novo = dinheiro(valor.mul(comissao.percentual).div(100));
        await tx.comissao.update({ where: { id: comissao.id }, data: { valor: novo, valorBase: valor } });
        await registrarEvento(tx, { tipo: "ComissaoRecalculada", agregadoTipo: "Comissao", agregadoId: comissao.id,
          autorId: autor.id, payload: { ajusteAprovacaoId: aprovacaoId ?? null, de: numero(comissao.valor), para: novo.toNumber(), base: valor.toNumber(), politicaId: comissao.politicaId } });
      }
    }
    await registrarEvento(tx, { tipo: snapshot.tipo === TipoAjuste.PERDAO ? "CobrancaPerdoada" : "CobrancaRenegociada",
      agregadoTipo: "Cobranca", agregadoId: cobranca.id, autorId: autor.id,
      payload: { de: alvo.valorDe, para: alvo.valorPara, saldo: saldo.toNumber(), vigencia, motivo, aprovacaoId: aprovacaoId ?? null, novoVencimento: alvo.novoVencimento } });
  }
}

export async function ajustarCobranca(input: AjusteInput): Promise<Resultado<{ aprovacao: boolean }>> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.VENDEDOR, Papel.GERENTE_COMERCIAL, Papel.FINANCEIRO);
    const dados = AjusteSchema.parse(input);
    const resultado = await prisma.$transaction(async (tx) => {
      // Primeiro consultar somente o vínculo, autorizando antes de ler valores sensíveis.
      const vinculo = await tx.cobranca.findUnique({ where: { id: dados.cobrancaId }, select: { matriculaId: true } });
      if (!vinculo) throw new ErroRegra("Cobrança não encontrada.");
      await bloquearMatriculas(tx, [vinculo.matriculaId]);
      await exigirEscopoAjuste(autor, vinculo.matriculaId, tx);
      const cobranca = await bloquearCobranca(tx, dados.cobrancaId);
      if (cobranca.status === StatusCobranca.PAGO || cobranca.status === StatusCobranca.CANCELADA) throw new ErroRegra("Cobrança paga ou cancelada não aceita ajuste.");
      if (dados.tipo === TipoAjuste.PERDAO && !autor.papeis.includes(Papel.ADMINISTRADOR)) throw new ErroPermissao("Perdoar cobrança exige administração.");
      const matricula = await tx.matricula.findUniqueOrThrow({ where: { id: vinculo.matriculaId }, include: { aluno: { select: { id: true, primeiroNome: true, sobrenome: true } } } });
      const valorPara = dados.tipo === TipoAjuste.PERDAO ? 0 : dados.valorPara;
      const candidatos = dados.vigencia === Vigencia.ESTA_COBRANCA ? [cobranca] : await tx.cobranca.findMany({ where: {
        matriculaId: matricula.id, tipo: cobranca.tipo, status: { in: [StatusCobranca.PENDENTE, StatusCobranca.ATRASADO] },
        ...(dados.vigencia === Vigencia.PROXIMOS_MESES ? { vencimento: { gte: cobranca.vencimento } } : {}),
      }, orderBy: { id: "asc" } });
      const limites = await limitesAtuais(tx, autor);
      let acima = dados.tipo === TipoAjuste.PERDAO || dados.tipo === TipoAjuste.BOLSA;
      const alvos: Snapshot["alvos"] = [];
      for (const c of candidatos) {
        const atual = await bloquearCobranca(tx, c.id);
        const erro = validarDirecaoAjuste(dados.tipo, numero(atual.valorNegociado), valorPara);
        if (erro) throw new ErroRegra(erro);
        acima ||= exigeAprovacaoComponente(limites, atual.tipo, atual.valorOriginal, valorPara);
        alvos.push({ id: atual.id, versao: atual.versao, valorDe: numero(atual.valorNegociado), referencia: numero(atual.valorOriginal), valorPara,
          novoVencimento: atual.id === cobranca.id && dados.novoVencimento ? dados.novoVencimento.toISOString() : null });
      }
      const snapshot: Snapshot = {
        alunoId: matricula.alunoId, alunoNome: nomeCompleto(matricula.aluno), moeda: cobranca.moeda,
        valorDe: numero(cobranca.valorNegociado), valorPara, descontoValor: numero(cobranca.valorNegociado) - valorPara,
        tipo: dados.tipo, exigeDirecao: autor.papeis.includes(Papel.GERENTE_COMERCIAL) || autor.papeis.includes(Papel.ADMINISTRADOR) || dados.tipo === TipoAjuste.PERDAO || dados.tipo === TipoAjuste.BOLSA,
        alvos,
      };
      if (acima) {
        const aprovada = await tx.aprovacao.create({ data: {
          tipo: dados.tipo === TipoAjuste.PERDAO ? TipoAprovacao.PERDAO_DIVIDA : dados.tipo === TipoAjuste.BOLSA ? TipoAprovacao.BOLSA : dados.tipo === TipoAjuste.ALTERACAO_VALOR ? TipoAprovacao.ALTERACAO_VALOR : TipoAprovacao.DESCONTO,
          solicitanteId: autor.id, alvoTipo: "Cobranca", alvoId: cobranca.id, vigencia: dados.vigencia,
          motivo: dados.motivo, impactoMensal: snapshot.descontoValor, payload: snapshot,
        } });
        await registrarEvento(tx, { tipo: "DescontoSolicitado", agregadoTipo: "Cobranca", agregadoId: cobranca.id, autorId: autor.id, payload: { aprovacaoId: aprovada.id } });
      } else await aplicarAlvos(tx, autor, snapshot, dados.motivo, dados.vigencia);
      return { aprovacao: acima };
    });
    revalidar(); return resultado;
  });
}

export async function decidirAprovacao(aprovacaoId: string, input: DecisaoInput): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.GERENTE_COMERCIAL);
    const dados = DecisaoSchema.parse(input);
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Aprovacao" WHERE id = ${aprovacaoId} FOR UPDATE`;
      const aprovacao = await tx.aprovacao.findUnique({ where: { id: aprovacaoId } });
      if (!aprovacao) throw new ErroRegra("Aprovação não encontrada.");
      exigirConferenciaIndependente(aprovacao.solicitanteId, autor.id);
      if (aprovacao.status !== StatusAprovacao.PENDENTE) throw new ErroRegra("Pedido já decidido.");
      const parsed = SnapshotSchema.safeParse(aprovacao.payload);
      if (!parsed.success) throw new ErroRegra("Pedido antigo sem versão de segurança. Solicite novamente.");
      const snapshot = parsed.data;
      const adm = autor.papeis.includes(Papel.ADMINISTRADOR);
      if ((snapshot.exigeDirecao || snapshot.tipo === TipoAjuste.BOLSA || snapshot.tipo === TipoAjuste.PERDAO) && !adm) throw new ErroPermissao("Este pedido exige outra pessoa da direção/administração.");
      const limites = await limitesAtuais(tx, autor);
      if (!adm && limites.alcadaAlteradaEm && limites.alcadaAlteradaEm > aprovacao.criadoEm) throw new ErroPermissao("Alçada alterada após o pedido. Encaminhe à direção.");
      const vinculos = await tx.cobranca.findMany({ where: { id: { in: snapshot.alvos.map((alvo) => alvo.id) } }, select: { matriculaId: true } });
      await bloquearMatriculas(tx, vinculos.map((vinculo) => vinculo.matriculaId));
      for (const alvo of snapshot.alvos) {
        const cobranca = await tx.cobranca.findUnique({ where: { id: alvo.id }, select: { matriculaId: true, tipo: true } });
        if (!cobranca) throw new ErroRegra("Cobrança não encontrada.");
        await exigirEscopoAprovacao(autor, cobranca.matriculaId, tx);
        if (dados.aprovar && !adm && exigeAprovacaoComponente(limites, cobranca.tipo, alvo.referencia, alvo.valorPara)) throw new ErroPermissao("Desconto acima da sua alçada. Encaminhe à direção.");
      }
      if (dados.aprovar) await aplicarAlvos(tx, autor, snapshot, aprovacao.motivo ?? "Aprovado", aprovacao.vigencia ?? Vigencia.ESTA_COBRANCA, aprovacao.id);
      await tx.aprovacao.update({ where: { id: aprovacao.id }, data: {
        status: dados.aprovar ? StatusAprovacao.APROVADA : StatusAprovacao.REJEITADA, aprovadorId: autor.id, decididoEm: new Date(),
      } });
      await registrarEvento(tx, { tipo: "AprovacaoDecidida", agregadoTipo: aprovacao.alvoTipo === "Matricula" ? "Matricula" : "Cobranca", agregadoId: aprovacao.alvoId ?? aprovacao.id,
        autorId: autor.id, payload: { status: dados.aprovar ? "APROVADA" : "REJEITADA", motivo: dados.motivo ?? null, aprovacaoId } });
    });
    revalidar();
  });
}

"use server";

import { revalidatePath } from "next/cache";
import { Papel, StatusCobranca, StatusFaturaB2B, TipoCobranca } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { gerarCodigo } from "@/lib/codigo";
import {
  ErroRegra,
  executarAcao,
  exigirSessao,
  exigirPapel,
  numero,
  numeroOuNull,
  registrarEvento,
  type Resultado,
} from "@/server/_shared";
import { bloquearMatriculas } from "@/server/financeiro/recebimentos";
import { baixarCobrancaTx } from "@/server/financeiro/baixa";
import {
  EmpresaSchema,
  FecharFaturaSchema,
  type EmpresaInput,
  type FecharFaturaInput,
  type MatriculasLoteB2BInput,
} from "./schema";

// B2B — FASE 2 (doc 03): contrato corporativo (Empresa) · matrículas em LOTE ·
// fatura ÚNICA por competência · baixa em lote. Toda mutação grava Evento (doc 13).
//
// Compatibilidade histórica da main. Q88 limita novas contratações a contratos
// individuais; criarMatriculasLoteB2B recusa a antiga ativação sem preparação.

const PAPEIS_B2B: Papel[] = [Papel.FINANCEIRO];

function revalidar() {
  revalidatePath("/empresas");
  revalidatePath("/financeiro", "layout");
  revalidatePath("/alunos");
}

export async function salvarEmpresa(
  input: EmpresaInput & { id?: string },
): Promise<Resultado<{ id: string }>> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirPapel(autor, ...PAPEIS_B2B);
    const dados = EmpresaSchema.parse(input);
    if (dados.paisId) {
      const pais = await prisma.pais.findUnique({ where: { id: dados.paisId } });
      if (!pais) throw new ErroRegra("País inexistente.");
    }

    const id = await prisma.$transaction(async (tx) => {
      if (input.id) {
        const antes = await tx.empresa.findUnique({ where: { id: input.id } });
        if (!antes) throw new ErroRegra("Empresa não encontrada.");
        await tx.empresa.update({ where: { id: input.id }, data: dados });
        await registrarEvento(tx, {
          tipo: "EmpresaEditada",
          agregadoTipo: "Empresa",
          agregadoId: input.id,
          autorId: autor.id,
          payload: { nome: dados.nome, ativo: dados.ativo },
        });
        return input.id;
      }
      const codigo = await gerarCodigo("empresa", tx);
      const empresa = await tx.empresa.create({ data: { ...dados, codigo } });
      await registrarEvento(tx, {
        tipo: "EmpresaCriada",
        agregadoTipo: "Empresa",
        agregadoId: empresa.id,
        autorId: autor.id,
        payload: { codigo, nome: dados.nome },
      });
      return empresa.id;
    });
    revalidar();
    return { id };
  });
}

/**
 * MATRÍCULAS EM LOTE (doc 03 §B2B): cria aluno + matrícula ATIVA + cronograma de
 * mensalidades para CADA colaborador, numa única transação (falha no meio = nada gravado).
 * Vencimentos no dia da EMPRESA; moeda = moeda local do país da empresa.
 */
export async function criarMatriculasLoteB2B(
  input: MatriculasLoteB2BInput,
): Promise<Resultado<{ criadas: number }>> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirPapel(autor, ...PAPEIS_B2B);
    void input;
    throw new ErroRegra("Contratação corporativa em lote não integra esta entrega. Prepare contratos individuais com a empresa como responsável financeiro, preservando reserva, aceite e pagamentos exigidos.");
  });
}

export async function fecharFaturaB2B(input: FecharFaturaInput): Promise<Resultado<{ id: string; total: number }>> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirPapel(autor, ...PAPEIS_B2B);
    const dados = FecharFaturaSchema.parse(input);

    const empresa = await prisma.empresa.findUnique({ where: { id: dados.empresaId } });
    if (!empresa) throw new ErroRegra("Empresa não encontrada.");

    const resultado = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Empresa" WHERE id = ${empresa.id} FOR UPDATE`;
      const mats = await tx.matricula.findMany({ where: { empresaId: empresa.id }, select: { id: true } });
      await bloquearMatriculas(tx, mats.map(m => m.id));
      await tx.$queryRaw`SELECT c.id FROM "Cobranca" c JOIN "Matricula" m ON m.id = c."matriculaId" WHERE m."empresaId" = ${empresa.id} ORDER BY c.id FOR UPDATE OF c`;
      const existente = await tx.faturaB2B.findUnique({
        where: { empresaId_competencia: { empresaId: empresa.id, competencia: dados.competencia } },
      });
      if (existente && existente.status !== StatusFaturaB2B.CANCELADA) {
        throw new ErroRegra(`Já existe fatura ${existente.codigo ?? ""} para ${dados.competencia}.`);
      }

      const cobrancas = await tx.cobranca.findMany({
        where: {
          matricula: { empresaId: empresa.id },
          tipo: TipoCobranca.MENSALIDADE,
          competencia: dados.competencia,
          status: { in: [StatusCobranca.PENDENTE, StatusCobranca.ATRASADO] },
          faturaB2BId: null,
        },
      });
      if (cobrancas.length === 0) {
        throw new ErroRegra("Nenhuma mensalidade aberta desta competência para faturar.");
      }
      const moedas = new Set(cobrancas.map((c) => c.moeda));
      if (moedas.size > 1) throw new ErroRegra("Cobranças em moedas diferentes não entram na mesma fatura.");

      // A fatura leva o SALDO ABERTO de cada item, não o valor integral (review PR #60):
      // uma cobrança de 100 com 40 já recebidos entra por 60 — documento e recebimento
      // fecham. O saldo entra como SNAPSHOT (`valorFaturado`) por cobrança: mudanças
      // posteriores não alteram a composição do documento fechado.
      const aberto = (c: (typeof cobrancas)[number]) =>
        numeroOuNull(c.saldo) ?? Math.max(0, numero(c.valorNegociado) - (numeroOuNull(c.valorRecebido) ?? 0) - numero(c.valorLiquidadoCredito) - numero(c.valorCompensadoPermuta));
      const total = cobrancas.reduce((soma, c) => soma + aberto(c), 0);
      if (total <= 0) throw new ErroRegra("As mensalidades desta competência não têm saldo aberto.");

      const [ano, mes] = dados.competencia.split("-").map(Number);
      const vencimento = new Date(ano, mes - 1, empresa.diaVencimento);

      // Fatura CANCELADA da mesma competência é REABERTA na mesma linha (review PR #60):
      // o @@unique(empresaId, competencia) tornaria um novo create um P2002 eterno.
      const fatura = existente
        ? await tx.faturaB2B.update({
            where: { id: existente.id },
            data: {
              moeda: cobrancas[0].moeda,
              valorTotal: total,
              status: StatusFaturaB2B.FECHADA,
              vencimento,
              pagoEm: null,
            },
          })
        : await tx.faturaB2B.create({
            data: {
              codigo: await gerarCodigo("fatura", tx),
              empresaId: empresa.id,
              competencia: dados.competencia,
              moeda: cobrancas[0].moeda,
              valorTotal: total,
              status: StatusFaturaB2B.FECHADA,
              vencimento,
            },
          });
      for (const c of cobrancas) {
        await tx.cobranca.update({
          where: { id: c.id },
          data: { faturaB2BId: fatura.id, valorFaturado: aberto(c) },
        });
      }
      await registrarEvento(tx, {
        tipo: "FaturaB2BFechada",
        agregadoTipo: "FaturaB2B",
        agregadoId: fatura.id,
        autorId: autor.id,
        payload: {
          codigo: fatura.codigo,
          competencia: dados.competencia,
          cobrancas: cobrancas.length,
          total,
          reabertura: !!existente,
        },
      });
      return { id: fatura.id, total };
    });
    revalidar();
    return resultado;
  });
}

/** Paga a fatura única: baixa EM LOTE todas as cobranças (miolo compartilhado — Fase 2). */
export async function pagarFaturaB2B(faturaId: string): Promise<Resultado<{ baixadas: number }>> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirPapel(autor, Papel.FINANCEIRO);

    const baixadas = await prisma.$transaction(async (tx) => {
      const ref = await tx.faturaB2B.findUnique({ where: { id: faturaId }, select: { empresaId: true, cobrancas: { select: { matriculaId: true } } } });
      if (!ref) throw new ErroRegra("Fatura não encontrada.");
      await tx.$queryRaw`SELECT id FROM "Empresa" WHERE id = ${ref.empresaId} FOR UPDATE`;
      await bloquearMatriculas(tx, ref.cobrancas.map(c => c.matriculaId));
      await tx.$queryRaw`SELECT id FROM "Cobranca" WHERE "faturaB2BId" = ${faturaId} ORDER BY id FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM "FaturaB2B" WHERE id = ${faturaId} FOR UPDATE`;
      const fatura = await tx.faturaB2B.findUnique({
        where: { id: faturaId },
        include: { cobrancas: true },
      });
      if (!fatura) throw new ErroRegra("Fatura não encontrada.");
      if (fatura.status !== StatusFaturaB2B.FECHADA) throw new ErroRegra("Só fatura FECHADA recebe pagamento.");

      // RECONCILIAÇÃO ESTRITA (review PR #60 rodada 2): a fatura só vira PAGA se a
      // liquidação COBRIR o documento — cada item vivo é baixado exatamente pelo snapshot
      // `valorFaturado` e a soma precisa fechar com `valorTotal`. Item cancelado/baixado
      // fora da fatura (mutações agora bloqueadas na origem; estado legado/fora de banda)
      // NÃO é pulado em silêncio: o caminho formal é cancelar a fatura e fechá-la de novo
      // (reemissão), que recompõe o documento sem o item.
      const divergente = (motivo: string) =>
        new ErroRegra(
          `${motivo} — a fatura diverge do documento fechado. Cancele a fatura e feche-a novamente (reemissão).`,
        );
      const agora = new Date();
      let n = 0;
      let totalBaixado = 0;
      for (const c of fatura.cobrancas) {
        if (c.status === StatusCobranca.CANCELADA) throw divergente(`A cobrança ${c.codigo ?? c.id} foi cancelada`);
        if (c.status === StatusCobranca.PAGO) throw divergente(`A cobrança ${c.codigo ?? c.id} já foi baixada fora da fatura`);
        const snapshot = numeroOuNull(c.valorFaturado);
        const restante = numeroOuNull(c.saldo) ?? numero(c.valorNegociado) - (numeroOuNull(c.valorRecebido) ?? 0) - numero(c.valorLiquidadoCredito) - numero(c.valorCompensadoPermuta);
        if (snapshot === null || restante !== snapshot) {
          throw divergente(`A cobrança ${c.codigo ?? c.id} mudou depois do fechamento`);
        }
        await baixarCobrancaTx(tx, autor.id, c.id, {
          valorRecebido: snapshot,
          forma: "TRANSFERENCIA",
          dataPagamento: agora,
          comentario: `Fatura B2B ${fatura.codigo ?? fatura.id}`,
          via: "fatura_b2b",
        });
        totalBaixado += snapshot;
        n += 1;
      }
      if (n === 0 || totalBaixado !== numero(fatura.valorTotal)) {
        throw divergente("A soma baixada não cobre o valor do documento");
      }
      await tx.faturaB2B.update({
        where: { id: fatura.id },
        data: { status: StatusFaturaB2B.PAGA, pagoEm: agora },
      });
      await registrarEvento(tx, {
        tipo: "FaturaB2BPaga",
        agregadoTipo: "FaturaB2B",
        agregadoId: fatura.id,
        autorId: autor.id,
        payload: {
          pagoEm: agora.toISOString(),
          cobrancasBaixadas: n,
          totalBaixado,
          valorTotalDocumento: numero(fatura.valorTotal),
        },
      });
      return n;
    });
    revalidar();
    return { baixadas };
  });
}

/** Cancela uma fatura FECHADA (desfaz o agrupamento — as cobranças voltam a ficar soltas). */
export async function cancelarFaturaB2B(faturaId: string): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirPapel(autor, ...PAPEIS_B2B);
    await prisma.$transaction(async (tx) => {
      const ref = await tx.faturaB2B.findUnique({ where: { id: faturaId }, select: { empresaId: true, cobrancas: { select: { matriculaId: true } } } });
      if (!ref) throw new ErroRegra("Fatura não encontrada.");
      await tx.$queryRaw`SELECT id FROM "Empresa" WHERE id = ${ref.empresaId} FOR UPDATE`;
      await bloquearMatriculas(tx, ref.cobrancas.map(c => c.matriculaId));
      await tx.$queryRaw`SELECT id FROM "Cobranca" WHERE "faturaB2BId" = ${faturaId} ORDER BY id FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM "FaturaB2B" WHERE id = ${faturaId} FOR UPDATE`;
      const fatura = await tx.faturaB2B.findUnique({ where: { id: faturaId } });
      if (!fatura) throw new ErroRegra("Fatura não encontrada.");
      if (fatura.status !== StatusFaturaB2B.FECHADA)
        throw new ErroRegra("Só fatura FECHADA (não paga) pode ser cancelada.");
      await tx.cobranca.updateMany({
        where: { faturaB2BId: fatura.id },
        data: { faturaB2BId: null, valorFaturado: null },
      });
      await tx.faturaB2B.update({ where: { id: fatura.id }, data: { status: StatusFaturaB2B.CANCELADA } });
      await registrarEvento(tx, {
        tipo: "FaturaB2BCancelada",
        agregadoTipo: "FaturaB2B",
        agregadoId: fatura.id,
        autorId: autor.id,
      });
    });
    revalidar();
  });
}

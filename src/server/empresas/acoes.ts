"use server";

import { revalidatePath } from "next/cache";
import { Papel, StatusCobranca, StatusFaturaB2B, StatusMatricula, TipoCobranca } from "@prisma/client";
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
import { baixarCobrancaTx } from "@/server/financeiro/baixa";
import {
  EmpresaSchema,
  FecharFaturaSchema,
  MatriculasLoteB2BSchema,
  type EmpresaInput,
  type FecharFaturaInput,
  type MatriculasLoteB2BInput,
} from "./schema";

// B2B — FASE 2 (doc 03): contrato corporativo (Empresa) · matrículas em LOTE ·
// fatura ÚNICA por competência · baixa em lote. Toda mutação grava Evento (doc 13).
//
// Decisões de domínio (registradas também no doc 15 §Fase 2):
//  - Matrícula B2B nasce ATIVA (lastro = CONTRATO CORPORATIVO — a empresa responde pela
//    fatura; não há taxa individual nem comissão automática por colaborador).
//  - As mensalidades dos colaboradores são cobranças NORMAIS (mesma máquina da Fase 0);
//    a fatura única as AGRUPA por competência — pagar a fatura baixa todas em lote.

const PAPEIS_B2B: Papel[] = [Papel.GERENTE_COMERCIAL, Papel.FINANCEIRO, Papel.SECRETARIA_ACADEMICA];

function revalidar() {
  revalidatePath("/empresas");
  revalidatePath("/financeiro");
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
    const dados = MatriculasLoteB2BSchema.parse(input);

    const empresa = await prisma.empresa.findUnique({ where: { id: dados.empresaId } });
    if (!empresa) throw new ErroRegra("Empresa não encontrada.");
    if (!empresa.ativo) throw new ErroRegra("Empresa inativa não recebe matrículas.");
    if (!empresa.paisId) throw new ErroRegra("Defina o país da empresa antes do lote (moeda/vencimentos).");
    const pais = await prisma.pais.findUnique({ where: { id: empresa.paisId } });
    if (!pais) throw new ErroRegra("País da empresa inexistente.");
    const produto = await prisma.produto.findUnique({ where: { id: dados.produtoId } });
    if (!produto) throw new ErroRegra("Produto inexistente.");

    const agora = new Date();
    await prisma.$transaction(async (tx) => {
      for (const col of dados.colaboradores) {
        const alunoCodigo = await gerarCodigo("aluno", tx);
        const aluno = await tx.aluno.create({
          data: {
            codigo: alunoCodigo,
            primeiroNome: col.primeiroNome,
            sobrenome: col.sobrenome,
            email: col.email,
            telefoneE164: col.telefone,
            paisId: pais.id,
          },
        });
        await registrarEvento(tx, {
          tipo: "AlunoCriado",
          agregadoTipo: "Aluno",
          agregadoId: aluno.id,
          autorId: autor.id,
          payload: { codigo: alunoCodigo, via: "lote_b2b", empresaId: empresa.id },
        });

        const matCodigo = await gerarCodigo("matricula", tx);
        const matricula = await tx.matricula.create({
          data: {
            codigo: matCodigo,
            alunoId: aluno.id,
            produtoId: produto.id,
            paisId: pais.id,
            empresaId: empresa.id,
            moeda: pais.moedaLocal,
            diaVencimento: empresa.diaVencimento,
            mesesPlano: dados.mesesPlano,
            // Lastro B2B: o CONTRATO CORPORATIVO responde — nasce ATIVA, sem taxa individual.
            status: StatusMatricula.ATIVA,
            contratoOk: true,
            pagamentoTaxaOk: true,
            primeiraMensalidadeOk: false,
            ativadaEm: agora,
          },
        });

        // Cronograma completo: N mensalidades, vencendo no dia da empresa a partir do mês
        // que vem (competência mensal — entram nas faturas únicas).
        for (let i = 0; i < dados.mesesPlano; i++) {
          const venc = new Date(agora.getFullYear(), agora.getMonth() + 1 + i, empresa.diaVencimento);
          const competencia = `${venc.getFullYear()}-${String(venc.getMonth() + 1).padStart(2, "0")}`;
          await tx.cobranca.create({
            data: {
              codigo: await gerarCodigo("cobranca", tx),
              matriculaId: matricula.id,
              tipo: TipoCobranca.MENSALIDADE,
              competencia,
              valorOriginal: dados.mensalidadeValor,
              valorNegociado: dados.mensalidadeValor,
              moeda: pais.moedaLocal,
              vencimento: venc,
              status: StatusCobranca.PENDENTE,
            },
          });
        }

        await registrarEvento(tx, {
          tipo: "MatriculaCriada",
          agregadoTipo: "Matricula",
          agregadoId: matricula.id,
          autorId: autor.id,
          payload: { codigo: matCodigo, via: "lote_b2b", empresaId: empresa.id },
        });
        await registrarEvento(tx, {
          tipo: "MatriculaAtivada",
          agregadoTipo: "Matricula",
          agregadoId: matricula.id,
          autorId: autor.id,
          payload: { ativadaEm: agora.toISOString(), lastro: "CONTRATO_B2B", empresaId: empresa.id },
        });
      }
      await registrarEvento(tx, {
        tipo: "MatriculasLoteB2B",
        agregadoTipo: "Empresa",
        agregadoId: empresa.id,
        autorId: autor.id,
        payload: { quantidade: dados.colaboradores.length, produtoId: produto.id, mesesPlano: dados.mesesPlano },
      });
    });
    revalidar();
    return { criadas: dados.colaboradores.length };
  });
}

/**
 * FECHA a fatura única da competência: agrupa as mensalidades ABERTAS (pendente/atrasado,
 * fora de fatura) das matrículas da empresa naquele mês. Idempotente por empresa×mês
 * (@@unique) — fechar de novo com cobranças novas exige cancelar a fatura antes.
 */
export async function fecharFaturaB2B(input: FecharFaturaInput): Promise<Resultado<{ id: string; total: number }>> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirPapel(autor, ...PAPEIS_B2B);
    const dados = FecharFaturaSchema.parse(input);

    const empresa = await prisma.empresa.findUnique({ where: { id: dados.empresaId } });
    if (!empresa) throw new ErroRegra("Empresa não encontrada.");

    const resultado = await prisma.$transaction(async (tx) => {
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
        Math.max(0, numero(c.valorNegociado) - (numeroOuNull(c.valorRecebido) ?? 0));
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
    exigirPapel(autor, Papel.FINANCEIRO, Papel.SECRETARIA_ACADEMICA);

    const baixadas = await prisma.$transaction(async (tx) => {
      const fatura = await tx.faturaB2B.findUnique({
        where: { id: faturaId },
        include: { cobrancas: true },
      });
      if (!fatura) throw new ErroRegra("Fatura não encontrada.");
      if (fatura.status !== StatusFaturaB2B.FECHADA) throw new ErroRegra("Só fatura FECHADA recebe pagamento.");

      // RECONCILIAÇÃO (review PR #60): os itens seguem mutáveis por outros fluxos depois do
      // fechamento — cobrança CANCELADA (aluno pausado) é PULADA (nunca trava a fatura
      // inteira) e cada item vivo é baixado pelo saldo aberto ATUAL. Divergências entre o
      // documento (valorTotal/snapshot) e o efetivamente baixado ficam auditadas no evento.
      const agora = new Date();
      let n = 0;
      let totalBaixado = 0;
      const pulados: string[] = [];
      for (const c of fatura.cobrancas) {
        if (c.status === StatusCobranca.PAGO) continue;
        if (c.status === StatusCobranca.CANCELADA) {
          pulados.push(c.codigo ?? c.id);
          continue;
        }
        const restante = numero(c.valorNegociado) - (numeroOuNull(c.valorRecebido) ?? 0);
        if (restante <= 0) continue;
        await baixarCobrancaTx(tx, autor.id, c.id, {
          valorRecebido: restante,
          forma: "TRANSFERENCIA",
          dataPagamento: agora,
          comentario: `Fatura B2B ${fatura.codigo ?? fatura.id}`,
          via: "fatura_b2b",
        });
        totalBaixado += restante;
        n += 1;
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
          itensCanceladosPulados: pulados,
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

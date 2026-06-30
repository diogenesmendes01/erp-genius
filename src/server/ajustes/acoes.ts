"use server";

import { revalidatePath } from "next/cache";
import {
  Papel,
  Prisma,
  TipoAjuste,
  TipoAprovacao,
  StatusAprovacao,
  StatusCobranca,
  Vigencia,
  TipoCobranca,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { nomeCompleto } from "@/lib/nome";
import {
  exigirSessao,
  exigirPapel,
  exigirSessaoComPapel,
  registrarEvento,
  executarAcao,
  ErroRegra,
  ErroPermissao,
  temPapel,
  descontoPercentual,
  precisaAprovacaoDesconto,
  validarDirecaoAjuste,
  type Resultado,
  type UsuarioSessao,
} from "@/server/_shared";
import { AjusteSchema, DecisaoSchema, type AjusteInput, type DecisaoInput } from "./schema";

function revalidar(alunoId?: string) {
  revalidatePath("/financeiro");
  if (alunoId) revalidatePath(`/alunos/${alunoId}/financeiro`);
}

const TIPO_AJUSTE_PARA_APROVACAO: Record<TipoAjuste, TipoAprovacao> = {
  DESCONTO: TipoAprovacao.DESCONTO,
  BOLSA: TipoAprovacao.BOLSA,
  ALTERACAO_VALOR: TipoAprovacao.ALTERACAO_VALOR,
  PERDAO: TipoAprovacao.PERDAO_DIVIDA,
  RENEGOCIACAO: TipoAprovacao.ALTERACAO_VALOR,
};

type CobrancaCompleta = Prisma.CobrancaGetPayload<{
  include: {
    matricula: {
      include: {
        comissoes: true;
        produto: { select: { modalidadeId: true } };
        aluno: { select: { id: true; primeiroNome: true; sobrenome: true } };
      };
    };
  };
}>;

/** Cobranças afetadas pela vigência. */
function cobrancasAlvo(
  cobranca: CobrancaCompleta,
  todasDaMatricula: { id: string; tipo: TipoCobranca; vencimento: Date; status: StatusCobranca }[],
  vigencia: Vigencia,
): string[] {
  if (vigencia === Vigencia.ESTA_COBRANCA) return [cobranca.id];
  // próximos meses / contrato inteiro → esta + mensalidades futuras pendentes
  const futuras = todasDaMatricula
    .filter(
      (c) =>
        c.tipo === cobranca.tipo &&
        c.status !== StatusCobranca.PAGO &&
        c.status !== StatusCobranca.CANCELADA &&
        c.vencimento >= cobranca.vencimento,
    )
    .map((c) => c.id);
  return Array.from(new Set([cobranca.id, ...futuras]));
}

/** Aplica o ajuste: atualiza cobrança(s), grava AjusteFinanceiro, recalcula comissão se for taxa. */
async function aplicarAjuste(
  tx: Prisma.TransactionClient,
  params: {
    cobranca: CobrancaCompleta;
    valorPara: number;
    novoVencimento?: Date;
    vigencia: Vigencia;
    tipo: TipoAjuste;
    motivo: string;
    autorId: string;
    aprovacaoId?: string;
  },
) {
  const { cobranca, valorPara, vigencia, tipo, motivo, autorId, aprovacaoId, novoVencimento } = params;
  const matricula = cobranca.matricula;
  const valorDe = cobranca.valorNegociado;
  const descontoValor = valorDe - valorPara;
  const descontoPct = valorDe > 0 ? (descontoValor / valorDe) * 100 : 0;

  const todas = await tx.cobranca.findMany({
    where: { matriculaId: matricula.id },
    select: { id: true, tipo: true, vencimento: true, status: true },
  });
  const alvos = cobrancasAlvo(cobranca, todas, vigencia);

  for (const id of alvos) {
    await tx.cobranca.update({
      where: { id },
      data: {
        valorNegociado: tipo === TipoAjuste.PERDAO ? 0 : valorPara,
        status: tipo === TipoAjuste.PERDAO ? StatusCobranca.CANCELADA : undefined,
        ...(novoVencimento && id === cobranca.id ? { vencimento: novoVencimento } : {}),
      },
    });
  }

  await tx.ajusteFinanceiro.create({
    data: {
      matriculaId: matricula.id,
      cobrancaId: cobranca.id,
      tipo,
      valorDe,
      valorPara: tipo === TipoAjuste.PERDAO ? 0 : valorPara,
      descontoValor: tipo === TipoAjuste.PERDAO ? valorDe : descontoValor,
      descontoPct,
      moeda: cobranca.moeda,
      vigencia,
      motivo,
      autorId,
      aprovacaoId: aprovacaoId ?? null,
      vendedorId: matricula.comissoes[0]?.vendedorId ?? null,
      paisId: matricula.paisId,
      modalidadeId: matricula.produto.modalidadeId,
    },
  });

  // Comissão recalcula só quando muda a TAXA DE MATRÍCULA (comissão = % da taxa).
  if (cobranca.tipo === TipoCobranca.MATRICULA) {
    for (const com of matricula.comissoes) {
      const novoValor = ((tipo === TipoAjuste.PERDAO ? 0 : valorPara) * com.percentual) / 100;
      await tx.comissao.update({ where: { id: com.id }, data: { valor: novoValor } });
    }
  }

  await registrarEvento(tx, {
    tipo:
      tipo === TipoAjuste.PERDAO
        ? "CobrancaPerdoada"
        : tipo === TipoAjuste.BOLSA
          ? "BolsaConcedida"
          : "CobrancaRenegociada",
    agregadoTipo: "Cobranca",
    agregadoId: cobranca.id,
    autorId,
    payload: { de: valorDe, para: valorPara, descontoValor, vigencia, motivo, aprovacaoId: aprovacaoId ?? null },
  });
}

async function carregarCobranca(cobrancaId: string): Promise<CobrancaCompleta> {
  const cobranca = await prisma.cobranca.findUnique({
    where: { id: cobrancaId },
    include: {
      matricula: {
        include: {
          comissoes: true,
          produto: { select: { modalidadeId: true } },
          aluno: { select: { id: true, primeiroNome: true, sobrenome: true } },
        },
      },
    },
  });
  if (!cobranca) throw new ErroRegra("Cobrança não encontrada.");
  return cobranca;
}

/**
 * Renegociar / ajustar uma cobrança (doc 09 §Renegociação).
 * - Admin/Financeiro: aplica direto. Vendedor: até o limite aplica; acima → aprovação.
 * - Perdão: só Admin.
 */
export async function ajustarCobranca(input: AjusteInput): Promise<Resultado<{ aprovacao: boolean }>> {
  return executarAcao(async () => {
    const autor = await exigirSessao();
    exigirPapel(autor, Papel.VENDEDOR, Papel.FINANCEIRO); // Admin passa em temPapel/exigirPapel
    const dados = AjusteSchema.parse(input);

    const cobranca = await carregarCobranca(dados.cobrancaId);
    const aluno = cobranca.matricula.aluno;

    if (dados.tipo === TipoAjuste.PERDAO && !temPapel(autor, Papel.ADMINISTRADOR)) {
      throw new ErroPermissao("Perdoar cobrança é exclusivo do Administrador.");
    }

    const valorDe = cobranca.valorNegociado;

    // Direção do ajuste: só ALTERACAO_VALOR pode aumentar; o resto é redução.
    const erroDirecao = validarDirecaoAjuste(dados.tipo, valorDe, dados.valorPara);
    if (erroDirecao) throw new ErroRegra(erroDirecao);

    const descontoPct = descontoPercentual(valorDe, dados.valorPara);

    // Só Financeiro/Admin aplicam sem limite. Para os demais (Vendedor),
    // limiteDescontoPct = null NÃO é ilimitado — é "sem autonomia" (qualquer desconto → aprovação).
    const total = temPapel(autor, Papel.FINANCEIRO) || temPapel(autor, Papel.ADMINISTRADOR);
    const limiteUsuario = (await prisma.usuario.findUnique({ where: { id: autor.id } }))?.limiteDescontoPct ?? null;
    const acimaDoLimite = precisaAprovacaoDesconto({
      podeAplicarSemLimite: total,
      limiteDescontoPct: limiteUsuario,
      descontoPct,
    });

    if (acimaDoLimite) {
      // cria pedido de aprovação (não aplica)
      await prisma.$transaction(async (tx) => {
        const aprov = await tx.aprovacao.create({
          data: {
            tipo: TIPO_AJUSTE_PARA_APROVACAO[dados.tipo],
            solicitanteId: autor.id,
            alvoTipo: "Cobranca",
            alvoId: cobranca.id,
            vigencia: dados.vigencia,
            motivo: dados.motivo,
            impactoMensal: valorDe - dados.valorPara,
            payload: {
              alunoNome: nomeCompleto(aluno),
              alunoId: aluno.id,
              valorDe,
              valorPara: dados.valorPara,
              descontoValor: valorDe - dados.valorPara,
              descontoPct,
              moeda: cobranca.moeda,
              novoVencimento: dados.novoVencimento ? dados.novoVencimento.toISOString() : null,
              tipo: dados.tipo,
            },
          },
        });
        await registrarEvento(tx, {
          tipo: "DescontoSolicitado",
          agregadoTipo: "Cobranca",
          agregadoId: cobranca.id,
          autorId: autor.id,
          payload: { percentual: descontoPct, vigencia: dados.vigencia, aprovacaoId: aprov.id },
        });
      });
      revalidar(aluno.id);
      return { aprovacao: true };
    }

    // aplica direto
    await prisma.$transaction(async (tx) => {
      await aplicarAjuste(tx, {
        cobranca,
        valorPara: dados.valorPara,
        novoVencimento: dados.novoVencimento,
        vigencia: dados.vigencia,
        tipo: dados.tipo,
        motivo: dados.motivo,
        autorId: autor.id,
      });
    });
    revalidar(aluno.id);
    return { aprovacao: false };
  });
}

/** Decidir um pedido de aprovação (Gerente Comercial / Admin). */
export async function decidirAprovacao(aprovacaoId: string, input: DecisaoInput): Promise<Resultado> {
  return executarAcao(async () => {
    const autor: UsuarioSessao = await exigirSessaoComPapel(Papel.GERENTE_COMERCIAL);
    const dados = DecisaoSchema.parse(input);

    const aprov = await prisma.aprovacao.findUnique({ where: { id: aprovacaoId } });
    if (!aprov) throw new ErroRegra("Aprovação não encontrada.");
    if (aprov.status !== StatusAprovacao.PENDENTE) throw new ErroRegra("Pedido já decidido.");

    const payload = (aprov.payload ?? {}) as Record<string, unknown>;
    const alunoId = typeof payload.alunoId === "string" ? payload.alunoId : undefined;

    if (!dados.aprovar) {
      await prisma.$transaction(async (tx) => {
        await tx.aprovacao.update({
          where: { id: aprovacaoId },
          data: { status: StatusAprovacao.REJEITADA, aprovadorId: autor.id, decididoEm: new Date() },
        });
        await registrarEvento(tx, {
          tipo: "AprovacaoDecidida",
          agregadoTipo: "Cobranca",
          agregadoId: aprov.alvoId ?? aprovacaoId,
          autorId: autor.id,
          payload: { status: "REJEITADA", motivo: dados.motivo ?? null },
        });
      });
      revalidar(alunoId);
      return;
    }

    if (!aprov.alvoId) throw new ErroRegra("Aprovação sem cobrança alvo.");
    const alvoId = aprov.alvoId;
    const cobranca = await carregarCobranca(alvoId);
    const valorPara = typeof payload.valorPara === "number" ? payload.valorPara : cobranca.valorNegociado;
    const novoVenc = typeof payload.novoVencimento === "string" ? new Date(payload.novoVencimento) : undefined;

    await prisma.$transaction(async (tx) => {
      await aplicarAjuste(tx, {
        cobranca,
        valorPara,
        novoVencimento: novoVenc,
        vigencia: aprov.vigencia ?? Vigencia.ESTA_COBRANCA,
        tipo: (payload.tipo as TipoAjuste) ?? TipoAjuste.DESCONTO,
        motivo: aprov.motivo ?? "Aprovado",
        autorId: autor.id,
        aprovacaoId: aprov.id,
      });
      await tx.aprovacao.update({
        where: { id: aprovacaoId },
        data: { status: StatusAprovacao.APROVADA, aprovadorId: autor.id, decididoEm: new Date() },
      });
      await registrarEvento(tx, {
        tipo: "AprovacaoDecidida",
        agregadoTipo: "Cobranca",
        agregadoId: alvoId,
        autorId: autor.id,
        payload: { status: "APROVADA" },
      });
    });
    revalidar(alunoId);
  });
}

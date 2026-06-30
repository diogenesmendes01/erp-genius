"use server";

import { revalidatePath } from "next/cache";
import { Papel, StatusCobranca, StatusComissao, FormaPagamento } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  exigirSessaoComPapel,
  registrarEvento,
  executarAcao,
  acumularPagamento,
  ErroRegra,
  type Resultado,
} from "@/server/_shared";
import {
  PagamentoSchema,
  SalvarTaxasCambioSchema,
  type PagamentoInput,
  type ModeloWhatsapp,
  type SalvarTaxasCambioInput,
} from "./schema";
import type { PassoRegua } from "@/server/cobrancas/regua";

const PAPEIS_BAIXA: Papel[] = [Papel.FINANCEIRO, Papel.SECRETARIA_ACADEMICA];
const PAPEIS_COMISSAO: Papel[] = [Papel.FINANCEIRO];
const PAPEIS_CAMBIO: Papel[] = [Papel.FINANCEIRO]; // + Admin (passa sempre em exigirSessaoComPapel)
// Fonte de câmbio pública: grátis, sem chave, base USD. `rates[X]` = unidades por 1 USD,
// que é EXATAMENTE o nosso `unidadesPorUsd` (pivô USD) — grava direto, sem conversão.
const CAMBIO_API_URL = "https://open.er-api.com/v6/latest/USD";

export async function registrarPagamento(
  cobrancaId: string,
  input: PagamentoInput,
): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(...PAPEIS_BAIXA);
    const dados = PagamentoSchema.parse(input);

    const cobranca = await prisma.cobranca.findUnique({ where: { id: cobrancaId } });
    if (!cobranca) throw new ErroRegra("Cobrança não encontrada.");
    if (cobranca.status === StatusCobranca.PAGO) throw new ErroRegra("Cobrança já está paga.");
    if (cobranca.status === StatusCobranca.CANCELADA)
      throw new ErroRegra("Cobrança cancelada não recebe pagamento.");

    // ACUMULA baixas parciais (issues #1/#10): nunca sobrescreve o total já recebido; saldo/
    // quitação pelo ACUMULADO; excedente acima do negociado só passa como crédito explícito.
    const jaRecebido = cobranca.valorRecebido ?? 0;
    const { recebidoTotal, saldo, quitada, excedente } = acumularPagamento(
      jaRecebido,
      cobranca.valorNegociado,
      dados.valorRecebido,
      dados.permitirExcedente,
    );

    await prisma.$transaction(async (tx) => {
      await tx.cobranca.update({
        where: { id: cobrancaId },
        data: {
          valorRecebido: recebidoTotal,
          saldo,
          status: quitada ? StatusCobranca.PAGO : StatusCobranca.PENDENTE,
          pagoEm: quitada ? dados.dataPagamento ?? new Date() : null,
          formaPagamento: dados.forma as FormaPagamento,
          comprovanteUrl: dados.comprovanteUrl ?? null,
          comprovanteNome: dados.comprovanteNome ?? null,
          comentario: dados.comentario || null,
        },
      });
      await registrarEvento(tx, {
        tipo: "PagamentoRegistrado",
        agregadoTipo: "Cobranca",
        agregadoId: cobrancaId,
        autorId: autor.id,
        // payload preserva o histórico da baixa: valor desta baixa + acumulado + saldo + excedente + comprovante.
        payload: {
          valorRecebido: dados.valorRecebido,
          recebidoAcumulado: recebidoTotal,
          forma: dados.forma,
          quitada,
          saldo,
          excedente,
          comprovanteUrl: dados.comprovanteUrl ?? null,
          comprovanteNome: dados.comprovanteNome ?? null,
        },
      });
    });
    revalidatePath("/financeiro");
  });
}

export async function registrarCobrancaWhatsApp(
  cobrancaId: string,
  modelo: ModeloWhatsapp,
  passo?: PassoRegua,
): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(...PAPEIS_BAIXA);
    const cobranca = await prisma.cobranca.findUnique({ where: { id: cobrancaId } });
    if (!cobranca) throw new ErroRegra("Cobrança não encontrada.");

    // Evento gravado em transação (issue #1): consistente com o restante do domínio.
    // `passo` = degrau da régua cumprido (doc 24) — é o que faz a fila avançar e o que o
    // cron de automação (Fase 1+) vai ler. Opcional: eventos legados sem passo seguem válidos.
    await prisma.$transaction(async (tx) => {
      await registrarEvento(tx, {
        tipo: "CobrancaEnviadaWhatsApp",
        agregadoTipo: "Cobranca",
        agregadoId: cobrancaId,
        autorId: autor.id,
        payload: { modelo, passo: passo ?? null },
      });
    });
    revalidatePath("/financeiro");
  });
}

/** Fecha o mês: comissões Aprovadas → Pagas. (doc 10: fechamento dia 30 · pagamento dia 05) */
export async function fecharMesComissoes(): Promise<Resultado<{ pagas: number }>> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(...PAPEIS_COMISSAO);
    const aprovadas = await prisma.comissao.findMany({ where: { status: StatusComissao.APROVADA } });
    if (aprovadas.length === 0) throw new ErroRegra("Nenhuma comissão aprovada para pagar.");

    const agora = new Date();
    await prisma.$transaction(async (tx) => {
      for (const c of aprovadas) {
        await tx.comissao.update({
          where: { id: c.id },
          data: { status: StatusComissao.PAGA, pagaEm: agora },
        });
        await registrarEvento(tx, {
          tipo: "ComissaoPaga",
          agregadoTipo: "Comissao",
          agregadoId: c.id,
          autorId: autor.id,
          payload: { pagaEm: agora.toISOString(), valor: c.valor },
        });
      }
    });
    revalidatePath("/financeiro");
    return { pagas: aprovadas.length };
  });
}

/**
 * Salva cotações de câmbio (Fase B) — uma linha NOVA por moeda (append-only, vigenteEm=agora),
 * preservando o histórico. Só consolidação/leitura: NÃO altera nenhuma cobrança/comissão.
 * Admin/Financeiro. Registra um Evento `TaxasCambioDefinidas` para auditoria de quem mexeu.
 */
export async function salvarTaxasCambio(
  input: SalvarTaxasCambioInput,
): Promise<Resultado<{ salvas: number }>> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(...PAPEIS_CAMBIO);
    const { entradas } = SalvarTaxasCambioSchema.parse(input);

    const agora = new Date();
    await prisma.$transaction(async (tx) => {
      for (const e of entradas) {
        await tx.taxaCambio.create({
          data: { moeda: e.moeda, unidadesPorUsd: e.unidadesPorUsd, vigenteEm: agora },
        });
      }
      await registrarEvento(tx, {
        tipo: "TaxasCambioDefinidas",
        agregadoTipo: "TaxaCambio",
        agregadoId: "cambio",
        autorId: autor.id,
        payload: { entradas, vigenteEm: agora.toISOString() },
      });
    });
    revalidatePath("/financeiro");
    return { salvas: entradas.length };
  });
}

/**
 * Atualiza as cotações automaticamente a partir de uma fonte pública (grátis, sem chave, base
 * USD). Grava na MESMA `TaxaCambio` (append-only) — o consolidado fica resiliente: se a fonte cair,
 * segue usando a última cotação salva. Override manual (`salvarTaxasCambio`) continua valendo.
 * Moedas-alvo = em uso nos países + BRL (matriz); USD é o pivô (=1, não busca).
 */
export async function atualizarCotacoesAutomatico(): Promise<
  Resultado<{ atualizadas: number; semCotacao: string[] }>
> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(...PAPEIS_CAMBIO);

    const paises = await prisma.pais.findMany({ select: { moedaLocal: true } });
    const alvo = [...new Set(["BRL", ...paises.map((p) => p.moedaLocal.toUpperCase())])].filter(
      (m) => m !== "USD",
    );

    let rates: Record<string, number>;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      const resp = await fetch(CAMBIO_API_URL, { signal: ctrl.signal, cache: "no-store" });
      clearTimeout(t);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = (await resp.json()) as { result?: string; rates?: Record<string, number> };
      if (json.result !== "success" || !json.rates) throw new Error("resposta inválida");
      rates = json.rates;
    } catch {
      throw new ErroRegra("Não foi possível buscar as cotações agora. Tente de novo ou informe manualmente.");
    }

    const valida = (m: string) => typeof rates[m] === "number" && rates[m] > 0;
    const entradas = alvo
      .filter(valida)
      // 4 casas bastam para câmbio de referência e evita ruído de ponto-flutuante.
      .map((m) => ({ moeda: m, unidadesPorUsd: Math.round(rates[m] * 10000) / 10000 }));
    const semCotacao = alvo.filter((m) => !valida(m));
    if (entradas.length === 0) {
      throw new ErroRegra("A fonte de câmbio não retornou nenhuma das moedas em uso.");
    }

    const agora = new Date();
    await prisma.$transaction(async (tx) => {
      for (const e of entradas) {
        await tx.taxaCambio.create({
          data: { moeda: e.moeda, unidadesPorUsd: e.unidadesPorUsd, vigenteEm: agora },
        });
      }
      await registrarEvento(tx, {
        tipo: "TaxasCambioDefinidas",
        agregadoTipo: "TaxaCambio",
        agregadoId: "cambio",
        autorId: autor.id,
        payload: { fonte: "open.er-api.com", entradas, vigenteEm: agora.toISOString() },
      });
    });
    revalidatePath("/financeiro");
    return { atualizadas: entradas.length, semCotacao };
  });
}

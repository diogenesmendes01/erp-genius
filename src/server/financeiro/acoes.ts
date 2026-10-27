"use server";

import { revalidatePath } from "next/cache";
import { Papel, Prisma, StatusCobranca, StatusComissao, FormaPagamento } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  exigirSessaoComPapel,
  registrarEvento,
  executarAcao,
  numero,
  ErroRegra,
  ErroPermissao,
  type Resultado,
} from "@/server/_shared";
import {
  PagamentoSchema,
  ConferenciaSchema,
  PoliticaComissaoSchema,
  type PoliticaComissaoInput,
  SalvarTaxasCambioSchema,
  type PagamentoInput,
  type ModeloWhatsapp,
  type SalvarTaxasCambioInput,
  MODELOS_WHATSAPP,
} from "./schema";
import { exigirCapacidade } from "@/server/_shared/capacidades";
import { exigirArquivoVinculavel } from "@/server/uploads/autorizacao";
import { bloquearCobranca, receberTx, receberComDestinacoesTx, hashDadosPagamento } from "./recebimentos";
import { exigirConferenciaIndependente, dinheiro } from "./regras";
import type { PassoRegua } from "@/server/cobrancas/regua";
import { registrarEventoCobrancaEnviada } from "@/server/cobrancas/eventos";
import { reavaliarAcessoAutomaticoDaCobranca } from "@/server/cobrancas/acesso-aulas";
import { PASSOS_POLITICA } from "@/server/whatsapp/schema";
import { DIA_PREVISAO_COMISSAO_MAX, DIA_PREVISAO_COMISSAO_MIN, DiaPrevisaoComissaoSchema } from "./previsao-comissao";
import { analisarComDatasDaEscola, ChaveIdempotenciaSchema, dataObrigatoria } from "@/server/_shared/validacao";
import { marcaIdempotencia, repeticaoIdempotente, type MarcaIdempotencia } from "@/server/_shared/idempotencia";
import { fusoDaEscola } from "@/server/relatorios/atendimento";

const PAPEIS_BAIXA: Papel[] = [Papel.FINANCEIRO, Papel.SECRETARIA_ACADEMICA];
const PAPEIS_COMISSAO: Papel[] = [Papel.FINANCEIRO];
const PAPEIS_CAMBIO: Papel[] = [Papel.FINANCEIRO];
const RegistroCobrancaWhatsAppSchema = z.object({
  cobrancaId: z.string().min(1),
  modelo: z.enum(MODELOS_WHATSAPP),
  passo: z.enum(PASSOS_POLITICA).nullable(),
  cicloRegua: z.number().int().nonnegative(),
}).strict();
const RecebimentoDestinadoSchema = z.object({
  titularMatriculaId: z.string().min(1), pagadorId: z.string().min(1).nullable().optional(), chaveIdempotencia: z.string().min(16).max(120),
  valorRecebido: z.coerce.number().positive().finite(), moeda: z.string().regex(/^[A-Z]{3}$/), forma: z.nativeEnum(FormaPagamento),
  dataPagamento: dataObrigatoria,
  comentario: z.string().trim().max(2000).nullable().optional(), comprovanteUrl: z.string().trim().nullable().optional(), comprovanteNome: z.string().trim().nullable().optional(),
  destinos: z.array(z.object({ tipo: z.enum(["COBRANCA", "CREDITO_SEM_DESTINO"]), cobrancaId: z.string().min(1).nullable().optional(), valor: z.coerce.number().positive().finite(), evidencia: z.string().trim().min(5).max(2000), chaveIdempotencia: z.string().min(1).max(120) }).strict()).min(1),
}).strict();
const CAMBIO_API_URL = "https://open.er-api.com/v6/latest/USD";

async function reavaliarAcessoAposCommit(cobrancaId: string) {
  try {
    await reavaliarAcessoAutomaticoDaCobranca(cobrancaId);
  } catch {
    console.error("[financeiro] Operação confirmada. Falha no recálculo de acesso às aulas; reavaliação pendente pelo cron institucional.");
  }
}

export async function registrarPagamento(cobrancaId: string, input: PagamentoInput): Promise<Resultado<{ informado: boolean }>> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(...PAPEIS_BAIXA);
    const dados = analisarComDatasDaEscola(PagamentoSchema, input, await fusoDaEscola());
    const hashDados = hashDadosPagamento({ ...dados, cobrancaId, autorId: autor.id });
    const concessoes = await prisma.usuario.findUniqueOrThrow({ where: { id: autor.id }, select: { permissoes: true } });
    const financeiro = autor.papeis.includes(Papel.FINANCEIRO) || autor.papeis.includes(Papel.ADMINISTRADOR) || concessoes.permissoes.includes("pagamento.caixa");
    await prisma.$transaction(async (tx) => {
      const cobranca = await bloquearCobranca(tx, cobrancaId);
      const vinculo = await tx.matricula.findUniqueOrThrow({ where: { id: cobranca.matriculaId }, select: { alunoId: true, leadId: true } });
      if (dados.comprovanteUrl) await exigirArquivoVinculavel(autor, dados.comprovanteUrl, { cobrancaId, alunoId: vinculo.alunoId, leadId: vinculo.leadId ?? undefined }, tx);
      if (financeiro) {
        const anterior = dados.dataPagamento ? null : await tx.recebimento.findUnique({ where: { chaveIdempotencia: dados.chaveIdempotencia }, select: { dataPagamento: true } });
        await receberTx(tx, { ...dados, cobrancaId, autorId: autor.id, hashDados, dataPagamento: dados.dataPagamento ?? anterior?.dataPagamento ?? new Date() });
        return;
      }
      const anterior = await tx.pagamentoInformado.findUnique({ where: { chaveIdempotencia: dados.chaveIdempotencia } });
      if (anterior) {
        if (anterior.cobrancaId !== cobrancaId || anterior.autorId !== autor.id || !anterior.valor.equals(dinheiro(dados.valorRecebido)) || anterior.comprovanteUrl !== (dados.comprovanteUrl ?? null) || (anterior.hashDados && anterior.hashDados !== hashDados)) {
          throw new ErroRegra("Identificador do informe já usado para outros dados.");
        }
        return;
      }
      if (cobranca.status === StatusCobranca.PAGO || cobranca.status === StatusCobranca.CANCELADA) throw new ErroRegra("Cobrança paga ou cancelada não aceita informe.");
      const configuracao = await tx.configuracaoOperacional.findUnique({ where: { id: "escola" }, select: { prazoConferenciaHoras: true } });
      const criadoEm = new Date();
      const suspenderLembretesAte = new Date(criadoEm.getTime() + (configuracao?.prazoConferenciaHoras ?? 48) * 3600_000);
      const informe = await tx.pagamentoInformado.create({ data: {
        chaveIdempotencia: dados.chaveIdempotencia, cobrancaId, autorId: autor.id, hashDados,
        valor: dinheiro(dados.valorRecebido), moeda: cobranca.moeda, forma: dados.forma,
        dataPagamento: dados.dataPagamento ?? new Date(), comprovanteUrl: dados.comprovanteUrl ?? null,
        comprovanteNome: dados.comprovanteNome ?? null, comentario: dados.comentario ?? null,
        permitirExcedente: dados.permitirExcedente,
        criadoEm, suspenderLembretesAte,
      } });
      await registrarEvento(tx, { tipo: "PagamentoInformado", agregadoTipo: "Cobranca", agregadoId: cobrancaId,
        autorId: autor.id, payload: { informeId: informe.id, versao: informe.versao, valor: dados.valorRecebido,
          suspenderLembretesAte: suspenderLembretesAte?.toISOString() ?? null } });
    });
    await reavaliarAcessoAposCommit(cobrancaId);
    revalidatePath("/financeiro", "layout"); revalidatePath("/alunos", "layout");
    return { informado: !financeiro };
  });
}

export async function registrarRecebimentoDestinado(input: unknown): Promise<Resultado<{ recebimentoId: string }>> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.FINANCEIRO);
    const dados = analisarComDatasDaEscola(RecebimentoDestinadoSchema, input, await fusoDaEscola());
    const resultado = await prisma.$transaction(async (tx) => {
      if (dados.comprovanteUrl) await exigirArquivoVinculavel(autor, dados.comprovanteUrl, { matriculaId: dados.titularMatriculaId, categoriaDocumento: "COMPROVANTE" }, tx);
      const r = await receberComDestinacoesTx(tx, { ...dados, dataDigitada: true, autorId: autor.id, pagadorId: dados.pagadorId ?? null, comentario: dados.comentario ?? null, comprovanteUrl: dados.comprovanteUrl ?? null, comprovanteNome: dados.comprovanteNome ?? null, destinos: dados.destinos.map((d) => ({ ...d, cobrancaId: d.cobrancaId ?? undefined })) });
      return r.id;
    });
    for (const cobrancaId of [...new Set(dados.destinos.flatMap((d) => d.cobrancaId ? [d.cobrancaId] : []))]) await reavaliarAcessoAposCommit(cobrancaId);
    revalidatePath("/financeiro", "layout"); revalidatePath("/alunos", "layout");
    return { recebimentoId: resultado };
  });
}

export async function conferirPagamento(informeId: string, input: { versao: number; confirmar: boolean; motivo?: string }): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.FINANCEIRO);
    const dados = ConferenciaSchema.parse(input);
    const cobrancaId = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "PagamentoInformado" WHERE id = ${informeId} FOR UPDATE`;
      const informe = await tx.pagamentoInformado.findUnique({ where: { id: informeId } });
      if (!informe) throw new ErroRegra("Informe não encontrado.");
      exigirConferenciaIndependente(informe.autorId, autor.id);
      if (informe.versao !== dados.versao) throw new ErroRegra("Versão do informe inválida. Atualize a tela.");
      if (informe.status === (dados.confirmar ? "CONFIRMADO" : "REJEITADO") && informe.conferenteId === autor.id) return informe.cobrancaId;
      if (informe.status !== "A_CONFERIR" || informe.versao !== dados.versao) throw new ErroRegra("O informe já mudou ou foi conferido; atualize a tela.");
      if (dados.confirmar) {
        const evidenciaInforme = informe.comprovanteUrl
          ? `informe:${informe.id}; comprovante:${informe.comprovanteUrl}; autor:${informe.autorId}; data:${informe.dataPagamento.toISOString()}`
          : informe.comprovanteNome
            ? `informe:${informe.id}; comprovante:${informe.comprovanteNome}; autor:${informe.autorId}; data:${informe.dataPagamento.toISOString()}`
            : `informe:${informe.id}; autor:${informe.autorId}; data:${informe.dataPagamento.toISOString()}; protocolo:${informe.chaveIdempotencia}`;
        await receberTx(tx, {
          cobrancaId: informe.cobrancaId, chaveIdempotencia: `informe:${informe.id}:${informe.versao}`,
          informeId: informe.id, autorId: autor.id, valorRecebido: numero(informe.valor), forma: informe.forma,
          dataPagamento: informe.dataPagamento, comprovanteUrl: informe.comprovanteUrl,
          comprovanteNome: informe.comprovanteNome, comentario: informe.comentario,
          permitirExcedente: informe.permitirExcedente,
          moeda: informe.moeda,
          evidencia: evidenciaInforme,
        });
      }
      await tx.pagamentoInformado.update({ where: { id: informe.id }, data: {
        status: dados.confirmar ? "CONFIRMADO" : "REJEITADO", conferenteId: autor.id, conferidoEm: new Date(),
        motivoConferencia: dados.motivo ?? null,
      } });
      await registrarEvento(tx, { tipo: dados.confirmar ? "PagamentoConfirmado" : "PagamentoRejeitado",
        agregadoTipo: "Cobranca", agregadoId: informe.cobrancaId, autorId: autor.id,
        payload: { informeId, versao: informe.versao, motivo: dados.motivo ?? null } });
      return informe.cobrancaId;
    });
    await reavaliarAcessoAposCommit(cobrancaId);
    revalidatePath("/financeiro", "layout"); revalidatePath("/alunos", "layout");
  });
}

function mesmaPoliticaComissao(
  p: { tipo: string; percentual: Prisma.Decimal | null; valorFixo: Prisma.Decimal | null; moeda: string; vigenteEm: Date; base: string },
  d: { tipo: string; percentual: number | null; valorFixo: number | null; moeda: string; vigenteEm: Date },
): boolean {
  const igual = (a: Prisma.Decimal | null, b: number | null) => (a === null || b === null ? a === b : a.equals(new Prisma.Decimal(b).toDecimalPlaces(2)));
  return p.base === "TAXA_MATRICULA" && p.tipo === d.tipo && p.moeda === d.moeda && p.vigenteEm.getTime() === d.vigenteEm.getTime()
    && igual(p.percentual, d.percentual) && igual(p.valorFixo, d.valorFixo);
}

export async function publicarPoliticaComissao(input: PoliticaComissaoInput): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.FINANCEIRO, Papel.GERENTE_COMERCIAL);
    await exigirCapacidade(autor, "comissao.configurar");
    const dados = PoliticaComissaoSchema.parse(input);
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Produto" WHERE id = ${dados.produtoId} FOR UPDATE`;
      const pais = await tx.pais.findUnique({ where: { id: dados.paisId } });
      const produto = await tx.produto.findUnique({ where: { id: dados.produtoId } });
      if (!pais || !produto || pais.moedaLocal !== dados.moeda) throw new ErroRegra("Oferta/moeda inválida para a política.");
      const anterior = await tx.politicaComissao.findFirst({ where: { paisId: pais.id, produtoId: produto.id }, orderBy: { versao: "desc" } });
      if (anterior && anterior.criadaPorId === autor.id && mesmaPoliticaComissao(anterior, dados)) return;
      if (dados.vigenteEm.getTime() < Date.now() - 60_000) throw new ErroRegra("Publique a política com vigência atual ou futura.");
      if (anterior && dados.vigenteEm <= anterior.vigenteEm) throw new ErroRegra("A nova versão deve começar depois da versão anterior.");
      if (anterior) await tx.politicaComissao.update({ where: { id: anterior.id }, data: { encerraEm: dados.vigenteEm } });
      const politica = await tx.politicaComissao.create({ data: {
        ...dados, base: "TAXA_MATRICULA", criadaPorId: autor.id, versao: (anterior?.versao ?? 0) + 1,
      } });
      await registrarEvento(tx, { tipo: "PoliticaComissaoPublicada", agregadoTipo: "PoliticaComissao", agregadoId: politica.id,
        autorId: autor.id, payload: { versao: politica.versao, tipo: politica.tipo, vigenteEm: politica.vigenteEm.toISOString() } });
    });
    revalidatePath("/financeiro", "layout"); revalidatePath("/matriculas/nova");
  });
}

export async function registrarCobrancaWhatsApp(
  cobrancaId: string,
  modelo: ModeloWhatsapp,
  passo?: PassoRegua,
  cicloRegua = 0,
): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(...PAPEIS_BAIXA);
    const dados = RegistroCobrancaWhatsAppSchema.parse({ cobrancaId, modelo, passo: passo ?? null, cicloRegua });

    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Cobranca" WHERE id = ${dados.cobrancaId} FOR SHARE`;
      await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${autor.id} FOR SHARE`;
      const [usuario, cobranca] = await Promise.all([
        tx.usuario.findUnique({ where: { id: autor.id }, select: { ativo: true, papeis: true } }),
        tx.cobranca.findUnique({ where: { id: dados.cobrancaId }, select: { cicloRegua: true } }),
      ]);
      if (!usuario?.ativo || !usuario.papeis.some((p) => p === Papel.ADMINISTRADOR || PAPEIS_BAIXA.includes(p))) throw new ErroPermissao();
      if (!cobranca) throw new ErroRegra("Cobrança não encontrada.");
      if (dados.cicloRegua > cobranca.cicloRegua) throw new ErroRegra("Ciclo de cobrança inválido. Atualize a fila financeira.");
      await registrarEventoCobrancaEnviada(tx, {
        cobrancaId: dados.cobrancaId,
        modelo: dados.modelo,
        passo: dados.passo,
        cicloRegua: dados.cicloRegua,
        canal: "manual",
        autorId: autor.id,
      });
    });
    revalidatePath("/financeiro", "layout");
  });
}

export async function fecharMesComissoes(input: { chaveIdempotencia?: string } = {}): Promise<Resultado<{ pagas: number }>> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(...PAPEIS_COMISSAO);
    const marca = marcaIdempotencia(ChaveIdempotenciaSchema.optional().parse(input.chaveIdempotencia), { acao: "fecharMesComissoes" });
    const pagas = await prisma.$transaction(async (tx) => {
      if (marca) {
        const repetido = await repeticaoIdempotente(tx, {
          tipo: "ComissaoPaga", agregadoTipo: "Comissao", autorId: autor.id, marca,
          mensagemConflito: "Esta tentativa já foi usada em outra operação. Recarregue a página e confira as comissões antes de repetir.",
        });
        if (repetido) {
          const [{ n }] = await tx.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM "Evento"
            WHERE "tipo" = 'ComissaoPaga' AND "autorId" = ${autor.id}
              AND "payload" ? 'chaveIdempotencia' AND ("payload" ->> 'chaveIdempotencia') = ${marca.chaveIdempotencia}
              AND "agregadoTipo" = 'Comissao'`;
          return n;
        }
      }
      return fecharComissoesAprovadasTx(tx, autor.id, null, marca);
    });
    if (pagas === 0) throw new ErroRegra("Nenhuma comissão aprovada para pagar.");
    revalidatePath("/financeiro", "layout");
    return { pagas };
  });
}

export async function fecharComissoesAprovadasTx(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  autorId: string | null,
  aprovadasAntesDe: Date | null = null,
  marca: MarcaIdempotencia | null = null,
): Promise<number> {
  const bloqueadas = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Comissao" WHERE status = 'APROVADA' ORDER BY id FOR UPDATE`;
  const aprovadas = await tx.comissao.findMany({
    where: {
      id: { in: bloqueadas.map(c => c.id) },
      status: StatusComissao.APROVADA,
      ...(aprovadasAntesDe
        ? {
            OR: [
              { aprovadaEm: { lt: aprovadasAntesDe } },
              { aprovadaEm: null, criadoEm: { lt: aprovadasAntesDe } },
            ],
          }
        : {}),
    },
  });
  const agora = new Date();
  for (const c of aprovadas) {
    await tx.comissao.update({
      where: { id: c.id },
      data: { status: StatusComissao.PAGA, pagaEm: agora },
    });
    await registrarEvento(tx, {
      tipo: "ComissaoPaga",
      agregadoTipo: "Comissao",
      agregadoId: c.id,
      autorId,
      payload: { pagaEm: agora.toISOString(), valor: numero(c.valor), moeda: c.moeda, politicaId: c.politicaId, ...marca },
    });
  }
  return aprovadas.length;
}

export async function salvarConfigFinanceiro(input: { fechamentoComissaoAutomatico: boolean }): Promise<Resultado> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(...PAPEIS_COMISSAO);
    const ligado = !!input.fechamentoComissaoAutomatico;
    await prisma.$transaction(async (tx) => {
      const antes = await tx.configFinanceiro.findUnique({ where: { id: "financeiro" } });
      await tx.configFinanceiro.upsert({
        where: { id: "financeiro" },
        create: { id: "financeiro", fechamentoComissaoAutomatico: ligado },
        update: { fechamentoComissaoAutomatico: ligado },
      });
      await registrarEvento(tx, {
        tipo: "ConfigFinanceiroAlterada",
        agregadoTipo: "ConfigFinanceiro",
        agregadoId: "financeiro",
        autorId: autor.id,
        payload: { antes: antes?.fechamentoComissaoAutomatico ?? false, depois: ligado },
      });
    });
    revalidatePath("/financeiro", "layout");
  });
}

export async function salvarDiaPrevisaoComissao(input: { dia: number }): Promise<Resultado<{ dia: number }>> {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.FINANCEIRO, Papel.GERENTE_COMERCIAL);
    await exigirCapacidade(autor, "comissao.configurar");
    const parsed = DiaPrevisaoComissaoSchema.safeParse(input?.dia);
    if (!parsed.success) throw new ErroRegra(`Informe um dia entre ${DIA_PREVISAO_COMISSAO_MIN} e ${DIA_PREVISAO_COMISSAO_MAX}.`);
    const para = parsed.data;
    await prisma.$transaction(async (tx) => {
      await tx.configFinanceiro.upsert({ where: { id: "financeiro" }, create: { id: "financeiro" }, update: {} });
      await tx.$queryRaw`SELECT id FROM "ConfigFinanceiro" WHERE id = 'financeiro' FOR UPDATE`;
      const antes = await tx.configFinanceiro.findUniqueOrThrow({ where: { id: "financeiro" } });
      const de = antes.diaPrevisaoPagamentoComissao;
      if (de === para) return;
      await tx.configFinanceiro.update({ where: { id: "financeiro" }, data: { diaPrevisaoPagamentoComissao: para } });
      await registrarEvento(tx, {
        tipo: "DiaPrevisaoComissaoAlterado",
        agregadoTipo: "ConfigFinanceiro",
        agregadoId: "financeiro",
        autorId: autor.id,
        payload: { de, para },
      });
    });
    revalidatePath("/financeiro", "layout");
    revalidatePath("/comissoes");
    return { dia: para };
  });
}

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
    revalidatePath("/financeiro", "layout");
    return { salvas: entradas.length };
  });
}

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
    revalidatePath("/financeiro", "layout");
    return { atualizadas: entradas.length, semCotacao };
  });
}

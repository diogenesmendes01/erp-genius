"use server";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroPermissao, ErroRegra, registrarEvento } from "@/server/_shared";
import { hashSubstituicao } from "@/server/contratos/substituicao-estado";
import { calcularExcedentePermuta } from "./excedente-permuta-calculo";
import { carregarOrigensExcedentePermutaTx } from "./excedente-permuta-origens-tx";

// Q167C/Q171: o excedente de permuta nunca vira crédito ou devolução sozinho. Financeiro propõe a destinação
// negociada, registram-se as concordâncias do aluno (ou responsável) e da escola, e outro aprovador financeiro
// decide; os destinos (saldo restrito a serviços e/ou crédito financeiro) nascem na transação da decisão.
const id = z.string().trim().min(1).max(100);
const dinheiro = z.string().regex(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/, "Informe valor com até duas casas.");
const texto = z.string().trim().min(5).max(2000);
const Preparar = z.object({
  matriculaId: id, cobrancaId: id, valorDevidoAcordado: dinheiro,
  distribuicao: z.array(z.object({ origemId: id, valor: dinheiro }).strict()).max(50).optional(),
  itens: z.array(z.object({ tipo: z.enum(["SALDO_SERVICOS", "CREDITO_FINANCEIRO"]), valor: dinheiro }).strict()).min(1).max(2),
  motivo: texto, chaveIdempotencia: z.string().trim().min(8).max(100),
}).strict();
const Concordar = z.object({ propostaId: id, parte: z.enum(["ALUNO_OU_RESPONSAVEL", "ESCOLA"]), nomeDeclarante: z.string().trim().min(2).max(200), meio: z.string().trim().min(2).max(100), evidencia: z.string().trim().min(5).max(4000) }).strict();
const Decidir = z.object({ propostaId: id, aprovada: z.boolean(), motivo: texto }).strict();

async function autorFinanceiro(tx: Prisma.TransactionClient, autorId: string, aprovacao = false) {
  await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id=${autorId} FOR SHARE`;
  const u = await tx.usuario.findUnique({ where: { id: autorId }, select: { ativo: true, papeis: true, permissoes: true } });
  if (!u?.ativo || !u.papeis.some(p => p === Papel.ADMINISTRADOR || p === Papel.FINANCEIRO)
    || (aprovacao && !u.papeis.includes(Papel.ADMINISTRADOR) && !u.permissoes.includes("financeiro.aprovar_acertos"))) throw new ErroPermissao();
  return u;
}
async function bloquear(tx: Prisma.TransactionClient, matriculaId: string, cobrancaId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola',0))`;
  await tx.$queryRaw`SELECT id FROM "Matricula" WHERE id=${matriculaId} FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM "Cobranca" WHERE id=${cobrancaId} FOR UPDATE`;
}

/** Fotografia = fontes reais da cobrança + aritmética do excedente. É recalculada na decisão; qualquer mudança invalida a proposta. */
async function apurarTx(tx: Prisma.TransactionClient, d: { matriculaId: string; cobrancaId: string; valorDevidoAcordado: string; distribuicao?: { origemId: string; valor: string }[] }) {
  const fontes = await carregarOrigensExcedentePermutaTx(tx, { matriculaId: d.matriculaId, cobrancaId: d.cobrancaId });
  if (fontes.status !== "PRONTA") throw new ErroRegra(`As fontes de liquidação desta cobrança ainda não são finais: ${fontes.pendencias.map((pendencia) => pendencia.codigo).join(", ")}`);
  const calculo = calcularExcedentePermuta({ cobrancaId: d.cobrancaId, versaoCobranca: fontes.fotografia.versaoCobranca, moeda: fontes.fotografia.moeda,
    valorDevido: d.valorDevidoAcordado, origens: fontes.origens, ...(d.distribuicao ? { distribuicao: d.distribuicao } : {}) });
  if (calculo.status === "DISTRIBUICAO_MISTA_PENDENTE") throw new ErroRegra("A redução mistura fontes de liquidação. Informe a distribuição por origem acordada antes de propor a destinação.");
  if (calculo.status === "SEM_EXCEDENTE_SERVICO" || !calculo.excedentesServico.length) throw new ErroRegra("Esta cobrança não possui excedente de serviço a destinar com a obrigação informada.");
  const fotografia = JSON.parse(JSON.stringify({ fontes: fontes.fotografia, origens: fontes.origens, calculo })) as Prisma.JsonObject;
  return { fotografia, fotografiaHash: hashSubstituicao(fotografia), versaoCobranca: fontes.fotografia.versaoCobranca, moeda: fontes.fotografia.moeda,
    valorExcedente: new Prisma.Decimal(calculo.excedenteServico), excedentes: calculo.excedentesServico };
}

export async function prepararDestinacaoExcedentePermuta(input: z.input<typeof Preparar>) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.FINANCEIRO), d = Preparar.parse(input), entradaHash = hashSubstituicao(d);
    if (new Set(d.itens.map(i => i.tipo)).size !== d.itens.length) throw new ErroRegra("Informe cada destino uma única vez.");
    return prisma.$transaction(async tx => {
      await bloquear(tx, d.matriculaId, d.cobrancaId); await autorFinanceiro(tx, autor.id);
      const repetida = await tx.propostaDestinacaoExcedentePermuta.findUnique({ where: { preparadorId_chaveIdempotencia: { preparadorId: autor.id, chaveIdempotencia: d.chaveIdempotencia } } });
      if (repetida) { if (repetida.entradaHash !== entradaHash) throw new ErroRegra("A chave já corresponde a outra destinação."); return { id: repetida.id, valorExcedente: repetida.valorExcedente.toFixed(2) }; }
      // O cálculo não conhece destinações anteriores; uma segunda contaria o mesmo excedente de novo.
      if (await tx.propostaDestinacaoExcedentePermuta.count({ where: { cobrancaId: d.cobrancaId, decisao: { is: { aprovada: true } } } })) throw new ErroRegra("Esta cobrança já possui destinação de excedente aprovada. Nova redução da obrigação exige conferência financeira específica.");
      if (await tx.propostaDestinacaoExcedentePermuta.count({ where: { cobrancaId: d.cobrancaId, decisao: null } })) throw new ErroRegra("Já existe destinação de excedente aguardando decisão para esta cobrança.");
      const apuracao = await apurarTx(tx, d);
      const totalItens = d.itens.reduce((s, i) => s.plus(i.valor), new Prisma.Decimal(0));
      if (d.itens.some(i => new Prisma.Decimal(i.valor).lte(0)) || !totalItens.equals(apuracao.valorExcedente)) throw new ErroRegra(`Os destinos precisam somar exatamente o excedente apurado (${apuracao.valorExcedente.toFixed(2)} ${apuracao.moeda}).`);
      const proposta = await tx.propostaDestinacaoExcedentePermuta.create({ data: {
        matriculaId: d.matriculaId, cobrancaId: d.cobrancaId, versaoCobranca: apuracao.versaoCobranca, moeda: apuracao.moeda, valorDevidoAcordado: d.valorDevidoAcordado, valorExcedente: apuracao.valorExcedente,
        fotografia: apuracao.fotografia, fotografiaHash: apuracao.fotografiaHash, preparadorId: autor.id, motivo: d.motivo, chaveIdempotencia: d.chaveIdempotencia, entradaHash } });
      for (const e of apuracao.excedentes) await tx.origemExcedentePermuta.create({ data: { propostaId: proposta.id, aplicacaoPermutaId: e.aplicacaoPermutaId, valor: e.valor } });
      for (const i of d.itens) await tx.itemDestinacaoExcedentePermuta.create({ data: { propostaId: proposta.id, tipo: i.tipo, valor: i.valor } });
      await registrarEvento(tx, { tipo: "DestinacaoExcedentePermutaProposta", agregadoTipo: "Matricula", agregadoId: d.matriculaId, autorId: autor.id,
        payload: { propostaId: proposta.id, cobrancaId: d.cobrancaId, valorExcedente: apuracao.valorExcedente.toFixed(2), moeda: apuracao.moeda, itens: d.itens } });
      return { id: proposta.id, valorExcedente: apuracao.valorExcedente.toFixed(2) };
    }, { timeout: 30000 });
  });
}

/** Concordância de uma das partes, com quem declarou, por qual meio e a evidência. Não decide nem aplica nada. */
export async function registrarConcordanciaExcedentePermuta(input: z.input<typeof Concordar>) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.FINANCEIRO, Papel.SECRETARIA_ACADEMICA), d = Concordar.parse(input);
    return prisma.$transaction(async tx => {
      const p = await tx.propostaDestinacaoExcedentePermuta.findUnique({ where: { id: d.propostaId }, select: { id: true, matriculaId: true, cobrancaId: true, decisao: { select: { id: true } } } });
      if (!p) throw new ErroRegra("Destinação não encontrada.");
      await bloquear(tx, p.matriculaId, p.cobrancaId);
      if (p.decisao) throw new ErroRegra("A destinação já foi decidida.");
      const anterior = await tx.concordanciaDestinacaoExcedentePermuta.findUnique({ where: { propostaId_parte: { propostaId: p.id, parte: d.parte } } });
      if (anterior) {
        if (anterior.nomeDeclarante !== d.nomeDeclarante || anterior.meio !== d.meio || anterior.evidencia !== d.evidencia) throw new ErroRegra("Esta parte já possui concordância registrada. Para mudar o acordo, rejeite a proposta e prepare outra.");
        return { id: anterior.id };
      }
      const c = await tx.concordanciaDestinacaoExcedentePermuta.create({ data: { ...d, registradaPorId: autor.id } });
      await registrarEvento(tx, { tipo: "ConcordanciaExcedentePermutaRegistrada", agregadoTipo: "Matricula", agregadoId: p.matriculaId, autorId: autor.id, payload: { propostaId: p.id, concordanciaId: c.id, parte: d.parte } });
      return { id: c.id };
    }, { timeout: 30000 });
  });
}

export async function decidirDestinacaoExcedentePermuta(input: z.input<typeof Decidir>) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.FINANCEIRO), d = Decidir.parse(input);
    return prisma.$transaction(async tx => {
      const referencia = await tx.propostaDestinacaoExcedentePermuta.findUnique({ where: { id: d.propostaId }, select: { matriculaId: true, cobrancaId: true } });
      if (!referencia) throw new ErroRegra("Destinação não encontrada.");
      await bloquear(tx, referencia.matriculaId, referencia.cobrancaId); await autorFinanceiro(tx, autor.id, true);
      const p = await tx.propostaDestinacaoExcedentePermuta.findUniqueOrThrow({ where: { id: d.propostaId }, include: { decisao: true, itens: true, concordancias: true } });
      if (p.decisao) {
        if (p.decisao.decisorId !== autor.id || p.decisao.aprovada !== d.aprovada || p.decisao.motivo !== d.motivo) throw new ErroRegra("A destinação já recebeu outra decisão.");
        return { id: p.decisao.id, aprovada: p.decisao.aprovada };
      }
      if (p.preparadorId === autor.id) throw new ErroRegra("A decisão exige outra pessoa.");
      if (d.aprovada) {
        if (p.concordancias.length !== 2) throw new ErroRegra("Registre a concordância do aluno ou responsável e a da escola antes de aprovar.");
        const foto = z.object({ calculo: z.object({ distribuicao: z.array(z.object({ origemId: z.string(), valor: z.string() })).optional() }) }).parse(p.fotografia);
        const atual = await apurarTx(tx, { matriculaId: p.matriculaId, cobrancaId: p.cobrancaId, valorDevidoAcordado: p.valorDevidoAcordado.toFixed(2),
          ...(foto.calculo.distribuicao ? { distribuicao: foto.calculo.distribuicao.map(x => ({ origemId: x.origemId, valor: x.valor })) } : {}) });
        if (atual.fotografiaHash !== p.fotografiaHash) throw new ErroRegra("As fontes de liquidação ou a cobrança mudaram depois da proposta. Prepare nova destinação.");
      }
      const decisao = await tx.decisaoDestinacaoExcedentePermuta.create({ data: { propostaId: p.id, decisorId: autor.id, aprovada: d.aprovada, motivo: d.motivo, fotografiaHash: p.fotografiaHash } });
      const destinos: { tipo: string; id: string; creditoId?: string }[] = [];
      if (d.aprovada) for (const item of p.itens) {
        if (item.tipo === "SALDO_SERVICOS") {
          const saldo = await tx.saldoServicoPermuta.create({ data: { itemId: item.id, decisaoId: decisao.id, matriculaId: p.matriculaId, moeda: p.moeda, valorInicial: item.valor } });
          destinos.push({ tipo: item.tipo, id: saldo.id });
        } else {
          const origem = await tx.origemCreditoExcedentePermuta.create({ data: { itemId: item.id, decisaoId: decisao.id, matriculaId: p.matriculaId, cobrancaId: p.cobrancaId, valor: item.valor, moeda: p.moeda } });
          const credito = await tx.creditoMatricula.create({ data: { matriculaId: p.matriculaId, moeda: p.moeda, valorInicial: item.valor, origemExcedentePermutaId: origem.id } });
          destinos.push({ tipo: item.tipo, id: origem.id, creditoId: credito.id });
        }
      }
      await registrarEvento(tx, { tipo: "DestinacaoExcedentePermutaDecidida", agregadoTipo: "Matricula", agregadoId: p.matriculaId, autorId: autor.id, payload: { propostaId: p.id, decisaoId: decisao.id, aprovada: d.aprovada, destinos } });
      return { id: decisao.id, aprovada: decisao.aprovada };
    }, { timeout: 30000 });
  });
}

/** Painel da matrícula: cobranças compensadas por permuta, destinações e saldo restrito a serviços. */
export async function consultarDestinacoesExcedentePermuta(input: { matriculaId: string }) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.FINANCEIRO), d = z.object({ matriculaId: id }).strict().parse(input);
    return prisma.$transaction(async tx => {
      const usuario = await autorFinanceiro(tx, autor.id);
      const aprova = usuario.papeis.includes(Papel.ADMINISTRADOR) || usuario.permissoes.includes("financeiro.aprovar_acertos");
      const [cobrancas, propostas, saldos] = await Promise.all([
        tx.cobranca.findMany({ where: { matriculaId: d.matriculaId, valorCompensadoPermuta: { gt: 0 } }, orderBy: [{ vencimento: "asc" }, { id: "asc" }], take: 100,
          select: { id: true, tipo: true, versao: true, moeda: true, status: true, vencimento: true, valorNegociado: true, valorRecebido: true, valorLiquidadoCredito: true, valorCompensadoPermuta: true } }),
        tx.propostaDestinacaoExcedentePermuta.findMany({ where: { matriculaId: d.matriculaId }, orderBy: [{ criadaEm: "desc" }, { id: "desc" }], take: 50,
          include: { itens: true, concordancias: { orderBy: { parte: "asc" } }, decisao: true, preparador: { select: { nome: true } } } }),
        tx.saldoServicoPermuta.findMany({ where: { matriculaId: d.matriculaId }, orderBy: [{ criadoEm: "asc" }, { id: "asc" }], select: { id: true, moeda: true, valorInicial: true, criadoEm: true } }),
      ]);
      // As fontes reais de cada cobrança orientam quem prepara a distribuição; a leitura não altera nada.
      const fontes = new Map<string, { prontas: boolean; pendencias: string[]; origens: { id: string; tipo: string; valor: string }[] }>();
      for (const c of cobrancas) {
        try {
          const f = await carregarOrigensExcedentePermutaTx(tx, { matriculaId: d.matriculaId, cobrancaId: c.id });
          fontes.set(c.id, { prontas: f.status === "PRONTA", pendencias: f.pendencias.map(x => x.codigo), origens: f.origens.map(o => ({ id: o.id, tipo: o.tipo, valor: new Prisma.Decimal(o.valor).toFixed(2) })) });
        } catch (erro) {
          if (!(erro instanceof ErroRegra)) throw erro;
          fontes.set(c.id, { prontas: false, pendencias: [erro.message], origens: [] });
        }
      }
      return {
        matriculaId: d.matriculaId,
        cobrancas: cobrancas.map(c => ({ fontes: fontes.get(c.id)!, id: c.id, tipo: c.tipo, versao: c.versao, moeda: c.moeda, status: c.status, vencimento: c.vencimento.toISOString(), valorNegociado: c.valorNegociado.toFixed(2),
          liquidado: new Prisma.Decimal(c.valorRecebido ?? 0).plus(c.valorLiquidadoCredito).plus(c.valorCompensadoPermuta).toFixed(2), permuta: c.valorCompensadoPermuta.toFixed(2),
          emAndamento: propostas.some(p => p.cobrancaId === c.id && !p.decisao),
          destinada: propostas.some(p => p.cobrancaId === c.id && p.decisao?.aprovada) })),
        propostas: propostas.map(p => ({ id: p.id, cobrancaId: p.cobrancaId, moeda: p.moeda, valorDevidoAcordado: p.valorDevidoAcordado.toFixed(2), valorExcedente: p.valorExcedente.toFixed(2), motivo: p.motivo,
          preparador: p.preparador.nome, criadaEm: p.criadaEm.toISOString(), itens: p.itens.map(i => ({ tipo: i.tipo, valor: i.valor.toFixed(2) })),
          concordancias: p.concordancias.map(k => ({ parte: k.parte, nomeDeclarante: k.nomeDeclarante, meio: k.meio, evidencia: k.evidencia, registradaEm: k.registradaEm.toISOString() })),
          partesPendentes: (["ALUNO_OU_RESPONSAVEL", "ESCOLA"] as const).filter(parte => !p.concordancias.some(k => k.parte === parte)),
          estado: p.decisao ? (p.decisao.aprovada ? "APROVADA" : "REJEITADA") : "PENDENTE",
          podeDecidir: !p.decisao && aprova && p.preparadorId !== autor.id,
          decisao: p.decisao ? { aprovada: p.decisao.aprovada, motivo: p.decisao.motivo, decididaEm: p.decisao.decididaEm.toISOString() } : null })),
        saldosServico: saldos.map(s => ({ id: s.id, moeda: s.moeda, valorInicial: s.valorInicial.toFixed(2), criadoEm: s.criadoEm.toISOString() })),
      };
    });
  });
}

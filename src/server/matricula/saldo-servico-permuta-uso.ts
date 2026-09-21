"use server";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroPermissao, ErroRegra, registrarEvento } from "@/server/_shared";
import { hashSubstituicao } from "@/server/contratos/substituicao-estado";
import { reavaliarAcessoAutomaticoDaCobranca } from "@/server/cobrancas/acesso-aulas";

// Q171: uso do saldo restrito a serviços. Abate mensalidade, hora particular ou taxa em aberto da MESMA matrícula,
// na moeda do saldo, por proposta do Financeiro e decisão de outro aprovador. A aprovação nasce como aplicação de
// compensação de permuta (crédito de serviço) na mesma transação; o saldo não expira e nunca vira dinheiro.
const id = z.string().trim().min(1).max(100);
const dinheiro = z.string().regex(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/, "Informe valor com até duas casas.");
const texto = z.string().trim().min(5).max(2000);
const Propor = z.object({ saldoId: id, cobrancaId: id, valor: dinheiro, motivo: texto, chaveIdempotencia: z.string().trim().min(8).max(100) }).strict();
const Decidir = z.object({ propostaId: id, aprovada: z.boolean(), motivo: texto }).strict();
const TIPOS_ABATIVEIS = ["MENSALIDADE", "HORA_PARTICULAR", "MATRICULA"] as const;

async function autorFinanceiro(tx: Prisma.TransactionClient, autorId: string, aprovacao = false) {
  await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id=${autorId} FOR SHARE`;
  const u = await tx.usuario.findUnique({ where: { id: autorId }, select: { ativo: true, papeis: true, permissoes: true } });
  if (!u?.ativo || !u.papeis.some(p => p === Papel.ADMINISTRADOR || p === Papel.FINANCEIRO)
    || (aprovacao && !u.papeis.includes(Papel.ADMINISTRADOR) && !u.permissoes.includes("financeiro.aprovar_acertos"))) throw new ErroPermissao();
  return u;
}
async function bloquear(tx: Prisma.TransactionClient, matriculaId: string, cobrancaId: string, saldoId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola',0))`;
  await tx.$queryRaw`SELECT id FROM "Matricula" WHERE id=${matriculaId} FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM "Cobranca" WHERE id=${cobrancaId} FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM "SaldoServicoPermuta" WHERE id=${saldoId} FOR UPDATE`;
}

/** Disponível = inicial − usos aprovados − propostas pendentes (a pendente reserva para não prometer duas vezes). */
export async function saldoServicoDisponivelTx(tx: Prisma.TransactionClient, saldoId: string, ignorarPropostaId?: string) {
  const s = await tx.saldoServicoPermuta.findUniqueOrThrow({ where: { id: saldoId }, select: { valorInicial: true, usos: { select: { id: true, valor: true, decisao: { select: { aprovada: true } } } } } });
  const comprometido = s.usos.filter(u => u.id !== ignorarPropostaId && (!u.decisao || u.decisao.aprovada)).reduce((acc, u) => acc.plus(u.valor), new Prisma.Decimal(0));
  return { inicial: s.valorInicial, disponivel: s.valorInicial.minus(comprometido), aprovado: s.usos.filter(u => u.decisao?.aprovada).reduce((acc, u) => acc.plus(u.valor), new Prisma.Decimal(0)) };
}

export async function proporUsoSaldoServicoPermuta(input: z.input<typeof Propor>) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.FINANCEIRO), d = Propor.parse(input), entradaHash = hashSubstituicao(d);
    return prisma.$transaction(async tx => {
      const saldo = await tx.saldoServicoPermuta.findUnique({ where: { id: d.saldoId }, select: { id: true, matriculaId: true, moeda: true } });
      if (!saldo) throw new ErroRegra("Saldo de serviços não encontrado.");
      await bloquear(tx, saldo.matriculaId, d.cobrancaId, saldo.id); await autorFinanceiro(tx, autor.id);
      const repetida = await tx.propostaUsoSaldoServicoPermuta.findUnique({ where: { preparadorId_chaveIdempotencia: { preparadorId: autor.id, chaveIdempotencia: d.chaveIdempotencia } } });
      if (repetida) { if (repetida.entradaHash !== entradaHash) throw new ErroRegra("A chave já corresponde a outro uso."); return { id: repetida.id }; }
      const c = await tx.cobranca.findUnique({ where: { id: d.cobrancaId }, select: { id: true, matriculaId: true, moeda: true, tipo: true, status: true, saldo: true, versao: true } });
      if (!c || c.matriculaId !== saldo.matriculaId) throw new ErroRegra("O saldo de serviços só abate cobranças da mesma matrícula.");
      if (c.moeda !== saldo.moeda) throw new ErroRegra(`O saldo de serviços está em ${saldo.moeda}; a cobrança está em ${c.moeda}.`);
      if (!TIPOS_ABATIVEIS.includes(c.tipo as typeof TIPOS_ABATIVEIS[number])) throw new ErroRegra("O saldo de serviços abate apenas mensalidade, hora particular ou taxa de matrícula.");
      if (!["PENDENTE", "ATRASADO"].includes(c.status) || c.saldo === null) throw new ErroRegra("A cobrança precisa estar em aberto.");
      const valor = new Prisma.Decimal(d.valor);
      if (valor.lte(0)) throw new ErroRegra("Informe valor positivo.");
      if (valor.gt(c.saldo)) throw new ErroRegra(`O valor excede o saldo da cobrança (${c.saldo.toFixed(2)} ${c.moeda}).`);
      const disponivel = await saldoServicoDisponivelTx(tx, saldo.id);
      if (valor.gt(disponivel.disponivel)) throw new ErroRegra(`O valor excede o saldo de serviços disponível (${disponivel.disponivel.toFixed(2)} ${saldo.moeda}).`);
      if (await tx.propostaUsoSaldoServicoPermuta.count({ where: { cobrancaId: c.id, decisao: null } })) throw new ErroRegra("Já existe uso de saldo de serviços aguardando decisão para esta cobrança.");
      const p = await tx.propostaUsoSaldoServicoPermuta.create({ data: { saldoId: saldo.id, matriculaId: saldo.matriculaId, cobrancaId: c.id, versaoCobranca: c.versao, moeda: c.moeda, valor, motivo: d.motivo, preparadorId: autor.id, chaveIdempotencia: d.chaveIdempotencia, entradaHash } });
      await registrarEvento(tx, { tipo: "UsoSaldoServicoPermutaProposto", agregadoTipo: "Matricula", agregadoId: saldo.matriculaId, autorId: autor.id, payload: { propostaId: p.id, saldoId: saldo.id, cobrancaId: c.id, valor: valor.toFixed(2), moeda: c.moeda } });
      return { id: p.id };
    }, { timeout: 30000 });
  });
}

export async function decidirUsoSaldoServicoPermuta(input: z.input<typeof Decidir>) {
  const resultado = await executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.FINANCEIRO), d = Decidir.parse(input);
    return prisma.$transaction(async tx => {
      const ref = await tx.propostaUsoSaldoServicoPermuta.findUnique({ where: { id: d.propostaId }, select: { matriculaId: true, cobrancaId: true, saldoId: true } });
      if (!ref) throw new ErroRegra("Uso de saldo não encontrado.");
      await bloquear(tx, ref.matriculaId, ref.cobrancaId, ref.saldoId); await autorFinanceiro(tx, autor.id, true);
      const p = await tx.propostaUsoSaldoServicoPermuta.findUniqueOrThrow({ where: { id: d.propostaId }, include: { decisao: true, cobranca: { select: { versao: true, status: true, saldo: true } } } });
      if (p.decisao) {
        if (p.decisao.decisorId !== autor.id || p.decisao.aprovada !== d.aprovada || p.decisao.motivo !== d.motivo) throw new ErroRegra("O uso já recebeu outra decisão.");
        return { id: p.decisao.id, aprovada: p.decisao.aprovada, cobrancaId: p.cobrancaId };
      }
      if (p.preparadorId === autor.id) throw new ErroRegra("A decisão exige outra pessoa.");
      if (d.aprovada) {
        if (p.cobranca.versao !== p.versaoCobranca || !["PENDENTE", "ATRASADO"].includes(p.cobranca.status) || p.cobranca.saldo === null || p.valor.gt(p.cobranca.saldo)) throw new ErroRegra("A cobrança mudou depois da proposta. Prepare novo uso.");
        const disponivel = await saldoServicoDisponivelTx(tx, p.saldoId, p.id);
        if (p.valor.gt(disponivel.disponivel)) throw new ErroRegra("Saldo de serviços insuficiente para aprovar este uso.");
      }
      const decisao = await tx.decisaoUsoSaldoServicoPermuta.create({ data: { propostaId: p.id, decisorId: autor.id, aprovada: d.aprovada, motivo: d.motivo } });
      let aplicacaoId: string | null = null;
      if (d.aprovada) {
        const aplicacao = await tx.aplicacaoCompensacaoPermuta.create({ data: { usoSaldoServicoId: decisao.id, cobrancaId: p.cobrancaId, valor: p.valor } });
        aplicacaoId = aplicacao.id;
      }
      await registrarEvento(tx, { tipo: "UsoSaldoServicoPermutaDecidido", agregadoTipo: "Matricula", agregadoId: p.matriculaId, autorId: autor.id, payload: { propostaId: p.id, decisaoId: decisao.id, aprovada: d.aprovada, aplicacaoId } });
      return { id: decisao.id, aprovada: decisao.aprovada, cobrancaId: p.cobrancaId };
    }, { timeout: 30000 });
  });
  // Mesmo pós-processamento da compensação por permuta: a cobrança pode ter sido quitada e liberar o acesso.
  if (resultado.ok && resultado.dado?.aprovada) {
    try { await reavaliarAcessoAutomaticoDaCobranca(resultado.dado.cobrancaId); }
    catch { console.error("[permuta] Uso do saldo de serviços confirmado; reavaliação do acesso pendente pelo cron institucional."); }
  }
  return resultado;
}

/** Painel do saldo: disponível, usos e cobranças abatíveis da matrícula. */
export async function consultarUsosSaldoServicoPermuta(input: { matriculaId: string }) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.FINANCEIRO), d = z.object({ matriculaId: id }).strict().parse(input);
    return prisma.$transaction(async tx => {
      const usuario = await autorFinanceiro(tx, autor.id);
      const aprova = usuario.papeis.includes(Papel.ADMINISTRADOR) || usuario.permissoes.includes("financeiro.aprovar_acertos");
      const [saldos, propostas, cobrancas] = await Promise.all([
        tx.saldoServicoPermuta.findMany({ where: { matriculaId: d.matriculaId }, orderBy: [{ criadoEm: "asc" }, { id: "asc" }], select: { id: true, moeda: true, valorInicial: true, criadoEm: true } }),
        tx.propostaUsoSaldoServicoPermuta.findMany({ where: { matriculaId: d.matriculaId }, orderBy: [{ criadaEm: "desc" }, { id: "desc" }], take: 100, include: { decisao: { include: { aplicacao: { select: { id: true } } } }, preparador: { select: { nome: true } } } }),
        tx.cobranca.findMany({ where: { matriculaId: d.matriculaId, tipo: { in: [...TIPOS_ABATIVEIS] }, status: { in: ["PENDENTE", "ATRASADO"] }, saldo: { gt: 0 } }, orderBy: [{ vencimento: "asc" }, { id: "asc" }], take: 100, select: { id: true, tipo: true, moeda: true, status: true, vencimento: true, saldo: true, versao: true } }),
      ]);
      const saldosSaida = [];
      for (const s of saldos) {
        const r = await saldoServicoDisponivelTx(tx, s.id);
        saldosSaida.push({ id: s.id, moeda: s.moeda, valorInicial: s.valorInicial.toFixed(2), usadoAprovado: r.aprovado.toFixed(2), disponivel: r.disponivel.toFixed(2), criadoEm: s.criadoEm.toISOString(),
          cobrancasAbativeis: r.disponivel.lte(0) ? [] : cobrancas.filter(c => c.moeda === s.moeda && !propostas.some(p => p.cobrancaId === c.id && !p.decisao)).map(c => ({ id: c.id, tipo: c.tipo, status: c.status, vencimento: c.vencimento.toISOString(), saldo: c.saldo!.toFixed(2), versao: c.versao })) });
      }
      return {
        matriculaId: d.matriculaId, saldos: saldosSaida,
        propostas: propostas.map(p => ({ id: p.id, saldoId: p.saldoId, cobrancaId: p.cobrancaId, moeda: p.moeda, valor: p.valor.toFixed(2), motivo: p.motivo, preparador: p.preparador.nome, criadaEm: p.criadaEm.toISOString(),
          estado: p.decisao ? (p.decisao.aprovada ? "APROVADA" : "REJEITADA") : "PENDENTE", podeDecidir: !p.decisao && aprova && p.preparadorId !== autor.id,
          decisao: p.decisao ? { aprovada: p.decisao.aprovada, motivo: p.decisao.motivo, decididaEm: p.decisao.decididaEm.toISOString(), aplicacaoId: p.decisao.aplicacao?.id ?? null } : null })),
      };
    });
  });
}

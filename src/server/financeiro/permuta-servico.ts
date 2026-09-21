"use server";
import { createHash } from "node:crypto";
import { Papel, Prisma, UnidadePermutaServico } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { reavaliarAcessoAposPermuta } from "./permuta-acesso";
import { executarAcao, exigirSessaoComPapel, ErroPermissao, ErroRegra, ErroAutenticacao, registrarEvento } from "@/server/_shared";
// As mutações desta unidade concluem dentro da transação. Somente rejeições
// conhecidas permitem revisar a entrada; falhas de transporte/banco são incertas.
async function executarPermuta<T>(acao: () => Promise<T>) {
  let podeRevisar = false;
  const resultado = await executarAcao(async () => {
    try { return await acao(); }
    catch (erro) {
      podeRevisar = erro instanceof z.ZodError || erro instanceof ErroRegra || erro instanceof ErroPermissao || erro instanceof ErroAutenticacao;
      throw erro;
    }
  });
  return resultado.ok ? resultado : { ...resultado, podeRevisar };
}

const texto = z.string().trim().min(5).max(2000), id = z.string().trim().min(1).max(100), valor = z.string().regex(/^\d{1,10}(?:\.\d{1,2})?$/);
const hash = (x: unknown) => createHash("sha256").update(JSON.stringify(x)).digest("hex");
async function financeiro(tx: Prisma.TransactionClient, usuarioId: string, aprovar = false) {
    await tx.$queryRaw `SELECT id FROM "Usuario" WHERE id=${usuarioId} FOR SHARE`;
    const u = await tx.usuario.findUnique({ where: { id: usuarioId }, select: { ativo: true, papeis: true, permissoes: true } });
    if (!u?.ativo || !u.papeis.some(p => p === Papel.FINANCEIRO || p === Papel.ADMINISTRADOR) || (aprovar && !u.papeis.includes(Papel.ADMINISTRADOR) && !u.permissoes.includes("financeiro.aprovar_acertos")))
        throw new ErroPermissao();
    return u;
}
export async function prepararAcordoPermuta(input: unknown) { return executarPermuta(async () => { const u = await exigirSessaoComPapel(Papel.FINANCEIRO); const d = z.object({ matriculaId: id, vigenciaInicio: z.string().date(), vigenciaFim: z.string().date(), moeda: z.string().trim().min(3).max(10), unidade: z.nativeEnum(UnidadePermutaServico), quantidadePactuada: valor, valorPorUnidade: valor, contrapartida: texto, formulaDescricao: texto, cobrancas: z.array(z.object({ cobrancaId: id, valorMaximo: valor }).strict()).min(1), chaveIdempotencia: z.string().min(8).max(100) }).strict().parse(input); const total = new Prisma.Decimal(d.quantidadePactuada).mul(d.valorPorUnidade).toFixed(2), entradaHash = hash(d); return prisma.$transaction(async (tx) => { await financeiro(tx, u.id); const anterior = await tx.acordoPermutaServico.findUnique({ where: { preparadorId_chaveIdempotencia: { preparadorId: u.id, chaveIdempotencia: d.chaveIdempotencia } } }); if (anterior) {
    if (anterior.entradaHash !== entradaHash)
        throw new ErroRegra("Chave já usada para outro acordo.");
    return { id: anterior.id, repetido: true };
} const a = await tx.acordoPermutaServico.create({ data: { matriculaId: d.matriculaId, preparadorId: u.id, vigenciaInicio: new Date(d.vigenciaInicio), vigenciaFim: new Date(d.vigenciaFim), moeda: d.moeda, unidade: d.unidade, quantidadePactuada: d.quantidadePactuada, valorPorUnidade: d.valorPorUnidade, valorTotalPactuado: total, contrapartida: d.contrapartida, formulaDescricao: d.formulaDescricao, chaveIdempotencia: d.chaveIdempotencia, entradaHash, cobrancasElegiveis: { create: d.cobrancas.map(c => ({ cobrancaId: c.cobrancaId, valorMaximo: c.valorMaximo })) } } }); await registrarEvento(tx, { tipo: "AcordoPermutaPreparado", agregadoTipo: "Matricula", agregadoId: d.matriculaId, autorId: u.id, payload: { acordoId: a.id, moeda: d.moeda, valorTotalPactuado: total } }); return { id: a.id, repetido: false }; }); }); }
export async function confirmarServicoPermuta(input: unknown) { return executarPermuta(async () => { const u = await exigirSessaoComPapel(Papel.GERENTE_PEDAGOGICO); const d = z.object({ acordoId: id, periodoInicio: z.string().date(), periodoFim: z.string().date(), quantidadeComprovada: valor, referenciaServico: z.string().trim().min(3).max(200), evidencia: texto, chaveIdempotencia: z.string().min(8).max(100) }).strict().parse(input); const entradaHash = hash(d); return prisma.$transaction(async (tx) => { await tx.$queryRaw `SELECT id FROM "Usuario" WHERE id=${u.id} FOR SHARE`; const atual = await tx.usuario.findUnique({ where: { id: u.id }, select: { ativo: true, papeis: true } }); if (!atual?.ativo || !atual.papeis.some(p => p === Papel.GERENTE_PEDAGOGICO || p === Papel.ADMINISTRADOR))
    throw new ErroPermissao(); const anterior = await tx.confirmacaoServicoPermuta.findUnique({ where: { confirmadorId_chaveIdempotencia: { confirmadorId: u.id, chaveIdempotencia: d.chaveIdempotencia } } }); if (anterior) {
    if (anterior.entradaHash !== entradaHash)
        throw new ErroRegra("Chave já usada para outra confirmação.");
    return { id: anterior.id, repetido: true };
} const a = await tx.acordoPermutaServico.findUniqueOrThrow({ where: { id: d.acordoId } }); const c = await tx.confirmacaoServicoPermuta.create({ data: { acordoId: a.id, confirmadorId: u.id, periodoInicio: new Date(d.periodoInicio), periodoFim: new Date(d.periodoFim), quantidadeComprovada: d.quantidadeComprovada, referenciaServico: d.referenciaServico, evidencia: d.evidencia, chaveIdempotencia: d.chaveIdempotencia, entradaHash } }); await registrarEvento(tx, { tipo: "ServicoPermutaConfirmado", agregadoTipo: "Matricula", agregadoId: a.matriculaId, autorId: u.id, payload: { acordoId: a.id, confirmacaoId: c.id, referenciaServico: d.referenciaServico } }); return { id: c.id, repetido: false }; }); }); }
export async function proporCompensacaoPermuta(input: unknown) {
    return executarPermuta(async () => {
        const u = await exigirSessaoComPapel(Papel.FINANCEIRO);
        const d = z.object({ confirmacaoId: id, destinos: z.array(z.object({ cobrancaId: id, valor }).strict()).min(1), chaveIdempotencia: z.string().min(8).max(100) }).strict().parse(input);
        const total = d.destinos.reduce((s, x) => s.plus(x.valor), new Prisma.Decimal(0));
        const entradaHash = hash(d);
        return prisma.$transaction(async (tx) => {
            await financeiro(tx, u.id);
            const anterior = await tx.propostaCompensacaoPermuta.findUnique({ where: { preparadorId_chaveIdempotencia: { preparadorId: u.id, chaveIdempotencia: d.chaveIdempotencia } } });
            if (anterior) {
                if (anterior.entradaHash !== entradaHash)
                    throw new ErroRegra("Chave já usada para outra proposta.");
                return { id: anterior.id, repetido: true, efetivada: false };
            }
            const confirmacao = await tx.confirmacaoServicoPermuta.findUniqueOrThrow({ where: { id: d.confirmacaoId }, include: { acordo: { include: { cobrancasElegiveis: true } } } });
            const ids = d.destinos.map(destino => destino.cobrancaId);
            if (new Set(ids).size !== ids.length)
                throw new ErroRegra("Uma cobrança não pode aparecer duas vezes na proposta.");
            await tx.$queryRaw `SELECT id FROM "Cobranca" WHERE id IN (${Prisma.join([...ids].sort())}) ORDER BY id FOR UPDATE`;
            const cobrancas = await tx.cobranca.findMany({ where: { id: { in: ids } }, select: { id: true, versao: true, moeda: true, matriculaId: true, tipo: true, status: true, saldo: true, suspensaPorItemPausaId: true, canceladaPorPausaId: true } });
            const fotografia = d.destinos.map(destino => {
                const cobranca = cobrancas.find(c => c.id === destino.cobrancaId);
                const elegivel = confirmacao.acordo.cobrancasElegiveis.find(c => c.cobrancaId === destino.cobrancaId);
                const valorDestino = new Prisma.Decimal(destino.valor);
                if (!cobranca || !elegivel || cobranca.matriculaId !== confirmacao.acordo.matriculaId || cobranca.moeda !== confirmacao.acordo.moeda || cobranca.tipo !== "MENSALIDADE" || !["PENDENTE", "ATRASADO"].includes(cobranca.status) || cobranca.suspensaPorItemPausaId || cobranca.canceladaPorPausaId || cobranca.saldo === null || valorDestino.lte(0) || valorDestino.gt(cobranca.saldo) || valorDestino.gt(elegivel.valorMaximo))
                    throw new ErroRegra("Confira a elegibilidade e o saldo atual de cada mensalidade.");
                return { cobrancaId: cobranca.id, versao: cobranca.versao, saldo: cobranca.saldo.toFixed(2), valor: valorDestino.toFixed(2) };
            });
            if (await tx.pagamentoInformado.count({ where: { cobrancaId: { in: ids }, status: "A_CONFERIR" } }))
                throw new ErroRegra("Confira os comprovantes pendentes antes de propor a compensação.");
            const p = await tx.propostaCompensacaoPermuta.create({ data: { confirmacaoId: d.confirmacaoId, preparadorId: u.id, valor: total, snapshot: { destinos: fotografia, valor: total.toFixed(2), efetivada: false }, chaveIdempotencia: d.chaveIdempotencia, entradaHash, destinos: { create: d.destinos } } });
            return { id: p.id, repetido: false, efetivada: false };
        });
    });
}
export async function decidirCompensacaoPermuta(input: unknown) { return executarPermuta(async () => { const u = await exigirSessaoComPapel(Papel.FINANCEIRO); const d = z.object({ propostaId: id, aprovar: z.boolean(), motivo: texto }).strict().parse(input); const resultado = await prisma.$transaction(async (tx) => { await financeiro(tx, u.id, true); const p = await tx.propostaCompensacaoPermuta.findUniqueOrThrow({ where: { id: d.propostaId }, include: { decisao: { include: { aplicacoes: true } }, confirmacao: { include: { acordo: true } } } }); if (p.decisao) {
    if (p.decisao.decisorId !== u.id || p.decisao.aprovada !== d.aprovar || p.decisao.motivo !== d.motivo)
        throw new ErroRegra("A proposta já possui decisão.");
    return { id: p.decisao.id, efetivada: p.decisao.aplicacoes.length > 0, repetida: true };
}
if (d.aprovar) {
  const fotografia = z.object({ destinos: z.array(z.object({ cobrancaId: id, versao: z.number().int(), saldo: valor, valor })).min(1) }).safeParse(p.snapshot);
  if (!fotografia.success) throw new ErroRegra("A proposta precisa de nova conferência de saldo antes da aprovação.");
  const ids = fotografia.data.destinos.map(destino => destino.cobrancaId).sort();
  await tx.$queryRaw`SELECT id FROM "Cobranca" WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE`;
  const atuais = await tx.cobranca.findMany({ where: { id: { in: ids } } });
  for (const destino of fotografia.data.destinos) {
    const atual = atuais.find(c => c.id === destino.cobrancaId);
    if (!atual || atual.versao !== destino.versao || !atual.saldo?.equals(destino.saldo) || atual.saldo.lt(destino.valor) || atual.suspensaPorItemPausaId || atual.canceladaPorPausaId) throw new ErroRegra("A cobrança mudou. Rejeite esta proposta e prepare uma nova conferência.");
  }
  if (await tx.pagamentoInformado.count({ where: { cobrancaId: { in: ids }, status: "A_CONFERIR" } })) throw new ErroRegra("Confira os comprovantes antes de aprovar a compensação.");
}
const decisao = await tx.decisaoCompensacaoPermuta.create({ data: { propostaId: p.id, decisorId: u.id, aprovada: d.aprovar, motivo: d.motivo } }); await registrarEvento(tx, { tipo: "CompensacaoPermutaDecidida", agregadoTipo: "Matricula", agregadoId: p.confirmacao.acordo.matriculaId, autorId: u.id, payload: { propostaId: p.id, decisaoId: decisao.id, aprovada: d.aprovar, efetivada: d.aprovar } }); return { id: decisao.id, efetivada: d.aprovar, repetida: false }; });
if (resultado.efetivada) await reavaliarAcessoAposPermuta(resultado.id);
return resultado; }); }
export async function consultarPermutas(pagina = 1) {
    return executarPermuta(async () => {
        const sessao = await exigirSessaoComPapel(Papel.FINANCEIRO, Papel.GERENTE_PEDAGOGICO);
        const paginaValidada = z.number().int().min(1).max(100000).parse(pagina);
        return prisma.$transaction(async (tx) => {
            await tx.$queryRaw `SELECT id FROM "Usuario" WHERE id=${sessao.id} FOR SHARE`;
            const usuario = await tx.usuario.findUniqueOrThrow({
                where: { id: sessao.id }, select: { ativo: true, papeis: true },
            });
            const podeFinanceiro = usuario.papeis.some(p => p === Papel.FINANCEIRO || p === Papel.ADMINISTRADOR);
            if (!usuario.ativo || (!podeFinanceiro && !usuario.papeis.includes(Papel.GERENTE_PEDAGOGICO)))
                throw new ErroPermissao();
            const acordos = await tx.acordoPermutaServico.findMany({
                orderBy: [{ criadoEm: "desc" }, { id: "desc" }], take: 50, skip: (paginaValidada - 1) * 50,
                include: {
                    matricula: { select: { codigo: true, aluno: { select: { primeiroNome: true } } } },
                    cobrancasElegiveis: { where: podeFinanceiro ? {} : { id: { in: [] } }, include: { cobranca: { select: { codigo: true, saldo: true } } } },
                    confirmacoes: { orderBy: { criadaEm: "desc" }, include: { propostas: { where: podeFinanceiro ? {} : { id: { in: [] } }, include: { decisao: { include: { aplicacoes: true } }, destinos: true } } } },
                },
            });
            return acordos.map(a => ({
                id: a.id, matriculaId: a.matriculaId,
                matricula: a.matricula.codigo ?? a.matricula.aluno.primeiroNome,
                moeda: podeFinanceiro ? a.moeda : null, unidade: a.unidade,
                quantidadePactuada: a.quantidadePactuada.toFixed(2),
                valorPorUnidade: podeFinanceiro ? a.valorPorUnidade.toFixed(2) : null,
                valorTotalPactuado: podeFinanceiro ? a.valorTotalPactuado.toFixed(2) : null,
                contrapartida: a.contrapartida,
                formulaDescricao: podeFinanceiro ? a.formulaDescricao : null,
                cobrancas: podeFinanceiro ? a.cobrancasElegiveis.map(e => ({
                    id: e.cobrancaId, codigo: e.cobranca.codigo ?? e.cobrancaId,
                    saldo: e.cobranca.saldo?.toFixed(2) ?? null, valorMaximo: e.valorMaximo.toFixed(2),
                })) : [],
                confirmacoes: a.confirmacoes.map(c => ({
                    id: c.id, periodoInicio: c.periodoInicio.toISOString().slice(0, 10),
                    periodoFim: c.periodoFim.toISOString().slice(0, 10),
                    quantidadeComprovada: c.quantidadeComprovada.toFixed(2),
                    referenciaServico: c.referenciaServico, evidencia: c.evidencia,
                    propostas: podeFinanceiro ? c.propostas.map(p => ({
                        id: p.id, valor: p.valor.toFixed(2),
                        destinos: p.destinos.map(d => ({ cobrancaId: d.cobrancaId, valor: d.valor.toFixed(2) })),
                        decisao: p.decisao ? { aprovada: p.decisao.aprovada, motivo: p.decisao.motivo, efetivada: p.decisao.aplicacoes.length > 0, decididaEm: p.decisao.decididaEm.toISOString(), aplicacoes: p.decisao.aplicacoes.map(a => ({ id: a.id, cobrancaId: a.cobrancaId, valor: a.valor.toFixed(2), aplicadaEm: a.aplicadaEm.toISOString() })) } : null,
                    })) : [],
                })),
            }));
        });
    });
}
export async function listarCobrancasParaPermuta() {
    return executarPermuta(async () => {
        const usuario = await exigirSessaoComPapel(Papel.FINANCEIRO);
        return prisma.$transaction(async (tx) => {
            await financeiro(tx, usuario.id);
            const cobrancas = await tx.cobranca.findMany({
                where: { tipo: "MENSALIDADE", status: { in: ["PENDENTE", "ATRASADO"] }, saldo: { gt: 0 } },
                orderBy: [{ matriculaId: "asc" }, { vencimento: "asc" }],
                select: { id: true, codigo: true, matriculaId: true, moeda: true, saldo: true, vencimento: true,
                    matricula: { select: { codigo: true, aluno: { select: { primeiroNome: true, sobrenome: true } } } } },
            });
            return cobrancas.map(c => ({
                id: c.id, codigo: c.codigo ?? "Mensalidade", matriculaId: c.matriculaId,
                matricula: c.matricula.codigo ?? c.matriculaId,
                aluno: `${c.matricula.aluno.primeiroNome} ${c.matricula.aluno.sobrenome}`.trim(),
                moeda: c.moeda, saldo: c.saldo!.toFixed(2), vencimento: c.vencimento.toISOString().slice(0, 10),
            }));
        });
    });
}

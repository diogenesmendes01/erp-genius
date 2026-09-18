"use server";
import { conferirIntervalosCoberturaAditivo } from "./aditivo-cobertura-intervalos";
import { z } from "zod";
import { Papel, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroPermissao, ErroRegra, registrarEvento } from "@/server/_shared";
import { bloquearMatriculas } from "@/server/financeiro/recebimentos";
import { carregarEstadoConferenciaFinalAditivoTx } from "./aditivo-conferencia-final-estado";
import { hashSubstituicao } from "./substituicao-estado";
import { extrairPoliticaCoberturaFormalizada, extrairLimitesCoberturaFormalizada } from "./aditivo-cobertura-politica";
import { AplicarImpactosCoberturaAditivoSchema, DecidirImpactosCoberturaAditivoSchema, PrepararImpactosCoberturaAditivoSchema } from "./aditivo-cobertura-schema";

async function exigirFinanceiro(tx: Prisma.TransactionClient, id: string, aprovar = false) {
  const u = await tx.usuario.findUnique({ where: { id }, select: { ativo: true, papeis: true, permissoes: true } });
  if (!u?.ativo || !u.papeis.some(p => p === Papel.FINANCEIRO || p === Papel.ADMINISTRADOR) || (aprovar && !u.papeis.includes(Papel.ADMINISTRADOR) && !u.permissoes.includes("financeiro.aprovar_acertos"))) throw new ErroPermissao();
}
const civil = (d: Date | null) => d?.toISOString().slice(0, 10) ?? null;
function foto(c: { id: string; versao: number; coberturaInicio: Date | null; coberturaFim: Date | null; status: string; valorRecebido: Prisma.Decimal | null }) {
  return { cobranca: { id: c.id, versao: c.versao, coberturaInicio: civil(c.coberturaInicio), coberturaFim: civil(c.coberturaFim), status: c.status, valorRecebido: c.valorRecebido?.toFixed(2) ?? null } };
}
function fotografiaMudou(impactos: { cobrancaId: string }[], fotografia: Prisma.JsonValue, atuais: { id: string; versao: number; coberturaInicio: Date | null; coberturaFim: Date | null; status: string; valorRecebido: Prisma.Decimal | null }[]) {
  const linhas = (fotografia as { cobrancas?: { id: string; fotografiaHash?: string }[] }).cobrancas;
  return !linhas || impactos.some(impacto => {
    const cobranca = atuais.find(atual => atual.id === impacto.cobrancaId);
    const anterior = linhas.find(linha => linha.id === impacto.cobrancaId);
    return !cobranca || !anterior?.fotografiaHash || hashSubstituicao(foto(cobranca)) !== anterior.fotografiaHash;
  });
}
async function carregarFormalizacao(tx: Prisma.TransactionClient, matriculaId: string, propostaId: string, conclusaoId: string, revisaoHash: string) {
  const estado = await carregarEstadoConferenciaFinalAditivoTx(tx, { matriculaId, propostaId, conclusaoId });
  if (estado.dados.ambiente !== "PRODUCAO" || estado.revisaoHash !== revisaoHash) throw new ErroRegra("A correção exige a conferência final da assinatura em produção.");
  const v = await tx.versaoCondicoesAditivo.findFirst({ where: { matriculaId, propostaId, conferenciaFinal: { conclusaoId } }, select: { id: true, propostaId: true, conferenciaFinalId: true, condicoesHash: true, proposta: { select: { snapshot: true, entradaHash: true } } } });
  if (!v) throw new ErroRegra("Formalize as condições do aditivo antes do acerto de cobertura.");
  const politica = extrairPoliticaCoberturaFormalizada(v.proposta.snapshot, v.proposta.entradaHash);
  return { ...v, politica, revisaoHash };
}

export async function prepararImpactosCoberturaAditivo(input: unknown) { return executarAcao(async () => {
  const autor = await exigirSessaoComPapel(Papel.FINANCEIRO, Papel.ADMINISTRADOR); const d = PrepararImpactosCoberturaAditivoSchema.parse(input);
  return prisma.$transaction(async tx => {
    await exigirFinanceiro(tx, autor.id); await bloquearMatriculas(tx, [d.matriculaId]);
    const anterior = await tx.conjuntoImpactosCoberturaAditivo.findUnique({
      where: { preparadorId_chaveIdempotencia: { preparadorId: autor.id, chaveIdempotencia: d.chaveIdempotencia } },
      include: { conferenciaFinal: { select: { conclusaoId: true } } },
    });
    if (anterior) {
      const salva = z.object({ revisaoHash: z.string(), motivo: z.string(), evidencia: z.string(), cobrancas: z.array(z.object({
        id: z.string(), classificacao: z.string(), justificativa: z.string(), coberturaInicioNova: z.string().nullable(), coberturaFimNova: z.string().nullable(),
      })) }).parse(anterior.fotografia);
      const solicitadas = d.linhas.map(l => ({ id: l.cobrancaId, classificacao: l.classificacao, justificativa: l.justificativa,
        coberturaInicioNova: l.coberturaInicioNova ?? null, coberturaFimNova: l.coberturaFimNova ?? null,
      })).sort((a, b) => a.id.localeCompare(b.id));
      if (anterior.matriculaId !== d.matriculaId || anterior.propostaAditivoId !== d.propostaId || anterior.conferenciaFinal.conclusaoId !== d.conclusaoId ||
        salva.revisaoHash !== d.revisaoHash || salva.motivo !== d.motivo || salva.evidencia !== d.evidencia ||
        hashSubstituicao(salva.cobrancas.sort((a, b) => a.id.localeCompare(b.id))) !== hashSubstituicao(solicitadas)) {
        throw new ErroRegra("Chave já usada com outro conjunto de cobertura.");
      }
      return { id: anterior.id, status: anterior.status };
    }
    const formal = await carregarFormalizacao(tx, d.matriculaId, d.propostaId, d.conclusaoId, d.revisaoHash);
    const cobrancas = await tx.cobranca.findMany({ where: { matriculaId: d.matriculaId, tipo: "MENSALIDADE" }, orderBy: [{ coberturaInicio: "asc" }, { id: "asc" }] });
    if (cobrancas.length !== d.linhas.length || new Set(d.linhas.map(l => l.cobrancaId)).size !== cobrancas.length || cobrancas.some(c => !d.linhas.some(l => l.cobrancaId === c.id))) throw new ErroRegra("Classifique todas as mensalidades existentes, inclusive as preservadas.");
    const linhas = d.linhas.map(l => { const c = cobrancas.find(x => x.id === l.cobrancaId)!; if (l.classificacao === "AFETADA" && (!c.coberturaInicio || !c.coberturaFim)) throw new ErroRegra("Mensalidade afetada sem cobertura histórica exige conferência antes do acerto."); return { ...l, c, fotografia: foto(c) }; });
    conferirIntervalosCoberturaAditivo(linhas.map(l => ({
      id: l.cobrancaId, afetada: l.classificacao === "AFETADA",
      anterior: { inicio: civil(l.c.coberturaInicio), fim: civil(l.c.coberturaFim) },
      nova: { inicio: l.classificacao === "AFETADA" ? l.coberturaInicioNova! : civil(l.c.coberturaInicio), fim: l.classificacao === "AFETADA" ? l.coberturaFimNova! : civil(l.c.coberturaFim) },
    })), extrairLimitesCoberturaFormalizada(formal.proposta.snapshot, formal.proposta.entradaHash));
    const fotografia = { revisaoHash: d.revisaoHash, versaoCondicoesId: formal.id, condicoesHash: formal.condicoesHash, politica: formal.politica, cobrancas: linhas.map(l => ({ id: l.cobrancaId, classificacao: l.classificacao, justificativa: l.justificativa, coberturaInicioNova: l.coberturaInicioNova ?? null, coberturaFimNova: l.coberturaFimNova ?? null, fotografia: l.fotografia, fotografiaHash: hashSubstituicao(l.fotografia) })), motivo: d.motivo, evidencia: d.evidencia };
    const fotografiaHash = hashSubstituicao(fotografia);
    const db = tx;
    const ativo = await db.conjuntoImpactosCoberturaAditivo.findFirst({ where: { propostaAditivoId: d.propostaId, status: { in: ["PENDENTE", "APROVADO", "COMPLETO"] } } });
    if (ativo) throw new ErroRegra("Já existe conjunto ativo para esta proposta.");
    const conjunto = await db.conjuntoImpactosCoberturaAditivo.create({ data: { matriculaId: d.matriculaId, propostaAditivoId: d.propostaId, conferenciaFinalId: formal.conferenciaFinalId, versaoCondicoesId: formal.id, preparadorId: autor.id, escolhaCiclo: formal.politica.escolha, cicloFuturo: formal.politica, hashFormalizado: formal.proposta.entradaHash, fotografia, fotografiaHash, motivo: d.motivo, evidencia: d.evidencia, chaveIdempotencia: d.chaveIdempotencia, impactos: { create: linhas.map(l => ({ cobrancaId: l.cobrancaId, classificacao: l.classificacao, coberturaInicioAnterior: l.c.coberturaInicio, coberturaFimAnterior: l.c.coberturaFim, coberturaInicioNova: l.classificacao === "AFETADA" ? new Date(`${l.coberturaInicioNova}T00:00:00.000Z`) : null, coberturaFimNova: l.classificacao === "AFETADA" ? new Date(`${l.coberturaFimNova}T00:00:00.000Z`) : null, justificativa: l.justificativa, versaoCobranca: l.c.versao })) } } });
    await registrarEvento(tx, { tipo: "ImpactosCoberturaAditivoPreparados", agregadoTipo: "Matricula", agregadoId: d.matriculaId, autorId: autor.id, payload: { conjuntoId: conjunto.id, propostaId: d.propostaId, fotografiaHash } }); return { id: conjunto.id, status: conjunto.status };
  });
}); }

export async function decidirImpactosCoberturaAditivo(input: unknown) { return executarAcao(async () => {
 const autor = await exigirSessaoComPapel(Papel.FINANCEIRO, Papel.ADMINISTRADOR); const d = DecidirImpactosCoberturaAditivoSchema.parse(input);
 return prisma.$transaction(async tx => { const db = tx; const ref = await db.conjuntoImpactosCoberturaAditivo.findUniqueOrThrow({ where: { id: d.conjuntoId }, select: { matriculaId: true } }); await bloquearMatriculas(tx,[ref.matriculaId]); await exigirFinanceiro(tx,autor.id,true); const c = await db.conjuntoImpactosCoberturaAditivo.findUniqueOrThrow({ where:{id:d.conjuntoId}, include:{decisao:true,impactos:true} }); if(c.preparadorId===autor.id) throw new ErroRegra("A decisão exige outro Financeiro."); if(c.decisao) { if(c.decisao.decisorId!==autor.id || c.decisao.aprovada!==d.aprovada || c.decisao.chaveIdempotencia!==d.chaveIdempotencia || c.decisao.motivo!==d.motivo) throw new ErroRegra("O conjunto já recebeu outra decisão."); return {id:c.decisao.id,aprovada:c.decisao.aprovada}; } if(d.aprovada) { await carregarFormalizacao(tx,c.matriculaId,c.propostaAditivoId,(await tx.conferenciaFinalAditivo.findUniqueOrThrow({where:{id:c.conferenciaFinalId}})).conclusaoId,(c.fotografia as any).revisaoHash); const ids=c.impactos.map((i:any)=>i.cobrancaId).sort(); await tx.$queryRaw`SELECT id FROM "Cobranca" WHERE id=ANY(${ids}::text[]) ORDER BY id FOR UPDATE`; const atuais=await tx.cobranca.findMany({where:{matriculaId:c.matriculaId,tipo:"MENSALIDADE"}}); if(atuais.length!==c.impactos.length || c.impactos.some((i:any)=>hashSubstituicao(foto(atuais.find(x=>x.id===i.cobrancaId)!)) !== (c.fotografia as any).cobrancas.find((x:any)=>x.id===i.cobrancaId).fotografiaHash)) throw new ErroRegra("Mensalidade mudou após o preparo; prepare novo conjunto."); }
 const decisao=await db.decisaoConjuntoImpactosCoberturaAditivo.create({data:{conjuntoId:c.id,decisorId:autor.id,aprovada:d.aprovada,motivo:d.motivo,fotografiaHash:c.fotografiaHash,chaveIdempotencia:d.chaveIdempotencia}}); await db.conjuntoImpactosCoberturaAditivo.update({where:{id:c.id},data:{status:d.aprovada?"APROVADO":"REJEITADO"}}); return {id:decisao.id,aprovada:decisao.aprovada}; });
}); }

export async function aplicarImpactosCoberturaAditivo(input: unknown) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.FINANCEIRO, Papel.ADMINISTRADOR);
    const d = AplicarImpactosCoberturaAditivoSchema.parse(input);
    return prisma.$transaction(async tx => {
      const db = tx;
      const ref = await db.conjuntoImpactosCoberturaAditivo.findUniqueOrThrow({ where: { id: d.conjuntoId }, select: { matriculaId: true } });
      await bloquearMatriculas(tx, [ref.matriculaId]);
      await exigirFinanceiro(tx, autor.id, true);
      const c = await db.conjuntoImpactosCoberturaAditivo.findUniqueOrThrow({ where: { id: d.conjuntoId }, include: { decisao: true, impactos: { include: { aplicacao: true } } } });
      if (c.status === "COMPLETO") return { id: c.id, completo: true };
      if (c.status !== "APROVADO" || !c.decisao?.aprovada || c.decisao.decisorId !== autor.id || c.preparadorId === autor.id) throw new ErroRegra("Aplicação exige conjunto aprovado pelo decisor independente.");
      const ids = c.impactos.map((i) => i.cobrancaId).sort();
      await tx.$queryRaw`SELECT id FROM "Cobranca" WHERE id = ANY(${ids}::text[]) ORDER BY id FOR UPDATE`;
      const atuais = await tx.cobranca.findMany({ where: { matriculaId: c.matriculaId, tipo: "MENSALIDADE" } });
      if (atuais.length !== c.impactos.length || c.impactos.some((i) => {
        const atual = atuais.find(cobranca => cobranca.id === i.cobrancaId);
        return i.aplicacao || !atual || atual.versao !== i.versaoCobranca || civil(atual.coberturaInicio) !== civil(i.coberturaInicioAnterior) || civil(atual.coberturaFim) !== civil(i.coberturaFimAnterior);
      })) throw new ErroRegra("O conjunto não pode ser aplicado parcialmente nem sobre mensalidade alterada.");
      for (const i of c.impactos.filter((x) => x.classificacao === "AFETADA")) {
        if (!i.coberturaInicioAnterior || !i.coberturaFimAnterior || !i.coberturaInicioNova || !i.coberturaFimNova) throw new ErroRegra("Impacto afetado sem os limites aprovados da cobertura.");
        await tx.cobranca.update({ where: { id: i.cobrancaId }, data: { coberturaInicio: i.coberturaInicioNova, coberturaFim: i.coberturaFimNova, versao: { increment: 1 } } });
        await db.aplicacaoCoberturaAditivo.create({ data: { impactoId: i.id, cobrancaId: i.cobrancaId, executorId: autor.id, fotografiaHash: c.fotografiaHash, chaveIdempotencia: `${d.chaveIdempotencia}:${i.id}`, versaoCobrancaAntes: i.versaoCobranca, versaoCobrancaDepois: i.versaoCobranca + 1, coberturaInicioAnterior: i.coberturaInicioAnterior, coberturaFimAnterior: i.coberturaFimAnterior, coberturaInicioNova: i.coberturaInicioNova, coberturaFimNova: i.coberturaFimNova } });
      }
      await db.conjuntoImpactosCoberturaAditivo.update({ where: { id: c.id }, data: { status: "COMPLETO" } });
      await registrarEvento(tx, { tipo: "ImpactosCoberturaAditivoAplicados", agregadoTipo: "Matricula", agregadoId: c.matriculaId, autorId: autor.id, payload: { conjuntoId: c.id, politica: c.cicloFuturo, fotografiaHash: c.fotografiaHash } });
      return { id: c.id, completo: true };
    });
  });
}
export async function obsoletarImpactosCoberturaAditivo(input: unknown) { return executarAcao(async () => {
  const autor = await exigirSessaoComPapel(Papel.FINANCEIRO, Papel.ADMINISTRADOR);
  const d = (await import("./aditivo-cobertura-schema")).ObsoletarImpactosCoberturaAditivoSchema.parse(input);
  return prisma.$transaction(async tx => {
    const ref = await tx.conjuntoImpactosCoberturaAditivo.findUniqueOrThrow({ where: { id: d.conjuntoId }, select: { matriculaId: true } });
    await bloquearMatriculas(tx, [ref.matriculaId]); await exigirFinanceiro(tx, autor.id);
    const c = await tx.conjuntoImpactosCoberturaAditivo.findUniqueOrThrow({ where: { id: d.conjuntoId }, include: { impactos: { include: { aplicacao: true } } } });
    if (c.status === "OBSOLETO") {
      const evento = await tx.evento.findFirst({ where: { tipo: "ImpactosCoberturaAditivoObsoletos", agregadoTipo: "Matricula", agregadoId: c.matriculaId, autorId: autor.id, payload: { path: ["conjuntoId"], equals: c.id } }, orderBy: { criadoEm: "desc" } });
      const payload = evento?.payload as { conjuntoId?: string; motivo?: string; chaveIdempotencia?: string } | null;
      if (payload?.conjuntoId !== c.id || payload.motivo !== d.motivo || payload.chaveIdempotencia !== d.chaveIdempotencia) throw new ErroRegra("Conjunto já obsoleto por outra operação.");
      return { id: c.id, obsoleto: true };
    }
    if (!['PENDENTE','APROVADO'].includes(c.status) || c.impactos.some(i => i.aplicacao)) throw new ErroRegra("Somente conjunto sem aplicação pode ser obsoleto.");
    if (c.status === "APROVADO") {
      const ids = c.impactos.map(impacto => impacto.cobrancaId).sort();
      await tx.$queryRaw`SELECT id FROM "Cobranca" WHERE id = ANY(${ids}::text[]) ORDER BY id FOR UPDATE`;
      const atuais = await tx.cobranca.findMany({ where: { id: { in: ids } } });
      if (!fotografiaMudou(c.impactos, c.fotografia, atuais)) throw new ErroRegra("Conjunto aprovado continua íntegro; não há divergência material para obsolescência.");
    }
    await tx.conjuntoImpactosCoberturaAditivo.update({ where: { id: c.id }, data: { status: "OBSOLETO" } });
    await registrarEvento(tx, { tipo: "ImpactosCoberturaAditivoObsoletos", agregadoTipo: "Matricula", agregadoId: c.matriculaId, autorId: autor.id, payload: { conjuntoId: c.id, propostaId: c.propostaAditivoId, motivo: d.motivo, chaveIdempotencia: d.chaveIdempotencia } });
    return { id: c.id, obsoleto: true };
  });
}); }

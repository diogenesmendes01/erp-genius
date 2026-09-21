"use server";
import { Papel, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { executarAcao, exigirSessaoComPapel, ErroPermissao, ErroRegra } from "@/server/_shared";
import { PeriodoFechamentoHorasSchema, resolverPeriodoFechamentoHoras } from "./fechamento-horas-periodo";
import { PreparacaoFechamentoHorasSchema } from "./fechamento-horas-schema";

const Entrada = z.object({ alunoId: z.string().min(1), matriculaId: z.string().min(1),
  cursor: z.string().min(1).optional(), rascunhoId: z.string().min(1).optional(), periodo: PeriodoFechamentoHorasSchema.optional() }).strict()
  .refine(d => !(d.cursor && d.rascunhoId), "Consulte uma versão ou uma página por vez.");

/** Histórico preservado: nunca recalcula uma versão pela agenda ou preço atuais. */
export async function consultarFechamentosHoras(input: z.input<typeof Entrada>) {
  return executarAcao(async () => {
    const autor = await exigirSessaoComPapel(Papel.FINANCEIRO), d = Entrada.parse(input);
    return prisma.$transaction(async tx => {
      const u = await tx.usuario.findUnique({ where: { id: autor.id }, select: { ativo: true, papeis: true, permissoes: true } });
      if (!u?.ativo || !u.papeis.some(p => p === Papel.FINANCEIRO || p === Papel.ADMINISTRADOR)) throw new ErroPermissao();
      const matricula = await tx.matricula.findFirst({ where: { id: d.matriculaId, alunoId: d.alunoId }, select: { id: true, alunoId: true, codigo: true, moeda: true, contratoDocumentoId: true, contratoOk: true, confirmacaoContratoEm: true } });
      if (!matricula) throw new ErroRegra("Matrícula não encontrada para este aluno.");
      const referencia = d.cursor ?? d.rascunhoId;
      if (referencia && !await tx.rascunhoFechamentoHoras.count({ where: { id: referencia, matriculaId: matricula.id } })) {
        throw new ErroRegra("Versão não corresponde à matrícula.");
      }
      const encontrados = await tx.rascunhoFechamentoHoras.findMany({
        where: { matriculaId: matricula.id, ...(d.rascunhoId ? { id: d.rascunhoId } : d.cursor ? { id: { lt: d.cursor } } : {}) },
        orderBy: { id: "desc" }, take: d.rascunhoId ? 1 : 31,
        select: { id: true, versao: true, periodoInicio: true, periodoFimExclusivo: true, criadoEm: true,
          documentoId: true, motivo: true, preparador: { select: { id: true, nome: true } },
          documento: { select: { nome: true, url: true, arquivado: true } },
          decisao: { select: { id: true, aprovada: true, confirmaReferenciaContratual: true, motivo: true, decididaEm: true, decisor: { select: { nome: true } },
            emissao: { select: { id: true, criadaEm: true, executor: { select: { nome: true } }, cobranca: { select: { id: true, codigo: true, moeda: true, valorOriginal: true, valorNegociado: true, saldo: true, vencimento: true, status: true } } } } } },
          entrada: Boolean(d.rascunhoId), snapshot: Boolean(d.rascunhoId) },
      });
      const pagina = encontrados.slice(0, 30);
      const referenciasFaturadas = d.rascunhoId ? z.object({ apuracao: z.object({ preservados: z.array(z.object({ destinacao: z.object({ tipo: z.string(), cobrancaId: z.string().optional() }) })) }) }).safeParse(pagina[0]?.snapshot) : null;
      const idsAnteriores = referenciasFaturadas?.success ? [...new Set(referenciasFaturadas.data.apuracao.preservados.flatMap(p => p.destinacao.tipo === "FATURADA" && p.destinacao.cobrancaId ? [p.destinacao.cobrancaId] : []))] : [];
      const cobrancasAnteriores = idsAnteriores.length ? await tx.emissaoFechamentoHoras.findMany({ where: { cobrancaId: { in: idsAnteriores }, cobranca: { matriculaId: matricula.id }, decisao: { rascunho: { matriculaId: matricula.id } } },
        select: { cobrancaId: true, cobranca: { select: { codigo: true } }, decisao: { select: { rascunhoId: true } } } }) : [];
      const periodo = d.periodo ? resolverPeriodoFechamentoHoras(d.periodo) : null;
      const ultima = periodo ? await tx.rascunhoFechamentoHoras.findFirst({ where: { matriculaId: matricula.id,
        periodoInicio: new Date(periodo.inicioInstante), periodoFimExclusivo: new Date(periodo.fimExclusivo) }, orderBy: { versao: "desc" }, select: { versao: true } }) : null;
      return { matricula, cobrancasAnteriores: cobrancasAnteriores.map(e => ({ cobrancaId: e.cobrancaId, codigo: e.cobranca.codigo, rascunhoId: e.decisao.rascunhoId })), preparacao: periodo ? { periodo, versaoAnterior: ultima?.versao ?? 0 } : null, proximoCursor: encontrados.length > 30 ? pagina[29].id : null,
        versoes: pagina.map(r => ({ id: r.id, versao: r.versao, documentoId: r.documentoId, motivo: r.motivo,
          documento: { nome: r.documento.nome, url: !r.documento.arquivado && matricula.contratoOk && !!matricula.confirmacaoContratoEm && r.documentoId === matricula.contratoDocumentoId && /^\/api\/files\/[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(r.documento.url) ? r.documento.url : null },
          preparador: r.preparador, criadoEm: r.criadoEm.toISOString(), periodoInicio: r.periodoInicio.toISOString(),
          podeDecidir: !r.decisao && r.preparador.id !== autor.id && (u.papeis.includes(Papel.ADMINISTRADOR) || u.permissoes.includes("financeiro.aprovar_acertos")),
          referenciaProposta: d.rascunhoId ? (() => { const p = PreparacaoFechamentoHorasSchema.safeParse(r.entrada); return p.success ? { periodo: p.data.periodo, escolha: p.data.escolha } : null; })() : null,
          decisao: r.decisao ? { id: r.decisao.id, aprovada: r.decisao.aprovada, confirmaReferenciaContratual: r.decisao.confirmaReferenciaContratual,
            motivo: r.decisao.motivo, decisor: r.decisao.decisor, decididaEm: r.decisao.decididaEm.toISOString() } : null,
          emissao: r.decisao?.emissao ? { id: r.decisao.emissao.id, criadaEm: r.decisao.emissao.criadaEm.toISOString(), executor: r.decisao.emissao.executor,
            cobranca: { ...r.decisao.emissao.cobranca, valorOriginal: r.decisao.emissao.cobranca.valorOriginal.toFixed(2),
              valorNegociado: r.decisao.emissao.cobranca.valorNegociado.toFixed(2), saldo: r.decisao.emissao.cobranca.saldo?.toFixed(2) ?? null,
              vencimento: r.decisao.emissao.cobranca.vencimento.toISOString() } } : null,
          periodoFimExclusivo: r.periodoFimExclusivo.toISOString(),
          // Detalhes somente na consulta individual; a lista não transporta todos os encontros.
          memoria: d.rascunhoId ? r.snapshot : null,
          natureza: "RASCUNHO" as const, comprovaEmissao: Boolean(r.decisao?.emissao) })) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  });
}

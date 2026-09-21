import { Prisma } from "@prisma/client";
import { z } from "zod";
import { ErroRegra } from "@/server/_shared";
import { hashSubstituicao } from "./substituicao-estado";
import { PrepararAditivoContratualSchema } from "./aditivo-schema";
import { conferirIntervalosCoberturaAditivo } from "./aditivo-cobertura-intervalos";
import { extrairLimitesCoberturaFormalizada } from "./aditivo-cobertura-politica";
export async function carregarAplicacoesCamposTx(tx: Prisma.TransactionClient, matriculaId: string, fimExclusivo?: Date) {
  const versoes = await tx.versaoCondicoesAditivo.findMany({
    where: {
      matriculaId: matriculaId,
      ...(fimExclusivo ? { vigenciaInicio: { lt: fimExclusivo } } : {}),
    },
    select: {
      id: true,
      anteriorId: true,
      proposta: { select: { snapshot: true, entradaHash: true, matriculaId: true } },
      propostasVencimento: { where: { decisao: { aprovada: true, aplicacao: { isNot: null } } }, select: { decisao: { select: { aplicacao: { select: { id: true } } } } } },
      conjuntosImpactosTaxa: { where: { status: "COMPLETO", matriculaId, decisao: { aprovada: true } }, select: { id: true, propostaAditivoId: true }, orderBy: [{ criadaEm: "desc" }, { id: "desc" }] },
      conjuntosImpactosCobertura: {
        where: { status: "COMPLETO", matriculaId },
        select: {
          id: true, propostaAditivoId: true, preparadorId: true, hashFormalizado: true, fotografiaHash: true, cicloFuturo: true,
          decisao: { select: { id: true, aprovada: true, decisorId: true, fotografiaHash: true } },
          impactos: { select: { id: true, classificacao: true, coberturaInicioAnterior: true, coberturaFimAnterior: true, coberturaInicioNova: true, coberturaFimNova: true, aplicacao: { select: { id: true, fotografiaHash: true, aplicadaEm: true } } } },
        },
      },
      propostaId: true,
      versao: true,
      condicoes: true,
      condicoesHash: true,
      vigenciaInicio: true,
      aplicacao: { select: { id: true } },
    },
  });

  return versoes.sort((a,b) => a.versao-b.versao).map(v => {
    if (v.proposta.matriculaId !== matriculaId || hashSubstituicao(v.proposta.snapshot) !== v.proposta.entradaHash) throw new ErroRegra("Proposta contratual divergente da cadeia.");
    const entrada = z.object({ entrada: PrepararAditivoContratualSchema }).parse(v.proposta.snapshot).entrada;
    if (entrada.matriculaId !== matriculaId) throw new ErroRegra("Proposta pertence a outro contrato.");
    const coberturas = v.conjuntosImpactosCobertura;
    if (coberturas.length > 1 || coberturas.some(c =>
      c.propostaAditivoId !== v.propostaId || c.hashFormalizado !== v.proposta.entradaHash ||
      !c.decisao?.aprovada || c.decisao.decisorId === c.preparadorId || c.decisao.fotografiaHash !== c.fotografiaHash ||
      !entrada.cicloCoberturaFutura || hashSubstituicao(c.cicloFuturo) !== hashSubstituicao(entrada.cicloCoberturaFutura) ||
      !c.impactos.some(i => i.classificacao === "AFETADA") ||
      c.impactos.some(i => i.classificacao === "AFETADA" ? !i.aplicacao || i.aplicacao.fotografiaHash !== c.fotografiaHash : !!i.aplicacao)
    )) throw new ErroRegra("Prova de aplicação da cobertura divergente da versão contratual.");
    for (const conjunto of coberturas) {
      conferirIntervalosCoberturaAditivo(conjunto.impactos.map(impacto => ({
        id: impacto.id,
        afetada: impacto.classificacao === "AFETADA",
        anterior: {
          inicio: impacto.coberturaInicioAnterior?.toISOString().slice(0, 10) ?? null,
          fim: impacto.coberturaFimAnterior?.toISOString().slice(0, 10) ?? null,
        },
        nova: {
          inicio: impacto.coberturaInicioNova?.toISOString().slice(0, 10) ?? null,
          fim: impacto.coberturaFimNova?.toISOString().slice(0, 10) ?? null,
        },
      })), extrairLimitesCoberturaFormalizada(v.proposta.snapshot, v.proposta.entradaHash));
    }
    const coberturaCompleta = coberturas[0];
    const aplicacoesAfetadas = coberturaCompleta?.impactos.filter(i => i.classificacao === "AFETADA").map(i => i.aplicacao!);
    return { ...v, alteracoes: entrada.alteracoes.map(a => ({ origem: a.origem, valorEstruturado: a.valorEstruturado })), conjuntoCoberturaCompletoId: coberturaCompleta?.id ?? null,
      conjuntoCoberturaCompleto: coberturaCompleta && coberturaCompleta.decisao && aplicacoesAfetadas?.length
        ? { id: coberturaCompleta.id, decisaoId: coberturaCompleta.decisao.id, politica: coberturaCompleta.cicloFuturo, aplicadaEm: new Date(Math.max(...aplicacoesAfetadas.map(a => a.aplicadaEm.getTime()))).toISOString() }
        : null,
      conjuntoTaxaCompletoId: v.conjuntosImpactosTaxa.find(c => c.propostaAditivoId === v.propostaId)?.id ?? null, aplicacaoGeralId: v.aplicacao?.id ?? null, aplicacaoVencimentoId: v.propostasVencimento[0]?.decisao?.aplicacao?.id ?? null };
  });
}

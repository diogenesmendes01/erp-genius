import { Prisma } from "@prisma/client";
import { z } from "zod";
import { ErroRegra } from "@/server/_shared";
import { hashSubstituicao } from "./substituicao-estado";
import { PrepararAditivoContratualSchema } from "./aditivo-schema";
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
    return { ...v, alteracoes: entrada.alteracoes.map(a => ({ origem: a.origem, valorEstruturado: a.valorEstruturado })), aplicacaoGeralId: v.aplicacao?.id ?? null, aplicacaoVencimentoId: v.propostasVencimento[0]?.decisao?.aplicacao?.id ?? null };
  });
}

import { Prisma } from "@prisma/client";
import { ErroRegra } from "@/server/_shared";
import { OrigemCampoSchema } from "./campos";
import { validarValorAlteracaoAditivo } from "./aditivo-valores";
import { hashSubstituicao } from "./substituicao-estado";

export type VersaoAplicacaoCampos = {
  id: string; anteriorId: string | null; versao: number;
  condicoes: Prisma.JsonValue; condicoesHash: string;
  alteracoes: { origem: string; valorEstruturado: unknown }[];
  aplicacaoGeralId: string | null;
  aplicacaoVencimentoId: string | null;
  /** Conjunto Q170 completo, nunca uma aplicação isolada de cobrança. */
  conjuntoTaxaCompletoId?: string | null;
};
const proprios = new Set(["TAXA_VALOR", "TAXA_VENCIMENTO", "PRIMEIRA_MENSALIDADE_VENCIMENTO", "COBERTURA_INICIO", "COBERTURA_FIM", "ADIANTAMENTO_VALOR", "ADIANTAMENTO_MINUTOS", "ADIANTAMENTO_VENCIMENTO", "MOEDA", "REGIME"]);

/** Projeta fatos existentes; não fabrica uma aplicação geral nem reescreve história. */
export function projetarAplicacoesPorCampo(cadeia: readonly VersaoAplicacaoCampos[]) {
  const campos = new Map<string, { origemVersaoId: string; valorHash: string; aplicacaoId: string | null }>();
  let anterior: VersaoAplicacaoCampos | undefined;
  const acumuladas: Prisma.JsonObject = {};
  for (const versao of [...cadeia].sort((a,b) => a.versao-b.versao)) {
    if (versao.versao !== (anterior?.versao ?? 0)+1 || versao.anteriorId !== (anterior?.id ?? null)) throw new ErroRegra("Cadeia de aplicações incompleta ou divergente.");
    if (hashSubstituicao(versao.condicoes) !== versao.condicoesHash) throw new ErroRegra("Integridade das condições divergente.");
    const nomes = new Set<string>();
    for (const alteracao of versao.alteracoes) {
      if (nomes.has(alteracao.origem) || alteracao.valorEstruturado === undefined) throw new ErroRegra("Alterações explícitas divergentes.");
      validarValorAlteracaoAditivo(OrigemCampoSchema.parse(alteracao.origem), alteracao.valorEstruturado);
      nomes.add(alteracao.origem);
      acumuladas[alteracao.origem] = alteracao.valorEstruturado as Prisma.JsonValue;
      // Mesmo valor reiterado em nova proposta é nova decisão, não mera herança.
      campos.set(alteracao.origem, {
        origemVersaoId: versao.id, valorHash: hashSubstituicao(alteracao.valorEstruturado),
        aplicacaoId: alteracao.origem === "PRIMEIRA_MENSALIDADE_VENCIMENTO" ? versao.aplicacaoVencimentoId : (alteracao.origem === "TAXA_VALOR" || alteracao.origem === "TAXA_VENCIMENTO") ? versao.conjuntoTaxaCompletoId ?? null : proprios.has(alteracao.origem) ? null : versao.aplicacaoGeralId,
      });
    }
    if (hashSubstituicao(acumuladas) !== versao.condicoesHash) throw new ErroRegra("Condições não correspondem às alterações preservadas.");
    anterior = versao;
  }
  return Object.fromEntries(campos);
}

/** Campos diretos desta proposta serão aplicados agora; toda herança exige prova. */
export function conferirAplicacaoDireta(cadeia: readonly VersaoAplicacaoCampos[], versaoId: string) {
 const atual = cadeia.find(v => v.id === versaoId);
 if (!atual || cadeia.some(v => v.versao > atual.versao)) throw new ErroRegra("Aplique a última cadeia formalizada de condições.");
 const estados = projetarAplicacoesPorCampo(cadeia);
 for (const [campo, estado] of Object.entries(estados)) {
   if (!estado.aplicacaoId && (proprios.has(campo) || estado.origemVersaoId !== versaoId)) throw new ErroRegra(`A condição ${campo} exige fluxo próprio antes da aplicação.`);
 }
 if (!atual.alteracoes.some(a => !proprios.has(a.origem))) throw new ErroRegra("A proposta contém somente condições com aplicação própria.");
}

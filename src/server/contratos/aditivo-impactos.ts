import { z } from "zod";
import { OrigemCampoSchema, type OrigemCampo } from "./campos";

type Grupo = "CADASTRAL" | "FINANCEIRO" | "CONTRATUAL" | "ACADEMICO";
type Tipo = "TEXT" | "EMAIL" | "DINHEIRO" | "DATA" | "MINUTOS" | "MOEDA" | "REGIME" | "AGENDA";
type Regra = { grupo: Grupo; tipo: Tipo; pendencias: readonly string[] };

const cadastro = "Após assinatura, conferência e aplicação, esta alteração compõe a versão cadastral deste contrato, na vigência aprovada. O cadastro geral e a conta de acesso permanecem separados.";
const financeiro = "Esta alteração ainda não cria cobrança. Estruture o impacto financeiro, registre-o e obtenha as aprovações próprias.";
const ordemGrupos: readonly Grupo[] = ["ACADEMICO", "CADASTRAL", "FINANCEIRO", "CONTRATUAL"];
const regras: Record<Exclude<OrigemCampo, `ADITIVO_${string}`>, Regra> = {
  ALUNO_NOME: { grupo: "CADASTRAL", tipo: "TEXT", pendencias: [cadastro] }, ALUNO_DOCUMENTO: { grupo: "CADASTRAL", tipo: "TEXT", pendencias: [cadastro] },
  ALUNO_EMAIL: { grupo: "CADASTRAL", tipo: "EMAIL", pendencias: [cadastro] }, ALUNO_ENDERECO: { grupo: "CADASTRAL", tipo: "TEXT", pendencias: [cadastro] },
  PAGADOR_NOME: { grupo: "CADASTRAL", tipo: "TEXT", pendencias: [cadastro] }, PAGADOR_DOCUMENTO: { grupo: "CADASTRAL", tipo: "TEXT", pendencias: [cadastro] },
  PAGADOR_EMAIL: { grupo: "CADASTRAL", tipo: "EMAIL", pendencias: [cadastro] }, PAGADOR_ENDERECO: { grupo: "CADASTRAL", tipo: "TEXT", pendencias: [cadastro] },
  TAXA_VALOR: { grupo: "FINANCEIRO", tipo: "DINHEIRO", pendencias: [financeiro] }, MENSALIDADE_VALOR: { grupo: "FINANCEIRO", tipo: "DINHEIRO", pendencias: [financeiro] },
  HORA_VALOR: { grupo: "FINANCEIRO", tipo: "DINHEIRO", pendencias: [financeiro] }, ADIANTAMENTO_VALOR: { grupo: "FINANCEIRO", tipo: "DINHEIRO", pendencias: [financeiro] },
  TAXA_VENCIMENTO: { grupo: "FINANCEIRO", tipo: "DATA", pendencias: [financeiro] }, PRIMEIRA_MENSALIDADE_VENCIMENTO: { grupo: "FINANCEIRO", tipo: "DATA", pendencias: [financeiro] },
  COBERTURA_INICIO: { grupo: "FINANCEIRO", tipo: "DATA", pendencias: [financeiro] }, COBERTURA_FIM: { grupo: "FINANCEIRO", tipo: "DATA", pendencias: [financeiro] },
  ADIANTAMENTO_VENCIMENTO: { grupo: "FINANCEIRO", tipo: "DATA", pendencias: [financeiro] }, ADIANTAMENTO_MINUTOS: { grupo: "FINANCEIRO", tipo: "MINUTOS", pendencias: [financeiro] },
  MOEDA: { grupo: "FINANCEIRO", tipo: "MOEDA", pendencias: [financeiro] },
  REGIME: { grupo: "CONTRATUAL", tipo: "REGIME", pendencias: ["O regime só pode ser refletido depois de estruturar, registrar e aprovar separadamente os impactos financeiro e acadêmico."] },
  AGENDA_PARTICULAR: { grupo: "ACADEMICO", tipo: "AGENDA", pendencias: ["Esta alteração ainda não muda a agenda. Estruture o impacto acadêmico, registre-o e obtenha as aprovações próprias."] },
};

const EntradaSchema = z.array(z.object({ campo: OrigemCampoSchema, rotulo: z.string().trim().min(1), anterior: z.string().trim().min(1), novo: z.string().trim().min(1) }).strict()).min(1);

/** Classifica fatos do snapshot para revisão. Não atualiza cadastro, cobrança ou agenda. */
export function classificarAlteracoesAditivo(entrada: unknown) {
  const alteracoes = EntradaSchema.parse(entrada);
  const vistos = new Set<string>();
  const impactos = alteracoes.map(({ campo, rotulo, anterior, novo }) => {
    if (vistos.has(campo)) throw new Error(`A alteração ${campo} foi informada mais de uma vez.`);
    vistos.add(campo);
    if (campo.startsWith("ADITIVO_")) throw new Error("Campos derivados de aditivo não podem ser aplicados como condição.");
    const regra = regras[campo as Exclude<OrigemCampo, `ADITIVO_${string}`>];
    if (!regra) throw new Error(`Não há classificação segura para ${campo}.`);
    return { campo, rotulo, grupo: regra.grupo, tipo: regra.tipo, anterior, novo, pendencias: [...regra.pendencias], exigeEstruturacao: true };
  });
  return { impactos, grupos: ordemGrupos.filter(grupo => impactos.some(impacto => impacto.grupo === grupo)) };
}

import { z } from "zod";
import { OrigemCampoSchema } from "./campos";
import { ValorAlteracaoAditivoSchema, representarValorAlteracaoAditivo, validarValorAlteracaoAditivo } from "./aditivo-valores";

const EntradaSchema = z.array(z.object({ origem: OrigemCampoSchema, novo: z.string().trim().min(1), valorEstruturado: ValorAlteracaoAditivoSchema.optional() }).strict()).min(1);
export type AlteracaoEfeitoAditivo = z.infer<typeof EntradaSchema.element>;
const cadastro: Record<string, string> = { ALUNO_NOME: "aluno.nome", ALUNO_DOCUMENTO: "aluno.documento", ALUNO_EMAIL: "aluno.email", ALUNO_ENDERECO: "aluno.endereco", PAGADOR_NOME: "pagador.nome", PAGADOR_DOCUMENTO: "pagador.documento", PAGADOR_EMAIL: "pagador.email", PAGADOR_ENDERECO: "pagador.endereco" };
const financeiro = new Set(["TAXA_VALOR", "TAXA_VENCIMENTO", "MENSALIDADE_VALOR", "PRIMEIRA_MENSALIDADE_VENCIMENTO", "COBERTURA_INICIO", "COBERTURA_FIM", "HORA_VALOR", "ADIANTAMENTO_VALOR", "ADIANTAMENTO_MINUTOS", "ADIANTAMENTO_VENCIMENTO", "MOEDA"]);

/** Projeta efeitos possíveis para revisão; não escreve matrícula, condições, cobrança ou agenda. */
export function planejarEfeitosAditivo(entrada: readonly AlteracaoEfeitoAditivo[] | unknown, contexto?: { cobrancaEmitida: boolean }) {
  const alteracoes = EntradaSchema.parse(entrada), efeitos: { origem: string; dominio: "CADASTRO" | "CONTRATUAL" | "CONDICOES_FUTURAS" | "COBRANCA_EMITIDA" | "AGENDA"; destino: string; valor: unknown; exigeAcerto?: true }[] = [], pendencias: { origem: string; mensagem: string }[] = [];
  if (new Set(alteracoes.map(a => a.origem)).size !== alteracoes.length) throw new Error("Alteração repetida no plano de efeitos.");
  for (const a of alteracoes) {
    if (!a.valorEstruturado) { pendencias.push({ origem: a.origem, mensagem: "O valor é textual legado e precisa ser estruturado antes de planejar efeitos." }); continue; }
    try { validarValorAlteracaoAditivo(a.origem, a.valorEstruturado); if (a.valorEstruturado.tipo !== "AGENDA" && a.novo !== representarValorAlteracaoAditivo(a.valorEstruturado)) throw new Error("O texto novo diverge do valor estruturado canônico."); } catch (e) { pendencias.push({ origem: a.origem, mensagem: e instanceof Error ? e.message : "Valor estruturado inválido." }); continue; }
    if (a.origem in cadastro) efeitos.push({ origem: a.origem, dominio: "CADASTRO", destino: `matricula.cadastroContratual.${cadastro[a.origem]!}`, valor: a.valorEstruturado });
    else if (a.origem === "REGIME") { efeitos.push({ origem: a.origem, dominio: "CONTRATUAL", destino: "condicoes.regime", valor: a.valorEstruturado }); efeitos.push({ origem: a.origem, dominio: "CONDICOES_FUTURAS", destino: "condicoes.regime", valor: a.valorEstruturado }); }
    else if (a.origem === "AGENDA_PARTICULAR") { pendencias.push({ origem: a.origem, mensagem: "A agenda exige resolução pela proposta aprovada antes de qualquer efeito." }); }
    else if (financeiro.has(a.origem)) { efeitos.push({ origem: a.origem, dominio: "CONDICOES_FUTURAS", destino: `condicoes.${a.origem}`, valor: a.valorEstruturado }); if (contexto?.cobrancaEmitida === true) { efeitos.push({ origem: a.origem, dominio: "COBRANCA_EMITIDA", destino: `cobrancas.${a.origem}`, valor: a.valorEstruturado, exigeAcerto: true }); pendencias.push({ origem: a.origem, mensagem: "Selecione e confira as cobranças afetadas antes de qualquer acerto." }); } else if (contexto?.cobrancaEmitida === undefined) pendencias.push({ origem: a.origem, mensagem: "Confira se há cobrança emitida antes de planejar qualquer acerto." }); }
    else pendencias.push({ origem: a.origem, mensagem: "Não há destino estruturado para esta alteração." });
  }
  return { efeitos, pendencias };
}

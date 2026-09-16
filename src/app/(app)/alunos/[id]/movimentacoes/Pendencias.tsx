const mensagens: Record<string, string> = {
  FUSO_INSTITUCIONAL_A_CONFERIR: "Administração: configure o fuso institucional antes de conferir as datas.",
  MATRICULA_NAO_ATIVA: "O contrato não está ativo. Confira sua situação antes de solicitar a pausa.",
  MATRICULA_NAO_PAUSADA: "O contrato não está pausado. Confira sua situação antes de solicitar a retomada.",
  PAUSA_CONTRATUAL_A_CONFERIR: "Confira o registro da pausa deste contrato; não há pausa contratual aplicada suficiente para preparar a retomada.",
  RETORNO_ANTERIOR_A_PAUSA: "A data de retorno precisa ser igual ou posterior à data da pausa.",
  REFERENCIA_CONTRATUAL_A_CONFERIR: "Confira a referência de cobertura prevista no contrato e, quando aplicável, a data de início do ciclo.",
  ALOCACAO_LEGADA_SEM_MATRICULA: "Secretaria: confira a matrícula correspondente ao vínculo antigo com a turma.",
  COBERTURA_A_CONFERIR: "Financeiro: confira o início e o fim da cobertura da mensalidade.",
  RECEBIMENTO_FUTURO_A_CONFERIR: "Financeiro: há recebimento ou comprovante em período futuro. O tratamento precisa ser conferido antes da pausa.",
  COBERTURA_SOBREPOSTA: "Financeiro: existem períodos de cobertura sobrepostos que precisam ser conferidos.",
  SUSPENSAO_A_CONFERIR: "Financeiro: confira a situação e os recebimentos da cobrança suspensa antes de retomar.",
};
const calculo = new Set([
  "Cobrança repetida na seleção.",
  "Coberturas de origem sobrepostas exigem conferência.",
  "Vencimentos fora da seleção ou repetidos.",
  "Informe o vencimento de cada cobrança selecionada.",
  "Coberturas mantidas sobrepostas exigem conferência.",
  "A nova cobertura conflita com período mantido. Confira a proposta.",
]);

export function Pendencias({ itens }: { itens: string[] }) {
  if (!itens.length) return null;
  // Projeta mensagens conhecidas: erros inesperados não expõem detalhes internos.
  const descricoes = [...new Set(itens.map((item) => mensagens[item.split(":")[0]]
    ?? (calculo.has(item) ? item : "A cobertura exige conferência da equipe antes da aprovação.")))];
  return <div role="alert" className="space-y-1 text-sm text-amber-800">
    <p className="font-medium">Pendências que impedem a aprovação</p>
    <ul className="list-disc space-y-1 pl-5">{descricoes.map((descricao) => <li key={descricao}>{descricao}</li>)}</ul>
  </div>;
}

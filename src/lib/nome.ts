// Nome do aluno foi dividido em `primeiroNome` + `sobrenome` (doc 09 §Identificação,
// migration `aluno_cadastro_completo`). Este helper reconstrói o nome de exibição para
// as projeções (DTOs) — assim listas, ficha e financeiro continuam consumindo um único
// `nome`. `nomePreferido`, quando existe, é o tratamento do dia a dia.

export interface PartesNome {
  primeiroNome: string;
  sobrenome?: string | null;
  nomePreferido?: string | null;
}

/** Nome completo: "primeiroNome sobrenome" (sobrenome opcional). */
export function nomeCompleto(p: PartesNome): string {
  return [p.primeiroNome, p.sobrenome].filter(Boolean).join(" ");
}

/** Nome de exibição: usa o nome preferido quando informado; senão o nome completo. */
export function nomeExibicao(p: PartesNome): string {
  return p.nomePreferido?.trim() || nomeCompleto(p);
}

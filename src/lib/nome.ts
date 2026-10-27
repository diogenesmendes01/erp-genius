export interface PartesNome {
  primeiroNome: string;
  sobrenome?: string | null;
  nomePreferido?: string | null;
}

export function nomeCompleto(p: PartesNome): string {
  return [p.primeiroNome, p.sobrenome].filter(Boolean).join(" ");
}

export function nomeExibicao(p: PartesNome): string {
  return p.nomePreferido?.trim() || nomeCompleto(p);
}

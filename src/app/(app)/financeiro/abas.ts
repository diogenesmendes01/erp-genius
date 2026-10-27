export type AbaFinanceiro = "cobrancas" | "informes" | "retomadas" | "comissoes" | "descontos" | "geral" | "politicas" | "aprovacoes" | "cambio";

export type PermissoesFinanceiro = {
  podeOperarCobranca: boolean;
  podeAprovar: boolean;
  podeGerenciarCambio: boolean;
  podeConfigurarPoliticas: boolean;
};

export const ROTULO_ABA: Record<AbaFinanceiro, string> = {
  cobrancas: "Cobranças",
  informes: "A conferir",
  retomadas: "Retomadas",
  comissoes: "Comissões",
  descontos: "Descontos",
  geral: "Visão geral",
  politicas: "Política de comissão",
  aprovacoes: "Aprovações",
  cambio: "Câmbio",
};

export function abasVisiveis(p: PermissoesFinanceiro): AbaFinanceiro[] {
  return [
    ...(p.podeOperarCobranca ? (["cobrancas", "informes", "retomadas"] as const) : []),
    "comissoes",
    "descontos",
    ...(p.podeOperarCobranca ? (["geral"] as const) : []),
    ...(p.podeConfigurarPoliticas ? (["politicas"] as const) : []),
    ...(p.podeAprovar ? (["aprovacoes"] as const) : []),
    ...(p.podeGerenciarCambio ? (["cambio"] as const) : []),
  ];
}

export function resolverAba(pedida: string | undefined, p: PermissoesFinanceiro): AbaFinanceiro {
  const visiveis = abasVisiveis(p);
  return (visiveis as string[]).includes(pedida ?? "") ? (pedida as AbaFinanceiro) : p.podeOperarCobranca ? "cobrancas" : "comissoes";
}

export const hrefAba = (aba: AbaFinanceiro) => `/financeiro/${aba}`;

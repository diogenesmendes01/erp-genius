// Abas do /financeiro (docs/42-auditoria-frontend-ux.md, E8). Cada aba é uma rota (/financeiro/<aba>,
// hrefAba) com o próprio guard e as próprias consultas. Módulo puro: quais abas o papel enxerga
// (abasVisiveis), a padrão do papel e a compatibilidade dos links antigos com ?aba= (resolverAba).

export type AbaFinanceiro = "cobrancas" | "informes" | "retomadas" | "comissoes" | "descontos" | "geral" | "politicas" | "aprovacoes" | "cambio";

export type PermissoesFinanceiro = {
  podeOperarCobranca: boolean;
  podeAprovar: boolean;
  podeGerenciarCambio: boolean;
  /** Administrador ou permissão `comissao.configurar` (a mesma regra de configuracaoComissoes). */
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

/** Abas que o papel enxerga, na ordem da barra. */
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

/**
 * Aba pedida na URL, se o papel a enxerga; senão a padrão (Cobranças para quem opera, Comissões para
 * os demais). Aba inválida ou proibida nunca dispara a consulta dela — cai na padrão, sem erro.
 */
export function resolverAba(pedida: string | undefined, p: PermissoesFinanceiro): AbaFinanceiro {
  const visiveis = abasVisiveis(p);
  return (visiveis as string[]).includes(pedida ?? "") ? (pedida as AbaFinanceiro) : p.podeOperarCobranca ? "cobrancas" : "comissoes";
}

/** Rota da aba (E8 definitivo): cada aba é uma página própria sob /financeiro. */
export const hrefAba = (aba: AbaFinanceiro) => `/financeiro/${aba}`;

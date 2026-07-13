import { formatarMoeda } from "@/lib/dinheiro";
import { TEXTOS_FABRICA } from "@/server/cobrancas/fabrica";

// Renderização de template (doc 26 §Camada 2 · doc 30 S/gap 15): variáveis amigáveis
// {nome} {valor} {vencimento} {link} → corpo final (snapshot auditável na intenção) +
// valores POSICIONAIS na ordem de aparição (para template Meta {{1}}..{{n}}).
// Textos de fábrica: fonte única em cobrancas/fabrica.ts (seed + fallback — doc 29 regra 4).

export { TEXTOS_FABRICA };

export interface DadosRender {
  nome: string;
  valor: number;
  moeda: string;
  vencimento: Date;
  link?: string | null;
  /** Idioma do template (casa com Pais.idioma — gap 11). Default es. */
  idioma?: string;
}

export interface TemplateRenderizado {
  corpo: string;
  /** Valores na ordem de aparição das variáveis no corpo — posicionais do template Meta. */
  variaveis: string[];
}

const LOCALE_POR_IDIOMA: Record<string, string> = { pt: "pt-BR", es: "es-CR", en: "en-US" };

export function renderizarTemplate(corpoTemplate: string, dados: DadosRender): TemplateRenderizado {
  const locale = LOCALE_POR_IDIOMA[dados.idioma ?? "es"] ?? "es-CR";
  const valores: Record<string, string> = {
    nome: dados.nome,
    valor: formatarMoeda(dados.valor, dados.moeda),
    vencimento: dados.vencimento.toLocaleDateString(locale, { timeZone: "UTC" }),
    link: dados.link ?? "",
  };

  const variaveis: string[] = [];
  const corpo = corpoTemplate.replace(/\{(nome|valor|vencimento|link)\}/g, (_, chave: string) => {
    const v = valores[chave] ?? "";
    variaveis.push(v);
    return v;
  });
  return { corpo, variaveis };
}

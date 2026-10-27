import { formatarMoeda } from "@/lib/dinheiro";
import { TEXTOS_FABRICA } from "@/server/cobrancas/fabrica";

export { TEXTOS_FABRICA };

export interface DadosRender {
  nome: string;
  valor: number;
  moeda: string;
  vencimento: Date;
  link?: string | null;
  idioma?: string;
}

export interface TemplateRenderizado {
  corpo: string;
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

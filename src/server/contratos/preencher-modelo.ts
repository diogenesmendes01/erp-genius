import { ConteudoModeloSchema } from "./modelo-schema";
import { OrigemCampo, ROTULOS_ORIGEM } from "./campos";
import { ErroRegra } from "@/server/_shared/sessao";

/** Resolve somente campos declarados, em uma passagem, sem avaliar expressões
 * ou interpretar como modelo o valor vindo do cadastro. Chamador fornece fontes
 * conferidas no servidor, nunca cláusulas ou valores financeiros do navegador. */
export function preencherModelo(conteudo: unknown, fontes: Partial<Record<OrigemCampo, string | null | undefined>>) {
  const modelo = ConteudoModeloSchema.parse(conteudo);
  const campos: { chave: string; origem: OrigemCampo; valor: string }[] = [];
  for (const campo of modelo.campos) {
    if (!campo.origem) throw new ErroRegra(`O campo ${campo.chave} não tem origem aprovada. Prepare e publique uma nova versão do modelo.`);
    const valor = fontes[campo.origem];
    if (typeof valor !== "string" || !valor.trim()) throw new ErroRegra(`Complete a informação necessária: ${ROTULOS_ORIGEM[campo.origem]}.`);
    campos.push({ chave: campo.chave, origem: campo.origem, valor });
  }
  const valores = new Map(campos.map((c) => [c.chave, c.valor]));
  const resolver = (texto: string) => texto.replace(/\{\{([a-z][a-z0-9_]{0,59})\}\}/g, (_, chave: string) => {
    const valor = valores.get(chave);
    if (valor == null) throw new ErroRegra(`Campo não resolvido: ${chave}.`);
    return valor;
  });
  return { titulo: resolver(modelo.titulo), finalidade: modelo.finalidade, campos,
    secoes: modelo.secoes.map((s) => ({ titulo: resolver(s.titulo), texto: resolver(s.texto) })) };
}

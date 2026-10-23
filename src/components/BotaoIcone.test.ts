import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { BotaoIcone } from "./BotaoIcone";
// createElement recebe children no terceiro argumento; a assinatura de props do React18 não o deduz.
const html=(props:Omit<ComponentProps<typeof BotaoIcone>,"children">)=>renderToStaticMarkup(createElement(BotaoIcone,props as ComponentProps<typeof BotaoIcone>,"x"));
it("controle acessível circular preserva atributos nativos e estado ativo", () => {
 const h=html({rotulo:"Filtros",ativo:true,tamanho:34,disabled:true,"aria-expanded":true});
 for(const t of ['aria-label="Filtros"','type="button"','aria-expanded="true"',"disabled",'rounded-full','h-[34px]','w-[34px]','bg-gray-100','text-gray-600'])expect(h).toContain(t);
});
it("Fechar aceita28 tipado e demais tamanhos não dependem de classe dinâmica", () => {
 for(const tamanho of [28,34,36,44] as const){const h=html({rotulo:"Fechar",tamanho});expect(h).toContain('h-['+tamanho+'px]');expect(h).toContain('w-['+tamanho+'px]');}
});

import { useLayoutEffect, useRef } from "react";
import { useBuscaConversa } from "@/app/(app)/inbox/useBuscaConversa";
type ApiBusca = ReturnType<typeof useBuscaConversa>;
export function BuscaConversaFixture({id,ms,aoAtualizar}:{id:string;ms:{id:string;corpo:string;criadoEm:string;apagada:boolean}[];aoAtualizar(a:ApiBusca):void}) {
 const scroll = useRef<HTMLDivElement>(null);
 const resultado = useBuscaConversa(id,ms,scroll);
 const { aberta, campoRef } = resultado;
 useLayoutEffect(() => { aoAtualizar(resultado); });
 return <section aria-label="Conversa"><button aria-label="Buscar na conversa" /><button aria-label="Mais ações da conversa" />{aberta ? <input ref={campoRef} aria-label="Busca" /> : null}<div ref={scroll} /></section>;
}

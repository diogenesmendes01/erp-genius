import type{BrowserContext,Page}from'playwright-core';
export declare function abrirApp(pagina:Page,contexto:BrowserContext,base:string,ids:{beatriz:string;mariana:string},estado:string,tamanho:string):Promise<{finalizar?:()=>Promise<void>;metadados?:Record<string,unknown>}>;

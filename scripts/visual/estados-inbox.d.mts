import type {BrowserContext,Page,Response} from 'playwright-core';
export declare function instalarErroEstado(contexto:BrowserContext,base:string,id:string,estado:string):Promise<{diagnosticos:{tipo:string;metodo:string;caminho:string}[];respostaEsperada(r:Response):boolean}>;
export declare function semanticaEstado319Pronto(estado:string):boolean;
export declare function abrirCarregandoApp(pagina:Page,contexto:BrowserContext,base:string):Promise<()=>Promise<void>>;
export declare function confirmarPainelVazio(contexto:BrowserContext,base:string,id:string):Promise<{status:number;setor:string;oportunidade:null}>;

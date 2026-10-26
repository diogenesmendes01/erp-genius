import {act,createElement} from "react";
import type {Root} from "react-dom/client";
import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {criarDomMinimo,desligarObservadores,type Elemento} from "@/test/dom-minimo";
const m=vi.hoisted(()=>({replace:vi.fn(),params:"nova=p1&o=antiga&modo=lista&busca=curso",nova:[] as {preenchido?:{pessoaId?:string;nome?:string};aoFechar():void}[]}));
vi.mock("next/navigation",()=>({usePathname:()=>"/funil",useSearchParams:()=>new URLSearchParams(m.params),useRouter:()=>({push:vi.fn(),replace:m.replace,refresh:vi.fn()})}));
vi.mock("@/server/crm/oportunidades",()=>({moverEtapaEmLote:vi.fn()}));
vi.mock("./QuadroFunil",()=>({QuadroFunil:()=>null}));vi.mock("./ListaFunil",()=>({ListaFunil:()=>null}));
// Fronteira do formulário existente: o pai é responsável por abrir uma superfície e entregar snapshot/fechamento.
vi.mock("./NovaOportunidade",()=>({NovaOportunidade:(p:typeof m.nova[number])=>{m.nova.push(p);return createElement('section',{'role':'dialog','aria-label':'Nova oportunidade'},p.preenchido?.nome,createElement('button',{onClick:p.aoFechar},'Cancelar nova'));}}));
vi.mock("./PainelOportunidade",()=>({PainelOportunidade:()=>createElement('section',{'role':'dialog'},'Oportunidade antiga')}));
vi.mock("./ModalPerda",()=>({ModalPerda:()=>createElement('section',{'role':'dialog'},'Perda')}));
import {FunilCliente} from "./FunilCliente";
type Props=Parameters<typeof FunilCliente>[0];
const base=()=>({colunas:[],modo:"quadro",filtros:{busca:"curso",tipo:"",donoId:"",temperatura:"",origem:"",tagId:"",perdidosDias:"todos",ordem:"recentes"},dirOrdem:"asc",salvos:[],aberta:null,oportunidadeNaoEncontrada:false,capacidades:["funil.mover"],podeAtribuir:false,vendedores:[],paises:[],vazio:null,preenchidoNova:{pessoaId:"p1",nome:"Pessoa um fictícia"}} as Props);
let root:Root,host:Elemento;
const render=(p:Partial<Props>={})=>act(async()=>root.render(createElement(FunilCliente,{...base(),...p})));
beforeEach(async()=>{vi.clearAllMocks();m.nova=[];m.params="nova=p1&o=antiga&modo=lista&busca=curso";const d=criarDomMinimo();const criar=d.documento.createElement.bind(d.documento);d.documento.createElement=(tag:string)=>{const el=criar(tag);if(tag==='select')Object.defineProperty(el,'options',{get:()=>el.querySelectorAll('option')});return el;};vi.stubGlobal('self',globalThis);vi.stubGlobal('document',d.documento);vi.stubGlobal('window',d.janela);vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);host=d.documento.createElement('div');d.documento.body.appendChild(host);const{createRoot}=await import('react-dom/client');root=createRoot(host as unknown as HTMLElement);});
afterEach(async()=>{await act(async()=>root.unmount());desligarObservadores();vi.unstubAllGlobals();});
// Double da fronteira PainelOportunidade: este teste só verifica supressão do painel antigo; seus dados internos não são consumidos.
it("Nova por Pessoa abre preenchida com uma única superfície, mesmo com o parâmetro o",async()=>{await render({aberta:{oportunidade:{id:"antiga"},historico:[]} as unknown as Props['aberta']});expect(host.querySelectorAll('[role=dialog]')).toHaveLength(1);expect(host.textContent).toContain('Pessoa um fictícia');expect(host.textContent).not.toContain('Oportunidade antiga');expect(m.nova.at(-1)?.preenchido).toEqual({pessoaId:"p1",nome:"Pessoa um fictícia"});});
it("Cancelar limpa somente nova, conserva o e filtros, sem salvar",async()=>{await render();await act(async()=>m.nova.at(-1)!.aoFechar());expect(m.replace).toHaveBeenCalledExactlyOnceWith('/funil?o=antiga&modo=lista&busca=curso',{scroll:false});expect(host.querySelectorAll('[role=dialog]')).toHaveLength(0);});
it("não concede criação sem capacidade global",async()=>{await render({capacidades:[]});expect(host.querySelectorAll('[role=dialog]')).toHaveLength(0);expect(m.nova).toHaveLength(0);});
it("troca da Pessoa cria novo snapshot e ACK antigo não fecha a nova abertura",async()=>{await render();const anterior=m.nova.at(-1)!;await render({preenchidoNova:{pessoaId:"p2",nome:"Pessoa dois fictícia"}});expect(host.textContent).toContain('Pessoa dois fictícia');await act(async()=>anterior.aoFechar());expect(host.querySelectorAll('[role=dialog]')).toHaveLength(1);expect(m.replace).not.toHaveBeenCalled();});
it("A para B para A é uma nova sessão e não aceita ACK da primeira",async()=>{await render();const anterior=m.nova.at(-1)!;await render({preenchidoNova:{pessoaId:"p2",nome:"Pessoa dois fictícia"}});await render();await act(async()=>anterior.aoFechar());expect(host.querySelectorAll('[role=dialog]')).toHaveLength(1);expect(m.replace).not.toHaveBeenCalled();});
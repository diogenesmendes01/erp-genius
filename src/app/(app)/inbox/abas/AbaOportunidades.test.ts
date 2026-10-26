import {act,createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import type {Root} from "react-dom/client";
import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {criarDomMinimo,desligarObservadores,type Elemento} from "@/test/dom-minimo";
import type {OportunidadesPainel} from "@/server/inbox/painel-oportunidades";
const {mover}=vi.hoisted(()=>({mover:vi.fn()}));vi.mock("@/server/inbox/acoes-painel",()=>({moverEtapaNoInbox:mover}));
import {AbaOportunidades} from "./AbaOportunidades";
const dados:OportunidadesPainel={atual:{id:"op327",titulo:"Curso fictício327",produto:"Inglês327",valor:"650.00",moeda:"BRL",etapa:"QUALIFICADO",temperatura:"MORNO",responsavel:null,dataExperimental:null,experimentalConfirmada:false,professorExperimental:null,motivoPerda:null},outras:[],pessoaId:null};
const cap={veLead:true,verContato:false,editarContato:false,editarTags:false,criarTag:false,moverEtapa:true,tarefas:false,tarefasEquipe:false,desfazerAria:false,verEmpresa:false};
type Props=Parameters<typeof AbaOportunidades>[0];
let root:Root,host:Elemento;const mudar=vi.fn(),perder=vi.fn();
const props=():Props=>({dados,capacidades:cap,atendimentoId:"A",fuso:null,aoMudar:mudar,aoAbrirPerda:perder,podeAbrirFunil:true});
const render=(extra:Partial<Props>={})=>act(async()=>root.render(createElement(AbaOportunidades,{...props(),...extra})));
const botao=(nome:string)=>host.querySelectorAll('button').find(e=>e.getAttribute('aria-label')===nome)!;
function handler(e:Elemento,nome:string){const k=Object.keys(e).find(k=>k.startsWith('__reactProps'))!;return(e as unknown as Record<string,Record<string,(ev?:unknown)=>unknown>>)[k][nome];}
async function clicar(nome:string){await act(async()=>{handler(botao(nome),'onClick')();});}
async function selecionar(etapa:string){await act(async()=>{handler(host.querySelector('select')!,'onChange')({target:{value:etapa}});});}
beforeEach(async()=>{vi.clearAllMocks();mover.mockResolvedValue({ok:true});const dom=criarDomMinimo();const criar=dom.documento.createElement.bind(dom.documento);dom.documento.createElement=t=>{const e=criar(t);if(t==='select')Object.defineProperty(e,'options',{get:()=>e.querySelectorAll('option')});return e;};vi.stubGlobal('document',dom.documento);vi.stubGlobal('window',dom.janela);vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);host=dom.documento.createElement('div');dom.documento.body.appendChild(host);const{createRoot}=await import('react-dom/client');root=createRoot(host as unknown as HTMLElement);});
afterEach(async()=>{await act(async()=>root.unmount());desligarObservadores();vi.unstubAllGlobals();});
it("SSR apresenta valor/linhas e recusa de salto sem probabilidade ou score",()=>{const h=renderToStaticMarkup(createElement(AbaOportunidades,props()));for(const t of["Oportunidade atual","Funil Matrículas","Inglês327","Responsável","Sem responsável","Temperatura","Produto"])expect(h).toContain(t);expect(h).toMatch(/R\$\s?650,00/);expect(h).not.toContain("Probabilidade");expect(h).not.toContain("Score");expect(h).toMatch(/<option[^>]*value="NOVO"[^>]*disabled[^>]*title="Avance uma etapa por vez\."/);});
it("sem oportunidade visível mostra vazio legítimo e nenhum select",async()=>{await render({dados:{atual:null,outras:[],pessoaId:null}});expect(host.textContent).toContain("Sem oportunidade visível para você.");expect(host.querySelector('select')).toBeNull();});
it("sem capacidade os controles ficam readonly e nenhum movimento é disparado",async()=>{await render({capacidades:{...cap,moverEtapa:false}});expect((host.querySelector('select')!.getAttribute('disabled')!==null)).toBe(true);expect(host.querySelectorAll('button').every(b=>b.getAttribute('disabled')!==null)).toBe(true);expect(mover).not.toHaveBeenCalled();});
it("mover usa atendimento e CAS da oportunidade, reconcilia só após OK; mesma etapa não executa",async()=>{await render();await selecionar("QUALIFICADO");expect(mover).not.toHaveBeenCalled();await clicar("Etapa 1º Contato");expect(mover).toHaveBeenCalledWith("A","EM_ATENDIMENTO","op327");expect(mover).toHaveBeenCalledOnce();expect(mudar).toHaveBeenCalledOnce();});
it("recusa de segmento apresenta motivo sem ação nem modal",async()=>{await render();await clicar("Etapa Novo");expect(host.textContent).toContain("Avance uma etapa por vez.");expect(mover).not.toHaveBeenCalled();expect(perder).not.toHaveBeenCalled();});
it.each([true,false])("ação especial informa destino e link Funil apenas com alçada global=%s",async podeAbrirFunil=>{await render({podeAbrirFunil});await selecionar("PROPOSTA");expect(host.textContent).toContain("Para enviar a proposta, abra a oportunidade no funil.");expect(host.querySelectorAll('a').map(a=>a.getAttribute('href'))).toEqual(podeAbrirFunil?["/funil?o=op327"]:[]);expect(mover).not.toHaveBeenCalled();});
it("PERDIDO abre callback funcional do modal existente sem mover etapa diretamente",async()=>{await render();await selecionar("PERDIDO");expect(perder).toHaveBeenCalledOnce();expect(mover).not.toHaveBeenCalled();});
it.each(["negocio","transporte"])("falha %s mantém contexto e libera controles",async tipo=>{mover[tipo==="negocio"?"mockResolvedValue":"mockRejectedValue"](tipo==="negocio"?{ok:false,erro:"Etapa recusada327"}:Error("offline"));await render();await clicar("Etapa 1º Contato");expect(host.textContent).toContain(tipo==="negocio"?"Etapa recusada327":"Resultado não confirmado.");expect(mudar).not.toHaveBeenCalled();expect((host.querySelector('select')!.getAttribute('disabled')!==null)).toBe(false);});
it("ACK de movimento antigo não reconcilia outro atendimento montado depois",async()=>{let concluir!:(r:{ok:true})=>void;mover.mockImplementation(()=>new Promise(r=>concluir=r));await render();await clicar("Etapa 1º Contato");await render({atendimentoId:"B",dados:{...dados,atual:{...dados.atual!,id:"opB",produto:"CursoB"}}});await act(async()=>concluir({ok:true}));expect(host.textContent).toContain("CursoB");expect(mudar).not.toHaveBeenCalled();expect((host.querySelector('select')!.getAttribute('disabled')!==null)).toBe(false);});
it.each(['NOVO','EM_ATENDIMENTO','QUALIFICADO','EXPERIMENTAL_AGENDADA','EXPERIMENTAL_REALIZADA','NO_SHOW','PROPOSTA','AGUARDANDO_MATRICULA','MATRICULADO','PERDIDO'] as const)('barra %s conserva rotulos centrais e tom apenas no span decorativo',async etapa=>{
  const {ETAPA_LABEL}=await import('@/lib/labels');
  const {destinoDoArraste}=await import('@/server/crm/etapas');
  await render({dados:{...dados,atual:{...dados.atual!,etapa}}});
  const grupo=host.querySelectorAll('div').find(e=>e.getAttribute('aria-label')==='Etapas da oportunidade')!;
  const segmentos=grupo.querySelectorAll('button');expect(segmentos).toHaveLength(8);
  for(const b of segmentos){const codigo=(Object.keys(ETAPA_LABEL) as (keyof typeof ETAPA_LABEL)[]).find(k=>b.getAttribute('aria-label')==='Etapa '+ETAPA_LABEL[k])!;expect(codigo).toBeTruthy();const destino=destinoDoArraste(etapa,codigo);expect(b.getAttribute('title')).toBe(destino.tipo==='recusar'?destino.motivo:ETAPA_LABEL[codigo]);const decoracao=b.querySelector('span')!;expect(decoracao.getAttribute('aria-hidden')).toBe('true');expect(decoracao.textContent).toBe('');}
  for(const option of host.querySelectorAll('option'))expect(option.textContent).toBe(ETAPA_LABEL[option.getAttribute('value') as keyof typeof ETAPA_LABEL]);
  expect(host.textContent).not.toMatch(/\b(marca|perigo|neutro)\b/);
  expect(mover).not.toHaveBeenCalled();expect(perder).not.toHaveBeenCalled();
});

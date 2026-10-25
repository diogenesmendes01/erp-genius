import {act,createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import type {Root} from "react-dom/client";
import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {criarDomMinimo,desligarObservadores,type Elemento} from "@/test/dom-minimo";
import type {OportunidadesPainel} from "@/server/inbox/painel-oportunidades";
// O DOM mínimo não implementa namespaces SVG; apresentação dos ícones reais é coberta no SSR do cartão.
vi.mock("@tabler/icons-react",()=>({IconCalendarTime:()=>createElement('span'),IconPencil:()=>createElement('span'),IconTrash:()=>createElement('span'),IconBriefcase:()=>createElement('span'),IconPlus:()=>createElement('span'),IconHandStop:()=>createElement('span'),IconThumbDown:()=>createElement('span'),IconCalendarCheck:()=>createElement('span')}));
const {mover}=vi.hoisted(()=>({mover:vi.fn()}));vi.mock("@/server/inbox/acoes-painel",()=>({moverEtapaNoInbox:mover}));
import {AbaOportunidades} from "./AbaOportunidades";
const dados:OportunidadesPainel={atual:{id:"op327",titulo:"Curso fictício327",produto:"Inglês327",valor:"650.00",moeda:"BRL",etapa:"QUALIFICADO",temperatura:"MORNO",responsavel:null,dataExperimental:null,experimentalConfirmada:false,professorExperimental:null,motivoPerda:null},outras:[],pessoaId:null,tarefas:[],fusoEscola:"America/Sao_Paulo"};
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
it("sem oportunidade visível mostra vazio legítimo e nenhum select",async()=>{await render({dados:{atual:null,outras:[],pessoaId:null,tarefas:[],fusoEscola:"America/Sao_Paulo"}});expect(host.textContent).toContain("Sem oportunidade visível para você.");expect(host.querySelector('select')).toBeNull();});
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

it("328: projeta cartão experimental na aba com fuso escolar e permissão de abrir Funil independente de mover",()=>{const html=renderToStaticMarkup(createElement(AbaOportunidades,{...props(),dados:{...dados,atual:{...dados.atual!,dataExperimental:"2026-11-01T01:30:00.000Z",professorExperimental:"Helena fictícia",etapa:"EXPERIMENTAL_REALIZADA"}},capacidades:{...cap,moverEtapa:false},fusoEscola:"America/Costa_Rica"}));expect(html).toContain("Aula experimental");expect(html).toContain("31/10/2026, 19:30");expect(html).toContain("Realizada");expect(html).toContain('href="/funil?o=op327"');});

const assumir328=vi.fn();
beforeEach(()=>{assumir328.mockReset().mockResolvedValue({ok:true});});
const acao328=(nome:string)=>host.querySelectorAll('button').find(e=>e.textContent===nome);
async function clicar328(nome:string){expect(acao328(nome)).toBeTruthy();await act(async()=>{handler(acao328(nome)!,'onClick')();});}
it.each(['NOVO','EM_ATENDIMENTO','QUALIFICADO','EXPERIMENTAL_AGENDADA','EXPERIMENTAL_REALIZADA','NO_SHOW','PROPOSTA','AGUARDANDO_MATRICULA','MATRICULADO','PERDIDO'] as const)('328: perda na seção segue D8 em%s',async etapa=>{await render({dados:{...dados,atual:{...dados.atual!,etapa}}});expect(!!acao328('Marcar como perdido')).toBe(!['MATRICULADO','PERDIDO'].includes(etapa));if(acao328('Marcar como perdido')){await clicar328('Marcar como perdido');expect(perder).toHaveBeenCalledOnce();expect(mover).not.toHaveBeenCalled();}});
it('328: readonly não mostra perda, mas assumir é capacidade independente',async()=>{await render({capacidades:{...cap,moverEtapa:false},podeAssumir:true,aoAssumir:assumir328});expect(acao328('Marcar como perdido')).toBeUndefined();expect(acao328('Assumir conversa')).toBeTruthy();await clicar328('Assumir conversa');expect(assumir328).toHaveBeenCalledOnce();expect(mudar).toHaveBeenCalledOnce();expect(host.textContent).toContain('Atendimento assumido.');});
it.each([false,undefined])('328: sem alçada%s não expõe assumir',async podeAssumir=>{await render({podeAssumir,aoAssumir:assumir328});expect(acao328('Assumir conversa')).toBeUndefined();expect(assumir328).not.toHaveBeenCalled();});
it('328: sem callback não cria controle assumir sem ação',async()=>{await render({podeAssumir:true});expect(acao328('Assumir conversa')).toBeUndefined();});
it('328: assumir trava clique duplo e controles até o ACK, sem promessa de SSE',async()=>{let concluir!:(r:{ok:true})=>void;assumir328.mockImplementation(()=>new Promise(r=>concluir=r));await render({podeAssumir:true,aoAssumir:assumir328});const onClick=handler(acao328('Assumir conversa')!,'onClick');await act(async()=>{onClick();onClick();});expect(assumir328).toHaveBeenCalledOnce();expect(host.querySelector('select')!.getAttribute('disabled')).not.toBeNull();expect(acao328('Marcar como perdido')!.getAttribute('disabled')).not.toBeNull();expect(mudar).not.toHaveBeenCalled();await act(async()=>concluir({ok:true}));expect(mudar).toHaveBeenCalledOnce();expect(acao328('Assumir conversa')!.getAttribute('disabled')).toBeNull();});
it.each(['negocio','transporte'])('328: erro%s de assumir mostra feedback sem reconciliar',async tipo=>{assumir328[tipo==='negocio'?'mockResolvedValue':'mockRejectedValue'](tipo==='negocio'?{ok:false,erro:'Outro atendente já assumiu este atendimento.'}:Error('offline'));await render({podeAssumir:true,aoAssumir:assumir328});await clicar328('Assumir conversa');expect(host.textContent).toContain(tipo==='negocio'?'Outro atendente já assumiu este atendimento.':'Resultado não confirmado.');expect(mudar).not.toHaveBeenCalled();expect(acao328('Assumir conversa')!.getAttribute('disabled')).toBeNull();});
it.each(['atendimento','oportunidade'])('328: ACK de assumir antigo não reconcilia nova %s',async troca=>{let concluir!:(r:{ok:true})=>void;assumir328.mockImplementation(()=>new Promise(r=>concluir=r));await render({podeAssumir:true,aoAssumir:assumir328});await clicar328('Assumir conversa');await render({atendimentoId:troca==='atendimento'?'B':'A',dados:{...dados,atual:{...dados.atual!,id:'nova328',produto:'Nova sessão328'}},podeAssumir:true,aoAssumir:assumir328});await act(async()=>concluir({ok:true}));expect(host.textContent).toContain('Nova sessão328');expect(mudar).not.toHaveBeenCalled();expect(host.textContent).not.toContain('Atendimento assumido.');});

it("329: compõe outras oportunidades e criação pela alçada global independente de mover etapa",()=>{
 const h=renderToStaticMarkup(createElement(AbaOportunidades,{...props(),podeCriarOportunidade:true,podeAbrirFunil:true,dados:{...dados,pessoaId:"p/329",outras:[{id:"outra329",titulo:"Outro curso fictício",etapa:"PERDIDO",valor:"0",moeda:"BRL"}]},capacidades:{...cap,moverEtapa:false}} as Parameters<typeof AbaOportunidades>[0]));
 expect(h).toContain("Oportunidade atual");expect(h).toContain("Outras oportunidades deste contato");expect(h).toContain("Outro curso fictício");expect(h).toContain('href="/funil?nova=p%2F329"');expect(h).toContain('href="/funil?o=outra329"');
});

it("330: tarefas diretamente ligadas continuam visíveis sem oportunidade atual",()=>{
 const html=renderToStaticMarkup(createElement(AbaOportunidades,{...props(),capacidades:{...cap,tarefas:true},dados:{...dados,atual:null,tarefas:[{id:"t330",versao:1,titulo:"Tarefa direta330",descricao:null,tipo:"LIGACAO",status:"ABERTA",prioridade:"NORMAL",dataCivil:null,hora:null,fusoOrigem:"America/Sao_Paulo",lembreteAntecedenciaMin:null,responsavel:null,atrasada:false,ia:false,leadId:null,atendimentoId:"a327",criadoEm:"2026-10-22T12:00:00Z",criadorNome:null,podeAgir:true}],fusoEscola:"America/Sao_Paulo"}}));
 expect(html).toContain("Tarefa direta330");expect(html).toContain("Tarefas · 1 aberta(s)");
});
it.each([true,false])("332 entradas nominais na seção de ações com oportunidade visível=%s",async visivel=>{
 const criar=vi.fn(),nota=vi.fn();await render({dados:{...dados,atual:visivel?dados.atual:null},capacidades:{...cap,tarefas:true},aoNovaTarefa:criar,aoAdicionarNota:nota});for(const texto of ["Criar tarefa","Adicionar nota"]){const b=host.querySelectorAll("button").find(e=>e.textContent===texto)!;expect(b).toBeDefined();await act(async()=>handler(b,"onClick")());}expect(criar).toHaveBeenCalledOnce();expect(nota).toHaveBeenCalledOnce();expect(mover).not.toHaveBeenCalled();
});
it("332 callback não concede capacidade de tarefas e nota continua independente",async()=>{await render({aoNovaTarefa:vi.fn(),aoAdicionarNota:vi.fn()});expect(host.querySelectorAll("button").some(b=>b.textContent==="Criar tarefa")).toBe(false);expect(host.querySelectorAll("button").some(b=>b.textContent==="Adicionar nota")).toBe(true);});

it("357 Aba não reconcilia ACK depois de perder e recuperar a capacidade no mesmo atendimento",async()=>{
 let concluir!:(r:{ok:true})=>void;assumir328.mockImplementation(()=>new Promise(r=>concluir=r));
 const p={podeAssumir:true,aoAssumir:assumir328,contextoAria:true};await render(p);await clicar328("Assumir conversa");await render({...p,podeAssumir:false});await render(p);await act(async()=>concluir({ok:true}));expect(mudar).not.toHaveBeenCalled();
});
it("357 handler antigo da Aba não executa após revogação e retorno de capacidade",async()=>{
 const p={podeAssumir:true,aoAssumir:assumir328,contextoAria:true};await render(p);const onClick=handler(acao328("Assumir conversa")!,"onClick");await render({...p,podeAssumir:false});await render(p);await act(async()=>onClick());expect(assumir328).not.toHaveBeenCalled();
});

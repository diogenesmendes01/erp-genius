import type { ReactNode } from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Duas formas de teste no mesmo arquivo, sem DOM: marcação (renderToStaticMarkup, React real) e interação
// (o componente chamado como função, com os ganchos de src/test/tela-sem-dom.ts; efeitos não rodam).
const m = vi.hoisted(() => ({ g: null as null | import("@/test/tela-sem-dom").Ganchos }));
vi.mock("react", async (original) => {
  const real = await original<typeof import("react")>();
  return {
    ...real,
    useId: (() => m.g ? m.g.useId() : real.useId()) as typeof real.useId,
    useState: ((i: unknown) => (m.g ? m.g.useState(i) : real.useState(i as never))) as unknown as typeof real.useState,
    useRef: ((i: unknown) => (m.g ? m.g.useRef(i) : real.useRef(i as never))) as unknown as typeof real.useRef,
    useLayoutEffect: ((f: () => void, d?: unknown[]) => (m.g ? f() : real.useLayoutEffect(f, d))) as unknown as typeof real.useLayoutEffect,
    useEffect: ((f: () => void, d?: unknown[]) => (m.g ? undefined : real.useEffect(f, d))) as unknown as typeof real.useEffect,
  };
});

import { Compositor, MOTIVO_SEM_ENVIO, AVISO_NOTA, CARREGANDO_ENVIO, FALHA_PERMISSAO_ENVIO, AVISO_ANEXO_EM_BREVE, type PropsCompositor } from "./Compositor";
import { SeletorEmoji, buscarEmoji, type EntradaEmoji } from "./SeletorEmoji";
import { AVISO_RECURSO_MOTOR, type RecursoMotor } from "./recursos-canal";
import { criarChavesPorAlvo } from "@/lib/chave-idempotencia";
import { MSG_RESULTADO_INCERTO } from "@/lib/mensagens";
import { CampoTexto } from "@/components/CampoTexto";
import { criarGanchos, clicarBotao, elementos } from "@/test/tela-sem-dom";

function props(p: Partial<PropsCompositor> = {}): PropsCompositor {
  return {
    atendimentoId: "at1", modo: "responder", podeEnviar: true, capacidades: [],
    aoEnviarTexto: vi.fn(async () => ({ ok: true as const })),
    aoEnviarMidia: vi.fn(async () => ({ ok: true as const })),
    aoNota: vi.fn(async () => ({ ok: true as const })),
    ...p,
  };
}
const html = (p: Partial<PropsCompositor> = {}) => renderToStaticMarkup(createElement(Compositor, props(p)));
const htmlSeletor = () => renderToStaticMarkup(createElement(SeletorEmoji, { gif: false, figurinha: false, aoEmoji: () => {}, aoFechar: () => {} }));

const armazenamento = new Map<string, string>();
beforeEach(() => {
  armazenamento.clear();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => armazenamento.get(k) ?? null,
    setItem: (k: string, v: string) => void armazenamento.set(k, v),
    removeItem: (k: string) => void armazenamento.delete(k),
  });
});
afterEach(() => { m.g = null; vi.unstubAllGlobals(); });

function digitar(raiz: ReactNode, v: string) {
  const ta = elementos(raiz).find((n) => n.type === CampoTexto)!;
  (ta.props.onChange as (e: unknown) => void)({ target: { value: v } });
}
const esvaziar = () => new Promise((r) => setTimeout(r, 0));

describe("Compositor", () => {
  // C6 da revisão do #233: lista simples de botões (sem role=listbox/option, que exigiria foco e setas).
  it("respostas rapidas aparecem como lista de botoes e o clique aplica as variaveis", () => {
    m.g = criarGanchos();
    const p = props({ respostas: [{ id: "r1", atalho: "/preco", titulo: "Preço", corpo: "Olá {nome}" }], variaveisResposta: { nome: "Ana" } });
    const tela = () => m.g!.renderizar(Compositor, p);
    digitar(tela(), "/pre");
    const marc = renderToStaticMarkup(createElement("div", null, tela() as ReactNode));
    expect(marc).not.toMatch(/role="(listbox|option)"/);
    expect(marc).toMatch(/<ul aria-label="Respostas rápidas"[^>]*><li><button type="button"[^>]*><strong>\/preco<\/strong>/);
    clicarBotao(tela(), "/preco Preço");
    const ta = elementos(tela()).find((n) => n.type === CampoTexto)!;
    expect(ta.props.value).toBe("Olá Ana");
  });

  it("modo nota mostra o aviso e nunca chama aoEnviarTexto", async () => {
    m.g = criarGanchos();
    const p = props({ modo: "nota" });
    const tela = () => m.g!.renderizar(Compositor, p);
    expect(renderToStaticMarkup(createElement("div", null, tela() as ReactNode))).toContain(AVISO_NOTA);
    digitar(tela(), "combinar com a coordenação");
    clicarBotao(tela(), "Enviar");
    await esvaziar();
    expect(p.aoNota).toHaveBeenCalledWith("combinar com a coordenação", expect.any(String));
    expect(p.aoEnviarTexto).not.toHaveBeenCalled();
    expect(p.aoEnviarMidia).not.toHaveBeenCalled();
  });

  it("modo responder envia pelo aoEnviarTexto, limpa o campo e o rascunho", async () => {
    m.g = criarGanchos();
    const p = props();
    const tela = () => m.g!.renderizar(Compositor, p);
    digitar(tela(), "  Olá  ");
    expect(armazenamento.get("conversa-rascunho:at1:responder")).toBe("  Olá  ");
    clicarBotao(tela(), "Enviar");
    await esvaziar();
    expect(p.aoEnviarTexto).toHaveBeenCalledWith("Olá");
    expect(p.aoNota).not.toHaveBeenCalled();
    expect(armazenamento.has("conversa-rascunho:at1:responder")).toBe(false);
  });

  it("falha no envio mantém o texto e mostra o erro", async () => {
    m.g = criarGanchos();
    const p = props({ aoEnviarTexto: vi.fn(async () => ({ ok: false as const, erro: "Janela de 24h fechada." })) });
    const tela = () => m.g!.renderizar(Compositor, p);
    digitar(tela(), "Oi");
    clicarBotao(tela(), "Enviar");
    await esvaziar();
    expect(renderToStaticMarkup(createElement("div", null, tela() as ReactNode))).toContain("Janela de 24h fechada.");
    expect(armazenamento.get("conversa-rascunho:at1:responder")).toBe("Oi");
  });

  it.each(["ok", "falha", "rejeicao"])('resultado antigo %s não limpa texto/arquivo nem publica erro no novo atendimento', async (fim) => {
    m.g = criarGanchos();
    let resolver!: (r: {ok:true}|{ok:false;erro:string}) => void, rejeitar!: (e:Error) => void;
    const pendente = new Promise<{ok:true}|{ok:false;erro:string}>((resolve,reject)=>{resolver=resolve;rejeitar=reject;});
    let p=props({aoEnviarTexto:()=>pendente});
    const tela=()=>m.g!.renderizar(Compositor,p);
    digitar(tela(),'texto A');clicarBotao(tela(),'Enviar');
    p={...p,atendimentoId:'at2'};tela();digitar(tela(),'texto B');
    const arquivo={name:'B.pdf',size:200,type:'application/pdf'};
    const input=elementos(tela()).find(n=>n.type==='input'&&n.props['aria-label']==='Escolher arquivo')!;
    (input.props.onChange as (e:unknown)=>void)({target:{files:[arquivo],value:'B.pdf'}});
    if(fim==='rejeicao')rejeitar(new Error('falha antiga'));else resolver(fim==='ok'?{ok:true}:{ok:false,erro:'falha antiga'});
    await esvaziar();
    const t=tela();expect(elementos(t).find(n=>n.type===CampoTexto)!.props.value).toBe('texto B');
    expect(armazenamento.get('conversa-rascunho:at2:responder')).toBe('texto B');
    const h=renderToStaticMarkup(createElement('div',null,t));expect(h).toContain('B.pdf');expect(h).not.toContain('falha antiga');
  });
  it('trocar para nota durante envio libera a nova aba e a conclusão antiga não apaga seu rascunho',async()=>{
    m.g=criarGanchos();let resolver!:(r:{ok:true})=>void;
    const pendente=new Promise<{ok:true}>(r=>{resolver=r;});let p=props({aoEnviarTexto:()=>pendente});const tela=()=>m.g!.renderizar(Compositor,p);
    digitar(tela(),'resposta A');clicarBotao(tela(),'Enviar');
    p={...p,modo:'nota'};tela();digitar(tela(),'nota independente');
    expect(elementos(tela()).find(n=>n.type===CampoTexto)!.props.disabled).toBe(false);
    resolver({ok:true});await esvaziar();expect(elementos(tela()).find(n=>n.type===CampoTexto)!.props.value).toBe('nota independente');
    expect(armazenamento.get('conversa-rascunho:at1:nota')).toBe('nota independente');
  });
  it('participante com leitura e sem envio pode escrever nota sem chamar transporte',async()=>{
    m.g=criarGanchos();const p=props({modo:'nota',podeEnviar:false});const tela=()=>m.g!.renderizar(Compositor,p);
    expect(elementos(tela()).some(n=>n.type===CampoTexto)).toBe(true);
    digitar(tela(),'nota da equipe');clicarBotao(tela(),'Enviar');await esvaziar();
    expect(p.aoNota).toHaveBeenCalled();expect(p.aoEnviarTexto).not.toHaveBeenCalled();expect(p.aoEnviarMidia).not.toHaveBeenCalled();
  });

  it('nota reutiliza chave após falha, separa texto/contexto e renova somente no sucesso',async()=>{
    m.g=criarGanchos();const chamadas:{texto:string;chave?:string}[]=[];let ok=false;
    const aoNota=async(texto:string,chave?:string)=>{chamadas.push({texto,chave});return ok?{ok:true as const}:{ok:false as const,erro:'falha controlada'};};
    let p=props({modo:'nota',aoNota});const tela=()=>m.g!.renderizar(Compositor,p);
    digitar(tela(),'nota A');clicarBotao(tela(),'Enviar');await esvaziar();clicarBotao(tela(),'Enviar');await esvaziar();
    expect(chamadas[0].chave).toEqual(expect.any(String));expect(chamadas[1].chave).toBe(chamadas[0].chave);
    digitar(tela(),'nota alterada');clicarBotao(tela(),'Enviar');await esvaziar();expect(chamadas[2].chave).not.toBe(chamadas[0].chave);
    p={...p,atendimentoId:'at2'};tela();digitar(tela(),'nota A');clicarBotao(tela(),'Enviar');await esvaziar();expect(chamadas[3].chave).not.toBe(chamadas[0].chave);
    p={...p,atendimentoId:'at1'};tela();digitar(tela(),'nota A');ok=true;clicarBotao(tela(),'Enviar');await esvaziar();expect(chamadas[4].chave).toBe(chamadas[0].chave);
    digitar(tela(),'nota A');clicarBotao(tela(),'Enviar');await esvaziar();expect(chamadas[5].chave).not.toBe(chamadas[0].chave);
  });

  it('A→B→A não aceita resultado do primeiro A como resultado do rascunho atual',async()=>{
    m.g=criarGanchos();let resolver!:(r:{ok:true})=>void;const pendente=new Promise<{ok:true}>(r=>{resolver=r;});let p=props({aoEnviarTexto:()=>pendente});const tela=()=>m.g!.renderizar(Compositor,p);
    digitar(tela(),'primeiro A');clicarBotao(tela(),'Enviar');p={...p,atendimentoId:'at2'};tela();tela();p={...p,atendimentoId:'at1'};tela();digitar(tela(),'novo rascunho A');
    resolver({ok:true});await esvaziar();expect(elementos(tela()).find(n=>n.type===CampoTexto)!.props.value).toBe('novo rascunho A');expect(armazenamento.get('conversa-rascunho:at1:responder')).toBe('novo rascunho A');
  });
  it('dois cliques no mesmo handler antes do render iniciam só uma tentativa',async()=>{
    m.g=criarGanchos();let chamadas=0,resolver!:(r:{ok:true})=>void;const pendente=new Promise<{ok:true}>(r=>{resolver=r;});const p=props({modo:'nota',aoNota:()=>{chamadas++;return pendente;}}),tela=()=>m.g!.renderizar(Compositor,p);
    digitar(tela(),'nota');const t=tela();clicarBotao(t,'Enviar');clicarBotao(t,'Enviar');expect(chamadas).toBe(1);resolver({ok:true});await esvaziar();
  });
  it('agendar só aparece com callback real e fora da nota',()=>{
    m.g=criarGanchos();let abertos=0;let p=props({aoAgendar:()=>{abertos++;}});const tela=()=>m.g!.renderizar(Compositor,p);
    const b=elementos(tela()).find(n=>n.props['aria-label']==='Agendar mensagem')!;expect(b).toBeDefined();(b.props.onClick as ()=>void)();expect(abertos).toBe(1);
    p={...p,modo:'nota'};tela();expect(elementos(tela()).some(n=>n.props['aria-label']==='Agendar mensagem')).toBe(false);
    p={...p,modo:'responder',aoAgendar:undefined};tela();expect(elementos(tela()).some(n=>n.props['aria-label']==='Agendar mensagem')).toBe(false);
  });

  it('upload antigo não despacha mídia nem modifica arquivo/texto de outra conversa',async()=>{
    let resolver!:(r:{ok:boolean;json():Promise<{url:string}>})=>void;const pendente=new Promise<{ok:boolean;json():Promise<{url:string}>}>(r=>{resolver=r;});
    vi.stubGlobal('fetch',()=>pendente);vi.stubGlobal('FormData',class{append(){}});m.g=criarGanchos();
    let p=props();const tela=()=>m.g!.renderizar(Compositor,p);
    const escolher=(name:string)=>{const el=elementos(tela()).find(n=>n.type==='input'&&n.props['aria-label']==='Escolher arquivo')!;(el.props.onChange as (e:unknown)=>void)({target:{files:[{name,size:100,type:'application/pdf'}],value:name}});};
    escolher('A.pdf');digitar(tela(),'legenda A');clicarBotao(tela(),'Enviar');p={...p,atendimentoId:'at2'};tela();escolher('B.pdf');digitar(tela(),'legenda B');
    resolver({ok:true,json:async()=>({url:'/api/files/whatsapp-out/antigo.pdf'})});await esvaziar();
    expect(p.aoEnviarMidia).not.toHaveBeenCalled();expect(elementos(tela()).find(n=>n.type===CampoTexto)!.props.value).toBe('legenda B');expect(renderToStaticMarkup(createElement('div',null,tela()))).toContain('B.pdf');
  });
  it.each([null,false])('nota mantém leitura individual independente do estado de envio %s ou falha de envio',podeEnviar=>{
    const h=html({modo:'nota',podeEnviar,falhaPermissao:()=>{}});expect(h).toContain('Escreva uma nota interna');expect(h).not.toContain(FALHA_PERMISSAO_ENVIO);expect(h).not.toContain(MOTIVO_SEM_ENVIO);
  });

  it('falha de transporte de nota mantém tentativa e orienta retentar sem presumir erro de negócio',async()=>{
    m.g=criarGanchos();const chaves:(string|undefined)[]=[];const p=props({modo:'nota',aoNota:async(_texto,chave)=>{chaves.push(chave);throw new Error('rede interrompida');}}),tela=()=>m.g!.renderizar(Compositor,p);
    digitar(tela(),'nota incerta');clicarBotao(tela(),'Enviar');await esvaziar();
    expect(renderToStaticMarkup(createElement('div',null,tela()))).toContain(MSG_RESULTADO_INCERTO);
    expect(elementos(tela()).find(n=>n.type===CampoTexto)!.props.value).toBe('nota incerta');clicarBotao(tela(),'Enviar');await esvaziar();expect(chaves[1]).toBe(chaves[0]);
  });

  it.each(['ok','incerto'])('resultado tardio %s renova só a tentativa confirmada de A sem escrever estado de B',async(fim)=>{
    let sequencia=0;const tentativas=criarChavesPorAlvo(()=>String(++sequencia));m.g=criarGanchos();
    let resolver!:(r:{ok:true})=>void,rejeitar!:(e:Error)=>void;const pendente=new Promise<{ok:true}>((r,j)=>{resolver=r;rejeitar=j;});
    let p=props({modo:'nota',tentativasNota:tentativas,aoNota:()=>pendente});const tela=()=>m.g!.renderizar(Compositor,p);
    tela();expect(sequencia).toBe(0);digitar(tela(),'nota A');clicarBotao(tela(),'Enviar');
    const alvo=JSON.stringify(['at1','nota A']),original=tentativas.para(alvo).atual;
    p={...p,atendimentoId:'at2'};tela();digitar(tela(),'nota B');if(fim==='ok')resolver({ok:true});else rejeitar(new Error('sem resposta'));
    await esvaziar();expect(elementos(tela()).find(n=>n.type===CampoTexto)!.props.value).toBe('nota B');expect(renderToStaticMarkup(createElement('div',null,tela()))).not.toContain(MSG_RESULTADO_INCERTO);
    if(fim==='ok')expect(tentativas.para(alvo).atual).not.toBe(original);else expect(tentativas.para(alvo).atual).toBe(original);
    p={...p,atendimentoId:'at1'};tela();expect(elementos(tela()).find(n=>n.type===CampoTexto)!.props.value).toBe(fim==='ok'?'':'nota A');
  });

  it.each(['responder','nota'] as const)('C3 sucesso confirmado fora do contexto limpa somente o armazenamento enviado em%s', async modo => {
    m.g=criarGanchos();let resolver!:(r:{ok:true})=>void;const pendente=new Promise<{ok:true}>(r=>{resolver=r;});
    let p=props({modo,aoEnviarTexto:()=>pendente,aoNota:()=>pendente});const tela=()=>m.g!.renderizar(Compositor,p);
    digitar(tela(),'  texto A enviado  ');clicarBotao(tela(),'Enviar');p={...p,atendimentoId:'at2'};tela();digitar(tela(),'rascunho B');
    resolver({ok:true});await esvaziar();
    expect(armazenamento.has('conversa-rascunho:at1:'+modo)).toBe(false);
    expect(armazenamento.get('conversa-rascunho:at2:'+modo)).toBe('rascunho B');
    expect(elementos(tela()).find(n=>n.type===CampoTexto)!.props.value).toBe('rascunho B');
    p={...p,atendimentoId:'at1'};tela();expect(elementos(tela()).find(n=>n.type===CampoTexto)!.props.value).toBe('');
  });

  it.each(['ok','falha'])('resultado %s da tentativa anterior não apaga edição deliberada e novo anexo na mesma conversa',async(fim)=>{
    m.g=criarGanchos();let resolver!:(r:{ok:true}|{ok:false;erro:string})=>void;const pendente=new Promise<{ok:true}|{ok:false;erro:string}>(r=>{resolver=r;});
    const p=props({aoEnviarTexto:()=>pendente,respostas:[{id:'r',atalho:'/preco',titulo:'Preço',corpo:'Novo rascunho preparado'}]}),tela=()=>m.g!.renderizar(Compositor,p);
    digitar(tela(),'/pre');clicarBotao(tela(),'Enviar');
    // A sugestão e o seletor de arquivo continuam acionáveis enquanto o envio aguarda.
    clicarBotao(tela(),'/preco Preço');
    const seletor=elementos(tela()).find(n=>n.type==='input'&&n.props['aria-label']==='Escolher arquivo')!;
    (seletor.props.onChange as (e:unknown)=>void)({target:{files:[{name:'nova-intencao.pdf',size:100,type:'application/pdf'}],value:'novo'}});
    resolver(fim==='ok'?{ok:true}:{ok:false,erro:'erro da tentativa antiga'});await esvaziar();
    expect(elementos(tela()).find(n=>n.type===CampoTexto)!.props.value).toBe('Novo rascunho preparado');
    expect(armazenamento.get('conversa-rascunho:at1:responder')).toBe('Novo rascunho preparado');
    const h=renderToStaticMarkup(createElement('div',null,tela()));expect(h).toContain('nova-intencao.pdf');expect(h).not.toContain('erro da tentativa antiga');
  });

  it.each(['ok','falha'])('upload antigo %s não substitui novo anexo escolhido na mesma conversa', async (fim) => {
    m.g = criarGanchos();
    let resolver!: (r: {ok:boolean; json(): Promise<{url?:string;erro?:string}>}) => void;
    vi.stubGlobal('fetch', () => new Promise(r => { resolver = r; }));
    vi.stubGlobal('FormData', class { append() {} });
    const p = props(), tela = () => m.g!.renderizar(Compositor, p);
    const escolher = (name:string) => {
      const input = elementos(tela()).find(n => n.type === 'input' && n.props['aria-label'] === 'Escolher arquivo')!;
      (input.props.onChange as (e:unknown)=>void)({target:{files:[{name,size:100,type:'application/pdf'}],value:name}});
    };
    escolher('original.pdf'); digitar(tela(), 'legenda original'); clicarBotao(tela(), 'Enviar');
    escolher('novo.pdf');
    resolver({ok:fim==='ok',json:async()=>fim==='ok'?{url:'/arquivo-original.pdf'}:{erro:'upload antigo falhou'}});
    await esvaziar();
    expect(p.aoEnviarMidia).not.toHaveBeenCalled();
    const h = renderToStaticMarkup(createElement('div', null, tela()));
    expect(h).toContain('novo.pdf'); expect(h).not.toContain('upload antigo falhou');
    expect(elementos(tela()).find(n=>n.type===CampoTexto)!.props.disabled).toBe(false);
  });

  it.each(['ok','incerto'])('edição por emoji preserva nota e chave da tentativa %s original', async (fim) => {
    m.g = criarGanchos();
    let sequencia = 0;
    const tentativas = criarChavesPorAlvo(() => String(++sequencia));
    let resolver!: (r:{ok:true})=>void, rejeitar!: (e:Error)=>void;
    const pendente = new Promise<{ok:true}>((r,j)=>{resolver=r;rejeitar=j;});
    const p = props({modo:'nota',tentativasNota:tentativas,aoNota:()=>pendente});
    const tela = () => m.g!.renderizar(Compositor,p);
    digitar(tela(),'nota original');
    (elementos(tela()).find(n=>n.props['aria-label']==='Emojis')!.props.onClick as ()=>void)();
    clicarBotao(tela(),'Enviar');
    const original = tentativas.para(JSON.stringify(['at1','nota original'])).atual;
    const seletor = elementos(tela()).find(n=>typeof n.props.aoEmoji==='function')!;
    (seletor.props.aoEmoji as (v:string)=>void)('😀');
    if(fim==='ok') resolver({ok:true}); else rejeitar(new Error('sem resposta'));
    await esvaziar();
    expect(elementos(tela()).find(n=>n.type===CampoTexto)!.props.value).toBe('nota original😀');
    expect(armazenamento.get('conversa-rascunho:at1:nota')).toBe('nota original😀');
    expect(renderToStaticMarkup(createElement('div',null,tela()))).not.toContain(MSG_RESULTADO_INCERTO);
    const atual = tentativas.para(JSON.stringify(['at1','nota original'])).atual;
    if(fim==='ok') expect(atual).not.toBe(original); else expect(atual).toBe(original);
  });

  it("sem podeEnviar: compositor bloqueado com motivo", () => {
    const h = html({ podeEnviar: false });
    expect(h).toContain(MOTIVO_SEM_ENVIO);
    expect(h).toContain("Você não pode enviar nesta conversa");
    expect(h).not.toContain("<textarea");
  });

  it("rascunho do atendimento reaparece na primeira pintura", () => {
    armazenamento.set("conversa-rascunho:at1:responder", "meio da frase");
    expect(html()).toContain("meio da frase");
    expect(html({ atendimentoId: "at2" })).not.toContain("meio da frase");
  });

  it("trocar de atendimento ou de modo carrega o rascunho certo e limpa o erro da conversa anterior", async () => {
    armazenamento.set("conversa-rascunho:at2:responder", "rascunho do at2");
    armazenamento.set("conversa-rascunho:at2:nota", "nota do at2");
    m.g = criarGanchos();
    let p = props({ aoEnviarTexto: vi.fn(async () => ({ ok: false as const, erro: "Janela de 24h fechada." })) });
    const tela = () => m.g!.renderizar(Compositor, p);
    const texto = () => elementos(tela()).find((n) => n.type === CampoTexto)!.props.value;
    digitar(tela(), "Oi");
    clicarBotao(tela(), "Enviar");
    await esvaziar();
    expect(renderToStaticMarkup(createElement("div", null, tela() as ReactNode))).toContain("Janela de 24h fechada.");

    p = { ...p, atendimentoId: "at2" };
    tela(); // render da troca: ajusta o estado (o React refaria o render na hora)
    expect(texto()).toBe("rascunho do at2");
    expect(renderToStaticMarkup(createElement("div", null, tela() as ReactNode))).not.toContain("Janela de 24h fechada.");

    p = { ...p, modo: "nota" };
    tela();
    expect(texto()).toBe("nota do at2");

    p = { ...p, atendimentoId: "at1", modo: "responder" };
    tela();
    expect(texto()).toBe("Oi");
  });

  it("contato, enquete e localização ficam visíveis e desabilitados com o aviso do motor", () => {
    m.g = criarGanchos();
    const p = props();
    const tela = () => m.g!.renderizar(Compositor, p);
    (elementos(tela()).find((n) => n.props["aria-label"] === "Anexar")!.props.onClick as () => void)();
    const h = renderToStaticMarkup(createElement("div", null, tela() as ReactNode));
    expect(h).toContain(AVISO_RECURSO_MOTOR);
    for (const r of ["Contato", "Enquete", "Localização"]) expect(h).toMatch(new RegExp(`<button[^>]* disabled=""[^>]*>${r}</button>`));
  });

  it("com capacidade do motor, os três anexos seguem desabilitados com motivo do Inbox", () => {
    m.g = criarGanchos();
    const p = props({ capacidades: ["cartaoContato", "enquete", "localizacao"] });
    const tela = () => m.g!.renderizar(Compositor, p);
    (elementos(tela()).find((n) => n.props["aria-label"] === "Anexar")!.props.onClick as () => void)();
    const h = renderToStaticMarkup(createElement("div", null, tela() as ReactNode));
    expect(h).toContain("O envio deste tipo pelo Inbox ainda não está disponível.");
    expect(h).toContain(AVISO_ANEXO_EM_BREVE);
    expect(h).not.toContain(AVISO_RECURSO_MOTOR);
    for (const r of ["Contato", "Enquete", "Localização"]) expect(h).toMatch(new RegExp(`<button[^>]* disabled=""[^>]*>${r}</button>`));
  });

  it("capacidades parciais mostram o motivo correspondente em cada anexo, sempre desabilitado", () => {
    m.g = criarGanchos();
    const p = props({ capacidades: ["enquete"] });
    const tela = () => m.g!.renderizar(Compositor, p);
    (elementos(tela()).find((n) => n.props["aria-label"] === "Anexar")!.props.onClick as () => void)();
    const h = renderToStaticMarkup(createElement("div", null, tela() as ReactNode));
    for (const [rotulo, aviso] of [
      ["Contato", AVISO_RECURSO_MOTOR],
      ["Enquete", "O envio deste tipo pelo Inbox ainda não está disponível."],
      ["Localização", AVISO_RECURSO_MOTOR],
    ]) {
      expect(h).toMatch(new RegExp(`<button[^>]* disabled=""[^>]*>${rotulo}</button>`));
      expect(h.match(new RegExp(`>${rotulo}</button><small[^>]*>([^<]+)</small>`))?.[1]).toBe(aviso);
    }
  });

  it("nenhum item habilitado do menu Anexar fica sem ação", () => {
    for (const capacidades of [[], ["cartaoContato", "enquete", "localizacao"]] as RecursoMotor[][]) {
      m.g = criarGanchos();
      const p = props({ capacidades });
      const tela = () => m.g!.renderizar(Compositor, p);
      (elementos(tela()).find((n) => n.props["aria-label"] === "Anexar")!.props.onClick as () => void)();
      const itens = elementos(tela()).filter((n) => n.props.role === "menuitem" && !n.props.disabled);
      expect(itens.length).toBeGreaterThan(0);
      for (const i of itens) expect(typeof i.props.onClick, String(i.props.children)).toBe("function");
    }
  });

  it("modo Nota não oferece Anexar nem avisos de anexos, mesmo com capacidades do motor", () => {
    const h = html({ modo: "nota", capacidades: ["cartaoContato", "enquete", "localizacao"] });
    expect(h).toContain(AVISO_NOTA);
    expect(h).not.toContain('aria-label="Anexar"');
    expect(h).not.toContain('role="menuitem"');
    expect(h).not.toContain("O envio deste tipo pelo Inbox ainda não está disponível.");
  });

  // C2 da R1 do #217: anexar arquivo e gravar áudio (os do Inbox antigo) ficam no compositor novo.
  it("anexar: o arquivo escolhido sobe em /api/whatsapp/upload do atendimento e sai pelo aoEnviarMidia com a legenda", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ url: "/api/files/whatsapp-out/u1/doc.pdf" }) }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("FormData", class { campos: [string, unknown][] = []; append(k: string, v: unknown) { this.campos.push([k, v]); } });
    m.g = criarGanchos();
    const p = props();
    const tela = () => m.g!.renderizar(Compositor, p);
    const arquivo = { name: "contrato.pdf", size: 2048, type: "application/pdf" };
    const seletor = elementos(tela()).find((n) => n.type === "input" && n.props["aria-label"] === "Escolher arquivo")!;
    (seletor.props.onChange as (e: unknown) => void)({ target: { files: [arquivo], value: "x" } });
    expect(renderToStaticMarkup(createElement("div", null, tela() as ReactNode))).toContain("contrato.pdf");
    digitar(tela(), "segue o contrato");
    clicarBotao(tela(), "Enviar");
    await esvaziar();
    expect(fetchMock).toHaveBeenCalledWith("/api/whatsapp/upload", expect.objectContaining({ method: "POST" }));
    const corpo = (fetchMock.mock.calls[0] as unknown as [string, { body: { campos: [string, unknown][] } }])[1].body.campos;
    expect(corpo).toEqual([["file", arquivo], ["atendimentoId", "at1"]]);
    expect(p.aoEnviarMidia).toHaveBeenCalledWith("/api/files/whatsapp-out/u1/doc.pdf", "segue o contrato");
    expect(p.aoEnviarTexto).not.toHaveBeenCalled();
  });

  it("anexar: arquivo acima de 10MB não sobe e mostra o motivo", () => {
    m.g = criarGanchos();
    const p = props();
    const tela = () => m.g!.renderizar(Compositor, p);
    const seletor = elementos(tela()).find((n) => n.type === "input" && n.props["aria-label"] === "Escolher arquivo")!;
    (seletor.props.onChange as (e: unknown) => void)({ target: { files: [{ name: "grande.mp4", size: 11 * 1024 * 1024 }], value: "x" } });
    expect(renderToStaticMarkup(createElement("div", null, tela() as ReactNode))).toContain("Arquivo vazio ou acima de 10MB.");
  });

  it("gravar áudio: a gravação vira o anexo mensagem-de-voz e sai pelo aoEnviarMidia", async () => {
    const fluxo = { getTracks: () => [{ stop: vi.fn() }] };
    let gravador: { start(): void; stop(): void; ondataavailable?: (e: unknown) => void; onstop?: () => void; mimeType: string; state: string } | null = null;
    class GravadorFalso {
      static isTypeSupported = (t: string) => t === "audio/ogg;codecs=opus";
      mimeType: string; state = "inactive"; ondataavailable?: (e: unknown) => void; onstop?: () => void;
      constructor(_f: unknown, o: { mimeType: string }) { this.mimeType = o.mimeType; gravador = this as never; }
      start() { this.state = "recording"; }
      stop() { this.state = "inactive"; this.ondataavailable?.({ data: { size: 10 } }); this.onstop?.(); }
    }
    vi.stubGlobal("MediaRecorder", GravadorFalso);
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: vi.fn(async () => fluxo) } });
    vi.stubGlobal("Blob", class { constructor(public partes: unknown[], public o: unknown) {} });
    vi.stubGlobal("File", class { size = 10; constructor(_p: unknown[], public name: string, public o: { type: string }) {} });
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ url: "/api/files/whatsapp-out/u1/voz.ogg" }) })));
    vi.stubGlobal("FormData", class { append() {} });
    m.g = criarGanchos();
    const p = props();
    const tela = () => m.g!.renderizar(Compositor, p);
    await (elementos(tela()).find((n) => n.props["aria-label"] === "Gravar mensagem de voz")!.props.onClick as () => Promise<void>)();
    expect(gravador!.state).toBe("recording");
    (elementos(tela()).find((n) => n.props["aria-label"] === "Parar e revisar áudio")!.props.onClick as () => void)();
    expect(renderToStaticMarkup(createElement("div", null, tela() as ReactNode))).toContain("mensagem-de-voz.ogg");
    clicarBotao(tela(), "Enviar");
    await esvaziar();
    expect(p.aoEnviarMidia).toHaveBeenCalledWith("/api/files/whatsapp-out/u1/voz.ogg", "");
  });
});

describe("Compositor: permissão de envio carregando, falhou ou negada (C2 da revisão do #218)", () => {
  const semCampo = (h: string) => expect(h).not.toContain("Escreva uma mensagem");
  it("carregando (podeEnviar null): mostra Carregando…, não o motivo, e não envia", () => {
    const h = html({ podeEnviar: null });
    expect(h).toContain(CARREGANDO_ENVIO);
    expect(h).toMatch(/role="status"/);
    expect(h).not.toContain(MOTIVO_SEM_ENVIO);
    semCampo(h);
  });
  it("falhou: mensagem de erro em role=alert com Tentar de novo, sem o motivo e sem enviar", () => {
    const h = html({ podeEnviar: null, falhaPermissao: () => {} });
    expect(h).toMatch(new RegExp(`role="alert"[^>]*>[\\s\\S]*${FALHA_PERMISSAO_ENVIO}`));
    expect(h).toContain("Tentar de novo");
    expect(h).not.toContain(MOTIVO_SEM_ENVIO);
    expect(h).not.toContain(CARREGANDO_ENVIO);
    semCampo(h);
  });
  it("falhou: Tentar de novo chama falhaPermissao (o <Botao> do design system)", () => {
    m.g = criarGanchos();
    const tentar = vi.fn();
    clicarBotao(m.g.renderizar(Compositor, props({ podeEnviar: null, falhaPermissao: tentar })), "Tentar de novo");
    expect(tentar).toHaveBeenCalledTimes(1);
  });
  it("só false mostra o motivo de falta de permissão", () => {
    const h = html({ podeEnviar: false });
    expect(h).toContain(MOTIVO_SEM_ENVIO);
    expect(h).not.toContain(CARREGANDO_ENVIO);
    semCampo(h);
    expect(html({ podeEnviar: true })).toContain("Escreva uma mensagem");
  });
});

describe("SeletorEmoji", () => {
  it("abas GIF e Figurinha desabilitadas com o aviso", () => {
    const h = htmlSeletor();
    expect(h).toContain(AVISO_RECURSO_MOTOR);
    expect(h).toMatch(/<button[^>]* disabled=""[^>]*>GIFs<\/button>/);
    expect(h).toMatch(/<button[^>]* disabled=""[^>]*>Figurinhas<\/button>/);
    expect(h).toMatch(/<button[^>]*role="tab"[^>]*aria-selected="true"[^>]*>Emojis<\/button>/);
  });
  it("lista o grupo inicial", () => { expect(htmlSeletor()).toContain("😀"); });
  it("busca sem acento e sem variantes de tom de pele", () => {
    const dados: EntradaEmoji[] = [
      { emoji: "😀", label: "rosto risonho", keywords: "feliz | riso", group: "Smileys & Emotion" },
      { emoji: "👋🏽", label: "mão acenando", keywords: "oi", group: "People & Body" },
      { emoji: "👋", label: "mão acenando", keywords: "oi", group: "People & Body" },
    ];
    expect(buscarEmoji(dados, "RISÔNHO", "Flags").map((e) => e.emoji)).toEqual(["😀"]);
    expect(buscarEmoji(dados, "", "People & Body").map((e) => e.emoji)).toEqual(["👋"]);
    expect(buscarEmoji(dados, "", "Flags")).toEqual([]);
  });
});

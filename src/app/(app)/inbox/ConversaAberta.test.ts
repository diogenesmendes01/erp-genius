import { createElement, isValidElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

const virtual350=vi.hoisted(()=>({props:null as null|import("@/components/conversa/VirtualList").VirtualListProps<unknown>}));
vi.mock("@/components/conversa/VirtualList",async original=>{const real=await original<typeof import("@/components/conversa/VirtualList")>();return {...real,VirtualList:(p:import("@/components/conversa/VirtualList").VirtualListProps<unknown>)=>{virtual350.props=p;return real.VirtualList(p);}};});
const permissao = vi.hoisted(() => ({ enviar: true, chamadas: [] as unknown[][] }));
vi.mock("@/server/inbox/permissoes", async (orig) => {
  const real = await orig<typeof import("@/server/inbox/permissoes")>();
  return { ...real, podeExecutar: (...args: Parameters<typeof real.podeExecutar>) => {
    permissao.chamadas.push(args);
    return args[1] === "enviar" ? permissao.enviar : real.podeExecutar(...args);
  } };
});
vi.mock("@/server/aria/acoes",()=>({aprovarAcaoAria:vi.fn(),rejeitarAcaoAria:vi.fn()}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/server/whatsapp/acoes", () => ({ enviarMidiaInbox: vi.fn(), enviarTextoInbox: vi.fn() }));
vi.mock("@/server/whatsapp/acoes-atendimento", () => ({ assumirAtendimento: vi.fn(), assumirConversaDaAria: vi.fn(), atribuirAtendimento: vi.fn(), convidarParticipante: vi.fn(), devolverParaFila: vi.fn(), revogarParticipante: vi.fn(), transferirAtendimento: vi.fn() }));
vi.mock("@/server/whatsapp/acoes-conversa", () => ({ agendarMensagemNoAtendimentoLocal: vi.fn(), agendarMensagemNoAtendimento: vi.fn(), cancelarAgendamentoDoAtendimento: vi.fn(), registrarNotaAtendimento: vi.fn() }));
vi.mock("@/server/whatsapp/consultas-acoes-atendimento", () => ({ listarConvitesEAgendamentos: vi.fn(() => new Promise(() => {})), listarPessoasParaAtendimento: vi.fn(), origemVisivelDaTransferencia: vi.fn() }));
vi.mock("@/server/whatsapp/operacoes-atendimento", () => ({ encerrarAtendimentoWhatsApp: vi.fn() }));
vi.mock("@/server/whatsapp/preferencias", () => ({ alternarFixada: vi.fn(), silenciarConversa: vi.fn() }));

import { BalaoMensagem } from "@/components/conversa/BalaoMensagem";
import type { MensagemThread, NotaInternaThread } from "@/server/whatsapp/consultas-inbox";
import type { ItemListaInbox } from "@/server/inbox/consultas-pagina";
import { CARREGANDO_ENVIO, FALHA_PERMISSAO_ENVIO, MOTIVO_SEM_ENVIO } from "@/components/conversa/Compositor";
import type { ConversaHook } from "@/components/conversa/useConversa";
import { COMANDOS_MENSAGEM_LIGADOS, ConversaAberta, comandosDaMensagem, podeEnviarNaConversa, type PropsConversaAberta } from "./ConversaAberta";

const usuario = { id: "u1", papeis: [Papel.VENDEDOR] };
const item = (o: Partial<ItemListaInbox> = {}): ItemListaInbox => ({ estadoAria: null, atendidoPorVoce: false, previaAutor: null, previaRotulo: null,
  id: "a1", numeroId: "n1", numeroRotulo: "Comercial", finalidade: "COMERCIAL", driver: "MOTOR", contatoId: "c1", contatoNome: "Ana",
  contatoTelefone: "+5511999990000", optOut: false, vinculo: null, naoLidas: 0, ultimaMensagemEm: null, preview: null, linhaComercial: false,
  status: "EM_ATENDIMENTO", responsavelNome: null, prazoRespostaEm: null, fixada: false, silenciada: false, grupo: false,
  responsavelId: "u1", numeroDonoId: null, setoresDoNumero: ["COMERCIAL"], atendimentoOrigemId: null, capacidades: [], ...o,
});
const conversaVazia = { mensagens: [], notas: [], temMaisAntes: false, temMaisDepois: false, carregandoAntigas: false, erro: null, maisAntigas: async () => {} } as unknown as ConversaHook;
const propsConversa = (o: Partial<PropsConversaAberta> & { podeEnviar: boolean | null }): PropsConversaAberta => ({
  item: item(), usuario, fuso: null, conversa: conversaVazia, aoVoltar: () => {}, aoAlternarPainel: () => {}, aoMudar: () => {}, ...o,
});
const msg: MensagemThread = {
  id: "m1", direcao: "SAIDA", tipo: "TEXTO", corpo: "Olá", midiaPath: null, status: "ENVIADA", origem: "HUMANO",
  autorNome: null, templateNome: null, criadoEm: "2026-10-17T15:30:00.000Z", participanteNome: null, favorita: false, clientMessageId: null,
};

describe("ConversaAberta: notas internas na thread", () => {
  it("não renderiza nota posterior à janela quando ainda há mensagens mais novas para carregar", () => {
    const n: NotaInternaThread = { id: "fora", nota: "Fora da janela carregada", autorNome: "Ana", criadoEm: "2026-10-17T16:00:00.000Z", origem: "atendimento" };
    const conversa = { ...conversaVazia, mensagens: [msg], notas: [n], temMaisDepois: true } as ConversaHook;
    const h = renderToStaticMarkup(createElement(ConversaAberta, propsConversa({ podeEnviar: true, conversa })));
    expect(h).toContain("Olá");
    expect(h).not.toContain(n.nota);
  });
  it("mostra nota com as mensagens na ordem temporal e sem comandos externos", () => {
    const n: NotaInternaThread = { id: "e1", nota: "Combinar desconto", autorNome: "Ana", criadoEm: "2026-10-17T16:00:00.000Z", origem: "atendimento" };
    const conversa = { ...conversaVazia, mensagens: [msg], notas: [n] } as ConversaHook;
    const h = renderToStaticMarkup(createElement(ConversaAberta, propsConversa({ podeEnviar: true, conversa })));
    expect(h.indexOf("Olá")).toBeLessThan(h.indexOf("Combinar desconto"));
    expect(h).toContain("Nota interna · só equipe");
    expect(h).toContain("Combinar desconto");
    expect(h).toContain('role="note"');
    expect(h.match(/aria-label="Opções da mensagem"/g)).toHaveLength(1);
  });
});

describe("ConversaAberta: menu da mensagem só com comandos ligados (C3 da R1 do #217 · C4 da R1 do #219)", () => {
  const TODAS = ["editar", "apagar", "reagir", "encaminhar"] as const;
  const propria = { ...msg, propria: true };
  it("comandos ligados: copiar e os do motor que a 4D implementou (reagir, encaminhar, editar, apagar); responder e favoritar ficam fora", () => {
    expect([...COMANDOS_MENSAGEM_LIGADOS]).toEqual(["copiar", "reagir", "encaminhar", "editar", "apagar"]);
  });
  it("sem capacidade do número (sessão caída, não MOTOR): só copiar", () => {
    expect(comandosDaMensagem(propria, [], true)).toEqual(["copiar"]);
  });
  it("com as capacidades e o envio liberado: reagir, encaminhar, editar e apagar na própria mensagem de texto", () => {
    expect(comandosDaMensagem(propria, TODAS, true)).toEqual(["copiar", "reagir", "encaminhar", "editar", "apagar"]);
  });
  it("encaminhar exige a capacidade do número, o envio liberado e mensagem não apagada; vale para recebida e de outra pessoa", () => {
    expect(comandosDaMensagem(propria, ["encaminhar"], true)).toEqual(["copiar", "encaminhar"]);
    expect(comandosDaMensagem(propria, ["reagir", "editar", "apagar"], true)).not.toContain("encaminhar");
    expect(comandosDaMensagem(propria, ["encaminhar"], false)).toEqual(["copiar"]);
    expect(comandosDaMensagem({ ...propria, apagada: true }, ["encaminhar"], true)).toEqual(["copiar"]);
    expect(comandosDaMensagem({ ...msg, direcao: "ENTRADA" }, ["encaminhar"], true)).toEqual(["copiar", "encaminhar"]);
    expect(comandosDaMensagem({ ...msg, propria: false, tipo: "IMAGEM" }, ["encaminhar"], true)).toEqual(["copiar", "encaminhar"]);
  });
  it("cada comando do motor exige a própria capacidade", () => {
    expect(comandosDaMensagem(propria, ["reagir"], true)).toEqual(["copiar", "reagir"]);
    expect(comandosDaMensagem(propria, ["apagar"], true)).toEqual(["copiar", "apagar"]);
  });
  it("mensagem de outra pessoa ou recebida: reagir e encaminhar; mídia própria: apagar sem editar", () => {
    expect(comandosDaMensagem({ ...msg, propria: false }, TODAS, true)).toEqual(["copiar", "reagir", "encaminhar"]);
    expect(comandosDaMensagem({ ...msg, direcao: "ENTRADA" }, TODAS, true)).toEqual(["copiar", "reagir", "encaminhar"]);
    expect(comandosDaMensagem({ ...propria, tipo: "IMAGEM" }, TODAS, true)).toEqual(["copiar", "reagir", "encaminhar", "apagar"]);
  });
  it("sem o envio (escopo de envio do servidor ou encerrado) ou mensagem apagada: só copiar", () => {
    expect(comandosDaMensagem(propria, TODAS, false)).toEqual(["copiar"]);
    expect(comandosDaMensagem({ ...propria, apagada: true }, TODAS, true)).toEqual(["copiar"]);
  });
  it("BalaoMensagem com `comandos` esconde os itens sem ação", () => {
    const h = renderToStaticMarkup(createElement(BalaoMensagem, { m: msg, fuso: null, aoComando: () => {}, recursos: () => true, menuAberto: true, comandos: comandosDaMensagem(msg, [], true) }));
    expect(h).toContain("Copiar");
    for (const r of ["Responder", "Reagir", "Encaminhar", "Favoritar", "Editar", "Apagar"]) expect(h).not.toContain(`aria-label="${r}"`);
  });
  it("BalaoMensagem com os comandos do motor liberados mostra reagir, encaminhar, editar e apagar, mas não responder nem favoritar", () => {
    const h = renderToStaticMarkup(createElement(BalaoMensagem, { m: propria, fuso: null, aoComando: () => {}, recursos: () => true, menuAberto: true, comandos: comandosDaMensagem(propria, TODAS, true) }));
    for (const r of ["Copiar", "Reagir", "Encaminhar", "Editar", "Apagar"]) expect(h).toContain(`aria-label="${r}"`);
    for (const r of ["Responder", "Favoritar"]) expect(h).not.toContain(`aria-label="${r}"`);
  });
  it("no menu completo, Encaminhar depende do recurso do motor (sem ele, desabilitado com o aviso)", () => {
    const h = renderToStaticMarkup(createElement(BalaoMensagem, { m: msg, fuso: null, aoComando: () => {}, recursos: (r) => r !== "encaminhar", menuAberto: true }));
    expect(h).toMatch(/<button[^>]*aria-label="Encaminhar"[^>]*disabled=""/);
  });
  it("sem `comandos` o balão mantém o menu completo (outros usos)", () => {
    const h = renderToStaticMarkup(createElement(BalaoMensagem, { m: msg, fuso: null, aoComando: () => {}, recursos: () => true, menuAberto: true }));
    for (const r of ["Responder", "Copiar", "Reagir", "Encaminhar", "Favoritar", "Editar", "Apagar"]) expect(h).toContain(`aria-label="${r}"`);
  });
  it("a conversa passa ao balão os comandos da mensagem pelas capacidades e pelo envio, e abre as ações do motor (fonte)", () => {
    const fonte = readFileSync("src/app/(app)/inbox/ConversaAberta.tsx", "utf8");
    expect(fonte).toMatch(/<BalaoMensagem[\s\S]*?comandos=\{comandosDaMensagem\(m, capacidades, envioLiberado === true\)\}/); // carregando (null) não libera comando
    expect(fonte).toMatch(/\(c === "reagir" \|\| c === "encaminhar" \|\| c === "editar" \|\| c === "apagar"\) && item\) setAcaoMensagem\(\{ acao: c, m, atendimentoId: item\.id, numeroId: item\.numeroId \}\)/);
    expect(fonte).toMatch(/<AcoesMensagem[\s\S]*?aoMudar=\{\(\) => void conversa\.recarregar\(\)\}/);
    // O encaminhar recebe a conversa de origem (para excluí-la e para listar só o mesmo número).
    expect(fonte).toMatch(/<AcoesMensagem[\s\S]*?origem=\{\{ atendimentoId: acaoMensagem\.atendimentoId, numeroId: acaoMensagem\.numeroId \}\}/);
  });
});

describe("ConversaAberta: o compositor respeita o podeEnviar do servidor e o status (C4 da R1 do #217 · C6 do #217)", () => {
  it("atendimento aberto e o servidor libera o envio: pode enviar", () => {
    expect(podeEnviarNaConversa(item(), true)).toBe(true);
  });
  it("o servidor nega o envio (convidado sem envio, destinatário a conferir): não envia", () => {
    expect(podeEnviarNaConversa(item(), false)).toBe(false);
  });
  it("atendimento encerrado não envia, mesmo com o envio liberado", () => {
    expect(podeEnviarNaConversa(item({ status: "ENCERRADO" }), true)).toBe(false);
  });
  it("a decisão não passa por podeExecutar(\"enviar\"), que libera todo mundo", () => {
    permissao.chamadas = [];
    podeEnviarNaConversa(item(), true);
    podeEnviarNaConversa(item(), false);
    expect(permissao.chamadas.filter((c) => c[1] === "enviar")).toEqual([]);
  });
  it("componente: convidado sem envio (podeEnviar false) vê o aviso no lugar do compositor", () => {
    const h = renderToStaticMarkup(createElement(ConversaAberta, propsConversa({ podeEnviar: false })));
    expect(h).toContain(MOTIVO_SEM_ENVIO);
  });
  it("componente: com o envio liberado e o atendimento aberto o compositor aparece", () => {
    const h = renderToStaticMarkup(createElement(ConversaAberta, propsConversa({ podeEnviar: true })));
    expect(h).not.toContain(MOTIVO_SEM_ENVIO);
  });
  it("componente: encerrado esconde o compositor mesmo com o envio liberado", () => {
    const h = renderToStaticMarkup(createElement(ConversaAberta, propsConversa({ podeEnviar: true, item: item({ status: "ENCERRADO" }) })));
    expect(h).toContain(MOTIVO_SEM_ENVIO);
  });
  it("permissão ainda carregando (null): repassa null; encerrado continua false", () => {
    expect(podeEnviarNaConversa(item(), null)).toBeNull();
    expect(podeEnviarNaConversa(item({ status: "ENCERRADO" }), null)).toBe(false);
  });
  it("componente: carregando mostra Carregando…, não o motivo (C2 da revisão do #218)", () => {
    const h = renderToStaticMarkup(createElement(ConversaAberta, propsConversa({ podeEnviar: null })));
    expect(h).toContain(CARREGANDO_ENVIO);
    expect(h).not.toContain(MOTIVO_SEM_ENVIO);
  });
  it("componente: falha no painel mostra o erro com Tentar de novo; encerrado mostra o motivo", () => {
    const h = renderToStaticMarkup(createElement(ConversaAberta, propsConversa({ podeEnviar: null, falhaPermissao: () => {} })));
    expect(h).toContain(FALHA_PERMISSAO_ENVIO);
    expect(h).toContain("Tentar de novo");
    const enc = renderToStaticMarkup(createElement(ConversaAberta, propsConversa({ podeEnviar: null, falhaPermissao: () => {}, item: item({ status: "ENCERRADO" }) })));
    expect(enc).toContain(MOTIVO_SEM_ENVIO);
    expect(enc).not.toContain(FALHA_PERMISSAO_ENVIO);
  });
});

describe("ConversaAberta: anexo e áudio do compositor saem pelo envio de mídia da inbox (C2 da R1 do #217)", () => {
  it("aoEnviarMidia chama enviarMidiaInbox com o atendimento, a URL do upload e a legenda (fonte)", () => {
    const fonte = readFileSync("src/app/(app)/inbox/ConversaAberta.tsx", "utf8");
    expect(fonte).toMatch(/aoEnviarMidia=\{\(url, legenda\) => enviarMidiaInbox\(\{ conversaId: item\.id, url, legenda \}\)\}/);
  });
});

describe("ConversaAberta: recursos do motor pelas capacidades do número (merge da 4D com a 3F; B1/C4 da R1 do #219)", () => {
  it("balão e compositor usam `item.capacidades` (motor ativo e sessão CONECTADO), não o driver sozinho (fonte)", () => {
    const fonte = readFileSync("src/app/(app)/inbox/ConversaAberta.tsx", "utf8");
    expect(fonte).toMatch(/const capacidades = item\?\.capacidades \?\? \[\];/);
    expect(fonte).toMatch(/<BalaoMensagem[\s\S]*?recursos=\{\(r\) => capacidades\.includes\(r\)\}/);
    expect(fonte).toMatch(/<RodapeConversa[\s\S]*?capacidades=\{capacidades\}/);
    expect(fonte).not.toMatch(/recursoDisponivel|item\.driver/);
  });
});

it("decora a thread no fuso usando referência explícita SSR e preserva nota sem comandos",()=>{
 const mensagens: MensagemThread[]=[{id:"m1",direcao:"ENTRADA",tipo:"TEXTO",corpo:"Olá",midiaPath:null,status:"RECEBIDA",origem:null,autorNome:null,templateNome:null,criadoEm:"2026-10-22T02:30:00Z",participanteNome:null,favorita:false,clientMessageId:null}];
 const notas: NotaInternaThread[]=[{id:"n1",nota:"Nota só equipe",autorNome:"Ana",criadoEm:"2026-10-22T12:00:00Z",origem:"oportunidade"}];
 const props=propsConversa({podeEnviar:true,fuso:"America/Sao_Paulo",agoraInicial:Date.parse("2026-10-22T13:00:00Z"),conversa:{...conversaVazia,mensagens,notas}});
 const h=renderToStaticMarkup(createElement(ConversaAberta,props));
 for(const c of ['px-[7%]','max-[699px]:px-2.5','>Ontem<','>Hoje<','role="note"','Nota da oportunidade · só equipe'])expect(h).toContain(c);
 expect((h.match(/aria-label="Opções da mensagem"/g)||[]).length).toBe(1);
 expect(renderToStaticMarkup(createElement(ConversaAberta,props))).toBe(h);
});

it("315 liga o cabeçalho68 real sem remontar a thread ou repetir a barra antiga",()=>{
 const h=renderToStaticMarkup(createElement(ConversaAberta,propsConversa({podeEnviar:true})));
 expect(h).toContain("h-[68px]"); expect(h).toContain('aria-label="Mais ações da conversa"');
 expect(h).not.toContain('aria-label="Ações do atendimento"');
});


describe("319: estados públicos da thread",()=>{
 it("carga inicial vazia anuncia mensagens; dados existentes não são substituídos",()=>{
  const h=(conversa:ConversaHook)=>renderToStaticMarkup(createElement(ConversaAberta,propsConversa({podeEnviar:true,conversa})));
  expect(h({...conversaVazia,carregando:true})).toContain("Carregando mensagens");
  const existente=h({...conversaVazia,carregando:true,mensagens:[msg]});expect(existente).toContain("Olá");expect(existente).not.toContain("Carregando mensagens");
  const nota:NotaInternaThread={id:"n319",nota:"Nota preservada388",autorNome:"Ana",criadoEm:"2026-10-17T16:00:00.000Z",origem:"atendimento"};
  const soNota=h({...conversaVazia,carregando:true,notas:[nota]});expect(soNota).toContain(nota.nota);expect(soNota).not.toContain("Carregando mensagens");
 });
 it("erro mostra aviso público e retry sem status técnico, URL ou corpo da falha",()=>{
  const h=renderToStaticMarkup(createElement(ConversaAberta,propsConversa({podeEnviar:false,conversa:{...conversaVazia,erro:"ErroFonte500 /api/segredo corpo interno",recarregar:async()=>{}}})));
  expect(h).toContain('role="alert"');expect(h).toContain("Não foi possível carregar as mensagens.");expect(h).toContain("Tentar de novo");expect(h).not.toContain("ErroFonte");expect(h).not.toContain("/api/segredo");expect(h).not.toContain("corpo interno");
 });
 it("paginação ocupada mantém conteúdo e anuncia espera sem remontar como carga inicial",()=>{
  const h=renderToStaticMarkup(createElement(ConversaAberta,propsConversa({podeEnviar:false,conversa:{...conversaVazia,mensagens:[msg],carregandoAntigas:true,temMaisAntes:true}})));
  expect(h).toContain("Olá");expect(h).not.toContain("Carregando mensagens");expect(h).toContain('aria-busy="true"');expect(h).toContain("Mensagens anteriores");
 });
});

// #350: cartões vêm do painel autorizado; envio do compositor é outro contrato.
it("não mostra sugestão posterior à janela antiga, mas a conserva na janela atual",()=>{
 const cartao={id:"futura",turnoId:"t",acao:"RESPONDER",status:"SUGERIDA",criadoEm:"2026-10-17T16:00Z",expiraEm:null,justificativa:null,texto:"Sugestão posterior à janela",detalhe:{tipo:"enviar",documento:false},decididaPorId:null,decididaPorNome:null,decididaEm:null};
 for(const temMaisDepois of [true,false]){
  const h=renderToStaticMarkup(createElement(ConversaAberta,propsConversa({podeEnviar:false,conversa:{...conversaVazia,mensagens:[msg],temMaisDepois},aria:{cartoes:[cartao]}} as never)));
  expect(h.includes(cartao.texto)).toBe(!temMaisDepois);
 }
});
it("renderiza sugestão autorizada mesmo sem podeDecidir no lead do atendimento ou envio",()=>{
 const cartao={id:"s",turnoId:"t",acao:"RESPONDER",status:"SUGERIDA",criadoEm:"2026-10-17T15:31Z",expiraEm:null,justificativa:"Pedido de informação",texto:"Resposta sugerida",detalhe:{tipo:"enviar",documento:false},decididaPorId:null,decididaPorNome:null,decididaEm:null};
 const h=renderToStaticMarkup(createElement(ConversaAberta,propsConversa({podeEnviar:false,aria:{podeDecidir:false,cartoes:[cartao]}} as never)));
 expect(h).toContain("Resposta sugerida");expect(h).toContain("Aprovar e enviar");
});

it("cartões são alcançáveis no consumidor da lista virtual real sem alterar keys legadas",()=>{
 const mensagens=Array.from({length:120},(_,i)=>({...msg,id:"m"+i,criadoEm:new Date(Date.UTC(2026,9,17,12,i)).toISOString()}));
 const cartao={id:"s",turnoId:"t",acao:"RESPONDER",status:"SUGERIDA",criadoEm:"2026-10-17T12:01:30Z",expiraEm:null,justificativa:null,texto:"Resposta",detalhe:{tipo:"enviar",documento:false},decididaPorId:null,decididaPorNome:null,decididaEm:null};
 renderToStaticMarkup(createElement(ConversaAberta,propsConversa({podeEnviar:false,conversa:{...conversaVazia,mensagens},aria:{cartoes:[cartao]}} as never)));
 const v=virtual350.props!;const row=v.items.find(x=>(x as {tipo:string}).tipo==="sugestao-aria")!;
 expect(v.stableMount).toBe(true);expect(v.isItemFocusable!(row,0)).toBe(true);expect(v.getKey(row,0)).toBe("sugestao-aria:s");
 expect(v.items.filter(x=>(x as {tipo:string}).tipo==="mensagem").map((x,i)=>v.getKey(x,i))).toEqual(mensagens.map(m=>m.id));
});

it("348 usa estado e capacidades Aria recebidos sem inferir papel",()=>{
 const aria={handoff:null,podeDecidir:true,cartoes:[],pausada:true,motivo:"MANUAL" as const,podeAssumirAria:false,podeDevolver:true,};
 const h=renderToStaticMarkup(createElement(ConversaAberta,propsConversa({podeEnviar:true,item:item({estadoAria:"aprovacao"}),aria})));
 expect(h).toContain("Aria aguarda sua aprovação");expect(h).toContain('aria-label="Devolver para Aria"');expect(h).toContain('title="Aria pausada · Pausa manual"');
 const negado=renderToStaticMarkup(createElement(ConversaAberta,propsConversa({podeEnviar:true,item:item({estadoAria:"aprovacao"}),aria:{...aria,podeDecidir:false,podeAssumirAria:false,podeDevolver:false}})));
 expect(negado).toContain("Aria aguarda aprovação");expect(negado).not.toContain('aria-label="Devolver para Aria"');
});
it("348 grupo e encerrada preservam estados legados sem devolução",()=>{for(const alteracao of [{grupo:true},{status:"ENCERRADO" as const}]){const h=renderToStaticMarkup(createElement(ConversaAberta,propsConversa({podeEnviar:true,item:item({estadoAria:"ia",...alteracao}),aria:{handoff:null,podeDecidir:true,cartoes:[],pausada:true,motivo:null,podeAssumirAria:false,podeDevolver:true,}})));expect(h).not.toContain("Aria está atendendo");expect(h).not.toContain('aria-label="Devolver para Aria"');}});

it("352 faixa usa handoff autorizado e relógio SSR existente, sem inferir apenas estado da lista",()=>{
 const handoff={acaoId:"h352",pedidoEm:"2026-10-25T11:56:00Z",motivo:null,motivoTexto:"Valor alto",destino:"FILA_SETOR" as const,responsavelNome:null,resumo:null,feito:[],podeAssumir:true,ehResponsavel:false};
 const props=propsConversa({podeEnviar:true,item:item({estadoAria:"handoff"}),agoraInicial:Date.parse("2026-10-25T12:00:00Z"),aria:{handoff,podeDecidir:false,cartoes:[],pausada:true,motivo:"HANDOFF",podeAssumirAria:false,podeDevolver:false,}});
 const h=renderToStaticMarkup(createElement(ConversaAberta,props));expect(h).toContain("Aria pediu ajuda há 4 min");expect(h).toContain("Ver resumo e assumir");
 const sem=renderToStaticMarkup(createElement(ConversaAberta,{...props,aria:{...props.aria!,handoff:null}}));expect(sem).not.toContain("Ver resumo e assumir");
});

it("353 cartão mantém callback da conversa depois de retirar painel legado",()=>{
 const cartao={id:"353-cartao",turnoId:"t",acao:"RESPONDER" as const,status:"SUGERIDA" as const,criadoEm:"2026-10-17T15:31Z",expiraEm:null,justificativa:null,texto:"Resposta353",detalhe:{tipo:"enviar" as const,documento:false},decididaPorId:null,decididaPorNome:null,decididaEm:null};
 const aoMudar=vi.fn();renderToStaticMarkup(createElement(ConversaAberta,propsConversa({podeEnviar:false,aoMudar,aria:{pausada:false,motivo:null,podeAssumirAria:false,podeDevolver:false,podeDecidir:false,cartoes:[cartao],handoff:null}})));
 const v=virtual350.props!,row=v.items.find(x=>(x as {tipo:string}).tipo==="sugestao-aria")!;const no=v.renderItem(row,0);
 if(!isValidElement<{aoDecidir():void}>(no))throw Error("Cartão ausente na thread");expect(no.props.aoDecidir).toBe(aoMudar);no.props.aoDecidir();expect(aoMudar).toHaveBeenCalledOnce();
});
it.each([false,true])("434 consumidor transporta bloqueio cliente=%s sem usar podeDecidir geral",bloquearDecisoesAria=>{
 const cartao={id:"434",turnoId:"t",acao:"RESPONDER" as const,status:"SUGERIDA" as const,criadoEm:"2026-10-17T15:31Z",expiraEm:null,justificativa:null,texto:"Autorizado pelo lead da ação",detalhe:{tipo:"enviar" as const,documento:false},decididaPorId:null,decididaPorNome:null,decididaEm:null};
 renderToStaticMarkup(createElement(ConversaAberta,propsConversa({podeEnviar:false,bloquearDecisoesAria,aria:{pausada:false,motivo:null,podeAssumirAria:false,podeDevolver:false,podeDecidir:false,cartoes:[cartao],handoff:null}})));
 const v=virtual350.props!,row=v.items.find(x=>(x as {tipo:string}).tipo==="sugestao-aria")!;const no=v.renderItem(row,0);if(!isValidElement<{bloqueado?:boolean}>(no))throw Error("Cartão ausente");expect(no.props.bloqueado).toBe(bloquearDecisoesAria);
});
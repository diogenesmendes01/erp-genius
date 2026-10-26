import { act, createElement, StrictMode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { criarDomMinimo, desligarObservadores, type Documento, type Elemento } from "@/test/dom-minimo";
import type { DetalhesPainel } from "@/server/inbox/painel-detalhes";
import { GavetaContato, type PropsGavetaContato } from "./GavetaContato";
const { salvar } = vi.hoisted(() => ({ salvar: vi.fn() }));
vi.mock("@/server/inbox/acoes-painel", () => ({ editarContatoNoInbox: salvar }));
vi.mock("@tabler/icons-react", () => ({ IconX: (p: object) => createElement("span", p) }));
const dados: DetalhesPainel = { pessoa: { id: "p326", nome: "Pessoa fictícia326", email: "antes@example.test", cidade: "Origem", cargo: null, linkedin: null, origemCanal: "WHATSAPP", telefone: "+5500000000326", empresa: { id: "e326", nome: "Empresa fictícia326", documento: "RUC-FICTICIO", segmentoMercado: null, porte: null, site: null } }, oportunidade: null, b2b: null, campos: [
  { id: "texto", nome: "Objetivo", tipo: "TEXTO", opcoes: [], obrigatorio: false, valor: "Inicial", ia: true },
  { id: "numero", nome: "Horas", tipo: "NUMERO", opcoes: [], obrigatorio: false, valor: 0, ia: false },
  { id: "bool", nome: "Disponível", tipo: "BOOLEANO", opcoes: [], obrigatorio: false, valor: false, ia: false },
  { id: "data", nome: "Dia", tipo: "DATA", opcoes: [], obrigatorio: false, valor: null, ia: false },
  { id: "selecao", nome: "Nível", tipo: "SELECAO", opcoes: ["A1", "B2"], obrigatorio: false, valor: "A1", ia: false },
] };
let root: Root, host: Elemento, doc: Documento;
const ouvintes: { tipo: string; f: (e: Event) => void; alvo: object }[] = [];
function eventos(el: object) { const k = Object.keys(el).find(k => k.startsWith("__reactProps"))!; return (el as Record<string, Record<string, (e?: unknown) => unknown>>)[k]; }
const campo = (nome: string) => host.querySelector('[name="'+nome+'"]')!;
const botao = (nome: string) => Array.from(host.querySelectorAll("button")).find(b => b.textContent === nome)!;
async function digitar(nome: string, value: string) { await act(async () => { eventos(campo(nome)).onChange({ target: { value } }); }); }
async function enviar() { await act(async () => { void eventos(host.querySelector("form")!).onSubmit({ preventDefault() {} }); }); }
const base: PropsGavetaContato = { atendimentoId: "A", dados, aoFechar() {}, aoSalvo() {}, podeVerFicha: true };
async function montar(p: Partial<PropsGavetaContato> = {}) { await act(async () => root.render(createElement(StrictMode, null, createElement(GavetaContato, { ...base, ...p })))); }
beforeEach(async () => {
  vi.resetAllMocks(); salvar.mockResolvedValue({ ok: true }); ouvintes.length = 0;
  const dom = criarDomMinimo(); doc = dom.documento;
  const criar = doc.createElement.bind(doc);
  doc.createElement = tag => { const el = criar(tag); if (tag === "select") Object.defineProperty(el, "options", { get: () => el.querySelectorAll("option") }); return el; };
  for (const alvo of [doc, dom.janela]) Object.assign(alvo, { addEventListener: (tipo: string, f: (e: Event) => void) => ouvintes.push({ tipo, f, alvo }), removeEventListener: (tipo: string, f: (e: Event) => void) => { const i = ouvintes.findIndex(o => o.alvo === alvo && o.tipo === tipo && o.f === f); if (i >= 0) ouvintes.splice(i, 1); } });
  vi.stubGlobal("document", doc); vi.stubGlobal("window", dom.janela); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  host = doc.createElement("div"); doc.body.appendChild(host); const { createRoot } = await import("react-dom/client"); root = createRoot(host as unknown as HTMLElement);
});
afterEach(async () => { await act(async () => root.unmount()); desligarObservadores(); vi.unstubAllGlobals(); });
it("SSR mostra campos reais, empresa somente leitura e link condicionado, sem telefone/empresa editáveis ou B2C", () => {
  const html = renderToStaticMarkup(createElement(GavetaContato, base));
  for (const texto of ["Editar contato", "Nome", "E-mail", "Cidade", "Cargo", "LinkedIn", "Origem do contato", "Objetivo", "Horas", "Disponível", "Dia", "Nível", "Empresa fictícia326", "Trocar a empresa na ficha completa"]) expect(html).toContain(texto);
  expect(html).toContain('/contatos?c=p326'); expect(html).not.toContain('name="telefone"'); expect(html).not.toContain('name="empresaId"'); expect(html).not.toContain("B2C");
  expect(renderToStaticMarkup(createElement(GavetaContato, { ...base, podeVerFicha: false }))).not.toContain('/contatos?');
});
it("sem mudança não executa; diff e identidade da abertura chegam à action e só OK fecha/reconcilia", async () => {
  const fechar=vi.fn(), salvo=vi.fn(); await montar({aoFechar:fechar,aoSalvo:salvo}); expect(botao("Salvar").getAttribute("disabled")).not.toBeNull(); await enviar(); expect(salvar).not.toHaveBeenCalled();
  await digitar("cidade", "Campinas"); await enviar(); expect(salvar).toHaveBeenCalledExactlyOnceWith("A", {pessoaIdEsperada:"p326",pessoa:{cidade:"Campinas"}}); expect(fechar).toHaveBeenCalledOnce(); expect(salvo).toHaveBeenCalledOnce();
});
it("falha e transporte incerto conservam rascunho; tentativa em curso bloqueia duplicação e edição", async () => {
  let resolver!:(r:unknown)=>void; salvar.mockImplementationOnce(()=>new Promise(r=>{resolver=r;})).mockRejectedValueOnce(Error("offline")); const fechar=vi.fn(); await montar({aoFechar:fechar}); await digitar("nome","Nome novo"); await enviar(); await enviar(); expect(salvar).toHaveBeenCalledOnce(); expect(campo("nome").getAttribute("disabled")).not.toBeNull(); await digitar("nome","Não pode substituir");
  await act(async()=>resolver({ok:false,erro:"Conflito no servidor"})); expect(host.textContent).toContain("Conflito no servidor"); expect((campo("nome") as Elemento&{value:string}).value).toBe("Nome novo"); expect(fechar).not.toHaveBeenCalled(); await enviar(); expect(fechar).not.toHaveBeenCalled(); expect((campo("nome") as Elemento&{value:string}).value).toBe("Nome novo");
});
it.each(["outro atendimento", "reaberta", "fechada"])("ACK tardio de A não modifica contexto atual: %s", async caso=>{
  let resolver!:(r:unknown)=>void; salvar.mockImplementation(()=>new Promise(r=>{resolver=r;})); const antigo=vi.fn(), atual=vi.fn(); await montar({aoSalvo:antigo,aoFechar:antigo}); await digitar("nome","Enviado A"); await enviar();
  if(caso==="fechada") await act(async()=>root.render(createElement("p",null,"Fechada"))); else {if(caso==="reaberta") await act(async()=>root.render(createElement("p",null,"Fechada"))); await montar({atendimentoId:caso==="outro atendimento"?"B":"A",dados:{...dados,pessoa:{...dados.pessoa!,id:"pB",nome:"Pessoa B"}},aoSalvo:atual,aoFechar:atual}); await digitar("nome","Intenção B");}
  await act(async()=>resolver({ok:true})); expect(antigo).not.toHaveBeenCalled(); expect(atual).not.toHaveBeenCalled(); if(caso!=="fechada") expect((campo("nome") as Elemento&{value:string}).value).toBe("Intenção B");
});
it("snapshot SSE da mesma Pessoa não apaga edição nem troca a precondição lida", async()=>{
  await montar(); await digitar("cidade","Rascunho local"); await montar({dados:{...dados,pessoa:{...dados.pessoa!,id:"pessoa-nova",cidade:"Servidor novo"}}}); expect((campo("cidade") as Elemento&{value:string}).value).toBe("Rascunho local"); await enviar(); expect(salvar).toHaveBeenCalledWith("A",{pessoaIdEsperada:"p326",pessoa:{cidade:"Rascunho local"}});
});
it("loading/erro/retry e ausência autorizada de Pessoa nunca oferecem escrita", async()=>{
  await montar({dados:null}); expect(host.querySelector("form")).toBeNull(); expect(host.textContent).toContain("Carregando"); const retry=vi.fn(); await montar({dados:null,erro:true,aoRecarregar:retry}); await act(async()=>eventos(botao("Tentar de novo")).onClick({currentTarget:botao("Tentar de novo")})); expect(retry).toHaveBeenCalledOnce(); await montar({dados:{...dados,pessoa:null}}); expect(host.querySelector("form")).toBeNull(); expect(host.querySelector('[role="status"]')).not.toBeNull();
});
it("Escape do Drawer real fecha e devolve foco ao gatilho sem submit", async()=>{
  const gatilho=doc.createElement("button"); doc.body.appendChild(gatilho); gatilho.focus(); const fechar=vi.fn(); await montar({aoFechar:fechar});
  await act(async()=>{for(const o of [...ouvintes]) if(o.tipo==="keydown")o.f({key:"Escape",defaultPrevented:false,preventDefault(){},stopPropagation(){}} as unknown as Event);}); expect(fechar).toHaveBeenCalledOnce(); expect(salvar).not.toHaveBeenCalled(); await act(async()=>root.render(createElement("p",null,"Fechada"))); expect(doc.activeElement===gatilho).toBe(true);
});
it("cinco tipos mantêm zero/false e enviam somente valores alterados com CAS", async()=>{
  await montar(); expect((campo("numero") as Elemento&{value:string}).value).toBe("0");
  await act(async()=>eventos(campo("bool")).onChange({target:{checked:true}})); await digitar("numero","5"); await digitar("data","2026-10-23"); await digitar("selecao","B2"); await digitar("texto",""); await enviar();
  expect(salvar).toHaveBeenCalledWith("A",{pessoaIdEsperada:"p326",campos:[{campoId:"texto",valor:null},{campoId:"numero",valor:5},{campoId:"bool",valor:true},{campoId:"data",valor:"2026-10-23"},{campoId:"selecao",valor:"B2"}]});
});
it("rótulos ligam controles por IDs DOM únicos e Tab real do Drawer permanece na gaveta",async()=>{
  await montar();const labels=host.querySelectorAll("label");expect(labels).toHaveLength(11);
  const ids=labels.map(l=>l.getAttribute("for"));expect(new Set(ids).size).toBe(11);expect(ids.every(id=>!!id&&host.querySelector('[id="'+id+'"]'))).toBe(true);
  await digitar("cidade","Mudança");botao("Salvar").focus();await act(async()=>{for(const o of [...ouvintes])if(o.tipo==="keydown")o.f({key:"Tab",shiftKey:false,defaultPrevented:false,preventDefault(){},stopPropagation(){}} as unknown as Event);});expect(doc.activeElement?.getAttribute("aria-label")).toBe("Fechar");
});

it("campo numérico permite fração e envia decimal sem arredondar", async () => {
  await montar();
  expect(campo("numero").getAttribute("type")).toBe("number");
  expect(campo("numero").getAttribute("step")).toBe("any");
  await digitar("numero", "2.75"); await enviar();
  expect(salvar).toHaveBeenCalledWith("A", { pessoaIdEsperada: "p326", campos: [{ campoId: "numero", valor: 2.75 }] });
});
it("retry entrega foco ao Fechar persistente antes de remover o botão e conserva na chegada do formulário",async()=>{
  const recarregar=vi.fn();await montar({dados:null,erro:true,aoRecarregar:recarregar});
  const retry=botao("Tentar de novo"),fechar=host.querySelector('button[aria-label="Fechar"]')!;retry.focus();
  await act(async()=>eventos(retry).onClick({currentTarget:retry}));expect(recarregar).toHaveBeenCalledOnce();
  await montar({dados:null,erro:false,aoRecarregar:recarregar});
  expect(doc.activeElement===fechar).toBe(true);expect(doc.activeElement.closest('[inert]')).toBeNull();
  await montar({dados,erro:false,aoRecarregar:recarregar});
  expect(campo("nome")).toBeTruthy();expect(doc.activeElement===fechar).toBe(true);expect(salvar).not.toHaveBeenCalled();
});

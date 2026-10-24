import { DriverWhatsApp } from "@prisma/client";
import { act, createElement } from "react";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { criarDomMinimo, desligarObservadores, type Elemento } from "@/test/dom-minimo";
import type { PropsInboxNovo } from "./InboxNovo";
vi.mock("next/navigation", () => ({ useSearchParams: () => null, useRouter: () => ({ push() {}, replace() {} }), usePathname: () => "/inbox" }));
vi.mock("./useEventosInbox", () => ({ useEventosInbox: () => ({ conectado: true }) }));
vi.mock("@/components/conversa/useConversa", () => ({ useConversa: () => ({ mensagens: [] }) }));
vi.mock("@/server/whatsapp/preferencias", () => ({ marcarAtendimentoLidoAutomatico: async () => ({ ok: true }) }));
vi.mock("@/server/whatsapp/acoes", () => ({ registrarOptOutContato: vi.fn(), removerOptOutContato: vi.fn(), enviarTextoInbox: vi.fn(), enviarMidiaInbox: vi.fn() }));
// A thread e suas escritas são outra fronteira; casca, abas, campos e hook continuam reais.
vi.mock("./ConversaAberta", async () => { const { createElement } = await import("react"); return { ConversaAberta: () => createElement("header", null, "Conversa") }; });
vi.mock("@tabler/icons-react", async original => { const real = await original<Record<string, unknown>>(); const { createElement } = await import("react"); return Object.fromEntries(Object.entries(real).map(([k, v]) => [k, k.startsWith("Icon") ? () => createElement("span") : v])); });
import { InboxNovo } from "./InboxNovo";
const cap = { veLead: true, verContato: false, editarContato: false, editarTags: false, criarTag: false, moverEtapa: false, tarefas: false, tarefasEquipe: false, desfazerAria: false, verEmpresa: false };
const item = { id: "a1", numeroId: "n1", numeroRotulo: "Central", finalidade: "COMERCIAL", driver: DriverWhatsApp.MOTOR, contatoId: "c1", contatoNome: "Grupo Ventura", contatoTelefone: "+5500000000001", optOut: false, vinculo: null, naoLidas: 0, ultimaMensagemEm: null, preview: "Oi", linhaComercial: false, status: "EM_ATENDIMENTO", responsavelNome: null, prazoRespostaEm: null, fixada: false, silenciada: false, grupo: false };
const props = { inicial: { itens: [item], proximo: null }, filtros: {}, selecionado: "a1", usuario: { id: "leitor", papeis: ["PROFESSOR"] }, fuso: null } as unknown as PropsInboxNovo;
const detalhes = { pessoa: { id: "p1", nome: "Ana", email: "ana@teste.local", cidade: null, cargo: "RH", linkedin: null, origemCanal: "WHATSAPP", telefone: "+5500000000001", empresa: { id: "e1", nome: "Grupo Ventura", documento: null, segmentoMercado: null, porte: null, site: null } }, oportunidade: { id: "op1", titulo: "Equipe", produto: null, valor: "100", moeda: "USD", etapa: "PROPOSTA", b2b: true }, b2b: { empresa: { id: "e1", nome: "Grupo Ventura" }, decisor: true, participantes: [{ pessoaId: "p1", nome: "Ana", cargo: "RH", papel: "DECISOR", naConversa: true, hrefConversa: "/inbox?c=a1" }, { pessoaId: "p2", nome: "Bia", cargo: null, papel: "OUTRO", naConversa: false, hrefConversa: "/inbox?c=autorizada" }, { pessoaId: "p3", nome: "Caio", cargo: null, papel: "OUTRO", naConversa: false, hrefConversa: null }] }, campos: [] };
let root: Root, host: Elemento;
let responderDetalhes: () => Promise<Response>;
const pedidos: string[] = [];
const ouvintes: { alvo: object; tipo: string; f: (e: Event) => void; captura: boolean }[] = [];
function eventos(alvo: object) { return { addEventListener(tipo: string, f: (e: Event) => void, captura = false) { ouvintes.push({ alvo, tipo, f, captura }); }, removeEventListener(tipo: string, f: (e: Event) => void) { const i = ouvintes.findIndex(o => o.alvo === alvo && o.tipo === tipo && o.f === f); if (i >= 0) ouvintes.splice(i, 1); } }; }
const render = (p = props) => act(async () => { root.render(createElement(InboxNovo, p)); });
beforeEach(async () => {
  const dom = criarDomMinimo(); ouvintes.length = 0; Object.assign(dom.janela, eventos(dom.janela), { innerWidth: 1440, matchMedia: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }) });
  Object.assign(dom.documento, eventos(dom.documento), { visibilityState: "visible", querySelector: (s: string) => dom.documento.body.querySelector(s) });
  vi.stubGlobal("window", dom.janela); vi.stubGlobal("document", dom.documento); vi.stubGlobal("MutationObserver", dom.MutationObserver); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  pedidos.length = 0; responderDetalhes = async () => new Response(JSON.stringify(detalhes));
  vi.stubGlobal("fetch", vi.fn(async (url: string) => { pedidos.push(url); if (url.endsWith("/painel/detalhes")) return responderDetalhes(); if (url.endsWith("/painel")) return new Response(JSON.stringify({ setor: "COMERCIAL", oportunidade: null, pessoaId: "p1", podeEnviar: false, tags: [], acoes: null, cabecalho: { pessoaId: "p1", tagsDisponiveis: [], semNome: false, subtitulo: "Falando com Ana · Decisor", quadrado: true, capacidades: cap } })); return new Response(JSON.stringify({ itens: props.inicial.itens, proximo: null })); }));
  host = dom.documento.createElement("div"); Object.assign(host, eventos(host)); dom.documento.body.appendChild(host); const { createRoot } = await import("react-dom/client"); root = createRoot(host as unknown as HTMLElement);
});
afterEach(async () => { await act(async () => root.unmount()); desligarObservadores(); vi.unstubAllGlobals(); });
it("comercial consome DTO uma vez, apresenta cabeçalho B2B e somente o destino autorizado", async () => {
  await render(); await render();
  expect(host.textContent).toContain("Falando com Ana · Decisor"); expect(host.textContent).toContain("ana@teste.local"); expect(host.textContent).toContain("Na conversa");
  expect(host.querySelectorAll('a').map(e => e.getAttribute("href"))).toContain("/inbox?c=autorizada");
  expect(host.querySelectorAll('a').map(e => e.getAttribute("href"))).not.toContain("/inbox?c=a1");
  expect(host.querySelectorAll('a').map(e => e.getAttribute("href"))).not.toContain("/contatos?c=p1");
  expect(pedidos.filter(u => u.endsWith("/painel/detalhes"))).toHaveLength(1);
  expect(host.querySelector('[data-cabecalho-contato]')?.textContent).toContain("Grupo Ventura");
  expect(host.querySelectorAll('[role="tab"]').map(e => e.textContent)).toEqual(["Detalhes"]);
});
it("fora do comercial não adquire DTO comercial nem revela dados B2B", async () => {
  const outro = { ...props, inicial: { itens: [{ ...item, finalidade: "PEDAGOGICO", contatoTelefone: null }], proximo: null } } as unknown as PropsInboxNovo;
  await render(outro); expect(pedidos.filter(u => u.endsWith("/painel/detalhes"))).toHaveLength(0); expect(host.textContent).not.toContain("ana@teste.local"); expect(host.textContent).not.toContain("Falando com Ana");
});
it("falha de Detalhes oferece retry real e não aparece como ausência legítima", async () => {
  responderDetalhes = async () => new Response("privado", { status: 500 }); await render();
  expect(host.textContent).toContain("Não foi possível carregar os detalhes."); expect(host.textContent).not.toContain("Sem oportunidade visível"); expect(host.textContent).not.toContain("privado");
  const retry = host.querySelectorAll('button').find(e => e.textContent === "Tentar de novo")!; expect(retry).toBeDefined();
  responderDetalhes = async () => new Response(JSON.stringify(detalhes));
  await act(async () => { const ev = { type: "click", target: retry, button: 0, bubbles: true, preventDefault() {}, stopPropagation() {} }; for (const captura of [true, false]) for (const o of [...ouvintes]) if (o.alvo === host && o.tipo === "click" && o.captura === captura) o.f(ev as unknown as Event); });
  expect(host.textContent).toContain("ana@teste.local"); expect(pedidos.filter(u => u.endsWith("/painel/detalhes"))).toHaveLength(2);
});

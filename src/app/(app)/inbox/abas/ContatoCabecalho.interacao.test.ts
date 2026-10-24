import { act, createElement, StrictMode } from "react";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { criarDomMinimo, desligarObservadores, type Documento, type Elemento } from "@/test/dom-minimo";
import { TagsContato, type PropsTagsContato } from "./TagsContato";
import { ContatoSemNome, type PropsContatoSemNome } from "./ContatoSemNome";
const acoes = vi.hoisted(() => ({ atribuir: vi.fn(), remover: vi.fn(), criar: vi.fn(), nome: vi.fn() }));
vi.mock("@/server/inbox/acoes-painel", () => ({ atribuirTagNoInbox: acoes.atribuir, removerTagNoInbox: acoes.remover, criarEAtribuirTagNoInbox: acoes.criar }));
vi.mock("@/server/whatsapp/acoes", () => ({ editarNomeContatoWhatsApp: acoes.nome }));
vi.mock("@tabler/icons-react", () => ({ IconSparkles: (p: object) => createElement("span", p), IconUserX: (p: object) => createElement("span", p) }));
let root: Root, host: Elemento, doc: Documento;
const ouvintes: { tipo: string; f: (e: Event) => void; alvo: object }[] = [];
function eventos(el: object) { const k = Object.keys(el).find(k => k.startsWith("__reactProps"))!; return (el as Record<string, Record<string, (e?: unknown) => unknown>>)[k]; }
const botao = (nome: string) => Array.from(host.querySelectorAll("button")).find(b => b.textContent === nome)!;
const campo = () => host.querySelector("input")!;
async function clicar(nome: string) { await act(async () => { eventos(botao(nome)).onClick(); }); }
async function digitar(valor: string) { await act(async () => { eventos(campo()).onChange({ target: { value: valor } }); }); }
async function enviarNome() { await act(async () => { void eventos(host.querySelector("form")!).onSubmit({ preventDefault() {} }); }); }
async function montarTags(p: Partial<PropsTagsContato> = {}) { await act(async () => root.render(createElement(StrictMode, null, createElement(TagsContato, { atendimentoId: "A", tags: [], disponiveis: [{ id: "t1", nome: "Bolsista" }], podeEditar: true, podeCriar: true, aoMudar() {}, ...p })))); }
async function montarNome(p: Partial<PropsContatoSemNome> = {}) { await act(async () => root.render(createElement(StrictMode, null, createElement(ContatoSemNome, { atendimentoId: "A", nomeAnterior: "  ", podeEditar: true, aoMudar() {}, ...p })))); }
beforeEach(async () => {
  vi.resetAllMocks(); ouvintes.length = 0;
  for (const f of Object.values(acoes)) f.mockResolvedValue({ ok: true });
  const dom = criarDomMinimo(); doc = dom.documento; const criar = doc.createElement.bind(doc);
  doc.createElement = tag => { const el = criar(tag), consultar = el.querySelectorAll.bind(el); return Object.assign(el, { getBoundingClientRect: () => ({ top: 20, bottom: 46, left: 10, right: 90, width: 280, height: 140 }), querySelectorAll: (seletor: string) => consultar(seletor.replaceAll(":disabled", "[disabled]")) }); };
  for (const alvo of [doc, dom.janela]) Object.assign(alvo, { addEventListener: (tipo: string, f: (e: Event) => void) => ouvintes.push({ tipo, f, alvo }), removeEventListener: (tipo: string, f: (e: Event) => void) => { const i = ouvintes.findIndex(o => o.alvo === alvo && o.tipo === tipo && o.f === f); if (i >= 0) ouvintes.splice(i, 1); } });
  Object.assign(dom.janela, { innerWidth: 390, innerHeight: 500 });
  vi.stubGlobal("document", doc); vi.stubGlobal("window", dom.janela); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  host = doc.createElement("div"); doc.body.appendChild(host); const { createRoot } = await import("react-dom/client"); root = createRoot(host as unknown as HTMLElement);
});
afterEach(async () => { await act(async () => root.unmount()); desligarObservadores(); vi.unstubAllGlobals(); });
it("popover abre no campo; Escape consome só a busca e devolve foco ao gatilho real", async () => {
  await montarTags(); const gatilho = botao("+ tag"); await clicar("+ tag"); expect(doc.activeElement === campo()).toBe(true);
  const preventDefault = vi.fn(), stopPropagation = vi.fn();
  await act(async () => { for (const o of [...ouvintes]) if (o.tipo === "keydown") o.f({ key: "Escape", defaultPrevented: false, preventDefault, stopPropagation } as unknown as Event); });
  expect(host.querySelector('[role="dialog"]')).toBeNull(); expect(doc.activeElement === gatilho).toBe(true); expect(preventDefault).toHaveBeenCalledOnce(); expect(stopPropagation).toHaveBeenCalledOnce();
});
it("setas levam do campo às sugestões e voltam ao campo sem sequestrar Home na edição", async () => {
  await montarTags(); await clicar("+ tag"); const input = campo(), popover = host.querySelector('[role="dialog"]')!;
  const key = async (tecla: string, alvo: Elemento) => act(async () => { eventos(popover).onKeyDown?.({ key: tecla, target: alvo, defaultPrevented: false, preventDefault() {} }); });
  await key("ArrowDown", input); expect(doc.activeElement === botao("Bolsista")).toBe(true);
  await key("ArrowUp", botao("Bolsista")); expect(doc.activeElement === input).toBe(true);
  await key("Home", input); expect(doc.activeElement === input).toBe(true);
});
it("busca sem sugestões anuncia o estado vazio e conserva a criação separada", async () => {
  await montarTags(); await clicar("+ tag"); await digitar("Nova fictícia");
  const vazio = host.querySelector("[data-estado-vazio]");
  expect(vazio).not.toBeNull(); expect(vazio!.getAttribute("role")).toBe("status");
  expect(vazio!.textContent).toBe("Nenhuma tag encontrada.");
  expect(botao("Criar tag “Nova fictícia”")).toBeDefined();
  expect(doc.activeElement === campo()).toBe(true); expect(acoes.criar).not.toHaveBeenCalled();
  await digitar("Bolsista");
  expect(host.querySelector("[data-estado-vazio]")).toBeNull();
  expect(botao("Bolsista")).toBeDefined(); expect(acoes.criar).not.toHaveBeenCalled();
});
it("ação repetida fica bloqueada e resultado de A desmontado não reconcilia B", async () => {
  let resolver!: (r: { ok: true }) => void; acoes.atribuir.mockImplementation(() => new Promise(r => { resolver = r; }));
  const mudarA = vi.fn(), mudarB = vi.fn(); await montarTags({ aoMudar: mudarA }); await clicar("+ tag"); await clicar("Bolsista"); await clicar("Bolsista");
  expect(acoes.atribuir).toHaveBeenCalledExactlyOnceWith("A", "t1");
  await montarTags({ atendimentoId: "B", aoMudar: mudarB }); await clicar("+ tag"); await digitar("nova busca");
  await act(async () => resolver({ ok: true })); expect(mudarA).not.toHaveBeenCalled(); expect(mudarB).not.toHaveBeenCalled(); expect((campo() as Elemento & { value: string }).value).toBe("nova busca");
});
it("falha e transporte incerto mantêm busca e permitem retentar; só sucesso reconcilia", async () => {
  acoes.atribuir.mockResolvedValueOnce({ ok: false, erro: "Negado no servidor" }).mockRejectedValueOnce(new Error("rede"));
  const mudar = vi.fn(); await montarTags({ aoMudar: mudar }); await clicar("+ tag"); await digitar("Bolsista");
  await clicar("Bolsista"); expect(host.textContent).toContain("Negado no servidor"); expect(mudar).not.toHaveBeenCalled();
  await clicar("Bolsista"); expect(host.querySelector('[role="dialog"]')).not.toBeNull(); expect(mudar).not.toHaveBeenCalled();
  await clicar("Bolsista"); expect(mudar).toHaveBeenCalledOnce(); expect(host.querySelector('[role="dialog"]')).toBeNull();
});
it("nome vazio não chama action; CAS envia nomeAnterior bruto e conflito conserva edição", async () => {
  acoes.nome.mockResolvedValue({ ok: false, erro: "Nome alterado em outra tela" });
  await montarNome(); await enviarNome(); expect(host.textContent).toContain("Digite o nome"); expect(acoes.nome).not.toHaveBeenCalled();
  await digitar(" Nome fictício "); await enviarNome();
  expect(acoes.nome).toHaveBeenCalledExactlyOnceWith({ atendimentoId: "A", nome: " Nome fictício ", nomeAnterior: "  " });
  expect((campo() as Elemento & { value: string }).value).toBe(" Nome fictício "); expect(host.textContent).toContain("Nome alterado em outra tela");
});
it.each(["troca"] as const)("confirmação antiga do nome não apaga intenção posterior: %s", async caso => {
  let resolver!: (r: { ok: true }) => void; acoes.nome.mockImplementation(() => new Promise(r => { resolver = r; }));
  const mudarA = vi.fn(), mudarB = vi.fn(); await montarNome({ aoMudar: mudarA }); await digitar("Nome enviado"); await enviarNome();
  if (caso === "troca") await montarNome({ atendimentoId: "B", nomeAnterior: null, aoMudar: mudarB });
  await digitar("Intenção posterior"); await act(async () => resolver({ ok: true }));
  expect((campo() as Elemento & { value: string }).value).toBe("Intenção posterior"); expect(mudarA).not.toHaveBeenCalled(); expect(mudarB).not.toHaveBeenCalled();
});

it("nome fica indisponível durante tentativa; OK atualiza a base CAS antes de outra edição", async () => {
  let resolver!: (r: { ok: true }) => void; acoes.nome.mockImplementationOnce(() => new Promise(r => { resolver = r; }));
  const mudar = vi.fn(); await montarNome({ aoMudar: mudar }); await digitar(" Primeiro nome "); await enviarNome();
  expect(campo().getAttribute("disabled") !== null).toBe(true);
  await act(async () => resolver({ ok: true })); expect(mudar).toHaveBeenCalledOnce();
  expect(campo().getAttribute("disabled") !== null).toBe(false);
  await digitar("Segundo nome"); await enviarNome();
  expect(acoes.nome).toHaveBeenLastCalledWith({ atendimentoId: "A", nome: "Segundo nome", nomeAnterior: "Primeiro nome" });
});

it("criação e remoção usam IDs/contexto próprios e só confirmam sucesso", async () => {
  const mudar = vi.fn(); await montarTags({ aoMudar: mudar, tags: [{ id: "historica", rotulo: "Histórica", ia: true }] });
  const remover = host.querySelector('[aria-label="Remover tag Histórica"]')!;
  await act(async () => { void eventos(remover).onClick(); });
  expect(acoes.remover).toHaveBeenCalledExactlyOnceWith("A", "historica"); expect(mudar).toHaveBeenCalledOnce();
  await clicar("+ tag"); await digitar("Nova fictícia"); await clicar("Criar tag “Nova fictícia”");
  expect(acoes.criar).toHaveBeenCalledExactlyOnceWith("A", "Nova fictícia"); expect(mudar).toHaveBeenCalledTimes(2);
});
it("busca nova durante atribuição não é limpa nem fechada por confirmação anterior", async () => {
  let resolver!: (r: { ok: true }) => void; acoes.atribuir.mockImplementation(() => new Promise(r => { resolver = r; }));
  const mudar = vi.fn(); await montarTags({ aoMudar: mudar }); await clicar("+ tag"); await clicar("Bolsista"); await digitar("outra intenção");
  await act(async () => resolver({ ok: true }));
  expect((campo() as Elemento & { value: string }).value).toBe("outra intenção"); expect(host.querySelector('[role="dialog"]')).not.toBeNull(); expect(mudar).toHaveBeenCalledOnce();
});
it("scroll interno preserva busca; resize e scroll externo fecham e limpam listeners", async () => {
  await montarTags(); await clicar("+ tag"); const popover = host.querySelector('[role="dialog"]')!;
  await act(async () => { for (const o of [...ouvintes]) if (o.tipo === "scroll") o.f({ target: popover } as unknown as Event); });
  expect(host.querySelector('[role="dialog"]')).not.toBeNull();
  await act(async () => { for (const o of [...ouvintes]) if (o.tipo === "resize") o.f({} as Event); });
  expect(host.querySelector('[role="dialog"]')).toBeNull(); expect(ouvintes.filter(o => o.tipo === "scroll" || o.tipo === "resize" || o.tipo === "keydown")).toHaveLength(0);
  await clicar("+ tag"); await act(async () => { for (const o of [...ouvintes]) if (o.tipo === "scroll") o.f({ target: doc.body } as unknown as Event); });
  expect(host.querySelector('[role="dialog"]')).toBeNull();
});

it("fechar popover durante await não devolve foco tardiamente após o usuário sair", async () => {
  let resolver!: (r: { ok: true }) => void; acoes.atribuir.mockImplementation(() => new Promise(r => { resolver = r; }));
  await montarTags(); await clicar("+ tag"); await clicar("Bolsista");
  await act(async () => { for (const o of [...ouvintes]) if (o.tipo === "keydown") o.f({ key: "Escape", defaultPrevented: false, preventDefault() {}, stopPropagation() {} } as unknown as Event); });
  const fora = doc.createElement("button"); doc.body.appendChild(fora); fora.focus();
  await act(async () => resolver({ ok: true })); expect(doc.activeElement === fora).toBe(true);
});

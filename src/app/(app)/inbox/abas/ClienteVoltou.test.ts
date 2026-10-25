import { act, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { criarDomMinimo, desligarObservadores, type Elemento } from "@/test/dom-minimo";
const vincular = vi.hoisted(() => vi.fn());
vi.mock("@/server/whatsapp/acoes", () => ({ vincularContatoWhatsApp: vincular }));
import { ClienteVoltou } from "./ClienteVoltou";
type Props = Parameters<typeof ClienteVoltou>[0];
const mudar = vi.fn();
const props = (): Props => ({ atendimentoId: "a", nome: "  Fernanda Fictícia ", pessoaId: "p/8", dado: { oportunidadeId: "op", titulo: "Francês A1 · Semestral", situacao: "ganha", contatoId: "ct", podeVincular: true }, podeCriar: true, aoMudar: mudar });
let root: Root, host: Elemento, pagina: Elemento;
let documento: ReturnType<typeof criarDomMinimo>["documento"];
const teclas = new Set<(e: KeyboardEvent) => void>();
const render = (p: Partial<Props> = {}) => act(async () => root.render(createElement(ClienteVoltou, { ...props(), ...p })));
const botao = (texto: string) => pagina.querySelectorAll("button").find(b => b.textContent === texto)!;
function clicar(texto = "Vincular a Francês A1") {
  const b = botao(texto); expect(b).toBeTruthy();
  const k = Object.keys(b).find(k => k.startsWith("__reactProps"))!;
  (b as unknown as Record<string, { onClick(): void }>)[k].onClick();
}
const abrir = () => act(async () => clicar());
const confirmar = () => act(async () => clicar("Confirmar vínculo"));
async function escape() { await act(async () => { for (const f of teclas) f({ key: "Escape", stopPropagation() {} } as unknown as KeyboardEvent); }); }
beforeEach(async () => {
  vi.clearAllMocks(); teclas.clear(); vincular.mockResolvedValue({ ok: true });
  const d = criarDomMinimo(); documento = d.documento; pagina = d.documento.body;
  Object.assign(documento, { addEventListener(tipo: string, f: (e: KeyboardEvent) => void) { if (tipo === "keydown") teclas.add(f); }, removeEventListener(tipo: string, f: (e: KeyboardEvent) => void) { if (tipo === "keydown") teclas.delete(f); } });
  vi.stubGlobal("document", documento); vi.stubGlobal("window", d.janela); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  host = documento.createElement("div"); pagina.appendChild(host);
  const { createRoot } = await import("react-dom/client"); root = createRoot(host as unknown as HTMLElement);
});
afterEach(async () => { await act(async () => root.unmount()); desligarObservadores(); vi.unstubAllGlobals(); });
it("D18 informa reaproveitamento, encurta apenas o botão e codifica só Pessoa na URL", () => {
  const t = renderToStaticMarkup(createElement(ClienteVoltou, props()));
  expect(t).toContain("Fernanda já é cliente e voltou a escrever. A oportunidade Francês A1 · Semestral foi ganha.");
  expect(t).toContain("Vincular a Francês A1"); expect(t).toContain('href="/funil?nova=p%2F8"'); expect(t).not.toContain("novo interesse");
});
it("telefone/veto impede vínculo sem esconder histórico; criação tem alçada separada", async () => {
  await render({ dado: { ...props().dado, podeVincular: false, situacao: "perdida" }, podeCriar: false });
  expect(host.textContent).toContain("foi perdida."); expect(host.querySelector("button")).toBeNull(); expect(host.querySelector("a")).toBeNull(); expect(vincular).not.toHaveBeenCalled();
});
it("primeiro clique abre ConfirmarAcao real descrito, com foco no botão seguro e sem executar", async () => {
  await render(); const gatilho = botao("Vincular a Francês A1"); gatilho.focus(); await abrir();
  const dialogo = pagina.querySelector('[role="alertdialog"]')!;
  expect(dialogo).toBeTruthy(); expect(dialogo.getAttribute("aria-describedby")).toBeTruthy();
  expect(dialogo.textContent).toContain("Francês A1 · Semestral"); expect(dialogo.textContent).toContain("Desvincular");
  expect(documento.activeElement).toBe(botao("Voltar")); expect(host.inert).toBe(true); expect(vincular).not.toHaveBeenCalled();
});
it.each(["Voltar", "Escape"])("cancelar por %s fecha confirmação sem ação e devolve foco", async modo => {
  await render(); const gatilho = botao("Vincular a Francês A1"); gatilho.focus(); await abrir();
  if (modo === "Escape") await escape(); else await act(async () => clicar("Voltar"));
  expect(pagina.querySelector('[role="alertdialog"]')).toBeNull(); expect(vincular).not.toHaveBeenCalled(); expect(mudar).not.toHaveBeenCalled(); expect(documento.activeElement).toBe(gatilho); expect(host.inert).toBe(false);
});
it("duplo clique na confirmação executa uma vez com IDs exatos e só ACK ok recarrega", async () => {
  let resolver!: (r: { ok: true }) => void; vincular.mockImplementation(() => new Promise(r => resolver = r));
  await render(); await abrir(); expect(vincular).not.toHaveBeenCalled();
  await act(async () => { clicar("Confirmar vínculo"); clicar("Confirmar vínculo"); });
  expect(vincular).toHaveBeenCalledExactlyOnceWith({ contatoId: "ct", atendimentoId: "a", alvo: { tipo: "lead", id: "op" } });
  expect(botao("Confirmando…").getAttribute("disabled")).not.toBeNull(); expect(botao("Voltar").getAttribute("disabled")).not.toBeNull(); expect(mudar).not.toHaveBeenCalled();
  await act(async () => clicar("Voltar")); await escape(); expect(pagina.querySelector('[role="alertdialog"]')).not.toBeNull();
  await act(async () => resolver({ ok: true })); expect(mudar).toHaveBeenCalledOnce(); expect(pagina.querySelector('[role="alertdialog"]')).toBeNull();
});
it.each(["negocio", "transporte"])("erro %s permanece no diálogo real sem retry automático ou recarga", async tipo => {
  if (tipo === "negocio") vincular.mockResolvedValue({ ok: false, erro: "Contato já ligado." }); else vincular.mockRejectedValue(Error("offline"));
  await render(); await abrir(); await confirmar();
  const dialogo = pagina.querySelector('[role="alertdialog"]')!; expect(dialogo).toBeTruthy();
  expect(dialogo.textContent).toContain(tipo === "negocio" ? "Contato já ligado." : "Resultado não confirmado.");
  expect(mudar).not.toHaveBeenCalled(); expect(vincular).toHaveBeenCalledOnce(); expect(dialogo.textContent).not.toContain("Reenvie");
});
it.each(["atendimento", "oportunidade", "contato", "pessoa", "permissao", "ida-volta"])("ACK antigo não reconcilia sessão %s após confirmação", async troca => {
  let resolver!: (r: { ok: true }) => void; vincular.mockImplementation(() => new Promise(r => resolver = r));
  await render(); await abrir(); await confirmar();
  const novo: Partial<Props> = troca === "atendimento" || troca === "ida-volta" ? { atendimentoId: "b" } : troca === "pessoa" ? { pessoaId: "p2" } : { dado: { ...props().dado, ...(troca === "oportunidade" ? { oportunidadeId: "op2" } : troca === "contato" ? { contatoId: "ct2" } : { podeVincular: false }) } };
  await render(novo); if (troca === "ida-volta") await render();
  expect(pagina.querySelector('[role="alertdialog"]')).toBeNull();
  await act(async () => resolver({ ok: true })); expect(mudar).not.toHaveBeenCalled();
});

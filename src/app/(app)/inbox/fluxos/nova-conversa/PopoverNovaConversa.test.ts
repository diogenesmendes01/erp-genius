import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PopoverNovaConversa } from "./PopoverNovaConversa";
import type { OpcoesAtendimento } from "@/server/whatsapp/operacoes-atendimento";
vi.mock("@/server/whatsapp/operacoes-atendimento", () => ({ abrirAtendimentoInstitucional: vi.fn() }));
const destino = { chave: "SECRETARIA:a", nome: "Secretaria · Ana", finalidade: "SECRETARIA", alunoId: "a" } as OpcoesAtendimento["destinos"][number];
const painel = (opcoes: OpcoesAtendimento) => renderToStaticMarkup(createElement(PopoverNovaConversa, { opcoes, itens: [], aoSelecionar() {}, aoFechar() {} }));
describe("portabilidade dos estados de abertura existentes #361", () => {
 it("vendedor sem lead mantém orientação de carteira sem culpar o canal", () => {
  const html = painel({ destinos: [], numeros: [], comercial: true }); expect(html).toContain("Nenhum lead na sua carteira"); expect(html).not.toContain("disponibilizar um canal");
 });
 it("papel não comercial sem destinatário mantém mensagem de escopo", () => {
  const html = painel({ destinos: [], numeros: [], comercial: false }); expect(html).toContain("Nenhum destinatário no seu escopo"); expect(html).not.toContain("Nenhum lead"); expect(html).not.toContain("disponibilizar um canal");
 });
 it("destino autorizado sem canal orienta administração", () => {
  expect(painel({ destinos: [destino], numeros: [], comercial: false })).toContain("A administração precisa disponibilizar um canal ativo");
 });
 it("busca tem label vinculada e campo fluido de raio canônico", () => {
  const html = painel({ destinos: [destino], numeros: [], comercial: false }); expect(html).toMatch(/<label[^>]*for="[^"]+"/); expect(html).toContain('type="search"'); expect(html).toContain("Nome ou número com DDD"); expect(html).toContain("w-full rounded-md border border-gray-200");
 });
 it("destino indisponível mantém impedimento e botão desabilitado", () => {
  const html = painel({ destinos: [{ ...destino, disponivel: false, impedimento: "Destinatário indisponível" }], numeros: [], comercial: false }); expect(html).toContain("Destinatário indisponível"); expect(html).toContain('disabled=""');
 });
 it("conteúdo não cria diálogo ou form envolvente que aninhe o compositor", () => {
  const html = painel({ destinos: [], numeros: [], comercial: false }); expect(html).not.toContain('role="dialog"'); expect(html).not.toContain("<form"); expect(html).not.toContain("Conversar com +");
 });
});

import { describe, expect, it } from "vitest";
import { buscarNovaConversa, canaisDoDestino } from "./busca-nova-conversa";
import type { ItemListaInbox } from "@/server/inbox/consultas-pagina";
import type { OpcoesAtendimento } from "@/server/whatsapp/operacoes-atendimento";
const conversa = (id: string, nome: string, telefone = "", em: string | null = null) => ({ id, contatoNome: nome, contatoTelefone: telefone, ultimaMensagemEm: em } as ItemListaInbox);
const destino = (chave: string, nome: string, finalidade = "COMERCIAL") => ({ chave, nome, finalidade } as OpcoesAtendimento["destinos"][number]);
describe("busca local da nova conversa #361", () => {
  it("sem termo limita oito conversas recentes e doze destinos sem alterar as entradas", () => {
    const conversas = Array.from({ length: 11 }, (_, i) => conversa(String(i), `Pessoa ${i}`, "", `2026-10-${String(i + 1).padStart(2, "0")}T12:00:00Z`));
    const destinos = Array.from({ length: 15 }, (_, i) => destino(String(i), `Destino ${i}`));
    const antes = conversas.map(c => c.id);
    const r = buscarNovaConversa("", conversas, destinos);
    expect(r.conversas.map(c => c.id)).toEqual(["10", "9", "8", "7", "6", "5", "4", "3"]);
    expect(r.destinos).toHaveLength(12); expect(conversas.map(c => c.id)).toEqual(antes);
  });
  it("nome ignora caixa e acentos em conversas e destinos", () => {
    const r = buscarNovaConversa("JOAO", [conversa("a", "João")], [destino("d", "Comercial · João")]);
    expect(r.conversas.map(c => c.id)).toEqual(["a"]); expect(r.destinos.map(d => d.chave)).toEqual(["d"]);
  });
  it("telefone procura apenas a partir de três dígitos já visíveis no DTO", () => {
    const itens = [conversa("visivel", "Ana", "+50688889999"), conversa("oculto", "Bia", "")];
    expect(buscarNovaConversa("88", itens, []).conversas).toEqual([]);
    expect(buscarNovaConversa("888", itens, []).conversas.map(c => c.id)).toEqual(["visivel"]);
  });
  it("número sem resultado é orientação, não ação D9 ou criação", () => {
    expect(buscarNovaConversa("+55 11 99999-0000", [], []).numeroSemContato).toBe(true);
    expect(buscarNovaConversa("Ana", [], []).numeroSemContato).toBe(false);
    expect(buscarNovaConversa("1234567890", [conversa("a", "Ana", "+1234567890")], []).numeroSemContato).toBe(false);
  });
  it("mantém destino indisponível com impedimento para informar sem autorizar", () => {
    const d = { ...destino("d", "Ana"), disponivel: false, impedimento: "Sem autorização atual" };
    expect(buscarNovaConversa("Ana", [], [d]).destinos).toEqual([d]);
  });
});
describe("canais do destino #361", () => {
  const numeros = [{ id: "v", nome: "Vendas", comercial: true }, { id: "s", nome: "Secretaria", comercial: false }];
  it("comercial só usa linhas já autorizadas pelo servidor", () => { expect(canaisDoDestino(destino("d", "Ana"), numeros)).toEqual([numeros[0]]); });
  it("demais finalidades mantêm canais históricos", () => { expect(canaisDoDestino(destino("s", "Ana", "SECRETARIA"), numeros)).toEqual(numeros); });
  it("nenhum destino não inventa um canal ou fallback comercial", () => { expect(canaisDoDestino(undefined, numeros)).toEqual([]); });
});

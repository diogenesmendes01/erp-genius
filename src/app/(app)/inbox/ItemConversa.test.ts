import { DriverWhatsApp } from "@prisma/client";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ItemListaInbox } from "@/server/inbox/consultas-pagina";
import { ItemConversa } from "./ItemConversa";

const agora = new Date("2026-10-22T13:00:00.000Z");
const base: ItemListaInbox = {
  id: "a1", numeroId: "n1", numeroRotulo: "Cobrança", finalidade: "FINANCEIRO", driver: DriverWhatsApp.META_CLOUD,
  contatoId: "c3", contatoNome: "Mariana Costa", contatoTelefone: "+5511999990000", optOut: false, vinculo: null,
  naoLidas: 0, ultimaMensagemEm: "2026-10-22T12:42:00.000Z", preview: "Perfeito. Quanto fica?", linhaComercial: false,
  status: "EM_ATENDIMENTO", responsavelNome: "Ana Lima", prazoRespostaEm: null, fixada: false, silenciada: false, grupo: false,
  responsavelId: "u1", numeroDonoId: null, setoresDoNumero: ["FINANCEIRO"], atendimentoOrigemId: null, capacidades: [],
};
const h = (o: Partial<ItemListaInbox> = {}, p: { selecionado?: boolean; usuarioId?: string; fuso?: string | null } = {}) =>
  renderToStaticMarkup(createElement(ItemConversa, {
    item: { ...base, ...o }, selecionado: false, agora, aoSelecionar() {}, usuarioId: "u1", fuso: "America/Sao_Paulo", ...p,
  }));
describe("ItemConversa", () => {
  it("avatar44 colorido, nome14/600, hora mono e prévia13, sem número/telefone", () => {
    const t = h();
    for (const c of ["bg-avatar-4", "h-11", "font-semibold", "font-mono", "text-[11.5px]", "text-[13px]", ">MC<", ">09:42<", "Perfeito. Quanto fica?"]) expect(t).toContain(c);
    expect(t).not.toContain("Cobrança"); expect(t).not.toContain("+5511999990000");
  });
  it("seleção neutra e aria-current, hover somente fora da seleção", () => {
    const t = h({}, { selecionado: true });
    expect(t).toContain('aria-current="true"'); expect(t).toContain("bg-gray-100"); expect(t).not.toContain("bg-brand-bg text-brand-800");
    expect(h()).toContain("hover:bg-surface-muted"); expect(h()).not.toContain('aria-current="true"');
  });
  it("contador da marca mono600, hora verde; zero sem contador/hora cinza", () => {
    expect(h({ naoLidas: 2 })).toMatch(/text-brand-700[^"]*">09:42</);
    expect(h({ naoLidas: 2 })).toMatch(/<span class="[^"]*bg-brand-solid[^"]*font-mono[^"]*text-on-brand[^"]*">2<\/span>/);
    expect(h()).toMatch(/text-gray-400[^"]*">09:42</); expect(h()).not.toContain("min-w-5");
  });
  it("fixada e silenciada são ícones rotulados; ausentes não renderizam", () => {
    const t = h({ fixada: true, silenciada: true });
    expect(t).toContain('aria-label="Fixada"'); expect(t).toContain('aria-label="Silenciada"');
    expect(h()).not.toContain('aria-label="Fixada"'); expect(h()).not.toContain('aria-label="Silenciada"');
  });
  it("badges consomem estado309: responsável/setor/prazo com relógio", () => {
    const t = h({ prazoRespostaEm: "2026-10-22T12:12:00.000Z" });
    for (const c of ["Com você", "Financeiro", "Prazo estourado · 48 min", "bg-red-50", 'data-testid="icone-prazo"']) expect(t).toContain(c);
    expect(h({}, { usuarioId: "outra" })).toContain("Com Ana");
  });
  it("sem nome/fila tracejados e ícone, encerrado sem prazo", () => {
    const t = h({ contatoNome: "😀", responsavelId: null, status: "ABERTO_SEM_RESPONSAVEL" });
    expect(t).toContain(">#<"); expect(t).toContain("Sem nome"); expect(t).toContain('data-testid="icone-sem-nome"'); expect(t).toContain("Na fila"); expect(t).toContain("border-dashed");
    const encerrado = h({ status: "ENCERRADO", prazoRespostaEm: "2026-10-22T12:12:00.000Z" });
    expect(encerrado).toContain("Encerrado"); expect(encerrado).not.toContain("Prazo estourado");
  });
  it("grupo é contrato de render: ícone44 neutro e nenhum badge", () => {
    const t = h({ grupo: true, prazoRespostaEm: "2026-10-22T12:12:00.000Z" });
    expect(t).toContain('data-testid="icone-grupo"'); expect(t).toContain("h-11 w-11"); expect(t).toContain("bg-gray-100 text-gray-600");
    for (const c of ["Com você", "Financeiro", "Prazo estourado", "rounded-[6px]"]) expect(t).not.toContain(c);
  });
  it("fuso pessoal, ausência de instante e iniciais Unicode ficam nos produtores", () => {
    expect(h({}, { fuso: "America/Costa_Rica" })).toContain(">06:42<");
    expect(h({ ultimaMensagemEm: null, preview: null, contatoNome: "ßeta Anna" })).toContain(">SA<");
    expect(h({ ultimaMensagemEm: null })).not.toContain(">09:42<");
  });
});

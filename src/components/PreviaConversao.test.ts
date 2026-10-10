import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PreviaConversao, nomeDoFuso, textoPreviaConversao } from "./PreviaConversao";

// docs/43 §6 item 6: nenhuma tela mostrava a conversão antes do envio ("isso será 14:00 em São Paulo").
describe("PreviaConversao", () => {
  it("mostra em que horário o que foi digitado aparece no fuso de exibição", () => {
    expect(textoPreviaConversao("2026-09-22T11:00", "America/Costa_Rica", "America/Sao_Paulo"))
      .toBe("Isso será 22/09/2026, 14:00 em São Paulo (America/Sao_Paulo), o fuso em que a tela exibe os horários.");
  });

  it("a prévia muda com o fuso digitado (e com o de exibição)", () => {
    const local = "2026-09-22T11:00:00.000";
    expect(textoPreviaConversao(local, "America/Costa_Rica", "America/Sao_Paulo")).toContain("22/09/2026, 14:00 em São Paulo");
    expect(textoPreviaConversao(local, "America/Manaus", "America/Sao_Paulo")).toContain("22/09/2026, 12:00 em São Paulo");
    expect(textoPreviaConversao(local, "America/Sao_Paulo", "America/Costa_Rica")).toContain("22/09/2026, 08:00 em Costa Rica");
  });

  it("sem o que mostrar: mesmo fuso, horário incompleto, fuso não reconhecido (o CampoFuso acusa) ou data impossível", () => {
    expect(textoPreviaConversao("2026-09-22T11:00", "America/Sao_Paulo", "America/Sao_Paulo")).toBeNull();
    expect(textoPreviaConversao(" 2026-09-22T11:00", "America/Sao_Paulo", " America/Sao_Paulo ")).toBeNull();
    expect(textoPreviaConversao("", "America/Costa_Rica", "America/Sao_Paulo")).toBeNull();
    expect(textoPreviaConversao("2026-09-22", "America/Costa_Rica", "America/Sao_Paulo")).toBeNull();
    expect(textoPreviaConversao("2026-09-22T11:00", "America/Sao Paulo", "America/Sao_Paulo")).toBeNull();
    expect(textoPreviaConversao("2026-09-22T11:00", "", "America/Sao_Paulo")).toBeNull();
    expect(textoPreviaConversao("2026-02-30T11:00", "America/Costa_Rica", "America/Sao_Paulo")).toBeNull();
  });

  it("horário que não existe na mudança de horário de verão: avisa em vez de escolher um instante em silêncio", () => {
    expect(textoPreviaConversao("2026-03-08T02:30", "America/New_York", "America/Sao_Paulo")).toBe("Esse horário não existe ou se repete em New York por causa da mudança de horário; escolha outro antes de enviar.");
  });

  it("nome do fuso com acento para os operados; os demais saem do identificador", () => {
    expect(nomeDoFuso("America/Sao_Paulo")).toBe("São Paulo");
    expect(nomeDoFuso("America/Rio_Branco")).toBe("Rio Branco");
    expect(nomeDoFuso("Europe/Lisbon")).toBe("Lisbon");
    expect(nomeDoFuso("UTC")).toBe("UTC");
  });

  it("componente: um parágrafo com o texto, ou nada", () => {
    expect(renderToStaticMarkup(createElement(PreviaConversao, { local: "2026-09-22T11:00", fuso: "America/Costa_Rica", fusoExibicao: "America/Sao_Paulo" })))
      .toBe('<p class="text-sm text-gray-600">Isso será 22/09/2026, 14:00 em São Paulo (America/Sao_Paulo), o fuso em que a tela exibe os horários.</p>');
    expect(renderToStaticMarkup(createElement(PreviaConversao, { local: "", fuso: "America/Costa_Rica", fusoExibicao: "America/Sao_Paulo" }))).toBe("");
  });
});

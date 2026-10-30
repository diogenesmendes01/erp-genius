import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HORAS, MINUTOS } from "@/components/ui/datas";
import { CampoDataHoraLocal } from "@/components/CampoDataHoraLocal";
import { DateTimePicker, mensagemRestricaoDataHora } from "@/components/ui/date-time-picker";

const html = (no: ReactNode) => renderToStaticMarkup(no);
const inputs = (marcacao: string) => [...marcacao.matchAll(/<input\b[^>]*>/g)].map((m) => m[0]);

function formularioDe(marcacao: string) {
  const dados = new FormData();
  for (const tag of inputs(marcacao)) {
    if (/\sdisabled(?:=|\s|>)/.test(tag)) continue;
    const type = /\stype="([^"]*)"/.exec(tag)?.[1] ?? "text";
    if (type === "submit" || type === "button" || type === "reset" || type === "file") continue;
    const name = /\sname="([^"]*)"/.exec(tag)?.[1];
    if (!name) continue;
    dados.append(name, /\svalue="([^"]*)"/.exec(tag)?.[1] ?? "");
  }
  return dados;
}

describe("DateTimePicker — contrato do valor submetido", () => {
  it("emite input hidden no formato YYYY-MM-DDTHH:mm com o mesmo name e data-fuso", () => {
    const marcacao = html(createElement(DateTimePicker, { name: "quando", value: "2026-12-01T13:05", fuso: "America/Sao_Paulo" }));
    expect(marcacao).not.toContain("datetime-local");
    expect(marcacao).not.toMatch(/<select\b/);
    const campo = inputs(marcacao).find((tag) => /name="quando"/.test(tag));
    expect(campo).toContain('type="hidden"');
    expect(campo).toContain('value="2026-12-01T13:05"');
    expect(campo).toContain('data-fuso="America/Sao_Paulo"');
    expect(formularioDe(marcacao).get("quando")).toBe("2026-12-01T13:05");
  });

  it("valor vazio submete string vazia e o campo desabilitado fica fora do FormData", () => {
    const vazio = html(createElement(DateTimePicker, { name: "quando", value: "", fuso: "UTC" }));
    expect(formularioDe(vazio).get("quando")).toBe("");
    const desligado = html(createElement(DateTimePicker, { name: "quando", value: "2026-12-01T13:05", disabled: true }));
    expect(formularioDe(desligado).has("quando")).toBe(false);
  });

  it("estado inválido pinta a borda do gatilho e anuncia aria-invalid e aria-required nele", () => {
    const marcacao = html(createElement(DateTimePicker, { name: "quando", id: "quando", value: "2026-12-01T13:05", "aria-invalid": true, "aria-required": true }));
    const botao = /<button\b[^>]*>/.exec(marcacao)?.[0] ?? "";
    expect(botao).toContain('id="quando"');
    expect(botao).toContain("border-red-500");
    expect(botao).toContain('aria-invalid="true"');
    expect(botao).toContain('aria-required="true"');
  });

  it("espelho sem name não é datetime-local, fica fora do Tab e da árvore, e o valor sai só no hidden", () => {
    const marcacao = html(createElement(DateTimePicker, { name: "quando", required: true, value: "", "aria-describedby": "dica", fuso: "UTC" }));
    const todos = inputs(marcacao);
    const nomeado = todos.find((tag) => /name="quando"/.test(tag));
    const espelho = todos.find((tag) => !/\sname=/.test(tag));
    expect(espelho).toBeTruthy();
    expect(espelho).toContain('type="text"');
    expect(espelho).not.toContain("datetime-local");
    expect(espelho).toContain('tabindex="-1"');
    expect(espelho).toContain('aria-hidden="true"');
    expect(espelho).toMatch(/\srequired(?:=|\s|>)/);
    expect(espelho).not.toMatch(/\sname=/);
    expect(nomeado).toContain('type="hidden"');
    expect(nomeado).toContain('value=""');
    expect(formularioDe(marcacao).get("quando")).toBe("");
    expect([...formularioDe(marcacao).keys()]).toEqual(["quando"]);
    const botao = /<button\b[^>]*>/.exec(marcacao)?.[0] ?? "";
    expect(botao).toContain('aria-required="true"');
    expect(botao).not.toContain("aria-invalid");
    expect(botao).not.toMatch(/(?:^|[\s"])border-red-500(?:[\s"])/);
    expect(/aria-describedby="([^"]*)"/.exec(botao)?.[1]).toBe("dica");
    expect(marcacao).not.toContain('role="alert"');
    expect(marcacao).not.toContain("Informe data e hora.");
  });

  it("valor com milissegundos, required e step 0.001 não gera alerta", () => {
    const marcacao = html(createElement(DateTimePicker, { name: "realizadaEm", required: true, step: "0.001", value: "2026-10-01T02:30:00.000" }));
    expect(marcacao).toContain('value="2026-10-01T02:30:00.000"');
    expect(marcacao).toContain('step="0.001"');
    expect(marcacao).not.toContain("Informe data e hora.");
    expect(marcacao).not.toContain('role="alert"');
    expect(marcacao).not.toContain("aria-invalid");
  });

  it("required vazio não valida pelo hidden: um espelho sem name carrega a restrição e não entra no FormData", () => {
    const marcacao = html(createElement(DateTimePicker, { name: "quando", required: true, value: "", fuso: "UTC" }));
    const todos = inputs(marcacao);
    const nomeado = todos.find((tag) => /name="quando"/.test(tag));
    expect(nomeado).toContain('type="hidden"');
    expect(nomeado).toContain('value=""');
    const espelho = todos.find((tag) => !/\sname=/.test(tag) && /\srequired(?:=|\s|>)/.test(tag));
    expect(espelho).toBeTruthy();
    expect(espelho).not.toContain("datetime-local");
    expect(espelho).not.toContain('type="hidden"');
    expect(formularioDe(marcacao).get("quando")).toBe("");
    expect([...formularioDe(marcacao).keys()]).toEqual(["quando"]);
  });
});

describe("mensagemRestricaoDataHora", () => {
  it("obrigatório vazio pede data e hora; preenchido no formato local passa", () => {
    expect(mensagemRestricaoDataHora("", { required: true })).toBe("Informe data e hora.");
    expect(mensagemRestricaoDataHora("2026-12-01T13:05", { required: true })).toBe("");
  });

  it("min e max comparam o texto local sem mudar o formato", () => {
    expect(mensagemRestricaoDataHora("2026-12-01T09:00", { min: "2026-12-01T10:00" })).toBe("Informe um horário igual ou posterior ao mínimo.");
    expect(mensagemRestricaoDataHora("2026-12-01T10:00", { min: "2026-12-01T10:00" })).toBe("");
    expect(mensagemRestricaoDataHora("2026-12-01T12:00", { max: "2026-12-01T11:00" })).toBe("Informe um horário igual ou anterior ao máximo.");
    expect(mensagemRestricaoDataHora("", {})).toBe("");
  });

  it("aceita HH:mm quando o step é o de minutos e rejeita segundos", () => {
    expect(mensagemRestricaoDataHora("2026-12-01T13:05", { required: true })).toBe("");
    expect(mensagemRestricaoDataHora("2026-12-01T13:05", { required: true, step: 60 })).toBe("");
    expect(mensagemRestricaoDataHora("2026-12-01T13:05", { required: true, step: "60" })).toBe("");
    expect(mensagemRestricaoDataHora("2026-12-01T13:05:07", { required: true })).toBe("Informe data e hora.");
    expect(mensagemRestricaoDataHora("2026-12-01T13:05:00", { required: true })).toBe("Informe data e hora.");
    expect(mensagemRestricaoDataHora("2026-12-01T13:05:00", { required: true, step: 60 })).toBe("Informe data e hora.");
    expect(mensagemRestricaoDataHora("2026-12-01T13:05:07.123", { required: true, step: "60" })).toBe("Informe data e hora.");
  });

  it("aceita HH:mm:ss quando o step permite segundos", () => {
    expect(mensagemRestricaoDataHora("2026-12-01T13:05:07", { required: true, step: 1 })).toBe("");
    expect(mensagemRestricaoDataHora("2026-12-01T13:05:07", { required: true, step: "1" })).toBe("");
    expect(mensagemRestricaoDataHora("2026-12-01T13:05", { required: true, step: "1" })).toBe("");
    expect(mensagemRestricaoDataHora("2026-12-01T13:05:07.123", { required: true, step: "1" })).toBe("Informe data e hora.");
  });

  it("aceita YYYY-MM-DDTHH:mm:ss.SSS quando o step permite milissegundos", () => {
    expect(mensagemRestricaoDataHora("2026-12-01T13:05:07.123", { required: true, step: 0.001 })).toBe("");
    expect(mensagemRestricaoDataHora("2026-10-01T02:30:00.000", { required: true, step: "0.001" })).toBe("");
    expect(mensagemRestricaoDataHora("2026-12-01T13:05:07", { required: true, step: "0.001" })).toBe("");
    expect(mensagemRestricaoDataHora("2026-12-01T13:05", { required: true, step: "0.001" })).toBe("");
  });

  it("continua rejeitando horário fora de min e max, mesmo com segundos ou milissegundos", () => {
    expect(mensagemRestricaoDataHora("2026-12-01T09:59:59.999", { step: "0.001", min: "2026-12-01T10:00" })).toBe("Informe um horário igual ou posterior ao mínimo.");
    expect(mensagemRestricaoDataHora("2026-12-01T10:00:00.000", { step: "0.001", min: "2026-12-01T10:00", max: "2026-12-01T11:00" })).toBe("");
    expect(mensagemRestricaoDataHora("2026-12-01T11:00:00.001", { step: "0.001", max: "2026-12-01T11:00" })).toBe("Informe um horário igual ou anterior ao máximo.");
    expect(mensagemRestricaoDataHora("2026-12-01T10:00:01", { step: "1", max: "2026-12-01T10:00" })).toBe("Informe um horário igual ou anterior ao máximo.");
    expect(mensagemRestricaoDataHora("2026-12-01T10:00:00", { step: "1", min: "2026-12-01T10:00", max: "2026-12-01T10:00" })).toBe("");
  });
});

describe("CampoDataHoraLocal", () => {
  it("submete hidden no formato local, anuncia o fuso e não usa datetime-local nem select", () => {
    const marcacao = html(createElement(CampoDataHoraLocal, { name: "experimental", value: "2026-04-03T18:45", fuso: "America/Costa_Rica", nomeFuso: "fuso" }));
    expect(marcacao).not.toContain("datetime-local");
    expect(marcacao).not.toMatch(/<select\b/);
    expect(marcacao).toContain("Horário em America/Costa_Rica.");
    const dados = formularioDe(marcacao);
    expect(dados.get("experimental")).toBe("2026-04-03T18:45");
    expect(dados.get("fuso")).toBe("America/Costa_Rica");
    expect(marcacao).toContain('data-fuso="America/Costa_Rica"');
  });
});

describe("listas de hora e minuto", () => {
  it("cobre 00–23 e cada minuto", () => {
    expect(HORAS).toEqual(Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0")));
    expect(MINUTOS).toEqual(Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0")));
  });
});

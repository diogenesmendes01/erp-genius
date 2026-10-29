// @vitest-environment jsdom
import { createElement, useState } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { CapacidadeCrm } from "@/server/crm/permissoes";
import type { DetalheOportunidade } from "@/server/crm/historico";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {}, push: () => {} }) }));
const acoes = vi.hoisted(() => ({ enviarProposta: vi.fn(), agendarExperimental: vi.fn() }));
vi.mock("@/server/comercial/acoes", () => ({
  atribuirDono: vi.fn(), definirTemperatura: vi.fn(), agendarExperimental: acoes.agendarExperimental,
  enviarProposta: acoes.enviarProposta, registrarNotaInterna: vi.fn(), marcarPerdido: vi.fn(),
  atribuirProfessorExperimental: vi.fn(), confirmarPresencaExperimental: vi.fn(), moverEtapa: vi.fn(),
  atualizarResumo: vi.fn(), atualizarDatas: vi.fn(), editarLead: vi.fn(), registrarInteracao: vi.fn(),
  anexarDocumentoLead: vi.fn(), arquivarDocumentoLead: vi.fn(),
}));
vi.mock("@/server/matricula/acoes", () => ({ registrarLinkPagamento: vi.fn() }));
vi.mock("@/server/inbox/acoes-fechamento-painel", () => ({
  definirPrevisaoOportunidade: vi.fn(), criarTarefaOportunidade: vi.fn(), concluirTarefaOportunidade: vi.fn(), reabrirTarefaOportunidade: vi.fn(),
}));

import { PainelOportunidade } from "./PainelOportunidade";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const GERENTE: CapacidadeCrm[] = ["funil.ver", "funil.mover", "funil.atribuir"];
const base: DetalheOportunidade = {
  id: "op1", codigo: "L-000001", nome: "Maria Souza", b2b: false, etapa: "QUALIFICADO", temperatura: "MORNO",
  probabilidadePct: null, previsaoFechamento: null,
  valorPrevisto: "85000.00", moeda: "CRC", pais: "Costa Rica", dono: { id: "v1", nome: "Ana Vendedora" },
  proximaAcao: "Ligar", proximoFollowUp: null, dataExperimental: null, motivoPerda: null,
  criadoEm: new Date("2026-10-01T12:00:00Z"), pessoaId: "p1", interesse: null, objetivo: null,
  urgencia: null, orcamento: null, objecao: null, taxaMatricula: null,
  telefoneE164: "+50688887777", paisId: "cr", segmento: "ADULTO", origemCampanha: null, origemConjunto: null,
  origemAnuncio: null, origemPalavra: null, planoPrevisto: null, comissaoPrevista: null, dataProposta: null,
  professorExperimental: null, experimentalConfirmadaEm: null,
  documentos: [], b2bDetalhes: null, tarefas: [],
};
const realizada: DetalheOportunidade = {
  ...base, etapa: "EXPERIMENTAL_REALIZADA", dataExperimental: new Date("2026-10-20T18:00:00Z"),
  professorExperimental: { id: "prof1", nome: "Clara" },
};

beforeAll(() => {
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
  }
  for (const proto of [Element.prototype, HTMLElement.prototype]) {
    const alvo = proto as Element & { scrollIntoView?: () => void; hasPointerCapture?: () => boolean; setPointerCapture?: () => void; releasePointerCapture?: () => void };
    alvo.scrollIntoView ??= () => {};
    alvo.hasPointerCapture ??= () => false;
    alvo.setPointerCapture ??= () => {};
    alvo.releasePointerCapture ??= () => {};
  }
});

afterEach(() => { cleanup(); });

function Cenario({ oportunidade = base, aoFechar = () => {} }: { oportunidade?: DetalheOportunidade; aoFechar?: () => void }) {
  const [aberto, setAberto] = useState(false);
  return createElement("div", null,
    createElement("button", { type: "button", onClick: () => setAberto(true) }, "Cartão Maria Souza"),
    aberto ? createElement(PainelOportunidade, {
      oportunidade, historico: [], capacidades: GERENTE,
      vendedores: [{ id: "v1", nome: "Ana Vendedora" }, { id: "v2", nome: "Beto" }],
      professores: [{ id: "prof1", nome: "Clara" }, { id: "prof2", nome: "Diego" }],
      aoFechar: () => { setAberto(false); aoFechar(); },
    }) : null,
  );
}

async function abrirPainel() {
  const user = userEvent.setup();
  const view = render(createElement(Cenario));
  const cartao = screen.getByRole("button", { name: "Cartão Maria Souza" });
  await user.click(cartao);
  const sheet = await screen.findByRole("dialog", { name: "Maria Souza" });
  return { user, view, sheet, cartao };
}

function sheetAberto() {
  return screen.getByRole("dialog", { name: "Maria Souza" });
}

describe("PainelOportunidade como Sheet", () => {
  it("abre em portal Radix com data-state=open, título e descrição só para leitor de tela", async () => {
    const { view, sheet } = await abrirPainel();
    expect(sheet.getAttribute("data-state")).toBe("open");
    expect(view.container.contains(sheet)).toBe(false);
    expect(document.body.contains(sheet)).toBe(true);
    expect(sheet.querySelector("h2")?.textContent).toBe("Maria Souza");
    const descricao = document.getElementById(sheet.getAttribute("aria-describedby") ?? "");
    expect(descricao?.textContent).toBe("Detalhes e ações da oportunidade.");
    expect(descricao?.className).toContain("sr-only");
    expect(sheet.className).toContain("w-full");
    expect(sheet.className).toContain("max-w-none");
    expect(sheet.className).toContain("md:w-[45%]");
  });

  it("Esc no combobox fecha só o popover; o segundo Esc fecha o Sheet e devolve o foco ao cartão", async () => {
    const { user, cartao } = await abrirPainel();
    await user.click(screen.getByRole("button", { name: "Responsável" }));
    expect(await screen.findByPlaceholderText("Buscar responsável")).toBeTruthy();
    expect(sheetAberto().getAttribute("data-state")).toBe("open");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByPlaceholderText("Buscar responsável")).toBeNull());
    expect(sheetAberto().getAttribute("data-state")).toBe("open");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Maria Souza" })).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(cartao));
  });

  it("pointerdown fora do combobox e dentro do Sheet fecha só o popover", async () => {
    const { user } = await abrirPainel();
    await user.click(screen.getByRole("button", { name: "Responsável" }));
    await screen.findByPlaceholderText("Buscar responsável");
    await actFlush();
    const corpo = screen.getAllByText("Maria Souza").find((el) => el.tagName === "P");
    await user.pointer({ keys: "[MouseLeft]", target: corpo! });
    await waitFor(() => expect(screen.queryByPlaceholderText("Buscar responsável")).toBeNull());
    expect(sheetAberto().getAttribute("data-state")).toBe("open");
  });

  async function abrirPickerComHora() {
    const aberto = await abrirPainel();
    await aberto.user.click(screen.getByRole("button", { name: /Data e hora da experimental/ }));
    await aberto.user.click(await screen.findByRole("button", { name: /15 de outubro de 2026/ }));
    const hora = screen.getByRole("combobox", { name: "Hora" });
    const minuto = screen.getByRole("combobox", { name: "Minuto" });
    expect(hora.hasAttribute("disabled")).toBe(false);
    expect(minuto.hasAttribute("disabled")).toBe(false);
    await aberto.user.click(hora);
    expect(await screen.findByRole("listbox")).toBeTruthy();
    expect(screen.getByRole("option", { name: "13" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Minuto", hidden: true })).toBeTruthy();
    return aberto;
  }

  it("Esc com o popover e os selects de hora e minuto abertos fecha só o picker; o segundo Esc fecha o Sheet", async () => {
    const { user, cartao } = await abrirPickerComHora();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
    await waitFor(() => expect(screen.queryByRole("combobox", { name: "Hora" })).toBeNull());
    expect(screen.queryByRole("combobox", { name: "Minuto" })).toBeNull();
    expect(sheetAberto().getAttribute("data-state")).toBe("open");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Maria Souza" })).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(cartao));
  });

  it("clique fora com o select de hora aberto fecha só o picker; o segundo Esc fecha o Sheet", async () => {
    const { user, cartao } = await abrirPickerComHora();
    await actFlush();
    const velo = document.body.querySelector(":scope > .fixed.inset-0");
    expect(velo).toBeTruthy();
    await user.pointer({ keys: "[MouseLeft]", target: velo! });
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
    await waitFor(() => expect(screen.queryByRole("combobox", { name: "Hora" })).toBeNull());
    expect(sheetAberto().getAttribute("data-state")).toBe("open");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Maria Souza" })).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(cartao));
  });

  it("Esc e pointerdown no date picker e no select de hora não fecham o Sheet", async () => {
    const { user } = await abrirPainel();
    await user.click(screen.getByRole("button", { name: /Data e hora da experimental/ }));
    expect(await screen.findByRole("combobox", { name: "Hora" })).toBeTruthy();
    await user.pointer({ keys: "[MouseLeft]", target: screen.getByRole("combobox", { name: "Hora" }) });
    expect(sheetAberto().getAttribute("data-state")).toBe("open");
    expect(screen.getByRole("combobox", { name: "Hora" })).toBeTruthy();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("combobox", { name: "Hora" })).toBeNull());
    expect(sheetAberto().getAttribute("data-state")).toBe("open");
    await user.click(screen.getByRole("button", { name: /Data e hora da experimental/ }));
    await screen.findByRole("combobox", { name: "Hora" });
    await actFlush();
    const corpo = screen.getAllByText("Maria Souza").find((el) => el.tagName === "P");
    await user.pointer({ keys: "[MouseLeft]", target: corpo! });
    await waitFor(() => expect(screen.queryByRole("combobox", { name: "Hora" })).toBeNull());
    expect(sheetAberto().getAttribute("data-state")).toBe("open");
  });

  it("experimental realizada fica colapsada e o professor continua no Combobox", async () => {
    render(createElement(Cenario, { oportunidade: realizada }));
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Cartão Maria Souza" }));
    const sheet = await screen.findByRole("dialog", { name: "Maria Souza" });
    expect(sheet.textContent).toContain("Realizada");
    const gatilho = screen.getByRole("button", { name: "Reagendar / Alterar professor" });
    expect(gatilho.getAttribute("data-state")).toBe("closed");
    expect(screen.getByRole("button", { name: "Professor da experimental" })).toBeTruthy();
  });

  it("Enviar proposta continua chamando a ação do funil", async () => {
    acoes.enviarProposta.mockResolvedValue({ ok: true });
    render(createElement(Cenario));
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Cartão Maria Souza" }));
    await screen.findByRole("dialog", { name: "Maria Souza" });
    await user.click(screen.getByRole("button", { name: "Enviar proposta" }));
    await waitFor(() => expect(acoes.enviarProposta).toHaveBeenCalledWith("op1"));
  });
});

async function actFlush() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("painel aberto no DOM", () => {
  it("mostra título, descrição só para leitor de tela e rodapé, sem space-y, focus:ring, z-index arbitrário ou sombra solta", async () => {
    const { sheet } = await abrirPainel();
    expect(sheet.getAttribute("role")).toBe("dialog");
    expect(sheet.querySelector("h2")?.textContent).toBe("Maria Souza");
    const descricao = document.getElementById(sheet.getAttribute("aria-describedby") ?? "");
    expect(descricao?.textContent).toBe("Detalhes e ações da oportunidade.");
    expect(descricao?.className.split(/\s+/)).toContain("sr-only");
    expect(screen.getByRole("button", { name: "Enviar proposta" })).toBeTruthy();
    expect(screen.queryByRole("dialog", { name: "Drawer" })).toBeNull();
    const classes = sheet.className;
    expect(classes).toContain("md:w-[45%]");
    expect(classes).toContain("max-w-none");
    expect(classes).not.toMatch(/space-[xy]-/);
    expect(classes).not.toMatch(/focus:ring/);
    expect(classes).not.toMatch(/\bz-\[\d/);
    expect(classes).not.toMatch(/\bshadow-(?:sm|md|lg)\b/);
  });
});

describe("agendamento da experimental preenchido", () => {
  it("C1: escolhe data, hora e minuto e envia o valor local com o fuso do campo", async () => {
    acoes.agendarExperimental.mockResolvedValue({ ok: true });
    const { user } = await abrirPainel();
    await user.click(screen.getByRole("button", { name: /Data e hora da experimental/ }));
    await user.click(await screen.findByRole("button", { name: /15 de outubro de 2026/ }));
    await user.click(screen.getByRole("combobox", { name: "Hora" }));
    await user.click(await screen.findByRole("option", { name: "13" }));
    await user.click(screen.getByRole("combobox", { name: "Minuto" }));
    await user.click(await screen.findByRole("option", { name: "05" }));
    await user.click(screen.getByRole("button", { name: "Agendar experimental" }));
    await waitFor(() => expect(acoes.agendarExperimental).toHaveBeenCalledWith("op1", {
      dataLocal: "2026-10-15T13:05",
      fuso: "America/Sao_Paulo",
    }));
    expect(screen.getAllByRole("status").map((el) => el.textContent)).toContain("Experimental agendada.");
  });
});

describe("DateTimePicker no Sheet — BLOCK-513-A11Y", () => {
  function Agenda() {
    const [valor, setValor] = useState("");
    return createElement(Sheet, { open: true },
      createElement(SheetContent, null,
        createElement(SheetHeader, null,
          createElement(SheetTitle, null, "Agendar experimental"),
          createElement(SheetDescription, null, "Data da aula."),
        ),
        createElement("form", { "aria-label": "Agenda da experimental" },
          createElement(DateTimePicker, {
            name: "quando",
            required: true,
            "aria-label": "Data e hora da experimental",
            value: valor,
            onChange: (evento: { target: { value: string } }) => setValor(evento.target.value),
          }),
          createElement("button", { type: "submit" }, "Salvar"),
        ),
      ),
    );
  }

  function oculto() {
    return document.querySelector('input[aria-hidden="true"]');
  }

  it("Tab não para no input oculto e ele fica fora da árvore de acessibilidade", async () => {
    const user = userEvent.setup();
    render(createElement(Agenda));
    const gatilho = await screen.findByRole("button", { name: "Data e hora da experimental" });
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(oculto()?.getAttribute("aria-hidden")).toBe("true");
    expect(oculto()?.getAttribute("tabindex")).toBe("-1");
    expect(oculto()?.hasAttribute("name")).toBe(false);
    gatilho.focus();
    await user.tab();
    expect(document.activeElement).not.toBe(oculto());
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Salvar" }));
    expect(screen.getByRole("dialog", { name: "Agendar experimental" }).getAttribute("data-state")).toBe("open");
  });

  it("render inicial de obrigatório vazio não mostra alerta, borda vermelha nem aria-invalid", async () => {
    render(createElement(Agenda));
    const gatilho = await screen.findByRole("button", { name: "Data e hora da experimental" });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(gatilho.hasAttribute("aria-invalid")).toBe(false);
    expect(gatilho.className.split(/\s+/)).not.toContain("border-red-500");
    expect(gatilho.getAttribute("aria-required")).toBe("true");
  });

  it("blur vazio mostra o erro no gatilho", async () => {
    const user = userEvent.setup();
    render(createElement(Agenda));
    const gatilho = await screen.findByRole("button", { name: "Data e hora da experimental" });
    expect(screen.queryByRole("alert")).toBeNull();
    gatilho.focus();
    await user.tab();
    const alerta = await screen.findByRole("alert");
    expect(alerta.textContent).toContain("Informe data e hora.");
    expect(gatilho.getAttribute("aria-invalid")).toBe("true");
    expect(gatilho.className.split(/\s+/)).toContain("border-red-500");
    expect(gatilho.getAttribute("aria-describedby")).toContain(alerta.id);
    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });

  it("submit vazio foca o trigger, mostra o erro uma vez e mantém o Sheet aberto", async () => {
    const user = userEvent.setup();
    render(createElement(Agenda));
    const gatilho = await screen.findByRole("button", { name: "Data e hora da experimental" });
    expect(screen.queryByRole("alert")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(document.activeElement).toBe(gatilho));
    expect(document.activeElement).not.toBe(oculto());
    expect(screen.getByRole("dialog", { name: "Agendar experimental" }).getAttribute("data-state")).toBe("open");
    const alertas = screen.getAllByRole("alert");
    expect(alertas).toHaveLength(1);
    expect(alertas[0].textContent).toContain("Informe data e hora.");
    expect(document.body.textContent?.match(/Informe data e hora\./g)).toHaveLength(1);
    expect(gatilho.getAttribute("aria-describedby")).toContain(alertas[0].id);
    expect(gatilho.getAttribute("aria-required")).toBe("true");
    expect(gatilho.getAttribute("aria-invalid")).toBe("true");
  });

  it("onFocus do espelho devolve o foco ao gatilho sem duplicar o alerta", async () => {
    const user = userEvent.setup();
    render(createElement(Agenda));
    const gatilho = await screen.findByRole("button", { name: "Data e hora da experimental" });
    gatilho.focus();
    await user.tab();
    const alerta = await screen.findByRole("alert");
    const espelho = oculto() as HTMLElement;
    espelho.focus();
    expect(document.activeElement).toBe(gatilho);
    expect(screen.getAllByRole("alert")).toEqual([alerta]);
  });

  it("Esc com o picker aberto fecha só o picker", async () => {
    const user = userEvent.setup();
    render(createElement(Agenda));
    await user.click(await screen.findByRole("button", { name: "Data e hora da experimental" }));
    expect(await screen.findByRole("combobox", { name: "Hora" })).toBeTruthy();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("combobox", { name: "Hora" })).toBeNull());
    expect(screen.getByRole("dialog", { name: "Agendar experimental" }).getAttribute("data-state")).toBe("open");
  });
});

// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { createElement, useState } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { CapacidadeCrm } from "@/server/crm/permissoes";
import type { DetalheOportunidade } from "@/server/crm/historico";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {}, push: () => {} }) }));
const acoes = vi.hoisted(() => ({ enviarProposta: vi.fn() }));
vi.mock("@/server/comercial/acoes", () => ({
  atribuirDono: vi.fn(), definirTemperatura: vi.fn(), agendarExperimental: vi.fn(),
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

describe("fonte do painel", () => {
  const fonte = readFileSync("src/app/(app)/funil/PainelOportunidade.tsx", "utf8");

  it("compõe Sheet Radix sem dismiss manual, z-index, space-y, focus:ring ou sombra solta", () => {
    expect(fonte).toContain('from "@/components/ui/sheet"');
    expect(fonte).toContain("SheetHeader");
    expect(fonte).toContain("SheetTitle");
    expect(fonte).toContain("SheetDescription");
    expect(fonte).toContain("SheetFooter");
    expect(fonte).toContain("onInteractOutside");
    expect(fonte).toContain("onPointerDownOutside");
    expect(fonte).toContain("[data-radix-popper-content-wrapper]");
    expect(fonte).toContain("[cmdk-root]");
    expect(fonte).toContain("[role='listbox']");
    expect(fonte).not.toContain("Drawer");
    expect(fonte).not.toContain("document.addEventListener");
    expect(fonte).not.toMatch(/space-[xy]-/);
    expect(fonte).not.toMatch(/\bz-\[?\d/);
    expect(fonte).not.toMatch(/focus:ring/);
    expect(fonte).not.toMatch(/\bshadow-(?:sm|md|lg)\b/);
    expect(fonte).not.toMatch(/className=\{`[^`]*\$\{/);
    expect(fonte).toContain("md:w-[45%]");
    expect(fonte).toContain("max-w-none");
    expect(fonte).toContain("sr-only");
  });
});

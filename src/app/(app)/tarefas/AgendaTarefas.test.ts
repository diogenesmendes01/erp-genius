import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {} }) }));
vi.mock("@/server/crm/tarefas-acoes", () => ({ reagendarTarefa: vi.fn(), reagendarMensagem: vi.fn() }));

import { AgendaTarefas, HORAS_DA_GRADE, lerSlot, slotDaHora } from "./AgendaTarefas";
import { CalendarioTarefas } from "./CalendarioTarefas";
import { diasDaSemana, diasDoMes, inicioDaSemana, intervaloDaVisao } from "./visao";
import type { ItemAgenda, TarefaLista } from "@/server/crm/mensagens-agendadas";

const FUSO = "America/Costa_Rica";
const tarefa = (id: string, dataCivil: string, inicioEm: string | null): ItemAgenda => ({
  tipo: "tarefa",
  tarefa: { id, titulo: `Tarefa ${id}`, tipo: "LIGACAO", status: "ABERTA", dataCivil, inicioEm: inicioEm ? new Date(inicioEm) : null, versao: 1, fusoOrigem: FUSO, responsavel: null } as unknown as TarefaLista,
});

const renderAgenda = (p: { visao: "dia" | "semana"; itens?: ItemAgenda[]; fusoExibicao?: string }) =>
  renderToStaticMarkup(createElement(AgendaTarefas, { visao: p.visao, data: "2026-10-17", hoje: "2026-10-17", itens: p.itens ?? [], fusoEscola: FUSO, fusoExibicao: p.fusoExibicao ?? FUSO, params: {} }));

describe("AgendaTarefas", () => {
  it("agenda: dia no celular; semana só a partir de 700 px", () => {
    const html = renderAgenda({ visao: "semana" });
    expect(html).toContain("hidden sm:grid");
    expect(html).toContain('aria-label="Dia exibido"');
  });

  it("a visão de dia não tem o seletor de dia nem a grade escondida", () => {
    const html = renderAgenda({ visao: "dia" });
    expect(html).not.toContain('aria-label="Dia exibido"');
    expect(html).not.toContain("hidden sm:grid");
  });

  it("tarefa com hora cai no slot de 30 min da hora da escola e tem alça e menu Reagendar", () => {
    const html = renderAgenda({ visao: "dia", itens: [tarefa("t1", "2026-10-17", "2026-10-17T16:45:00Z")] }); // 10:45 na escola
    expect(html).toContain("Arrastar tarefa Tarefa t1");
    expect(html).toContain("10:45");
    expect(slotDaHora("10:45")).toBe("10:30");
  });

  it("grade de 30 em 30 minutos das 06:00 às 21:30; ids de slot ida e volta", () => {
    expect(HORAS_DA_GRADE[0]).toBe("06:00");
    expect(HORAS_DA_GRADE.at(-1)).toBe("21:30");
    expect(HORAS_DA_GRADE).toHaveLength(32);
    expect(slotDaHora("05:10")).toBe("06:00");
    expect(slotDaHora("23:59")).toBe("21:30");
    expect(lerSlot("slot|2026-10-20|09:30")).toEqual({ data: "2026-10-20", hora: "09:30" });
    expect(lerSlot("slot|2026-10-20|")).toEqual({ data: "2026-10-20", hora: null });
    expect(lerSlot("coluna:NOVO")).toBeNull();
  });

  it("calendário do mês mostra a contagem e leva ao dia", () => {
    const html = renderToStaticMarkup(createElement(CalendarioTarefas, { data: "2026-10-17", hoje: "2026-10-17", fusoEscola: FUSO, params: {}, itens: [tarefa("a", "2026-10-20", null), tarefa("b", "2026-10-20", null)] }));
    expect(html).toContain("2 tarefas");
    expect(html).toContain("visao=dia&amp;data=2026-10-20");
  });

  it("datas da semana (segunda a domingo) e do mês", () => {
    expect(inicioDaSemana("2026-10-17")).toBe("2026-10-12");
    expect(diasDaSemana("2026-10-17")).toHaveLength(7);
    const mes = diasDoMes("2026-10-17");
    expect(mes[0]).toBe("2026-09-28");
    expect(mes.at(-1)).toBe("2026-11-01");
    expect(mes.length % 7).toBe(0);
    expect(intervaloDaVisao("semana", "2026-10-17", "2026-10-17")).toEqual({ de: "2026-10-12", ate: "2026-10-18" });
  });
});

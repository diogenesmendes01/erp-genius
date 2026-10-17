import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {} }) }));
vi.mock("@/server/crm/tarefas-acoes", () => ({ concluirTarefa: vi.fn() }));

import { ListaTarefas } from "./ListaTarefas";
import { acoesLote } from "./visao";
import type { ItemAgenda, TarefaLista } from "@/server/crm/mensagens-agendadas";

const AGORA = "2026-10-17T15:00:00.000Z"; // 09:00 em Costa Rica
const FUSO = "America/Costa_Rica";

const tarefa = (id: string, dataCivil: string | null, extra: Partial<TarefaLista> = {}): ItemAgenda => ({
  tipo: "tarefa",
  tarefa: {
    id, titulo: `Tarefa ${id}`, descricao: null, tipo: "LIGACAO", setor: "COMERCIAL", status: "ABERTA", prioridade: "NORMAL",
    dataCivil, inicioEm: null, duracaoMin: 30, fusoOrigem: FUSO, lembreteAntecedenciaMin: null, lembrarEm: null, lembreteDisparadoEm: null,
    responsavelId: "u1", criadorId: "u1", concluidaEm: null, concluidaPorId: null, resultado: null, canceladaEm: null, motivoCancelamento: null,
    leadId: null, pessoaId: null, alunoId: null, matriculaId: null, origem: "HUMANO", versao: 1, criadoEm: new Date(AGORA), atualizadoEm: new Date(AGORA),
    responsavel: { id: "u1", nome: "Ana" }, ...extra,
  } as TarefaLista,
});
const mensagem = (id: string, status: "ADIADA" | "PENDENTE" | "DESPACHADA", agendadaPara: string): ItemAgenda => ({
  tipo: "mensagem", id, texto: "Olá!", agendadaPara: new Date(agendadaPara), status, motivoFalha: null, nomeContato: "Bia",
});

const itens: ItemAgenda[] = [
  tarefa("a", "2026-10-15"), // atrasada
  tarefa("h", "2026-10-17"), // hoje
  tarefa("am", "2026-10-18"), // amanhã
  tarefa("p7", "2026-10-22"), // próximos 7 dias
  tarefa("d", "2026-12-01"), // mais adiante
  tarefa("s", null), // sem data
  mensagem("m1", "ADIADA", "2026-10-17T20:00:00Z"),
];

const renderLista = (lista: ItemAgenda[], fusoExibicao = FUSO) =>
  renderToStaticMarkup(createElement(ListaTarefas, { itens: lista, agora: AGORA, fusoEscola: FUSO, fusoExibicao }));

describe("ListaTarefas", () => {
  it("grupos na ordem e mensagem com status real", () => {
    const html = renderLista(itens);
    expect(html).toMatch(/>Atrasadas<[\s\S]*>Hoje<[\s\S]*>Amanhã<[\s\S]*>Próximos 7 dias<[\s\S]*>Mais adiante<[\s\S]*>Sem data</);
    expect(html).toContain("Adiada · fora da janela de envio");
    expect(html).not.toContain("Mensagem enviada");
  });

  it("mensagem despachada diz Enviada; pendente diz Agendada; mensagem não tem caixa de seleção", () => {
    const html = renderLista([mensagem("m2", "DESPACHADA", "2026-10-16T20:00:00Z"), mensagem("m3", "PENDENTE", "2026-10-17T22:00:00Z")]);
    expect(html).toContain("Enviada");
    expect(html).toContain("Agendada");
    expect(html).not.toContain('type="checkbox"');
  });

  it("concluir em lote não inclui mensagens", () => {
    expect(acoesLote(["t1", "m1"])).toEqual({ concluir: ["t1"], ignoradas: 1 });
    expect(acoesLote([])).toEqual({ concluir: [], ignoradas: 0 });
  });

  it("horas no fuso do usuário, com a dica quando difere do fuso da escola", () => {
    const com = tarefa("x", "2026-10-17", { inicioEm: new Date("2026-10-17T20:00:00Z") });
    const noFusoDaEscola = renderLista([com]);
    expect(noFusoDaEscola).toContain("14:00");
    expect(noFusoDaEscola).not.toContain("no fuso da escola");
    const outro = renderLista([com], "America/Sao_Paulo");
    expect(outro).toContain("17:00");
    expect(outro).toContain("14:00 no fuso da escola");
  });

  it("vazio", () => {
    expect(renderLista([])).toContain("Nenhuma tarefa por aqui.");
  });
});

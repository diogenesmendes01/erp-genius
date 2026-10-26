import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import type { TarefaLista } from "@/server/crm/mensagens-agendadas";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh() {}, replace() {} }) }));
vi.mock("@/server/crm/tarefas-acoes", () => ({
  assumirTarefa: vi.fn(), cancelarTarefa: vi.fn(), concluirTarefa: vi.fn(),
  criarTarefa: vi.fn(), editarTarefa: vi.fn(), reabrirTarefa: vi.fn(),
}));
import { PainelTarefa } from "./PainelTarefa";
const tarefa: TarefaLista = {
  recorrencia: "NAO_REPETE", recorrenciaAncoraDataCivil: null, recorrenciaAncoraHora: null, recorrenciaAncoraFuso: null, recorrenciaPoliticaVersao: null, recorrenciaIndice: 0, recorrenciaAnteriorId: null,
  id: "tarefa-ficticia", titulo: "Ligação fictícia", descricao: null, tipo: "LIGACAO", setor: "COMERCIAL",
  status: "ABERTA", prioridade: "NORMAL", dataCivil: null, inicioEm: null, duracaoMin: 30,
  fusoOrigem: "America/Sao_Paulo", lembreteAntecedenciaMin: null, lembrarEm: null, lembreteDisparadoEm: null,
  responsavelId: null, criadorId: null, concluidaEm: null, concluidaPorId: null, resultado: null,
  canceladaEm: null, motivoCancelamento: null, leadId: null, pessoaId: null, alunoId: null, matriculaId: null,
  atendimentoId: "a1", origem: "HUMANO", versao: 1,
  criadoEm: new Date("2026-10-22T12:00:00Z"), atualizadoEm: new Date("2026-10-22T12:00:00Z"), responsavel: null,
};
type Props = Parameters<typeof PainelTarefa>[0];
const h = (extra: Partial<Props> = {}) => renderToStaticMarkup(createElement(PainelTarefa, {
  tarefa, responsaveis: [], fusoEscola: "America/Sao_Paulo", fusoExibicao: "America/Sao_Paulo",
  dataInicial: "2026-10-22", params: {}, ...extra,
}));
it("#336 tarefa aberta tem links relativos seguros sem mudar o formulário", () => {
  const html = h({ conversa: { atendimentoId: "a 1", aberta: true } });
  expect(html).toContain('href="/inbox?c=a%201"');
  expect(html).toContain('href="/inbox?c=a%201&amp;agendar=1"');
  expect(html).toContain("Abrir conversa"); expect(html).toContain("Agendar mensagem");
  expect(html).toContain("Salvar"); expect(html).toContain("Cancelar tarefa");
});
it("#336 conversa encerrada só abre; sem conversa não cria atalho", () => {
  const html = h({ conversa: { atendimentoId: "a1", aberta: false } });
  expect(html).toContain('href="/inbox?c=a1"'); expect(html).not.toContain("Agendar mensagem");
  expect(h()).not.toContain("Abrir conversa"); expect(h({ conversa: null })).not.toContain("Abrir conversa");
});
it.each([{min:15,rotulo:"15 minutos antes"},{min:1440,rotulo:"1 dia antes"}] as const)("D10 CRM conserva lembrete $min recebido do Inbox",({min,rotulo})=>{const html=h({tarefa:{...tarefa,prioridade:"BAIXA",lembreteAntecedenciaMin:min,dataCivil:"2026-10-25",inicioEm:new Date("2026-10-25T15:00:00Z"),lembrarEm:new Date(new Date("2026-10-25T15:00:00Z").getTime()-min*60000)}});expect(html).toContain(rotulo);expect(html).toContain(`value="${min}" selected=""`);expect(html).toContain("Baixa");});
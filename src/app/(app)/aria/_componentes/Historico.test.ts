import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import type { ItemHistoricoAria } from "@/server/aria/consultas";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh() {} }) }));
vi.mock("@/server/aria/acoes", () => ({ aprovarAcaoAria: vi.fn(), desfazerAcaoAria: vi.fn(), rejeitarAcaoAria: vi.fn() }));
import { Historico } from "./Historico";
const base: ItemHistoricoAria = {
  id: "acao-ficticia", atendimentoId: "ação/1", quando: "2026-10-22T12:00:00Z", acao: "CRIAR_TAREFA",
  contato: "Contato fictício", etapa: "NOVO", confianca: 95, status: "EXECUTADA",
  podeDesfazer: false, motivoIrreversivel: null, decididaPor: null,
};
const h = (itens: ItemHistoricoAria[]) => renderToStaticMarkup(createElement(Historico, {
  itens, proximo: null, podeDecidir: false, fuso: "America/Sao_Paulo",
  filtros: { busca: "", acao: "", etapa: "", resultado: "" },
}));
it("#336 histórico oferece Abrir nos layouts tabela e cartão sem Agendar", () => {
  const html = h([base]);
  expect(html.match(/href="\/inbox\?c=a%C3%A7%C3%A3o%2F1"/g)).toHaveLength(2);
  expect(html.match(/Abrir conversa/g)).toHaveLength(2);
  expect(html).not.toContain(">Agendar mensagem</a>");
  expect(html).not.toContain("&amp;agendar=1");
});
it("#336 ação sem atendimento não inventa link ou ID na tela", () => {
  const html = h([{ ...base, atendimentoId: null }]);
  expect(html).not.toContain("Abrir conversa"); expect(html).not.toContain("acao-ficticia");
});

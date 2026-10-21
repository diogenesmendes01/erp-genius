import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/server/crm/tarefas-acoes", () => ({ marcarNotificacaoLida: vi.fn() }));

import { hrefNotificacao } from "./SinoNotificacoes";
import { hrefTarefas } from "./visao";

const n = { id: "n1", titulo: "x", refId: "r", refTipo: "Tarefa", tipo: "LEMBRETE_TAREFA" as const, criadaEm: new Date(), lida: false };

describe("hrefNotificacao", () => {
  it("href_por_tipo", () => {
    expect(hrefNotificacao({ ...n, tipo: "SLA_ESTOURADO", refTipo: "AtendimentoWhatsApp", refId: "at1" })).toBe("/inbox?c=at1");
    expect(hrefNotificacao({ ...n, tipo: "LEMBRETE_TAREFA", refId: "t1" })).toBe(hrefTarefas({ t: "t1" }));
  });
  it("id_vai_codificado", () => expect(hrefNotificacao({ ...n, tipo: "SLA_ESTOURADO", refId: "a b&c" })).toBe("/inbox?c=a+b%26c"));
});

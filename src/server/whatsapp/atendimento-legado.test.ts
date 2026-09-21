import { afterEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  atendimentoWhatsApp: { findFirst: vi.fn(), findMany: vi.fn() },
  conversaWhatsApp: { findUnique: vi.fn(), upsert: vi.fn() },
  matricula: { findFirst: vi.fn(), findMany: vi.fn() },
  aluno: { findUnique: vi.fn() },
  lead: { findUnique: vi.fn() },
}));
const escopo = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("./escopo", () => ({ escopoAtendimentos: escopo }));

import { atendimentoDoInbound, atendimentoVisivel } from "./atendimentos";
import { destinatarioAtualDoAtendimento } from "./destinatario-atual";

afterEach(() => vi.clearAllMocks());

const contato = { telefoneE164: "+5511999990000", responsavelId: null };

describe("atendimento financeiro legado", () => {
  it("não considera destinatário atual sem matrícula", async () => {
    await expect(destinatarioAtualDoAtendimento({
      finalidade: "FINANCEIRO", leadId: null, alunoId: "aluno-1", matriculaId: null,
      conversa: { contato },
    })).resolves.toBe(false);
    expect(db.matricula.findFirst).not.toHaveBeenCalled();
  });

  it("não permite enviar por atendimento financeiro legado", async () => {
    escopo.mockResolvedValue({});
    db.atendimentoWhatsApp.findFirst.mockResolvedValue({
      id: "atendimento-legado", finalidade: "FINANCEIRO", leadId: null, alunoId: "aluno-1", matriculaId: null,
      conversaId: "conversa-1", conversa: { numeroId: "numero-1", contatoId: "contato-1", numero: {}, contato },
    });

    await expect(atendimentoVisivel({} as never, "atendimento-legado", true)).resolves.toBeNull();
    expect(db.matricula.findFirst).not.toHaveBeenCalled();
  });

  it("mantém inbound em triagem para o único financeiro legado aberto", async () => {
    db.atendimentoWhatsApp.findMany.mockResolvedValue([
      { id: "atendimento-legado", finalidade: "FINANCEIRO", matriculaId: null },
    ]);

    await expect(atendimentoDoInbound(db as never, "conversa-1")).resolves.toBeNull();
    expect(db.conversaWhatsApp.findUnique).not.toHaveBeenCalled();
    expect(db.matricula.findMany).not.toHaveBeenCalled();
  });

  it("em financeiro ignora telefone do lead e valida o contato do aluno", async () => {
    db.matricula.findFirst.mockResolvedValue({ id: "matricula-1", pais: null, preparacaoComercial: null,
      pagadoresPreparacao: [{ id: "pagador", versao: 1, tipo: "ALUNO", dados: { alunoId: "aluno-1" } }],
      aluno: { id: "aluno-1", primeiroNome: "Aluno", sobrenome: null, nomePreferido: null, pais: null, fuso: null,
        telefoneE164: contato.telefoneE164, responsaveis: [], _count: { matriculas: 1 } },
    });
    db.aluno.findUnique.mockResolvedValue({ telefoneE164: contato.telefoneE164, responsaveis: [] });
    db.lead.findUnique.mockResolvedValue({ telefoneE164: "+5511888880000" });

    await expect(destinatarioAtualDoAtendimento({
      finalidade: "FINANCEIRO", leadId: "lead-de-outro-telefone", alunoId: "aluno-1", matriculaId: "matricula-1",
      conversa: { contato },
    })).resolves.toBe(true);
    expect(db.lead.findUnique).not.toHaveBeenCalled();
    expect(db.matricula.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "matricula-1", alunoId: "aluno-1" } }));
  });
});

import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => {
  const mocks = { gate: vi.fn<() => boolean>(), fonte: vi.fn(), email: vi.fn(), avisoFindUnique: vi.fn(), avisoFindMany: vi.fn(), alocacoes: vi.fn(), intencaoCreate: vi.fn() };
  const tx = { $executeRaw: async () => 0, avisoAlteracaoAgenda: { findUnique: mocks.avisoFindUnique }, alocacaoTurma: { findMany: mocks.alocacoes }, intencaoMensagem: { create: mocks.intencaoCreate } };
  const prisma = { ...tx, $transaction: async (fn: (db: typeof tx) => Promise<unknown>) => fn(tx), avisoAlteracaoAgenda: { findUnique: mocks.avisoFindUnique, findMany: mocks.avisoFindMany } };
  return { mocks, prisma };
});
const mocks = state.mocks;
vi.mock("@/lib/prisma", () => ({ prisma: state.prisma }));
vi.mock("./quantidade-gate", () => ({ envioQuantidadeAulasHabilitado: state.mocks.gate }));
vi.mock("@/server/agenda/quantidade-fonte", () => ({ validarFonteQuantidadeAulasTx: state.mocks.fonte }));
vi.mock("@/server/email/resend", () => ({ enviarEmailResend: state.mocks.email }));
vi.mock("@/server/whatsapp/identidade", () => ({ garantirContato: vi.fn() }));
vi.mock("@/server/whatsapp/atendimentos", () => ({ garantirAtendimento: vi.fn() }));
vi.mock("@/server/whatsapp/destinatario-atual", () => ({ destinatarioAtualDoAtendimento: vi.fn() }));

import { entregarAvisoAlteracaoAgenda } from "./avisos";
import { enfileirarAvisosAgendaWhatsApp } from "./whatsapp";

const hash = (v: string) => createHash("sha256").update(v).digest("hex");
const inicioAtual = new Date("2099-02-02T10:00:00.000Z");
const fonteValida = () => ({ porTurma: new Map([["turma", new Set(["encontro"])]]), instantes: new Map([["encontro", [new Date("2099-02-01T10:00:00.000Z")]]]) });
const alocacaoHistorica = { turmaId: "turma", criadoEm: new Date("2099-01-01T00:00:00.000Z"), encerradaEm: new Date("2099-02-01T12:00:00.000Z"), ativa: false, provenienciaVinculo: null, inicioVigencia: null, fimVigencia: null };

function aviso(canal: "EMAIL" | "WHATSAPP" = "EMAIL", anterior = 10, nova = 12) {
  return {
    id: "aviso", eventoId: "evento", matriculaId: "matricula", canal, situacao: "PREPARADO", contatoHash: hash(canal === "EMAIL" ? "aluno@example.com" : "+5511999999999"), destinatarioAlunoId: "aluno", alunoId: "aluno", destinatarioResponsavelId: null, autorizacaoComunicacaoAcademicaId: null,
    evento: { agregadoTipo: "Modalidade", agregadoId: "modalidade", tipo: "QuantidadeAulasModalidadeAplicada", payload: { quantidadeAnterior: anterior, quantidadeNova: nova } },
    aluno: { email: "aluno@example.com", whatsapp: true, telefoneE164: "+5511999999999", aceitaComunicacoes: true, primeiroNome: "Ana", pais: { idioma: "pt_BR" }, responsaveis: [] },
    matricula: { codigo: "M-1", status: "ATIVA", id: "matricula", alunoId: "aluno" },
    itens: [{ encontroId: "encontro", encontro: { id: "encontro", turmaId: "turma", matriculaId: null, inicio: inicioAtual, fim: new Date("2099-02-02T11:00:00.000Z"), fusoOrigem: "UTC" } }],
    intencaoWhatsApp: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.gate.mockReturnValue(true); mocks.fonte.mockResolvedValue(fonteValida()); mocks.email.mockResolvedValue({ situacao: "ACEITO", provedorId: "simulado" });
  mocks.alocacoes.mockResolvedValue([alocacaoHistorica]); mocks.avisoFindMany.mockResolvedValue([]); mocks.intencaoCreate.mockResolvedValue({});
});

describe("Q38 transporte de quantidade simulado", () => {
  it("com gate desligado não chama e-mail nem enfileira WhatsApp", async () => {
    mocks.gate.mockReturnValue(false);
    mocks.avisoFindUnique.mockResolvedValue(aviso());
    await expect(entregarAvisoAlteracaoAgenda({ canal: "EMAIL", destinatario: "aluno@example.com", avisoId: "aviso", encontrosIds: ["encontro"] })).resolves.toEqual({ situacao: "RECUSADO" });
    mocks.avisoFindMany.mockResolvedValue([{ id: "wa" }]);
    mocks.avisoFindUnique.mockResolvedValue(aviso("WHATSAPP"));
    await expect(enfileirarAvisosAgendaWhatsApp()).resolves.toBe(0);
    expect(mocks.email).not.toHaveBeenCalled();
    expect(mocks.intencaoCreate).not.toHaveBeenCalled();
  });

  it.each([[10, 12, "incluídas ou alteradas"], [12, 10, "removidas ou alteradas"]])("com gate ligado comunica aulas %i para %i", async (anterior, nova, acao) => {
    mocks.avisoFindUnique.mockResolvedValue(aviso("EMAIL", anterior, nova));
    await expect(entregarAvisoAlteracaoAgenda({ canal: "EMAIL", destinatario: "aluno@example.com", avisoId: "aviso", encontrosIds: ["encontro"] })).resolves.toEqual({ situacao: "ACEITO", provedorId: "simulado" });
    expect(mocks.email).toHaveBeenCalledWith(expect.objectContaining({ assunto: "Alteração na quantidade de aulas", texto: expect.stringContaining(acao) }));
  });

  it("aceita vínculo histórico que cobre a fotografia anterior", async () => {
    mocks.avisoFindUnique.mockResolvedValue(aviso());
    await expect(entregarAvisoAlteracaoAgenda({ canal: "EMAIL", destinatario: "aluno@example.com", avisoId: "aviso", encontrosIds: ["encontro"] })).resolves.toMatchObject({ situacao: "ACEITO" });
    expect(mocks.email).toHaveBeenCalledTimes(1);
  });

  it("recusa vínculo estranho fora da turma afetada", async () => {
    mocks.avisoFindUnique.mockResolvedValue(aviso());
    mocks.alocacoes.mockResolvedValue([{ ...alocacaoHistorica, turmaId: "outra-turma" }]);
    await expect(entregarAvisoAlteracaoAgenda({ canal: "EMAIL", destinatario: "aluno@example.com", avisoId: "aviso", encontrosIds: ["encontro"] })).resolves.toEqual({ situacao: "RECUSADO" });
    expect(mocks.email).not.toHaveBeenCalled();
  });
});

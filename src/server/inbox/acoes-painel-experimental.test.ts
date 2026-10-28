import { beforeEach, describe, expect, it, vi } from "vitest";
import { EtapaLead, Papel } from "@prisma/client";
import type { UsuarioSessao } from "@/server/_shared/sessao";

const verLead = vi.hoisted(() => vi.fn(async () => true));
const sessao = vi.hoisted(() => vi.fn());
const aviso = vi.hoisted(() => vi.fn<(cliente: unknown, id: string) => Promise<void>>(async () => undefined));
const tx = vi.hoisted(() => ({
  $queryRaw: vi.fn(async () => []),
  usuario: { findUnique: vi.fn() },
  atendimentoWhatsApp: { findFirst: vi.fn() },
  oportunidade: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn() },
  evento: { create: vi.fn() },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: async (fn: (cliente: typeof tx) => Promise<unknown>) => fn(tx) } }));
vi.mock("@/server/_shared/sessao", async (original) => ({
  ...(await original<typeof import("@/server/_shared/sessao")>()),
  exigirSessao: () => sessao(),
}));
vi.mock("@/server/whatsapp/escopo", async (original) => ({
  ...(await original<typeof import("@/server/whatsapp/escopo")>()),
  escopoAtendimentos: async () => ({}),
}));
vi.mock("@/server/whatsapp/consultas-inbox", async (original) => ({
  ...(await original<typeof import("@/server/whatsapp/consultas-inbox")>()),
  podeVerLeadNaThread: () => verLead(),
}));
vi.mock("./aviso", () => ({ avisarAtendimento: aviso }));

import { agendarExperimentalNoInbox, atribuirProfessorExperimentalNoInbox, confirmarExperimentalNoInbox } from "./acoes-painel";

const vendedor: UsuarioSessao = { id: "vend", nome: "Vendedor", papeis: [Papel.VENDEDOR] };
const agenda = { dataISO: "2026-11-02T15:00:00.000Z", professorId: "prof" };
let lead: { etapa: EtapaLead; professorExperimentalId: string | null; dataExperimental: Date | null; experimentalConfirmadaEm: Date | null };

function usuarioDe(id: string) {
  if (id === "prof") return { nome: "Helena", papeis: [Papel.PROFESSOR], ativo: true, permissoes: [] };
  if (id === "inativo") return { nome: "Inativo", papeis: [Papel.PROFESSOR], ativo: false, permissoes: [] };
  if (id === "vend") return { nome: "Vendedor", papeis: [Papel.VENDEDOR], ativo: true, permissoes: [] };
  if (id === "sem") return { nome: "Professor", papeis: [Papel.PROFESSOR], ativo: true, permissoes: [] };
  return null;
}

beforeEach(() => {
  vi.clearAllMocks();
  lead = { etapa: EtapaLead.QUALIFICADO, professorExperimentalId: null, dataExperimental: new Date("2026-11-01T15:00:00.000Z"), experimentalConfirmadaEm: null };
  sessao.mockResolvedValue(vendedor);
  verLead.mockResolvedValue(true);
  tx.$queryRaw.mockResolvedValue([]);
  tx.usuario.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => usuarioDe(where.id));
  tx.atendimentoWhatsApp.findFirst.mockResolvedValue({ leadId: "lead1", finalidade: "COMERCIAL", conversa: { contatoId: "ct" } });
  tx.oportunidade.findUnique.mockImplementation(async () => lead);
  tx.oportunidade.findUniqueOrThrow.mockImplementation(async () => lead);
  tx.oportunidade.update.mockResolvedValue({});
  tx.evento.create.mockResolvedValue({ id: "ev" });
  aviso.mockResolvedValue(undefined);
});

function tiposDeEvento() {
  return tx.evento.create.mock.calls.map((c) => (c[0] as { data: { tipo: string } }).data.tipo);
}

describe("experimental no inbox", () => {
  it("agenda, grava professor e confirmação, registra os eventos e avisa o atendimento", async () => {
    expect(await agendarExperimentalNoInbox("at1", "lead1", agenda)).toEqual({ ok: true });
    expect(tx.oportunidade.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "lead1" },
      data: expect.objectContaining({ etapa: EtapaLead.EXPERIMENTAL_AGENDADA, professorExperimentalId: "prof", experimentalConfirmadaEm: null, dataExperimental: new Date("2026-11-02T15:00:00.000Z") }),
    }));
    expect(tiposDeEvento()).toEqual(expect.arrayContaining(["ExperimentalAgendada", "ExperimentalAtribuida"]));
    expect(aviso).toHaveBeenCalledWith(tx, "at1");

    lead.etapa = EtapaLead.EXPERIMENTAL_AGENDADA;
    lead.professorExperimentalId = null;
    tx.oportunidade.update.mockClear();
    tx.evento.create.mockClear();
    aviso.mockClear();
    expect(await atribuirProfessorExperimentalNoInbox("at1", "lead1", "prof")).toEqual({ ok: true });
    expect(tx.oportunidade.update).toHaveBeenCalledWith({ where: { id: "lead1" }, data: { professorExperimentalId: "prof" } });
    expect(tiposDeEvento()).toContain("ExperimentalAtribuida");
    expect(aviso).toHaveBeenCalledWith(tx, "at1");

    lead.professorExperimentalId = "prof";
    tx.oportunidade.update.mockClear();
    tx.evento.create.mockClear();
    aviso.mockClear();
    expect(await confirmarExperimentalNoInbox("at1", "lead1")).toEqual({ ok: true });
    const confirmacao = (tx.oportunidade.update.mock.calls[0]![0] as { data: { experimentalConfirmadaEm: Date } }).data.experimentalConfirmadaEm;
    expect(confirmacao).toBeInstanceOf(Date);
    expect(tiposDeEvento()).toContain("ExperimentalConfirmada");
    expect(aviso).toHaveBeenCalledWith(tx, "at1");
  });

  it("remarca experimental já agendada", async () => {
    lead.etapa = EtapaLead.EXPERIMENTAL_AGENDADA;
    expect(await agendarExperimentalNoInbox("at1", "lead1", { dataISO: "2026-11-03T15:00:00.000Z" })).toEqual({ ok: true });
    expect(tx.oportunidade.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ etapa: EtapaLead.EXPERIMENTAL_AGENDADA, experimentalConfirmadaEm: null }),
    }));
  });

  it("recusa quem não pode mover etapa e quem está fora do escopo", async () => {
    sessao.mockResolvedValue({ id: "sem", nome: "Professor", papeis: [Papel.PROFESSOR] });
    expect(await agendarExperimentalNoInbox("at1", "lead1", agenda)).toMatchObject({ ok: false, erro: "Você não tem acesso a esta função do CRM." });
    expect(await atribuirProfessorExperimentalNoInbox("at1", "lead1", "prof")).toMatchObject({ ok: false, erro: "Você não tem acesso a esta função do CRM." });
    expect(await confirmarExperimentalNoInbox("at1", "lead1")).toMatchObject({ ok: false, erro: "Você não tem acesso a esta função do CRM." });
    sessao.mockResolvedValue(vendedor);
    verLead.mockResolvedValue(false);
    expect(await agendarExperimentalNoInbox("at1", "lead1", agenda)).toMatchObject({ ok: false, erro: "Você não tem acesso a esta função do CRM." });
    expect(tx.oportunidade.update).not.toHaveBeenCalled();
    expect(aviso).not.toHaveBeenCalled();
  });

  it.each([EtapaLead.MATRICULADO, EtapaLead.PERDIDO])("não reabre experimental em %s", async (etapa) => {
    lead.etapa = etapa;
    const r = await agendarExperimentalNoInbox("at1", "lead1", agenda);
    expect(r).toMatchObject({ ok: false, erro: "Oportunidade encerrada não volta ao funil." });
    expect(tx.oportunidade.update).not.toHaveBeenCalled();
    expect(aviso).not.toHaveBeenCalled();
  });

  it("recusa professor inativo", async () => {
    const r = await agendarExperimentalNoInbox("at1", "lead1", { ...agenda, professorId: "inativo" });
    expect(r).toMatchObject({ ok: false, erro: "Professor não encontrado." });
    expect(tx.oportunidade.update).not.toHaveBeenCalled();
  });
});

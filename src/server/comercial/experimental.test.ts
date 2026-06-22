import { describe, it, expect, vi, beforeEach } from "vitest";
import { Papel, EtapaLead } from "@prisma/client";

// Escopo professor↔experimental via FK `professorExperimentalId` (Issue #13).
// Mocks: prisma (DB), auth (sessão) e next/cache (revalidatePath) — testes de
// integração leve das Server Actions / Home sem subir banco nem servidor.

const { prismaMock, authMock } = vi.hoisted(() => ({
  prismaMock: {
    lead: {
      findUnique: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
    usuario: {
      findUnique: vi.fn(),
    },
    evento: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  } as Record<string, any>,
  authMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { checkinExperimental, agendarExperimental } from "./acoes";
import { dadosHomeProfessor } from "@/server/home/consultas";

function comoUsuario(id: string, papeis: Papel[]) {
  authMock.mockResolvedValue({ user: { id, name: "U", papeis } });
}

beforeEach(() => {
  vi.clearAllMocks();
  // $transaction roda o callback com o próprio prismaMock como tx.
  prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) =>
    fn(prismaMock),
  );
  prismaMock.lead.update.mockResolvedValue({});
  prismaMock.evento.create.mockResolvedValue({});
});

describe("dadosHomeProfessor", () => {
  it("lista as experimentais atribuídas ao professor (via FK)", async () => {
    comoUsuario("prof1", [Papel.PROFESSOR]);
    prismaMock.lead.findMany.mockResolvedValue([
      { id: "lead1", nome: "Ana", dataExperimental: new Date("2026-06-22T10:00:00Z") },
    ]);
    // dadosHomeProfessor também consulta turma.findMany → mock ad-hoc
    prismaMock.turma = { findMany: vi.fn().mockResolvedValue([]) };

    const dados = await dadosHomeProfessor({ id: "prof1", nome: "P", papeis: [Papel.PROFESSOR] });

    expect(dados.experimentais).toHaveLength(1);
    expect(dados.experimentais[0].id).toBe("lead1");
    // a consulta filtra pela FK do professor logado
    const chamada = prismaMock.lead.findMany.mock.calls.at(-1)![0] as { where: Record<string, unknown> };
    expect(chamada.where.professorExperimentalId).toBe("prof1");
  });
});

describe("checkinExperimental", () => {
  it("professor vinculado consegue fazer check-in", async () => {
    comoUsuario("prof1", [Papel.PROFESSOR]);
    prismaMock.lead.findUnique.mockResolvedValue({
      id: "lead1",
      etapa: EtapaLead.EXPERIMENTAL_AGENDADA,
      professorExperimentalId: "prof1",
    });

    const r = await checkinExperimental("lead1", true);

    expect(r.ok).toBe(true);
    expect(prismaMock.lead.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "lead1" },
        data: expect.objectContaining({ etapa: EtapaLead.EXPERIMENTAL_REALIZADA }),
      }),
    );
  });

  it("professor NÃO vinculado é barrado (ErroPermissao)", async () => {
    comoUsuario("prof2", [Papel.PROFESSOR]);
    prismaMock.lead.findUnique.mockResolvedValue({
      id: "lead1",
      etapa: EtapaLead.EXPERIMENTAL_AGENDADA,
      professorExperimentalId: "prof1",
    });

    const r = await checkinExperimental("lead1", true);

    expect(r.ok).toBe(false);
    expect(prismaMock.lead.update).not.toHaveBeenCalled();
  });

  it("experimental sem professor atribuído (FK null) barra o professor", async () => {
    comoUsuario("prof1", [Papel.PROFESSOR]);
    prismaMock.lead.findUnique.mockResolvedValue({
      id: "lead1",
      etapa: EtapaLead.EXPERIMENTAL_AGENDADA,
      professorExperimentalId: null,
    });

    const r = await checkinExperimental("lead1", true);

    expect(r.ok).toBe(false);
    expect(prismaMock.lead.update).not.toHaveBeenCalled();
  });

  it("admin ignora o vínculo e faz check-in mesmo sem FK", async () => {
    comoUsuario("admin1", [Papel.ADMINISTRADOR]);
    prismaMock.lead.findUnique.mockResolvedValue({
      id: "lead1",
      etapa: EtapaLead.EXPERIMENTAL_AGENDADA,
      professorExperimentalId: null,
    });

    const r = await checkinExperimental("lead1", false);

    expect(r.ok).toBe(true);
    expect(prismaMock.lead.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ etapa: EtapaLead.NO_SHOW }),
      }),
    );
  });

  it("recusa quando não há experimental agendada (etapa errada)", async () => {
    comoUsuario("prof1", [Papel.PROFESSOR]);
    prismaMock.lead.findUnique.mockResolvedValue({
      id: "lead1",
      etapa: EtapaLead.NOVO,
      professorExperimentalId: "prof1",
    });

    const r = await checkinExperimental("lead1", true);

    expect(r.ok).toBe(false);
    expect(prismaMock.lead.update).not.toHaveBeenCalled();
  });
});

describe("agendarExperimental", () => {
  it("grava a FK do professor ao agendar com professorId", async () => {
    comoUsuario("vend1", [Papel.VENDEDOR]);
    // exigirLeadVisivel → findUnique (dono = vend1); depois professorAtribuido → findUnique
    prismaMock.lead.findUnique
      .mockResolvedValueOnce({ id: "lead1", vendedorDonoId: "vend1" })
      .mockResolvedValueOnce({ professorExperimentalId: null });
    prismaMock.usuario.findUnique.mockResolvedValue({ id: "prof1", papeis: [Papel.PROFESSOR] });

    const r = await agendarExperimental("lead1", {
      dataISO: "2026-06-22T10:00:00Z",
      professorId: "prof1",
    });

    expect(r.ok).toBe(true);
    expect(prismaMock.lead.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "lead1" },
        data: expect.objectContaining({
          etapa: EtapaLead.EXPERIMENTAL_AGENDADA,
          professorExperimentalId: "prof1",
        }),
      }),
    );
  });

  it("agenda sem professor (FK não tocada) quando professorId ausente", async () => {
    comoUsuario("vend1", [Papel.VENDEDOR]);
    prismaMock.lead.findUnique.mockResolvedValueOnce({ id: "lead1", vendedorDonoId: "vend1" });

    const r = await agendarExperimental("lead1", { dataISO: "2026-06-22T10:00:00Z" });

    expect(r.ok).toBe(true);
    const dataArg = (prismaMock.lead.update.mock.calls[0]![0] as { data: Record<string, unknown> })
      .data;
    expect(dataArg).not.toHaveProperty("professorExperimentalId");
  });
});

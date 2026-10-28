import { describe, it, expect, vi, beforeEach } from "vitest";
import { Papel, EtapaLead } from "@prisma/client";

const { prismaMock, authMock } = vi.hoisted(() => ({
  prismaMock: {
    oportunidade: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
    usuario: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    coberturaCarteira: { findMany: vi.fn() },
    evento: {
      create: vi.fn(),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    turma: {
      findMany: vi.fn(),
    },
    configComercial: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    $transaction: vi.fn(),
    $queryRaw: vi.fn().mockResolvedValue([]),
  },
  authMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { checkinExperimental, agendarExperimental, confirmarPresencaExperimental } from "./acoes";
import { dadosHomeProfessor } from "@/server/home/consultas";

const usuariosNoBanco = new Map<string, Record<string, unknown>>();

function existeUsuario(id: string, dados: Record<string, unknown>) {
  usuariosNoBanco.set(id, { nome: "U", ativo: true, ...dados });
}

function comoUsuario(id: string, papeis: Papel[]) {
  authMock.mockResolvedValue({ user: { id, name: "U", papeis } });
  usuariosNoBanco.clear();
  existeUsuario(id, { papeis });
  prismaMock.usuario.findUnique.mockImplementation(
    async ({ where }: { where: { id: string } }) => usuariosNoBanco.get(where.id) ?? null,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) =>
    fn(prismaMock),
  );
  prismaMock.oportunidade.update.mockResolvedValue({});
  prismaMock.oportunidade.findFirst.mockResolvedValue({ id: "lead1", vendedorDonoId: "vend1" });
  prismaMock.coberturaCarteira.findMany.mockResolvedValue([]);
  prismaMock.usuario.findMany.mockResolvedValue([]);
  prismaMock.evento.create.mockResolvedValue({});
});

describe("dadosHomeProfessor", () => {
  it("lista as experimentais atribuídas ao professor (via FK)", async () => {
    comoUsuario("prof1", [Papel.PROFESSOR]);
    prismaMock.oportunidade.findMany.mockResolvedValue([
      { id: "lead1", nome: "Ana", dataExperimental: new Date("2026-06-22T10:00:00Z") },
    ]);
    prismaMock.turma = { findMany: vi.fn().mockResolvedValue([]) };

    const dados = await dadosHomeProfessor({ id: "prof1", nome: "P", papeis: [Papel.PROFESSOR] });

    expect(dados.experimentais).toHaveLength(1);
    expect(dados.experimentais[0].id).toBe("lead1");
    const chamada = prismaMock.oportunidade.findMany.mock.calls.at(-1)![0] as { where: Record<string, unknown> };
    expect(chamada.where.professorExperimentalId).toBe("prof1");
  });

  it("separa a próxima experimental futura dos check-ins atrasados com a mesma referência do servidor", async () => {
    comoUsuario("prof1", [Papel.PROFESSOR]);
    prismaMock.turma = { findMany: vi.fn().mockResolvedValue([]) };
    prismaMock.oportunidade.findMany.mockResolvedValue([
      { id: "passada", nome: "Ana", dataExperimental: new Date("2026-06-22T09:59:59.999Z") },
      { id: "agora", nome: "Bia", dataExperimental: new Date("2026-06-22T10:00:00.000Z") },
      { id: "futura", nome: "Clara", dataExperimental: new Date("2026-06-22T10:30:00.000Z") },
    ]);

    const dados = await dadosHomeProfessor(
      { id: "prof1", nome: "P", papeis: [Papel.PROFESSOR] },
      new Date("2026-06-22T10:00:00.000Z"),
    );

    expect(dados.proximaExperimental).toMatchObject({ id: "agora", nome: "Bia" });
    expect(dados.experimentais.map((e) => e.id)).toEqual(["passada", "agora", "futura"]);
  });

  it("não inventa próxima aula quando há somente check-ins passados, mas os preserva", async () => {
    comoUsuario("prof1", [Papel.PROFESSOR]);
    prismaMock.turma = { findMany: vi.fn().mockResolvedValue([]) };
    prismaMock.oportunidade.findMany.mockResolvedValue([
      { id: "passada", nome: "Ana", dataExperimental: new Date("2026-06-22T09:59:59.999Z") },
    ]);

    const dados = await dadosHomeProfessor(
      { id: "prof1", nome: "P", papeis: [Papel.PROFESSOR] },
      new Date("2026-06-22T10:00:00.000Z"),
    );

    expect(dados.proximaExperimental).toBeNull();
    expect(dados.experimentais).toHaveLength(1);
  });

  it("retorna próxima e lista vazias quando não há experimental atribuída", async () => {
    comoUsuario("prof1", [Papel.PROFESSOR]);
    prismaMock.turma = { findMany: vi.fn().mockResolvedValue([]) };
    prismaMock.oportunidade.findMany.mockResolvedValue([]);

    const dados = await dadosHomeProfessor(
      { id: "prof1", nome: "P", papeis: [Papel.PROFESSOR] },
      new Date("2026-06-22T10:00:00.000Z"),
    );

    expect(dados.proximaExperimental).toBeNull();
    expect(dados.experimentais).toEqual([]);
  });
});

describe("checkinExperimental", () => {
  it("professor vinculado consegue fazer check-in", async () => {
    comoUsuario("prof1", [Papel.PROFESSOR]);
    prismaMock.oportunidade.findUnique.mockResolvedValue({
      id: "lead1",
      etapa: EtapaLead.EXPERIMENTAL_AGENDADA,
      professorExperimentalId: "prof1",
    });

    const r = await checkinExperimental("lead1", true);

    expect(r.ok).toBe(true);
    expect(prismaMock.oportunidade.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "lead1" },
        data: expect.objectContaining({ etapa: EtapaLead.EXPERIMENTAL_REALIZADA }),
      }),
    );
  });

  it("professor NÃO vinculado é barrado (ErroPermissao)", async () => {
    comoUsuario("prof2", [Papel.PROFESSOR]);
    prismaMock.oportunidade.findUnique.mockResolvedValue({
      id: "lead1",
      etapa: EtapaLead.EXPERIMENTAL_AGENDADA,
      professorExperimentalId: "prof1",
    });

    const r = await checkinExperimental("lead1", true);

    expect(r.ok).toBe(false);
    expect(prismaMock.oportunidade.update).not.toHaveBeenCalled();
  });

  it("experimental sem professor atribuído (FK null) barra o professor", async () => {
    comoUsuario("prof1", [Papel.PROFESSOR]);
    prismaMock.oportunidade.findUnique.mockResolvedValue({
      id: "lead1",
      etapa: EtapaLead.EXPERIMENTAL_AGENDADA,
      professorExperimentalId: null,
    });

    const r = await checkinExperimental("lead1", true);

    expect(r.ok).toBe(false);
    expect(prismaMock.oportunidade.update).not.toHaveBeenCalled();
  });

  it("admin ignora o vínculo e faz check-in mesmo sem FK", async () => {
    comoUsuario("admin1", [Papel.ADMINISTRADOR]);
    prismaMock.oportunidade.findUnique.mockResolvedValue({
      id: "lead1",
      etapa: EtapaLead.EXPERIMENTAL_AGENDADA,
      professorExperimentalId: null,
    });

    const r = await checkinExperimental("lead1", false);

    expect(r.ok).toBe(true);
    expect(prismaMock.oportunidade.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ etapa: EtapaLead.NO_SHOW }),
      }),
    );
  });

  it("recusa quando não há experimental agendada (etapa errada)", async () => {
    comoUsuario("prof1", [Papel.PROFESSOR]);
    prismaMock.oportunidade.findUnique.mockResolvedValue({
      id: "lead1",
      etapa: EtapaLead.NOVO,
      professorExperimentalId: "prof1",
    });

    const r = await checkinExperimental("lead1", true);

    expect(r.ok).toBe(false);
    expect(prismaMock.oportunidade.update).not.toHaveBeenCalled();
  });
});

describe("agendarExperimental", () => {
  function eventosRegistrados(tipo: string) {
    return prismaMock.evento.create.mock.calls
      .map((c: unknown[]) => c[0] as { data: Record<string, unknown> })
      .filter((c: { data: Record<string, unknown> }) => c.data.tipo === tipo);
  }

  it("grava a FK do professor ao agendar com professorId", async () => {
    comoUsuario("vend1", [Papel.VENDEDOR]);
    prismaMock.oportunidade.findUnique
      .mockResolvedValueOnce({ professorExperimentalId: null });
    existeUsuario("prof1", { id: "prof1", papeis: [Papel.PROFESSOR] });

    const r = await agendarExperimental("lead1", {
      dataISO: "2026-06-22T10:00:00Z",
      professorId: "prof1",
    });

    expect(r.ok).toBe(true);
    expect(prismaMock.oportunidade.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "lead1" },
        data: expect.objectContaining({
          etapa: EtapaLead.EXPERIMENTAL_AGENDADA,
          professorExperimentalId: "prof1",
        }),
      }),
    );
    expect(eventosRegistrados("ExperimentalAtribuida")).toHaveLength(1);
  });

  it("agenda sem professor: persiste FK null quando professorId ausente", async () => {
    comoUsuario("vend1", [Papel.VENDEDOR]);
    prismaMock.oportunidade.findUnique
      .mockResolvedValueOnce({ professorExperimentalId: null });

    const r = await agendarExperimental("lead1", { dataISO: "2026-06-22T10:00:00Z" });

    expect(r.ok).toBe(true);
    const dataArg = (prismaMock.oportunidade.update.mock.calls[0]![0] as { data: Record<string, unknown> })
      .data;
    expect(dataArg.professorExperimentalId).toBeNull();
    expect(eventosRegistrados("ExperimentalAtribuida")).toHaveLength(0);
  });

  it("reagendar com 'Definir depois' limpa a FK e audita a remoção", async () => {
    comoUsuario("vend1", [Papel.VENDEDOR]);
    prismaMock.oportunidade.findUnique
      .mockResolvedValueOnce({ professorExperimentalId: "prof1" });

    const r = await agendarExperimental("lead1", {
      dataISO: "2026-06-22T10:00:00Z",
      professorId: "",
    });

    expect(r.ok).toBe(true);
    const dataArg = (prismaMock.oportunidade.update.mock.calls[0]![0] as { data: Record<string, unknown> })
      .data;
    expect(dataArg.professorExperimentalId).toBeNull();
    const eventos = eventosRegistrados("ExperimentalAtribuida");
    expect(eventos).toHaveLength(1);
    expect(eventos[0].data.payload).toMatchObject({ de: "prof1", professorId: null });
  });

  it("reagendar ZERA a confirmação da experimental anterior", async () => {
    comoUsuario("vend1", [Papel.VENDEDOR]);
    prismaMock.oportunidade.findFirst
      .mockResolvedValueOnce({
        id: "lead1",
        vendedorDonoId: "vend1",
        experimentalConfirmadaEm: new Date("2026-06-20T09:00:00Z"),
      });
    prismaMock.oportunidade.findUnique.mockResolvedValueOnce({ professorExperimentalId: null });

    const r = await agendarExperimental("lead1", { dataISO: "2026-06-23T11:00:00Z" });

    expect(r.ok).toBe(true);
    const dataArg = (prismaMock.oportunidade.update.mock.calls[0]![0] as { data: Record<string, unknown> })
      .data;
    expect(dataArg.experimentalConfirmadaEm).toBeNull();
    expect(dataArg.dataExperimental).toEqual(new Date("2026-06-23T11:00:00Z"));
  });

  it("reagendar sem mudar o professor não duplica o evento de vínculo", async () => {
    comoUsuario("vend1", [Papel.VENDEDOR]);
    prismaMock.oportunidade.findUnique
      .mockResolvedValueOnce({ professorExperimentalId: "prof1" });
    existeUsuario("prof1", { id: "prof1", papeis: [Papel.PROFESSOR] });

    const r = await agendarExperimental("lead1", {
      dataISO: "2026-06-23T11:00:00Z",
      professorId: "prof1",
    });

    expect(r.ok).toBe(true);
    const dataArg = (prismaMock.oportunidade.update.mock.calls[0]![0] as { data: Record<string, unknown> })
      .data;
    expect(dataArg.professorExperimentalId).toBe("prof1");
    expect(eventosRegistrados("ExperimentalAtribuida")).toHaveLength(0);
  });

  it("não agenda experimental de lead fora da carteira autorizada", async () => {
    comoUsuario("vend1", [Papel.VENDEDOR]);
    prismaMock.oportunidade.findFirst.mockResolvedValueOnce(null);
    const r = await agendarExperimental("lead-alheio", { dataISO: "2026-06-23T11:00:00Z" });
    expect(r.ok).toBe(false);
    expect(prismaMock.oportunidade.findFirst).toHaveBeenCalledWith({ where: { AND: [{ id: "lead-alheio" }, { vendedorDonoId: { in: ["vend1"] } }] } });
    expect(prismaMock.oportunidade.update).not.toHaveBeenCalled();
    expect(prismaMock.evento.create).not.toHaveBeenCalled();
  });
});

describe("confirmarPresencaExperimental", () => {
  const agendada = {
    id: "lead1",
    vendedorDonoId: "vend1",
    etapa: EtapaLead.EXPERIMENTAL_AGENDADA,
    dataExperimental: new Date("2026-06-22T15:00:00.000Z"),
    experimentalConfirmadaEm: null,
  };

  it("grava a confirmação e o evento da presença", async () => {
    comoUsuario("vend1", [Papel.VENDEDOR]);
    prismaMock.oportunidade.findFirst.mockResolvedValue(agendada);
    const r = await confirmarPresencaExperimental("lead1");
    expect(r.ok).toBe(true);
    const data = (prismaMock.oportunidade.update.mock.calls[0]![0] as { data: { experimentalConfirmadaEm: Date } }).data;
    expect(data.experimentalConfirmadaEm).toBeInstanceOf(Date);
    expect(prismaMock.evento.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        tipo: "ExperimentalConfirmada",
        agregadoTipo: "Lead",
        agregadoId: "lead1",
        autorId: "vend1",
        payload: expect.objectContaining({
          dataExperimental: "2026-06-22T15:00:00.000Z",
        }),
      }),
    }));
  });

  it("confirmação já registrada não grava de novo", async () => {
    comoUsuario("vend1", [Papel.VENDEDOR]);
    prismaMock.oportunidade.findFirst.mockResolvedValue({ ...agendada, experimentalConfirmadaEm: new Date("2026-06-22T16:00:00.000Z") });
    const r = await confirmarPresencaExperimental("lead1");
    expect(r.ok).toBe(true);
    expect(prismaMock.oportunidade.update).not.toHaveBeenCalled();
    expect(prismaMock.evento.create).not.toHaveBeenCalled();
  });

  it("recusa etapa que não é experimental agendada", async () => {
    comoUsuario("vend1", [Papel.VENDEDOR]);
    prismaMock.oportunidade.findFirst.mockResolvedValue({ ...agendada, etapa: EtapaLead.NOVO, dataExperimental: null });
    const r = await confirmarPresencaExperimental("lead1");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erro).toBe("Só é possível confirmar presença de uma aula experimental agendada.");
    expect(prismaMock.oportunidade.update).not.toHaveBeenCalled();
  });

  it("professor não confirma presença comercial", async () => {
    comoUsuario("prof1", [Papel.PROFESSOR]);
    const r = await confirmarPresencaExperimental("lead1");
    expect(r.ok).toBe(false);
    expect(prismaMock.oportunidade.update).not.toHaveBeenCalled();
  });
});

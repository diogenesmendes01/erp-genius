import { createHash } from "node:crypto";
import { StatusTurma, type Prisma } from "@prisma/client";
import { beforeEach, expect, it, vi } from "vitest";
import { ErroRegra } from "@/server/_shared";

const evento = vi.hoisted(() => vi.fn());
const conferir = vi.hoisted(() => vi.fn());
vi.mock("@/server/_shared", async (original) => ({
  ...(await original<typeof import("@/server/_shared")>()),
  registrarEvento: evento,
}));
vi.mock("./reserva-disponibilidade", () => ({ conferirTurmaParaReserva: conferir }));

import { reservarVagaMatriculaTx } from "./reserva-vaga-tx";

const MENSAGEM = "A turma selecionada não está aberta para venda. Abra a turma antes de reservar a vaga.";
const AGORA = new Date("2026-10-30T15:00:00.000Z");
const ENTRADA = {
  matriculaId: "matricula-1",
  turmaId: "turma-1",
  autorId: "autor-1",
  motivo: "Reserva de vaga comercial",
  chaveIdempotencia: "chave-reserva-541",
};
const ACEITAS = [StatusTurma.ABERTA, StatusTurma.EM_ANDAMENTO] as const;
const RECUSADAS = Object.values(StatusTurma).filter((status) => !(ACEITAS as readonly StatusTurma[]).includes(status));

function hashEntrada() {
  return createHash("sha256").update(JSON.stringify({
    matriculaId: ENTRADA.matriculaId,
    turmaId: ENTRADA.turmaId,
    autorId: ENTRADA.autorId,
    motivo: ENTRADA.motivo,
    chaveIdempotencia: ENTRADA.chaveIdempotencia,
  })).digest("hex");
}

function txCom(status: StatusTurma, existente: { id: string; status: string; expiraEm: Date; entradaHash: string } | null = null) {
  const criar = vi.fn().mockResolvedValue({ id: "reserva-1", status: "ATIVA", expiraEm: new Date("2026-10-30T16:00:00.000Z") });
  const turmaFindUnique = vi.fn().mockResolvedValue({
    id: "turma-1", status, modalidadeId: "mod-1", capacidade: 10, nivel: { idiomaId: "idi-1" },
  });
  const tx = {
    $executeRaw: vi.fn(),
    $queryRaw: vi.fn(),
    usuario: { findUnique: vi.fn().mockResolvedValue({ ativo: true, papeis: ["VENDEDOR"] }) },
    reservaVagaMatricula: {
      findUnique: vi.fn().mockResolvedValue(existente),
      count: vi.fn().mockResolvedValue(0),
      create: criar,
    },
    configuracaoOperacional: { findUnique: vi.fn().mockResolvedValue({ prazoReservaMinutos: 60 }) },
    matricula: {
      findUnique: vi.fn().mockResolvedValue({
        id: "matricula-1", status: "RASCUNHO", produto: { modalidadeId: "mod-1", idiomaId: "idi-1" },
      }),
    },
    alocacaoTurma: { count: vi.fn().mockResolvedValue(0) },
    reservaAgendaParticular: { count: vi.fn().mockResolvedValue(0) },
    turma: { findUnique: turmaFindUnique },
  } as unknown as Prisma.TransactionClient;
  return { tx, criar, turmaFindUnique };
}

beforeEach(() => {
  vi.clearAllMocks();
  evento.mockResolvedValue(undefined);
  conferir.mockResolvedValue({
    janela: { id: "janela-1" },
    conferencia: { elegivel: true, impedimentos: [] },
    agora: AGORA,
  });
});

it.each(RECUSADAS)("BLOCK: turma %s é rejeitada sem criar reserva nem evento", async (status) => {
  const { tx, criar, turmaFindUnique } = txCom(status);
  const erro = await reservarVagaMatriculaTx(tx, ENTRADA).then(() => null, (falha: unknown) => falha);
  expect(erro).toBeInstanceOf(ErroRegra);
  expect((erro as ErroRegra).message).toBe(MENSAGEM);
  expect(turmaFindUnique).toHaveBeenCalledOnce();
  expect(conferir).not.toHaveBeenCalled();
  expect(criar).not.toHaveBeenCalled();
  expect(evento).not.toHaveBeenCalled();
});

it.each(ACEITAS)("BLOCK: turma %s aceita nova reserva de vaga", async (status) => {
  const { tx, criar } = txCom(status);
  await expect(reservarVagaMatriculaTx(tx, ENTRADA)).resolves.toMatchObject({ id: "reserva-1", status: "ATIVA" });
  expect(conferir).toHaveBeenCalledOnce();
  expect(conferir).toHaveBeenCalledWith(tx, expect.objectContaining({ id: "turma-1", status }));
  expect(criar).toHaveBeenCalledOnce();
  expect(evento).toHaveBeenCalledOnce();
});

it("BLOCK: reserva já criada com a mesma chave devolve a existente mesmo com turma PLANEJADA", async () => {
  const expiraEm = new Date("2026-10-30T16:00:00.000Z");
  const { tx, criar, turmaFindUnique } = txCom(StatusTurma.PLANEJADA, {
    id: "reserva-existente", status: "ATIVA", expiraEm, entradaHash: hashEntrada(),
  });
  await expect(reservarVagaMatriculaTx(tx, ENTRADA)).resolves.toEqual({ id: "reserva-existente", status: "ATIVA", expiraEm });
  expect(turmaFindUnique).not.toHaveBeenCalled();
  expect(conferir).not.toHaveBeenCalled();
  expect(criar).not.toHaveBeenCalled();
  expect(evento).not.toHaveBeenCalled();
});

import { beforeEach, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
const eventos = vi.hoisted(() => vi.fn());
vi.mock("@/server/_shared", async original => ({ ...await original<typeof import("@/server/_shared")>(), registrarEvento: eventos }));
vi.mock("@/server/financeiro/recebimentos", () => ({ bloquearMatriculas: vi.fn() }));
vi.mock("./reserva-particular-cadeia", () => ({ resolverReservaParticularAtual: async () => "r" }));
import { conferirVencimentoReservaTx } from "./reserva-vencimento-tx";
import { conferirVencimentoParticularTx } from "./reserva-particular-vencimento-tx";
beforeEach(() => vi.clearAllMocks());
it.each([false, true])("mantém reserva com crédito antecipado do contrato, particular=%s", async particular => {
  const reserva = { id: "r", matriculaId: "m", turmaId: "t", status: "ATIVA", expiraEm: new Date("2020-01-01") };
  const atualizar = vi.fn();
  const tabela = { findUnique: vi.fn().mockResolvedValue(reserva), findUniqueOrThrow: vi.fn().mockResolvedValue(reserva), update: atualizar };
  const receipt = vi.fn().mockImplementation(async ({ where }) => where.titularMatriculaId === "m" ? [{ id: "credito-antecipado" }] : []);
  const tx = { $executeRaw: vi.fn(), $queryRaw: vi.fn(), reservaVagaMatricula: tabela, reservaAgendaParticular: tabela,
    matricula: { findUniqueOrThrow: vi.fn().mockResolvedValue({ status: "AGUARDANDO", contratoOk: false, confirmacaoContratoEm: null, contratoDocumentoId: null, preparacaoComercial: { reservaParticularId: "r" } }) },
    pagamentoInformado: { findMany: vi.fn().mockResolvedValue([]) }, recebimento: { findMany: receipt }, cobranca: { findMany: vi.fn().mockResolvedValue([]) },
    processoAssinaturaContratual: { findMany: vi.fn().mockResolvedValue([]) }, documento: { findMany: vi.fn().mockResolvedValue([]) },
  } as unknown as Prisma.TransactionClient;
  const r = await (particular ? conferirVencimentoParticularTx : conferirVencimentoReservaTx)(tx, "r");
  expect(r).toMatchObject({ status: "MANTIDA_PENDENCIA", resultado: "PENDENCIA_REGISTRADA" });
  expect(receipt).toHaveBeenCalledWith(expect.objectContaining({ where: { titularMatriculaId: "m" } }));
  expect(atualizar).toHaveBeenCalledWith({ where: { id: "r" }, data: { status: "MANTIDA_PENDENCIA" } });
  expect(eventos).toHaveBeenCalledWith(tx, expect.objectContaining({ payload: expect.objectContaining({ recebimentosIds: ["credito-antecipado"] }) }));
});

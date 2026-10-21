import { beforeEach, expect, it } from "vitest";
import { MotivoPendenciaAvisoAgenda } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { registrarPendenciaAvisoAgendaTx, resolverPendenciaAvisoAgendaTx } from "./pendencias";

let eventoId: string, matriculaId: string, secretariaId: string;
beforeEach(async () => { await truncarBanco(); const c = await seedCatalogoMinimo(); secretariaId = (await criarUsuario(["SECRETARIA_ACADEMICA"])).id; const aluno = await prisma.aluno.create({ data: { primeiroNome: "Pendente", paisId: c.pais.id } }); const m = await prisma.matricula.create({ data: { alunoId: aluno.id, produtoId: c.produto.id, paisId: c.pais.id, moeda: "CRC", status: "ATIVA" } }); matriculaId = m.id; eventoId = (await prisma.evento.create({ data: { tipo: "ReplanejamentoConjuntoAplicado", agregadoTipo: "ConfiguracaoOperacional", agregadoId: "escola" } })).id; });

it("registra uma pendência idempotente e preserva seu histórico ao resolver", async () => {
  const entrada = { eventoId, matriculaId, motivo: MotivoPendenciaAvisoAgenda.SEM_DESTINATARIO_AUTORIZADO };
  const primeiro = await prisma.$transaction((tx) => registrarPendenciaAvisoAgendaTx(tx, entrada));
  const replay = await prisma.$transaction((tx) => registrarPendenciaAvisoAgendaTx(tx, entrada));
  expect(primeiro.criada).toBe(true); expect(replay).toEqual({ id: primeiro.id, criada: false });
  await expect(prisma.pendenciaAvisoAgenda.delete({ where: { id: primeiro.id } })).rejects.toThrow();
  expect(await prisma.$transaction((tx) => resolverPendenciaAvisoAgendaTx(tx, { id: primeiro.id, resolvidaPorId: secretariaId, observacaoResolucao: "Contato acadêmico conferido pela Secretaria" }))).toBe(true);
  expect(await prisma.$transaction((tx) => resolverPendenciaAvisoAgendaTx(tx, { id: primeiro.id, resolvidaPorId: secretariaId, observacaoResolucao: "Contato acadêmico conferido pela Secretaria" }))).toBe(true);
  expect(await prisma.pendenciaAvisoAgenda.findUniqueOrThrow({ where: { id: primeiro.id } })).toMatchObject({ situacao: "RESOLVIDA", resolvidaPorId: secretariaId });
});
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";
const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { preverPausaMatriculas } from "./pausa-previa";
let alunoId: string, matriculaId: string, outraId: string;
beforeEach(async () => {
  await truncarBanco();
  await prisma.configuracaoOperacional.create({ data: { fusoInstitucional: "America/Sao_Paulo" } });
  const sec = await criarUsuario([Papel.SECRETARIA_ACADEMICA]);
  authMock.mockResolvedValue({ user: { id: sec.id } });
  const c = await seedCatalogoMinimo();
  alunoId = (await prisma.aluno.create({ data: { primeiroNome: "Prévia", paisId: c.pais.id } })).id;
  const base = { alunoId, produtoId: c.produto.id, paisId: c.pais.id, moeda: "CRC", status: "ATIVA" as const, referenciaCobertura: "MES_CIVIL" as const };
  matriculaId = (await prisma.matricula.create({ data: base })).id;
  outraId = (await prisma.matricula.create({ data: base })).id;
});
const entrada = () => ({ matriculaIds: [matriculaId], dataEfetiva: "2026-09-15" });
async function cobrar(id: string, inicio: string | null, fim: string | null, vencimento: string, recebido = 0) {
  return prisma.cobranca.create({ data: { matriculaId: id, tipo: "MENSALIDADE", valorOriginal: 100, valorNegociado: 100,
    saldo: 100 - recebido, valorRecebido: recebido, moeda: "CRC", vencimento: new Date(vencimento),
    coberturaInicio: inicio ? new Date(inicio) : null, coberturaFim: fim ? new Date(fim) : null } });
}
describe("prévia de pausa por seleção explícita de contratos", () => {
  it("usa cobertura, preserva estado e não inclui o outro contrato", async () => {
    await cobrar(matriculaId, "2026-09-01", "2026-09-30", "2026-10-20");
    await cobrar(matriculaId, "2026-10-01", "2026-10-31", "2026-09-01");
    const outra = await cobrar(outraId, null, null, "2026-09-01");
    const antes = await prisma.cobranca.findMany({ orderBy: { id: "asc" } });
    const r = await preverPausaMatriculas(alunoId, entrada());
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error(r.erro);
    expect(r.dado!.matriculas).toHaveLength(1);
    expect(r.dado!.matriculas[0].pendencias).toEqual([]);
    expect(r.dado!.matriculas[0].periodos.map((p) => p.efeito).sort()).toEqual(["MANTER_PERIODO_INICIADO_INTEGRAL", "SUSPENDER_PERIODO_FUTURO"]);
    expect(JSON.stringify(r)).not.toContain(outra.id);
    expect(JSON.stringify(r)).not.toContain("valorRecebido");
    expect(await prisma.cobranca.findMany({ orderBy: { id: "asc" } })).toEqual(antes);
    expect((await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } })).status).toBe("ATIVA");
  });
  it("recusa seleção vazia, duplicada, inexistente ou de outro aluno", async () => {
    for (const ids of [[], [matriculaId, matriculaId], [matriculaId, "inexistente"]])
      expect((await preverPausaMatriculas(alunoId, { ...entrada(), matriculaIds: ids })).ok).toBe(false);
    expect((await preverPausaMatriculas("outro-aluno", entrada())).ok).toBe(false);
  });
  it("aponta cobertura ausente, sobreposição e saldo inconsistente sem ajustá-los", async () => {
    await cobrar(matriculaId, null, null, "2026-09-01");
    const parcial = await cobrar(matriculaId, "2026-10-01", "2026-10-31", "2026-09-01", 20);
    await prisma.cobranca.update({ where: { id: parcial.id }, data: { saldo: 90 } });
    await cobrar(matriculaId, "2026-10-15", "2026-11-15", "2026-10-15");
    const r = await preverPausaMatriculas(alunoId, entrada());
    if (!r.ok) throw new Error(r.erro);
    expect(r.dado!.matriculas[0].pendencias.map((p) => p.split(":")[0]).sort()).toEqual([
      "COBERTURA_A_CONFERIR", "COBERTURA_SOBREPOSTA", "RECEBIMENTO_FUTURO_A_CONFERIR",
    ]);
  });
  it("não permite consulta por vendedor ou professor", async () => {
    for (const papel of [Papel.VENDEDOR, Papel.PROFESSOR]) {
      const u = await criarUsuario([papel]);
      authMock.mockResolvedValue({ user: { id: u.id } });
      expect((await preverPausaMatriculas(alunoId, entrada())).ok).toBe(false);
    }
  });
});


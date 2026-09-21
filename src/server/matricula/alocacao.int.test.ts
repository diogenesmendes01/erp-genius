import { beforeEach, describe, expect, it, vi } from "vitest";
const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { Papel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { criarUsuario, eventosDo, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { consultarVinculosLegados, vincularAlocacaoLegada } from "./vinculo-legado";

let contexto: Awaited<ReturnType<typeof preparar>>;
async function preparar() {
  const c = await seedCatalogoMinimo();
  const nivel = await prisma.nivel.create({ data: { idiomaId: c.idioma.id, codigo: "A1", ordem: 1 } });
  const turma = await prisma.turma.create({ data: { nivelId: nivel.id, modalidadeId: c.modalidade.id } });
  const aluno = await prisma.aluno.create({ data: { primeiroNome: "Aluno", paisId: c.pais.id } });
  const outro = await prisma.aluno.create({ data: { primeiroNome: "Outro", paisId: c.pais.id } });
  const matricula = await prisma.matricula.create({ data: { alunoId: aluno.id, produtoId: c.produto.id, paisId: c.pais.id, moeda: "CRC" } });
  return { ...c, turma, aluno, outro, matricula };
}
beforeEach(async () => { await truncarBanco(); contexto = await preparar(); });

describe("B01 — integridade da alocação por matrícula", () => {
  it("histórico contratual rejeita matrícula de outra pessoa e preserva movimento legado", async () => {
    const { aluno, outro, matricula } = contexto;
    const legado = await prisma.movimentacaoAluno.create({ data: { alunoId: aluno.id, tipo: "MATRICULA" } });
    expect(legado.matriculaId).toBeNull();
    await expect(prisma.movimentacaoAluno.create({ data: { alunoId: outro.id, matriculaId: matricula.id, tipo: "TROCA_TURMA" } })).rejects.toThrow();
    const vinculado = await prisma.movimentacaoAluno.create({ data: { alunoId: aluno.id, matriculaId: matricula.id, tipo: "TROCA_TURMA" } });
    expect(vinculado.matriculaId).toBe(matricula.id);
    expect(await prisma.movimentacaoAluno.count()).toBe(2);
  });
  it("Secretaria confere o contrato exato sem alterar turma, datas ou duplicar auditoria", async () => {
    const { aluno, turma, matricula } = contexto;
    const usuario = await criarUsuario([Papel.SECRETARIA_ACADEMICA], "Secretaria");
    authMock.mockResolvedValue({ user: { id: usuario.id, papeis: usuario.papeis } });
    await prisma.matricula.update({ where: { id: matricula.id }, data: { status: "ATIVA" } });
    const legado = await prisma.alocacaoTurma.create({ data: { alunoId: aluno.id, turmaId: turma.id } });
    const dados = { alocacaoId: legado.id, matriculaId: matricula.id, motivo: "Contrato conferido pela equipe" };
    const consulta = await consultarVinculosLegados(aluno.id);
    expect(consulta.ok).toBe(true);
    if (!consulta.ok) throw new Error("Consulta indisponível");
    expect(consulta.dado).toEqual([{ alocacaoId: legado.id, turma: "A1", contratos: [{
      id: matricula.id, codigo: matricula.codigo, nome: `${contexto.idioma.nome} · ${contexto.modalidade.nome}`,
    }] }]);
    expect((await consultarVinculosLegados(contexto.outro.id))).toMatchObject({ ok: true, dado: [] });
    expect((await vincularAlocacaoLegada(dados)).ok).toBe(true);
    expect((await vincularAlocacaoLegada(dados)).ok).toBe(true);
    expect(await prisma.alocacaoTurma.findUnique({ where: { id: legado.id } })).toMatchObject({ ...legado, matriculaId: matricula.id });
    expect((await eventosDo("Matricula", matricula.id)).filter((e) => e.tipo === "AlocacaoLegadaVinculada")).toHaveLength(1);
    expect(await consultarVinculosLegados(aluno.id)).toMatchObject({ ok: true, dado: [] });
  });

  it("recusa contrato de outro aluno e sessão com papel revogado sem alterar o legado", async () => {
    const { outro, turma, matricula } = contexto;
    const usuario = await criarUsuario([Papel.SECRETARIA_ACADEMICA], "Secretaria");
    authMock.mockResolvedValue({ user: { id: usuario.id, papeis: usuario.papeis } });
    await prisma.matricula.update({ where: { id: matricula.id }, data: { status: "ATIVA" } });
    const legado = await prisma.alocacaoTurma.create({ data: { alunoId: outro.id, turmaId: turma.id } });
    const dados = { alocacaoId: legado.id, matriculaId: matricula.id, motivo: "Tentativa de conferência" };
    expect((await vincularAlocacaoLegada(dados)).ok).toBe(false);
    await prisma.usuario.update({ where: { id: usuario.id }, data: { papeis: [Papel.PROFESSOR] } });
    expect((await consultarVinculosLegados(outro.id)).ok).toBe(false);
    expect((await vincularAlocacaoLegada(dados)).ok).toBe(false);
    expect((await prisma.alocacaoTurma.findUniqueOrThrow({ where: { id: legado.id } })).matriculaId).toBeNull();
  });

  it("persiste e consulta o vínculo exato sem inferir matrícula para o legado", async () => {
    const { aluno, outro, turma, matricula } = contexto;
    const vinculada = await prisma.alocacaoTurma.create({ data: { alunoId: aluno.id, turmaId: turma.id, matriculaId: matricula.id } });
    const legado = await prisma.alocacaoTurma.create({ data: { alunoId: outro.id, turmaId: turma.id } });
    expect(legado.matriculaId).toBeNull();
    const contrato = await prisma.matricula.findUniqueOrThrow({ where: { id: matricula.id }, include: { alocacoes: true } });
    expect(contrato.alocacoes.map((a) => a.id)).toEqual([vinculada.id]);
  });

  it("banco rejeita vínculo com contrato de outro aluno, inclusive por SQL direto", async () => {
    const { outro, turma, matricula } = contexto;
    await expect(prisma.$executeRaw`INSERT INTO "AlocacaoTurma" (id, "alunoId", "turmaId", "matriculaId") VALUES ('vinculo-invalido', ${outro.id}, ${turma.id}, ${matricula.id})`).rejects.toThrow();
    expect(await prisma.alocacaoTurma.count()).toBe(0);
  });

  it("não permite trocar a identidade de contrato que já tem alocação", async () => {
    const { aluno, outro, turma, matricula } = contexto;
    await prisma.alocacaoTurma.create({ data: { alunoId: aluno.id, turmaId: turma.id, matriculaId: matricula.id } });
    await expect(prisma.matricula.update({ where: { id: matricula.id }, data: { alunoId: outro.id } })).rejects.toThrow();
    expect((await prisma.matricula.findUniqueOrThrow({ where: { id: matricula.id } })).alunoId).toBe(aluno.id);
  });

  it("permite contratos em turmas distintas e conserva uma alocação ativa por matrícula", async () => {
    const { aluno, turma, matricula, produto, pais } = contexto;
    const outra = await prisma.matricula.create({ data: { alunoId: aluno.id, produtoId: produto.id, paisId: pais.id, moeda: "CRC" } });
    const ativa = await prisma.alocacaoTurma.create({ data: { alunoId: aluno.id, turmaId: turma.id, matriculaId: matricula.id } });
    await expect(prisma.alocacaoTurma.create({ data: { alunoId: aluno.id, turmaId: turma.id, matriculaId: outra.id } })).rejects.toThrow();
    const segundaTurma = await prisma.turma.create({ data: { nivelId: turma.nivelId, modalidadeId: turma.modalidadeId } });
    const independente = await prisma.alocacaoTurma.create({ data: { alunoId: aluno.id, turmaId: segundaTurma.id, matriculaId: outra.id } });
    const terceiraTurma = await prisma.turma.create({ data: { nivelId: turma.nivelId, modalidadeId: turma.modalidadeId } });
    await expect(prisma.alocacaoTurma.create({ data: { alunoId: aluno.id, turmaId: terceiraTurma.id, matriculaId: matricula.id } })).rejects.toThrow();
    await prisma.alocacaoTurma.update({ where: { id: ativa.id }, data: { ativa: false, encerradaEm: new Date() } });
    await prisma.alocacaoTurma.create({ data: { alunoId: aluno.id, turmaId: turma.id, matriculaId: matricula.id } });
    expect(await prisma.alocacaoTurma.count({ where: { matriculaId: matricula.id } })).toBe(2);
    expect(await prisma.alocacaoTurma.findUniqueOrThrow({ where: { id: independente.id } })).toEqual(independente);
  });

  it.each([true, false])("recusa coexistência de legado e contrato, legado primeiro=%s", async legadoPrimeiro => {
    const { aluno, turma, matricula } = contexto;
    const segundaTurma = await prisma.turma.create({ data: { nivelId: turma.nivelId, modalidadeId: turma.modalidadeId } });
    await prisma.alocacaoTurma.create({ data: { alunoId: aluno.id, turmaId: turma.id, matriculaId: legadoPrimeiro ? null : matricula.id } });
    await expect(prisma.alocacaoTurma.create({ data: { alunoId: aluno.id, turmaId: segundaTurma.id, matriculaId: legadoPrimeiro ? matricula.id : null } })).rejects.toThrow(/legado/);
    expect(await prisma.alocacaoTurma.count()).toBe(1);
  });
});

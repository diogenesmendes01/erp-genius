import { describe, it, expect, beforeEach, vi } from "vitest";
import { Papel } from "@prisma/client";

// FASE 3 (doc 03): diário/frequência, notas, progressão sugerida + certificado e o
// PORTAL DO ALUNO (row-level pelo vínculo usuário↔aluno). Sessão mockada; papéis do banco.

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { truncarBanco, criarUsuario, seedCatalogoMinimo, eventosDo } from "@/test/integracao";
import { aprovarNivelAluno, criarAcessoPortal, lancarNotas, registrarAula, registrarTesteNivel, salvarAvaliacao } from "./acoes-legado";
import { diarioDaTurma } from "./consultas-legado";

let professor: Awaited<ReturnType<typeof criarUsuario>>;
let secretaria: Awaited<ReturnType<typeof criarUsuario>>;
let catalogo: Awaited<ReturnType<typeof seedCatalogoMinimo>>;

beforeEach(async () => {
  await truncarBanco();
  professor = await criarUsuario([Papel.PROFESSOR], "Prof");
  secretaria = await criarUsuario([Papel.SECRETARIA_ACADEMICA], "Sec");
  catalogo = await seedCatalogoMinimo();
});

async function seedTurmaComAluno() {
  const nivel = await prisma.nivel.create({ data: { idiomaId: catalogo.idioma.id, codigo: "A1", ordem: 1 } });
  const turma = await prisma.turma.create({
    data: {
      nome: "Salvador",
      modalidadeId: catalogo.modalidade.id,
      nivelId: nivel.id,
      professorId: professor.id,
      status: "EM_ANDAMENTO",
      capacidade: 10,
    },
  });
  const aluno = await prisma.aluno.create({
    data: { codigo: "A-000001", primeiroNome: "Maria", sobrenome: "Rojas", paisId: catalogo.pais.id },
  });
  await prisma.alocacaoTurma.create({ data: { alunoId: aluno.id, turmaId: turma.id } });
  return { turma, aluno, nivel };
}


// A Fase 3 simplificada foi substituída pela SPEC: os endpoints antigos não
// podem contornar diário histórico, oficialização ou convite individual.
describe("compatibilidade acadêmica após integração da main", () => {
  it("impede escrita pelo diário/notas antigos sem criar dados paralelos", async () => {
    const { turma, aluno } = await seedTurmaComAluno();
    authMock.mockResolvedValue({ user: { id: professor.id } });
    const aula = await registrarAula({ turmaId: turma.id, dataISO: "2026-08-20", presencas: [{ alunoId: aluno.id, presente: true }] });
    const avaliacao = await salvarAvaliacao({ turmaId: turma.id, nome: "Final", peso: 1 });
    const notas = await lancarNotas({ avaliacaoId: "legada", notas: [{ alunoId: aluno.id, valor: 90 }] });
    expect(aula.ok).toBe(false); expect(avaliacao.ok).toBe(false); expect(notas.ok).toBe(false);
    expect(await prisma.aula.count()).toBe(0); expect(await prisma.avaliacao.count()).toBe(0); expect(await prisma.nota.count()).toBe(0);
  });
  it("equipe não define senha nem cria identidade paralela do aluno", async () => {
    const { aluno } = await seedTurmaComAluno();
    authMock.mockResolvedValue({ user: { id: secretaria.id } });
    const r = await criarAcessoPortal({ alunoId: aluno.id, email: "aluno@teste.test", senha: "senha-proibida" });
    expect(r.ok).toBe(false);
    expect(await prisma.usuario.count({ where: { papeis: { has: Papel.ALUNO } } })).toBe(0);
    expect((await prisma.aluno.findUniqueOrThrow({ where: { id: aluno.id } })).usuarioId).toBeNull();
  });
  it("secretaria não emite certificado nem consulta notas legadas", async () => {
    const { turma, aluno } = await seedTurmaComAluno();
    authMock.mockResolvedValue({ user: { id: secretaria.id } });
    expect((await aprovarNivelAluno(turma.id, aluno.id)).ok).toBe(false);
    await expect(diarioDaTurma(turma.id)).rejects.toThrow();
    expect(await prisma.certificado.count()).toBe(0);
  });
  it("gestão não emite certificado sem fechamento da matrícula", async () => {
    const { turma, aluno } = await seedTurmaComAluno();
    const gestor = await criarUsuario([Papel.GERENTE_PEDAGOGICO]);
    authMock.mockResolvedValue({ user: { id: gestor.id } });
    expect((await aprovarNivelAluno(turma.id, aluno.id)).ok).toBe(false);
    expect(await prisma.certificado.count()).toBe(0);
  });
  it("preserva teste de nível no escopo docente e sua autoria", async () => {
    const { aluno, nivel } = await seedTurmaComAluno();
    const outro = await prisma.aluno.create({ data: { primeiroNome: "Outro", paisId: catalogo.pais.id } });
    authMock.mockResolvedValue({ user: { id: professor.id } });
    expect((await registrarTesteNivel({ alunoId: outro.id, nivelId: nivel.id, pontuacao: 80 })).ok).toBe(false);
    expect((await registrarTesteNivel({ alunoId: aluno.id, nivelId: nivel.id, pontuacao: 90 })).ok).toBe(true);
    expect(await prisma.testeNivel.count()).toBe(1);
    expect((await eventosDo("Aluno", aluno.id))[0].autorId).toBe(professor.id);
  });
  it("preserva unicidade dos certificados históricos", async () => {
    const { aluno, nivel } = await seedTurmaComAluno();
    await prisma.certificado.create({ data: { alunoId: aluno.id, nivelId: nivel.id, codigoValidacao: "AAAAAAAAAAAA" } });
    await expect(prisma.certificado.create({ data: { alunoId: aluno.id, nivelId: nivel.id, codigoValidacao: "BBBBBBBBBBBB" } })).rejects.toThrow();
  });
});

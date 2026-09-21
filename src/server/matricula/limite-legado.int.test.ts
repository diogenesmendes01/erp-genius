import { beforeEach, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";
const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/_shared", async original => {
  const real = await original<typeof import("@/server/_shared")>();
  return { ...real, exigirSessaoComPapel: async (...papeis: Papel[]) => {
    const session = await authMock();
    const u = await prisma.usuario.findUniqueOrThrow({ where: { id: session.user.id }, select: { id: true, nome: true, papeis: true, ativo: true } });
    if (!u.ativo) throw new real.ErroPermissao();
    real.exigirPapel(u, ...papeis); return u;
  } };
});
import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { pausarAluno, encerrarAluno } from "@/server/alunos/acoes";
import { solicitarRetomada } from "@/server/retomada/acoes";
import { impedimentoFluxoGlobal } from "./limite-legado";

beforeEach(async () => { await truncarBanco(); });

async function preparar(quantidade: number, papel: Papel) {
  const cat = await seedCatalogoMinimo();
  const autor = await criarUsuario([papel]); authMock.mockResolvedValue({ user: { id: autor.id } });
  const aluno = await prisma.aluno.create({ data: { primeiroNome: "Aluno com contratos", paisId: cat.pais.id } });
  const matriculas = [];
  for (let i = 0; i < quantidade; i++) {
    const m = await prisma.matricula.create({ data: { alunoId: aluno.id, paisId: cat.pais.id, produtoId: cat.produto.id, moeda: "CRC", status: "ATIVA" } });
    matriculas.push(m);
    await prisma.cobranca.create({ data: { matriculaId: m.id, tipo: "MENSALIDADE", moeda: "CRC", valorOriginal: 100, valorNegociado: 100, saldo: 100, vencimento: new Date("2099-01-10") } });
  }
  return { aluno, matriculas, cat };
}

async function fotografar(alunoId: string) {
  return {
    aluno: await prisma.aluno.findUniqueOrThrow({ where: { id: alunoId } }),
    matriculas: await prisma.matricula.findMany({ where: { alunoId }, orderBy: { id: "asc" } }),
    cobrancas: await prisma.cobranca.findMany({ where: { matricula: { alunoId } }, orderBy: { id: "asc" } }),
    alocacoes: await prisma.alocacaoTurma.findMany({ where: { alunoId }, orderBy: { id: "asc" } }),
    movimentos: await prisma.movimentacaoAluno.count({ where: { alunoId } }),
    propostas: await prisma.propostaRetomada.count({ where: { alunoId } }),
    eventos: await prisma.evento.count(),
  };
}

const operacoes = {
  PAUSAR: (id: string) => pausarAluno(id, { motivo: "Pedido do aluno" }),
  ENCERRAR: (id: string) => encerrarAluno(id, { motivo: "Desistiu" }),
  RETOMAR: (id: string) => solicitarRetomada(id, { opcao: "MANTER_VENCIMENTOS", motivo: "Pedido do aluno" }),
};

it.each([Papel.SECRETARIA_ACADEMICA, Papel.ADMINISTRADOR])("%s não altera globalmente dois contratos sem movimentação anterior", async papel => {
  const { aluno } = await preparar(2, papel);
  expect(await impedimentoFluxoGlobal(prisma, aluno.id)).toContain("selecione os contratos");
  const antes = await fotografar(aluno.id);
  for (const executar of Object.values(operacoes)) {
    expect(await executar(aluno.id)).toMatchObject({ ok: false, erro: expect.stringContaining("selecione os contratos") });
    expect(await fotografar(aluno.id)).toEqual(antes);
  }
});

it("um único contrato com vínculo acadêmico já exige movimentação contratual", async () => {
  const { aluno, matriculas, cat } = await preparar(1, Papel.ADMINISTRADOR);
  expect(await impedimentoFluxoGlobal(prisma, aluno.id)).toBeNull();
  const nivel = await prisma.nivel.create({ data: { idiomaId: cat.produto.idiomaId, codigo: "A1-contratual", ordem: 1 } });
  const turma = await prisma.turma.create({ data: { modalidadeId: cat.produto.modalidadeId, nivelId: nivel.id } });
  await prisma.alocacaoTurma.create({ data: { alunoId: aluno.id, matriculaId: matriculas[0].id, turmaId: turma.id } });
  expect(await impedimentoFluxoGlobal(prisma, aluno.id)).toContain("fluxo contratual");
  const antes = await fotografar(aluno.id);
  for (const executar of Object.values(operacoes)) {
    expect(await executar(aluno.id)).toMatchObject({ ok: false, erro: expect.stringContaining("fluxo contratual") });
    expect(await fotografar(aluno.id)).toEqual(antes);
  }
});

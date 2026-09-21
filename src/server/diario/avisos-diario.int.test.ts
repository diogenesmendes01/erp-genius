import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/_shared", async (original) => {
  const real = await original<typeof import("@/server/_shared")>();
  return {
    ...real,
    exigirSessaoComPapel: async (...papeis: Papel[]) => {
      const sessao = await authMock();
      const usuario = await prisma.usuario.findUniqueOrThrow({
        where: { id: sessao.user.id },
        select: { id: true, nome: true, papeis: true, ativo: true },
      });
      if (!usuario.ativo) throw new real.ErroPermissao();
      real.exigirPapel(usuario, ...papeis);
      return usuario;
    },
  };
});

import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { designarRegularizacaoAula, revogarRegularizacaoAula } from "./regularizacao-designacao";
import { salvarAulaDiario } from "./acoes";
import { solicitarConclusaoSemGravacao, decidirConclusaoSemGravacao } from "./excecao-gravacao";
import { consultarAvisosDiario, consultarConfiguracaoAvisosDiario, salvarConfiguracaoAvisosDiario } from "./avisos-pendencias-diario";

const AGORA = new Date("2026-06-16T15:00:00.000Z");
let professorId: string;
let outroProfessorId: string;
let regularizadorId: string;
let gestorId: string;
let administradorId: string;
let secretariaId: string;
let turmaId: string;
let alunoId: string;

const entrar = (id: string) => authMock.mockResolvedValue({ user: { id } });

beforeEach(async () => {
  vi.clearAllMocks();
  await truncarBanco();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(AGORA);
  const catalogo = await seedCatalogoMinimo();
  professorId = (await criarUsuario([Papel.PROFESSOR], "Professor responsável")).id;
  outroProfessorId = (await criarUsuario([Papel.PROFESSOR], "Outro professor")).id;
  regularizadorId = (await criarUsuario([Papel.PROFESSOR], "Professor regularizador")).id;
  gestorId = (await criarUsuario([Papel.GERENTE_PEDAGOGICO], "Gestão pedagógica")).id;
  administradorId = (await criarUsuario([Papel.ADMINISTRADOR], "Administração")).id;
  secretariaId = (await criarUsuario([Papel.SECRETARIA_ACADEMICA], "Secretaria")).id;
  const nivel = await prisma.nivel.create({ data: { idiomaId: catalogo.idioma.id, codigo: "Q22", ordem: 1 } });
  const turma = await prisma.turma.create({ data: {
    modalidadeId: catalogo.modalidade.id,
    nivelId: nivel.id,
    professorId,
    vinculosDocentes: { create: { professorId, inicio: new Date("2026-01-01T00:00:00.000Z") } },
  } });
  turmaId = turma.id;
  alunoId = (await prisma.aluno.create({ data: {
    primeiroNome: "Aluno",
    sobrenome: "Q22",
    paisId: catalogo.pais.id,
    alocacoes: { create: { turmaId, criadoEm: new Date("2026-01-01T00:00:00.000Z") } },
  } })).id;
  entrar(professorId);
});

afterEach(() => vi.useRealTimers());

async function aula(
  id: string,
  dados: Partial<{ inicio: Date; fim: Date; status: "PREVISTO" | "CANCELADO" | "MINISTRADO"; professorId: string }> = {},
) {
  const inicio = dados.inicio ?? new Date(AGORA.getTime() - 90 * 60_000);
  const fim = dados.fim ?? new Date(AGORA.getTime() - 30 * 60_000);
  return prisma.encontroAgenda.create({ data: {
    id,
    turmaId,
    professorId: dados.professorId ?? professorId,
    preparadorId: gestorId,
    inicio,
    fim,
    fusoOrigem: "UTC",
    finalidade: "AULA",
    status: dados.status ?? "PREVISTO",
    motivo: "Aula usada para conferir aviso interno pendente",
    chaveIdempotencia: `q22-${id}`,
    entradaHash: "fixture",
  } });
}

it("não cria ciclo quando os parâmetros obrigatórios ainda não foram configurados", async () => {
  const encontro = await aula("q22-sem-config");
  entrar(professorId);
  expect(await consultarAvisosDiario({})).toMatchObject({
    ok: true,
    dado: { configurada: false, itens: [expect.objectContaining({ encontroId: encontro.id, vencimento: null })] },
  });
  expect(await prisma.avisoPendenciaDiario.count({ where: { encontroId: encontro.id } })).toBe(0);
});

it("consulta administrativa da configuração não gera ciclos e nega outros papéis", async () => {
  const encontro = await aula("q22-consulta-config");
  for (const usuario of [professorId, gestorId, secretariaId]) {
    entrar(usuario);
    expect(await consultarConfiguracaoAvisosDiario()).toMatchObject({ ok: false });
  }
  entrar(administradorId);
  expect(await consultarConfiguracaoAvisosDiario()).toMatchObject({
    ok: true,
    dado: { prazoRegularizacaoDiarioMinutos: null, intervaloLembreteDiarioMinutos: null },
  });
  expect(await prisma.avisoPendenciaDiario.count({ where: { encontroId: encontro.id } })).toBe(0);
});

it("somente Administração ativa configura prazo e intervalo positivos", async () => {
  for (const usuario of [professorId, gestorId, secretariaId]) {
    entrar(usuario);
    expect(await salvarConfiguracaoAvisosDiario({
      prazoRegularizacaoDiarioMinutos: 60,
      intervaloLembreteDiarioMinutos: 15,
    })).toMatchObject({ ok: false });
  }
  const adminInativo = (await criarUsuario([Papel.ADMINISTRADOR], "Administração inativa")).id;
  await prisma.usuario.update({ where: { id: adminInativo }, data: { ativo: false } });
  entrar(adminInativo);
  expect(await salvarConfiguracaoAvisosDiario({
    prazoRegularizacaoDiarioMinutos: 60,
    intervaloLembreteDiarioMinutos: 15,
  })).toMatchObject({ ok: false });
  entrar(administradorId);
  expect(await salvarConfiguracaoAvisosDiario({
    prazoRegularizacaoDiarioMinutos: 0,
    intervaloLembreteDiarioMinutos: 15,
  })).toMatchObject({ ok: false });
  expect(await salvarConfiguracaoAvisosDiario({
    prazoRegularizacaoDiarioMinutos: 60,
    intervaloLembreteDiarioMinutos: 15,
  })).toMatchObject({ ok: true });
  await expect(prisma.$executeRaw`
    UPDATE "ConfiguracaoOperacional"
    SET "intervaloLembreteDiarioMinutos"=NULL
    WHERE id='escola'
  `).rejects.toThrow();
  await expect(prisma.$executeRaw`
    UPDATE "ConfiguracaoOperacional"
    SET "prazoRegularizacaoDiarioMinutos"=0
    WHERE id='escola'
  `).rejects.toThrow();
});

it("seleciona somente AULA prevista já terminada e mantém o ciclo idempotente", async () => {
  const passada = await aula("q22-passada", { fim: new Date(AGORA.getTime() - 20 * 60_000) });
  await aula("q22-futura", { inicio: new Date(AGORA.getTime() + 30 * 60_000), fim: new Date(AGORA.getTime() + 90 * 60_000) });
  await aula("q22-cancelada", { status: "CANCELADO" });
  await aula("q22-ministrada", { status: "MINISTRADO" });
  entrar(administradorId);
  expect(await salvarConfiguracaoAvisosDiario({ prazoRegularizacaoDiarioMinutos: 60, intervaloLembreteDiarioMinutos: 15 })).toMatchObject({ ok: true });

  entrar(professorId);
  const primeiro = await consultarAvisosDiario({});
  expect(primeiro).toMatchObject({
    ok: true,
    dado: {
      configurada: true,
      gestao: false,
      itens: [expect.objectContaining({ encontroId: passada.id, quantidadeLembretes: 1 })],
    },
  });
  const ciclos = await prisma.avisoPendenciaDiario.findMany({ where: { destinatarioId: professorId } });
  expect(ciclos).toHaveLength(1);
  expect(ciclos[0]).toMatchObject({ encontroId: passada.id, tipo: expect.any(String) });

  const repetida = await consultarAvisosDiario({});
  expect(repetida).toMatchObject({ ok: true, dado: { itens: [expect.objectContaining({ encontroId: passada.id, quantidadeLembretes: 1 })] } });
  expect(await prisma.avisoPendenciaDiario.count({ where: { destinatarioId: professorId } })).toBe(1);
});

it("emite lembrete no intervalo e alerta gestão somente depois do prazo", async () => {
  const encontro = await aula("q22-prazo", { fim: new Date(AGORA.getTime() - 30 * 60_000) });
  entrar(administradorId);
  await salvarConfiguracaoAvisosDiario({ prazoRegularizacaoDiarioMinutos: 60, intervaloLembreteDiarioMinutos: 15 });
  entrar(professorId);
  await consultarAvisosDiario({});
  vi.setSystemTime(new Date(AGORA.getTime() + 16 * 60_000));
  const lembrete = await consultarAvisosDiario({});
  expect(lembrete).toMatchObject({ ok: true, dado: { itens: [expect.objectContaining({ encontroId: encontro.id, quantidadeLembretes: 2 })] } });
  entrar(gestorId);
  expect(await consultarAvisosDiario({})).toMatchObject({
    ok: true,
    dado: { gestao: true, itens: [expect.objectContaining({ encontroId: encontro.id, atrasada: false })] },
  });

  vi.setSystemTime(new Date(AGORA.getTime() + 31 * 60_000));
  const vencido = await consultarAvisosDiario({});
  expect(vencido).toMatchObject({ ok: true, dado: { gestao: true, itens: [expect.objectContaining({ encontroId: encontro.id, atrasada: true })] } });
});

it("encerra o ciclo de docente desvinculado e não expõe a aula de outro professor", async () => {
  const propria = await aula("q22-vinculo-encerrado");
  await aula("q22-outra-sem-escopo", { professorId: outroProfessorId });
  entrar(administradorId);
  await salvarConfiguracaoAvisosDiario({ prazoRegularizacaoDiarioMinutos: 60, intervaloLembreteDiarioMinutos: 15 });
  entrar(professorId);
  expect(await consultarAvisosDiario({})).toMatchObject({
    ok: true,
    dado: { itens: [expect.objectContaining({ encontroId: propria.id })] },
  });
  await prisma.vinculoDocente.updateMany({
    where: { turmaId, professorId, fim: null },
    data: { fim: AGORA },
  });
  const depois = await consultarAvisosDiario({});
  expect(depois).toMatchObject({ ok: true, dado: { itens: [] } });
  expect(JSON.stringify(depois)).not.toContain("q22-outra-sem-escopo");
  expect(await prisma.avisoPendenciaDiario.findFirstOrThrow({
    where: { encontroId: propria.id, destinatarioId: professorId, tipo: "DOCENTE" },
  })).toMatchObject({ encerradoEm: expect.any(Date), encerramento: "CANCELADO" });
});

it("Q24 reabre o mesmo ciclo após nova designação sem duplicar lembrete no intervalo", async () => {
  const encontro = await aula("q22-q24-reabertura");
  entrar(administradorId);
  await salvarConfiguracaoAvisosDiario({ prazoRegularizacaoDiarioMinutos: 60, intervaloLembreteDiarioMinutos: 15 });
  entrar(gestorId);
  const primeira = await designarRegularizacaoAula({
    encontroId: encontro.id,
    responsavelId: regularizadorId,
    motivo: "Atribuição limitada para regularizar a pendência.",
    chaveIdempotencia: "q22-q24-primeira",
  });
  if (!primeira.ok || !primeira.dado) throw new Error(JSON.stringify(primeira));
  entrar(regularizadorId);
  await consultarAvisosDiario({});
  const cicloAntes = await prisma.avisoPendenciaDiario.findFirstOrThrow({
    where: { encontroId: encontro.id, destinatarioId: regularizadorId, tipo: "DOCENTE" },
  });
  expect(cicloAntes.quantidadeLembretes).toBe(1);

  entrar(gestorId);
  await revogarRegularizacaoAula({ designacaoId: primeira.dado.id, motivo: "Atribuição limitada encerrada." });
  entrar(regularizadorId);
  await consultarAvisosDiario({});
  expect(await prisma.avisoPendenciaDiario.findUniqueOrThrow({ where: { id: cicloAntes.id } }))
    .toMatchObject({ encerradoEm: expect.any(Date) });

  entrar(gestorId);
  expect(await designarRegularizacaoAula({
    encontroId: encontro.id,
    responsavelId: regularizadorId,
    motivo: "Nova atribuição para a mesma pendência.",
    chaveIdempotencia: "q22-q24-segunda",
  })).toMatchObject({ ok: true });
  entrar(regularizadorId);
  await consultarAvisosDiario({});
  const cicloDepois = await prisma.avisoPendenciaDiario.findUniqueOrThrow({ where: { id: cicloAntes.id } });
  expect(cicloDepois).toMatchObject({ encerradoEm: null, quantidadeLembretes: 1 });
  expect(await prisma.avisoPendenciaDiario.count({ where: { encontroId: encontro.id, destinatarioId: regularizadorId, tipo: "DOCENTE" } })).toBe(1);
  expect(await prisma.evento.count({ where: { tipo: "AvisoPendenciaDiarioEncerrado", agregadoId: encontro.id } })).toBe(1);
  expect(await prisma.evento.count({ where: { tipo: "AvisoPendenciaDiarioReaberto", agregadoId: encontro.id } })).toBe(1);
});

it("encerra ciclo cancelado além da primeira página sem concluir as vinte fontes válidas", async () => {
  entrar(administradorId);
  await salvarConfiguracaoAvisosDiario({ prazoRegularizacaoDiarioMinutos: 60, intervaloLembreteDiarioMinutos: 15 });
  const encontros = [];
  for (let indice = 0; indice < 21; indice++) {
    encontros.push(await aula(`q22-pagina-${indice}`, {
      inicio: new Date(AGORA.getTime() - (indice + 2) * 60_000),
      fim: new Date(AGORA.getTime() - (indice + 1) * 60_000),
    }));
  }
  entrar(professorId);
  const primeira = await consultarAvisosDiario({});
  if (!primeira.ok || !primeira.dado?.proximoCursor) throw new Error(JSON.stringify(primeira));
  expect(primeira.dado.itens).toHaveLength(20);
  const segunda = await consultarAvisosDiario({ cursor: primeira.dado.proximoCursor });
  expect(segunda).toMatchObject({ ok: true, dado: { itens: [expect.objectContaining({ encontroId: encontros[20]!.id })] } });
  await prisma.encontroAgenda.update({ where: { id: encontros[20]!.id }, data: { status: "CANCELADO" } });

  const atualizada = await consultarAvisosDiario({});
  expect(atualizada).toMatchObject({ ok: true, dado: { itens: expect.any(Array) } });
  expect(await prisma.avisoPendenciaDiario.findFirstOrThrow({
    where: { encontroId: encontros[20]!.id, destinatarioId: professorId, tipo: "DOCENTE" },
  })).toMatchObject({ encerradoEm: expect.any(Date), encerramento: "CANCELADO" });
  expect(await prisma.encontroAgenda.count({ where: { status: "PREVISTO" } })).toBe(20);
});

it("recalcula vencimento e próximo lembrete quando a configuração muda", async () => {
  const encontro = await aula("q22-config-alterada", { fim: new Date(AGORA.getTime() - 30 * 60_000) });
  entrar(administradorId);
  await salvarConfiguracaoAvisosDiario({ prazoRegularizacaoDiarioMinutos: 60, intervaloLembreteDiarioMinutos: 15 });
  entrar(professorId);
  await consultarAvisosDiario({});
  vi.setSystemTime(new Date(AGORA.getTime() + 16 * 60_000));
  await consultarAvisosDiario({});

  entrar(administradorId);
  await salvarConfiguracaoAvisosDiario({ prazoRegularizacaoDiarioMinutos: 120, intervaloLembreteDiarioMinutos: 20 });
  entrar(professorId);
  const atualizado = await consultarAvisosDiario({});
  expect(atualizado).toMatchObject({
    ok: true,
    dado: {
      configuracao: { prazoRegularizacaoDiarioMinutos: 120, intervaloLembreteDiarioMinutos: 20 },
      itens: [expect.objectContaining({
        encontroId: encontro.id,
        vencimento: new Date(AGORA.getTime() + 90 * 60_000).toISOString(),
        proximoLembreteEm: new Date(AGORA.getTime() + 36 * 60_000).toISOString(),
      })],
    },
  });
});

it("consultas concorrentes do mesmo professor deixam um único ciclo e lembrete", async () => {
  const encontro = await aula("q22-concorrencia");
  entrar(administradorId);
  await salvarConfiguracaoAvisosDiario({ prazoRegularizacaoDiarioMinutos: 60, intervaloLembreteDiarioMinutos: 15 });
  entrar(professorId);
  const resultados = await Promise.all([consultarAvisosDiario({}), consultarAvisosDiario({})]);
  expect(resultados).toEqual([
    expect.objectContaining({ ok: true }),
    expect.objectContaining({ ok: true }),
  ]);
  expect(await prisma.avisoPendenciaDiario.findMany({ where: { encontroId: encontro.id, destinatarioId: professorId } }))
    .toEqual([expect.objectContaining({ quantidadeLembretes: 1 })]);
});

it("delimita professor, honra designação Q24 vigente e encerra ciclo ao regularizar", async () => {
  const propria = await aula("q22-propria");
  await aula("q22-outra", { professorId: outroProfessorId });
  entrar(administradorId);
  await salvarConfiguracaoAvisosDiario({ prazoRegularizacaoDiarioMinutos: 60, intervaloLembreteDiarioMinutos: 15 });

  entrar(professorId);
  const proprio = await consultarAvisosDiario({});
  expect(proprio).toMatchObject({ ok: true, dado: { itens: [expect.objectContaining({ encontroId: propria.id })] } });
  expect(JSON.stringify(proprio)).not.toContain("q22-outra");

  entrar(gestorId);
  const designacao = await designarRegularizacaoAula({
    encontroId: propria.id,
    responsavelId: regularizadorId,
    motivo: "Responsável designado para a pendência desta aula.",
    chaveIdempotencia: "q22-designacao",
  });
  expect(designacao).toMatchObject({ ok: true });
  entrar(regularizadorId);
  expect(await consultarAvisosDiario({})).toMatchObject({ ok: true, dado: { itens: [expect.objectContaining({ encontroId: propria.id })] } });

  entrar(gestorId);
  if (!designacao.ok || !designacao.dado) throw new Error(JSON.stringify(designacao));
  await revogarRegularizacaoAula({ designacaoId: designacao.dado.id, motivo: "Atribuição limitada revogada." });
  entrar(regularizadorId);
  expect(await consultarAvisosDiario({})).toMatchObject({ ok: true, dado: { itens: [] } });

  entrar(professorId);
  const diario = await salvarAulaDiario({
    encontroId: propria.id,
    turmaId,
    ocorridaEm: propria.inicio.toISOString(),
    conteudo: "Conteúdo regularizado para encerrar o aviso da aula.",
    registros: [{ alunoId, presente: true }],
  });
  if (!diario.ok || !diario.dado) throw new Error(JSON.stringify(diario));
  const excecao = await solicitarConclusaoSemGravacao({
    encontroId: propria.id,
    motivo: "Gravação não recuperável; registros da aula conferidos.",
    chaveIdempotencia: "q22-resolucao",
  });
  if (!excecao.ok || !excecao.dado) throw new Error(JSON.stringify(excecao));
  entrar(administradorId);
  expect(await decidirConclusaoSemGravacao({
    excecaoId: excecao.dado.id,
    aprovar: true,
    motivo: "Exceção conferida por pessoa diferente do autor.",
  })).toMatchObject({ ok: true });
  entrar(professorId);
  expect(await consultarAvisosDiario({})).toMatchObject({ ok: true, dado: { itens: [] } });
  expect(await prisma.avisoPendenciaDiario.findFirstOrThrow({ where: { encontroId: propria.id, destinatarioId: professorId } }))
    .toMatchObject({ encerradoEm: expect.any(Date) });
});

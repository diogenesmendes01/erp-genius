import { beforeEach, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { carregarFrequenciaNivelTx } from "./frequencia-nivel-tx";

let professorId: string;
let gestorId: string;
let alunoId: string;
let matriculaId: string;
let nivelId: string;
let turmaOrigemId: string;
let turmaDestinoId: string;
let alocacaoOrigemId: string;

const inicio = new Date("2026-01-01T00:00:00.000Z");

async function apurar(agora: string) {
  return prisma.$transaction(tx => carregarFrequenciaNivelTx(tx, {
    matriculaId,
    nivelId,
    minimoPercentual: "75",
    agora: new Date(agora),
  }));
}

async function criarAula(turmaId: string, inicioAula: string, participacao: "PRESENTE" | "FALTA" | "IMPEDIDO_POR_RESTRICAO" | "PENDENTE", status: "MINISTRADO" | "PREVISTO" = "MINISTRADO") {
  const inicioEncontro = new Date(inicioAula);
  const aula = await prisma.encontroAgenda.create({ data: {
    turmaId,
    professorId,
    preparadorId: gestorId,
    inicio: inicioEncontro,
    fim: new Date(inicioEncontro.getTime() + 60 * 60 * 1000),
    fusoOrigem: "UTC",
    status: "PREVISTO",
    motivo: "Encontro da apuração histórica de frequência",
    chaveIdempotencia: `frequencia-nivel-${turmaId}-${inicioAula}`,
    entradaHash: "fixture",
    ...(status === "MINISTRADO" ? {
      diario: { create: {
        turmaId,
        professorId,
        ocorridaEm: inicioEncontro,
        conteudo: "Aula histórica",
        registros: { create: {
          alunoId,
          matriculaId,
          nomeAluno: "Aluna de frequência",
          presente: participacao === "PRESENTE",
          participacao: participacao === "PENDENTE" ? null : participacao,
        } },
      } },
    } : {}),
  } });
  if (status === "MINISTRADO") await prisma.encontroAgenda.update({ where: { id: aula.id }, data: { status: "MINISTRADO" } });
  return aula;
}

beforeEach(async () => {
  await truncarBanco();
  const catalogo = await seedCatalogoMinimo();
  professorId = (await criarUsuario(["PROFESSOR"])).id;
  gestorId = (await criarUsuario(["GERENTE_PEDAGOGICO"])).id;
  const nivel = await prisma.nivel.create({ data: { idiomaId: catalogo.idioma.id, codigo: "A1", ordem: 1 } });
  nivelId = nivel.id;
  const origem = await prisma.turma.create({ data: { modalidadeId: catalogo.modalidade.id, nivelId, professorId, dataInicio: inicio } });
  const destino = await prisma.turma.create({ data: { modalidadeId: catalogo.modalidade.id, nivelId, professorId, dataInicio: inicio } });
  turmaOrigemId = origem.id;
  turmaDestinoId = destino.id;
  alunoId = (await prisma.aluno.create({ data: { primeiroNome: "Aluna de frequência", paisId: catalogo.pais.id } })).id;
  matriculaId = (await prisma.matricula.create({ data: {
    alunoId,
    produtoId: catalogo.produto.id,
    paisId: catalogo.pais.id,
    moeda: "CRC",
    status: "ATIVA",
    ativadaEm: inicio,
  } })).id;
  alocacaoOrigemId = (await prisma.alocacaoTurma.create({ data: {
    alunoId,
    matriculaId,
    turmaId: turmaOrigemId,
    criadoEm: inicio,
  } })).id;
});

it("agrega participação de vínculos históricos no mesmo nível sem o falso bloqueio entre turmas", async () => {
  await criarAula(turmaOrigemId, "2026-01-10T10:00:00.000Z", "PRESENTE");
  const transicao = new Date("2026-01-15T00:00:00.000Z");
  await prisma.alocacaoTurma.update({ where: { id: alocacaoOrigemId }, data: { ativa: false, encerradaEm: transicao } });
  const destino = await prisma.alocacaoTurma.create({ data: { alunoId, matriculaId, turmaId: turmaDestinoId, criadoEm: transicao } });
  await criarAula(turmaDestinoId, "2026-01-20T10:00:00.000Z", "FALTA");

  const resultado = await apurar("2026-02-01T00:00:00.000Z");
  expect(resultado).toMatchObject({
    base: 2,
    presencas: 1,
    faltas: 1,
    regularizadas: 0,
    alocacoesIds: [alocacaoOrigemId, destino.id],
    escopo: "MATRICULA_NIVEL",
  });
  expect(resultado.pendenciasHistoricas.map(pendencia => pendencia.motivo)).not.toContain("CONFERIR_APROVEITAMENTO_ENTRE_VINCULOS");
  expect(resultado.memoria.map(aula => aula.aulaId)).toHaveLength(2);
  expect(new Set(resultado.memoria.map(aula => aula.aulaId)).size).toBe(2);
  expect((await apurar("2026-02-02T00:00:00.000Z")).fonteHash).toBe(resultado.fonteHash);
});

it("mantém encontros previstos fora da base e bloqueia temporalmente sem alterar o hash só pelo relógio", async () => {
  const futuro = await criarAula(turmaOrigemId, "2026-03-10T10:00:00.000Z", "PENDENTE", "PREVISTO");
  const antes = await apurar("2026-02-01T00:00:00.000Z");
  expect(antes).toMatchObject({ base: 0, atendeMinimo: null });
  expect(antes.pendenciasHistoricas).toContainEqual({ origemId: futuro.id, motivo: "ENCONTROS_A_REALIZAR" });
  const depois = await apurar("2026-03-11T00:00:00.000Z");
  expect(depois.base).toBe(0);
  expect(depois.pendencias).toContainEqual({ aulaId: futuro.id, motivo: "CONCLUSAO_DA_AULA" });
  expect(depois.pendenciasHistoricas.map(pendencia => pendencia.motivo)).not.toContain("ENCONTROS_A_REALIZAR");
  expect(depois.fonteHash).toBe(antes.fonteHash);
});

it("não deduz legado e sinaliza intervalos de vínculos sobrepostos", async () => {
  await prisma.alocacaoTurma.update({ where: { id: alocacaoOrigemId }, data: {
    ativa: false,
    encerradaEm: new Date("2026-01-20T00:00:00.000Z"),
  } });
  await prisma.alocacaoTurma.create({ data: {
    alunoId,
    matriculaId,
    turmaId: turmaDestinoId,
    criadoEm: new Date("2026-01-15T00:00:00.000Z"),
  } });
  const legado = await prisma.alocacaoTurma.create({ data: {
    alunoId,
    turmaId: turmaOrigemId,
    ativa: false,
    criadoEm: new Date("2025-12-01T00:00:00.000Z"),
  } });

  const resultado = await apurar("2026-02-01T00:00:00.000Z");
  expect(resultado.atendeMinimo).toBeNull();
  expect(resultado.pendenciasHistoricas).toEqual(expect.arrayContaining([
    { origemId: expect.stringMatching(new RegExp(`^${alocacaoOrigemId}:.+$`)), motivo: "VINCULOS_SOBREPOSTOS_NO_NIVEL" },
    { origemId: legado.id, motivo: "VINCULO_LEGADO_SEM_MATRICULA" },
    { origemId: legado.id, motivo: "VINCULO_LEGADO_SEM_LIMITE_HISTORICO" },
  ]));
});

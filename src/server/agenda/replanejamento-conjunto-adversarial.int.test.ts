import { beforeEach, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";

let preparadorId: string;
let decisorId: string;
let catalogo: Awaited<ReturnType<typeof seedCatalogoMinimo>>;

async function base() {
  const c = await seedCatalogoMinimo();
  preparadorId = (await criarUsuario(["SECRETARIA_ACADEMICA"])).id;
  decisorId = (await criarUsuario(["GERENTE_PEDAGOGICO"])).id;
  await prisma.configuracaoOperacional.create({ data: { id: "escola", fusoInstitucional: "UTC" } });
  return c;
}

async function criarRevisao(snapshot: object = { revisoes: [] }) {
  const calendario = await prisma.versaoCalendarioEscolar.create({ data: {
    versao: 1, preparadorId, fusoInstitucional: "UTC", periodos: [], motivo: "Calendário para guarda adversarial",
    chaveIdempotencia: "calendario-adversarial", entradaHash: "calendario-hash",
  } });
  const rascunho = await prisma.rascunhoReplanejamento.create({ data: {
    calendarioId: calendario.id, preparadorId, versao: 1, motivo: "Revisão conjunta adversarial",
    chaveIdempotencia: "rascunho-adversarial", entradaHash: "entrada-hash", estadoHash: "estado-hash", snapshot,
  } });
  const decisao = await prisma.decisaoReplanejamentoConjunto.create({ data: {
    rascunhoId: rascunho.id, decisorId, aprovada: true, motivo: "Decisão independente válida", estadoHash: rascunho.estadoHash,
  } });
  return { calendario, rascunho, decisao };
}

beforeEach(async () => { await truncarBanco(); catalogo = await base(); });

it("rejeita no commit aplicação SQL sem calendário, evento e efeitos materiais", async () => {
  const { rascunho, decisao } = await criarRevisao();
  await expect(prisma.$transaction(async (tx) => {
    await tx.aplicacaoReplanejamentoConjunto.create({ data: { rascunhoId: rascunho.id, decisaoId: decisao.id, estadoHash: "estado-hash" } });
  })).rejects.toThrow("Aplicação conjunta exige calendário publicado pela pessoa decisora");
  expect(await prisma.aplicacaoReplanejamentoConjunto.count()).toBe(0);
});

it("rejeita via SQL autoaprovação do preparador da revisão e do calendário", async () => {
  const calendario = await prisma.versaoCalendarioEscolar.create({ data: {
    versao: 1, preparadorId: decisorId, fusoInstitucional: "UTC", periodos: [], motivo: "Calendário preparado pelo decisor",
    chaveIdempotencia: "calendar-self", entradaHash: "hash",
  } });
  const rascunho = await prisma.rascunhoReplanejamento.create({ data: {
    calendarioId: calendario.id, preparadorId, versao: 1, motivo: "Revisão com decisor impedido",
    chaveIdempotencia: "review-self", entradaHash: "hash", estadoHash: "estado", snapshot: { revisoes: [] },
  } });
  await expect(prisma.decisaoReplanejamentoConjunto.create({ data: {
    rascunhoId: rascunho.id, decisorId, aprovada: true, motivo: "Autoaprovação deve falhar", estadoHash: "estado",
  } })).rejects.toThrow(/Decisão conjunta de replanejamento inválida/);
  expect(await prisma.decisaoReplanejamentoConjunto.count()).toBe(0);
});

it("reverte calendário, evento e dois horários quando um efeito material da revisão falta", async () => {
  const c = catalogo;
  const professor = (await criarUsuario(["PROFESSOR"])).id;
  const nivel = await prisma.nivel.create({ data: { idiomaId: c.idioma.id, codigo: "ADVERSARIAL", ordem: 1 } });
  const turmas = await Promise.all(["A", "B"].map((codigo) => prisma.turma.create({ data: { modalidadeId: c.modalidade.id, nivelId: nivel.id, professorId: professor, codigo } })));
  const antigo = new Date("2099-11-10T10:00:00.000Z"), fimAntigo = new Date("2099-11-10T11:00:00.000Z");
  const proposto = new Date("2099-11-11T10:00:00.000Z"), fimProposto = new Date("2099-11-11T11:00:00.000Z");
  const encontros = await Promise.all(turmas.map((turma, i) => prisma.encontroAgenda.create({ data: {
    turmaId: turma.id, professorId: professor, preparadorId, inicio: antigo, fim: fimAntigo, fusoOrigem: "UTC", status: "PREVISTO",
    motivo: "Encontro adversarial", chaveIdempotencia: `adversarial-${i}`, entradaHash: "fixture",
  } })));
  const snapshot = { revisoes: encontros.map((e, i) => ({ turmaId: turmas[i].id, previsao: { propostas: [{ encontroId: e.id, alterado: true, inicioProposto: proposto.toISOString(), fimProposto: fimProposto.toISOString() }] } })) };
  const { calendario, rascunho, decisao } = await criarRevisao(snapshot);
  await expect(prisma.$transaction(async (tx) => {
    await tx.decisaoCalendarioEscolar.create({ data: { calendarioId: calendario.id, decisorId, aprovada: true, motivo: "Publicação adversarial" } });
    await tx.evento.create({ data: { tipo: "ReplanejamentoConjuntoAplicado", agregadoTipo: "ConfiguracaoOperacional", agregadoId: "escola", autorId: decisorId, payload: {
      aprovada: true, revisaoId: rascunho.id, decisaoId: decisao.id,
      encontrosIds: encontros.map((e) => e.id),
      horarios: encontros.map((e) => ({ encontroId: e.id, inicioProposto: proposto.toISOString(), fimProposto: fimProposto.toISOString() })),
    } } });
    await tx.encontroAgenda.update({ where: { id: encontros[0].id }, data: { inicio: proposto, fim: fimProposto } });
    await tx.aplicacaoReplanejamentoConjunto.create({ data: { rascunhoId: rascunho.id, decisaoId: decisao.id, estadoHash: "estado-hash" } });
  })).rejects.toThrow("Aplicação conjunta sem os encontros materiais da revisão");
  expect(await prisma.aplicacaoReplanejamentoConjunto.count()).toBe(0);
  expect(await prisma.decisaoCalendarioEscolar.count()).toBe(0);
  expect(await prisma.evento.count({ where: { tipo: "ReplanejamentoConjuntoAplicado" } })).toBe(0);
  for (const encontro of encontros) expect(await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: encontro.id } })).toMatchObject({ inicio: antigo, fim: fimAntigo });
});




it("rejeita evento que duplica o primeiro horário e omite o segundo do snapshot", async () => {
  const professor = (await criarUsuario(["PROFESSOR"])).id;
  const nivel = await prisma.nivel.create({ data: { idiomaId: catalogo.idioma.id, codigo: "BIJECAO", ordem: 1 } });
  const turmas = await Promise.all(["C", "D"].map((codigo) => prisma.turma.create({ data: { modalidadeId: catalogo.modalidade.id, nivelId: nivel.id, professorId: professor, codigo } })));
  const antigo = new Date("2099-12-10T10:00:00.000Z"), fimAntigo = new Date("2099-12-10T11:00:00.000Z");
  const proposto = new Date("2099-12-11T10:00:00.000Z"), fimProposto = new Date("2099-12-11T11:00:00.000Z");
  const encontros = await Promise.all(turmas.map((turma, i) => prisma.encontroAgenda.create({ data: {
    turmaId: turma.id, professorId: professor, preparadorId, inicio: antigo, fim: fimAntigo, fusoOrigem: "UTC", status: "PREVISTO",
    motivo: "Encontro de bijeção adversarial", chaveIdempotencia: `bijeção-${i}`, entradaHash: "fixture",
  } })));
  const snapshot = { revisoes: encontros.map((e, i) => ({ turmaId: turmas[i].id, previsao: { propostas: [{ encontroId: e.id, alterado: true, inicioProposto: proposto.toISOString(), fimProposto: fimProposto.toISOString() }] } })) };
  const { calendario, rascunho, decisao } = await criarRevisao(snapshot);
  const horarioPrimeiro = { encontroId: encontros[0].id, inicioProposto: proposto.toISOString(), fimProposto: fimProposto.toISOString() };
  await expect(prisma.$transaction(async (tx) => {
    await tx.decisaoCalendarioEscolar.create({ data: { calendarioId: calendario.id, decisorId, aprovada: true, motivo: "Publicação com evento adulterado" } });
    await tx.evento.create({ data: { tipo: "ReplanejamentoConjuntoAplicado", agregadoTipo: "ConfiguracaoOperacional", agregadoId: "escola", autorId: decisorId,
      payload: { aprovada: true, revisaoId: rascunho.id, decisaoId: decisao.id, encontrosIds: [encontros[0].id, encontros[0].id], horarios: [horarioPrimeiro, horarioPrimeiro] } } });
    await tx.encontroAgenda.update({ where: { id: encontros[0].id }, data: { inicio: proposto, fim: fimProposto } });
    await tx.aplicacaoReplanejamentoConjunto.create({ data: { rascunhoId: rascunho.id, decisaoId: decisao.id, estadoHash: "estado-hash" } });
    await tx.$executeRawUnsafe("SET CONSTRAINTS ALL IMMEDIATE");
  })).rejects.toThrow("Aplicação conjunta sem os encontros materiais da revisão");
  expect(await prisma.aplicacaoReplanejamentoConjunto.count()).toBe(0);
  expect(await prisma.decisaoCalendarioEscolar.count()).toBe(0);
  expect(await prisma.evento.count({ where: { tipo: "ReplanejamentoConjuntoAplicado" } })).toBe(0);
  for (const encontro of encontros) expect(await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: encontro.id } })).toMatchObject({ inicio: antigo, fim: fimAntigo });
});

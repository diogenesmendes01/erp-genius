import { beforeEach, expect, it, vi } from "vitest";
const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { regraAvaliacaoTeste } from "@/test/regra-avaliacao";
import { decidirRegraAvaliacaoTx, prepararRegraAvaliacaoTx } from "./regras-tx";
import { decidirSegundaChamada, proporSegundaChamada } from "./segunda-chamada";
import { disponibilizarSegundaChamada } from "./segunda-chamada-disponibilizacao";
import { consultarPreviaAgendaInicialSegundaChamada, proporAgendaInicialSegundaChamada,
  decidirAgendaInicialSegundaChamada } from "./segunda-chamada-agenda-inicial";
import { listarSegundasChamadasSemAgenda } from "./segunda-chamada-fila-agenda";
import { proporProrrogacaoSegundaChamada, decidirProrrogacaoSegundaChamada } from "./segunda-chamada-prorrogacao";

let professor: string, gestor: string, administrador: string, alocacaoId: string, turmaId: string, matriculaId: string;
const entrar = (usuarioId: string) => authMock.mockResolvedValue({ user: { id: usuarioId } });
const proposta = (chaveIdempotencia = "segunda-chamada-proposta-1") => ({
  alocacaoId, codigoAvaliacao: "I1", motivo: "Ausência justificada na avaliação intermediária.",
  evidencias: "Atestado e comunicação institucional arquivados.", chaveIdempotencia,
});

beforeEach(async () => {
  await truncarBanco();
  const catalogo = await seedCatalogoMinimo();
  professor = (await criarUsuario(["PROFESSOR"])).id;
  gestor = (await criarUsuario(["GERENTE_PEDAGOGICO"])).id;
  administrador = (await criarUsuario(["ADMINISTRADOR"])).id;
  const nivel = await prisma.nivel.create({ data: { idiomaId: catalogo.idioma.id, codigo: "A1", ordem: 1 } });
  const regra = await prisma.$transaction(tx => prepararRegraAvaliacaoTx(tx, gestor, {
    nivelId: nivel.id, versaoEsperada: 0, conteudo: regraAvaliacaoTeste(),
    motivo: "Regra de teste da segunda chamada", chaveIdempotencia: "regra-segunda-chamada-teste",
  }));
  const versao = await prisma.versaoRegraAvaliacao.findUniqueOrThrow({ where: { id: regra.id } });
  await prisma.$transaction(tx => decidirRegraAvaliacaoTx(tx, administrador, {
    regraId: versao.id, conteudoHash: versao.conteudoHash, aprovada: true, motivo: "Publicação independente da regra",
  }));
  const turma = await prisma.turma.create({ data: {
    modalidadeId: catalogo.modalidade.id, nivelId: nivel.id, professorId: professor,
    dataInicio: new Date("2099-01-01T00:00:00Z"),
    vinculosDocentes: { create: { professorId: professor, inicio: new Date("2026-01-01T00:00:00Z") } },
  } });
  await prisma.turma.update({ where: { id: turma.id }, data: { status: "EM_ANDAMENTO", dataInicio: new Date("2026-01-01T00:00:00Z") } });
  turmaId = turma.id;
  const aluno = await prisma.aluno.create({ data: { primeiroNome: "Aluno segunda chamada", paisId: catalogo.pais.id } });
  const matricula = await prisma.matricula.create({ data: {
    alunoId: aluno.id, produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC", status: "ATIVA", ativadaEm: new Date("2026-01-01T00:00:00Z"),
  } });
  matriculaId = matricula.id;
  alocacaoId = (await prisma.alocacaoTurma.create({ data: { alunoId: aluno.id, matriculaId: matricula.id, turmaId: turma.id, criadoEm: new Date("2026-01-01T00:00:00Z") } })).id;
  entrar(professor);
});

async function aprovarEDisponibilizar(chave: string) {
  entrar(professor); const criada = await proporSegundaChamada(proposta(chave));
  if (!criada.ok || !criada.dado) throw new Error("proposta ausente");
  const [fonte] = await prisma.$queryRaw<{ id: string; entradaHash: string }[]>`SELECT id,"entradaHash" AS "entradaHash" FROM "PropostaSegundaChamada" WHERE id=${criada.dado.id}`;
  entrar(gestor); expect((await decidirSegundaChamada({ propostaId: fonte.id, propostaHash: fonte.entradaHash, aprovada: true, motivo: "Decisão independente de teste." })).ok).toBe(true);
  expect((await disponibilizarSegundaChamada({ propostaId: fonte.id, propostaHash: fonte.entradaHash, disponibilizadaEm: new Date().toISOString(), condicoes: "Condições oferecidas pela escola.", evidenciaComunicacao: "Comunicação registrada para o aluno." })).ok).toBe(true);
  return fonte;
}

async function prepararCalendario(naoLetivo = false, versao = 1) {
  await prisma.configuracaoOperacional.upsert({ where: { id: "escola" }, create: { id: "escola", fusoInstitucional: "UTC" }, update: {} });
  const dia = new Date(Date.now() + 60 * 60_000).toISOString().slice(0, 10);
  return prisma.versaoCalendarioEscolar.create({ data: {
    versao, preparadorId: gestor, fusoInstitucional: "UTC",
    periodos: naoLetivo ? [{ id: "feriado-teste", tipo: "FERIADO", nome: "Feriado institucional", inicio: dia, fim: dia }] : [],
    motivo: "Calendário aprovado para agenda inicial", chaveIdempotencia: `calendario-inicial-${versao}`, entradaHash: "fixture",
    decisao: { create: { decisorId: administrador, aprovada: true, motivo: "Conferência administrativa independente" } },
  } });
}

async function entradaAgenda(naoLetivo = false) {
  const fonte = await aprovarEDisponibilizar("fonte-agenda-inicial");
  await prepararCalendario(naoLetivo);
  const inicio = new Date(Date.now() + 60 * 60_000), fim = new Date(inicio.getTime() + 30 * 60_000);
  const referencia = { propostaSegundaChamadaId: fonte.id, professorId: professor,
    inicio: inicio.toISOString(), fim: fim.toISOString(), fusoOrigem: "UTC" };
  const previa = await consultarPreviaAgendaInicialSegundaChamada(referencia);
  if (!previa.ok || !previa.dado) throw new Error(JSON.stringify(previa));
  return { ...referencia, estadoConferido: previa.dado.estadoConferido,
    motivo: "Novo horário para avaliação pendente", evidencia: "Horário conferido com o aluno",
    ...(naoLetivo ? { motivoExcecaoNaoLetiva: "Aluno disponível somente nesta data excepcional" } : {}),
    chaveIdempotencia: "proposta-agenda-inicial" };
}

async function propostaAgenda(naoLetivo = false) {
  const entrada = await entradaAgenda(naoLetivo);
  const resultado = await proporAgendaInicialSegundaChamada(entrada);
  if (!resultado.ok || !resultado.dado) throw new Error(JSON.stringify(resultado));
  return { entrada, ...resultado.dado };
}

it("proposta não cria fatos; aprovação independente aplica agenda e reserva uma única vez", async () => {
  const p = await propostaAgenda();
  expect(await prisma.encontroAgenda.count()).toBe(0);
  expect(await prisma.reservaSegundaChamada.count()).toBe(0);
  expect(await proporAgendaInicialSegundaChamada(p.entrada)).toMatchObject({ ok: true, dado: { id: p.id } });
  const decisao = { propostaId: p.id, propostaHash: p.entradaHash, aprovada: true, motivo: "Agenda conferida independentemente" };
  expect(await decidirAgendaInicialSegundaChamada(decisao)).toMatchObject({ ok: false });
  entrar(administrador);
  const aprovado = await decidirAgendaInicialSegundaChamada(decisao);
  expect(aprovado, JSON.stringify(aprovado)).toMatchObject({ ok: true });
  expect(await decidirAgendaInicialSegundaChamada(decisao)).toEqual(aprovado);
  expect(await prisma.encontroAgenda.count()).toBe(1);
  expect(await prisma.encontroAgenda.count({ where: { matriculaId } })).toBe(1);
  expect(await prisma.reservaSegundaChamada.count()).toBe(1);
  expect(await prisma.$queryRaw`SELECT count(*)::int AS total FROM "AgendaSegundaChamada"`).toEqual([{ total: 1 }]);
  expect(await prisma.registroAvaliacaoMatricula.count()).toBe(0);
  await expect(prisma.$executeRaw`DELETE FROM "AplicacaoAgendaSegundaChamada" WHERE "reservaId" IN (SELECT id FROM "ReservaSegundaChamada")`)
    .rejects.toThrow(/exclusiva|imutável/i);
  await expect(prisma.$executeRaw`UPDATE "EncontroAgenda" SET "propostaAgendaSegundaChamadaId"=NULL WHERE "propostaAgendaSegundaChamadaId"=${p.id}`)
    .rejects.toThrow(/origem|imutável|decisão/i);
});

it("dia não letivo exige justificativa e autorização explícita sem alterar o calendário", async () => {
  const entrada = await entradaAgenda(true);
  const semMotivo = { ...entrada, motivoExcecaoNaoLetiva: undefined };
  expect(await proporAgendaInicialSegundaChamada(semMotivo)).toMatchObject({ ok: false });
  const criado = await proporAgendaInicialSegundaChamada(entrada);
  if (!criado.ok || !criado.dado) throw new Error(JSON.stringify(criado));
  entrar(administrador);
  const decisao = { propostaId: criado.dado.id, propostaHash: criado.dado.entradaHash, aprovada: true, motivo: "Revisão da exceção de calendário" };
  expect(await decidirAgendaInicialSegundaChamada(decisao)).toMatchObject({ ok: false });
  expect(await prisma.encontroAgenda.count()).toBe(0);
  expect(await decidirAgendaInicialSegundaChamada({ ...decisao, autorizarDiaNaoLetivo: true })).toMatchObject({ ok: true });
  expect(await prisma.versaoCalendarioEscolar.count()).toBe(1);
});

it("mudança de calendário impede aplicação sem fatos parciais e permite rejeitar", async () => {
  const p = await propostaAgenda();
  await prepararCalendario(false, 2);
  entrar(administrador);
  expect(await decidirAgendaInicialSegundaChamada({ propostaId: p.id, propostaHash: p.entradaHash,
    aprovada: true, motivo: "Tentativa sobre calendário desatualizado" })).toMatchObject({ ok: false });
  expect(await prisma.encontroAgenda.count()).toBe(0);
  expect(await prisma.reservaSegundaChamada.count()).toBe(0);
  expect(await decidirAgendaInicialSegundaChamada({ propostaId: p.id, propostaHash: p.entradaHash,
    aprovada: false, motivo: "Rejeitar proposta desatualizada para nova conferência" })).toMatchObject({ ok: true });
});

it("reconfere conflito surgido após proposta e impede duplicação concorrente", async () => {
  const p = await propostaAgenda();
  const colisao = await prisma.encontroAgenda.create({ data: { turmaId, professorId: professor, preparadorId: gestor,
    inicio: new Date(p.entrada.inicio), fim: new Date(p.entrada.fim), fusoOrigem: "UTC", status: "PREVISTO", motivo: "Aula conflitante posterior à revisão",
    chaveIdempotencia: "colisao-agenda-inicial", entradaHash: "fixture" } });
  entrar(administrador);
  const decisao = { propostaId: p.id, propostaHash: p.entradaHash, aprovada: true, motivo: "Conferir novamente a disponibilidade" };
  expect(await decidirAgendaInicialSegundaChamada(decisao)).toMatchObject({ ok: false });
  expect(await prisma.reservaSegundaChamada.count()).toBe(0);
  await prisma.encontroAgenda.update({ where: { id: colisao.id }, data: { status: "CANCELADO" } });
  let liberar!: () => void, sinalizar!: () => void;
  const liberacao = new Promise<void>(resolve => { liberar = resolve; });
  const pronto = new Promise<void>(resolve => { sinalizar = resolve; });
  const bloqueador = prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('calendario-escola',0))`;
    sinalizar();
    await liberacao;
  });
  await pronto;
  const esperarBloqueadas = (quantidade: number) => vi.waitFor(async () => {
    const [r] = await prisma.$queryRaw<{ total: number }[]>`SELECT count(*)::int AS total FROM pg_stat_activity WHERE datname=current_database() AND wait_event='advisory' AND query LIKE '%calendario-escola%'`;
    expect(r.total).toBeGreaterThanOrEqual(quantidade);
  }, { interval: 10, timeout: 2000 });
  const primeira = decidirAgendaInicialSegundaChamada(decisao);
  let segunda: ReturnType<typeof decidirAgendaInicialSegundaChamada> | undefined;
  try {
    await esperarBloqueadas(1);
    segunda = decidirAgendaInicialSegundaChamada(decisao);
    await esperarBloqueadas(2);
  } finally { liberar(); await bloqueador; }
  const resultados = await Promise.all([primeira, segunda!]);
  expect(resultados.every(r => r.ok), JSON.stringify(resultados)).toBe(true);
  expect(await prisma.reservaSegundaChamada.count()).toBe(1);
  expect(await prisma.encontroAgenda.count({ where: { finalidade: "SEGUNDA_CHAMADA" } })).toBe(1);
});

it("Secretaria pode propor; professor e usuário inativo não podem preparar; Secretaria não aprova", async () => {
  const entrada = await entradaAgenda();
  entrar(professor);
  expect(await proporAgendaInicialSegundaChamada(entrada)).toMatchObject({ ok: false });
  const secretaria = (await criarUsuario(["SECRETARIA_ACADEMICA"])).id;
  entrar(secretaria);
  const criada = await proporAgendaInicialSegundaChamada(entrada);
  if (!criada.ok || !criada.dado) throw new Error(JSON.stringify(criada));
  expect(await decidirAgendaInicialSegundaChamada({ propostaId: criada.dado.id, propostaHash: criada.dado.entradaHash,
    aprovada: true, motivo: "Tentativa indevida de decisão pela secretaria" })).toMatchObject({ ok: false });
  await prisma.usuario.update({ where: { id: secretaria }, data: { ativo: false } });
  expect(await proporAgendaInicialSegundaChamada({ ...entrada, chaveIdempotencia: "inativa-agenda-inicial" })).toMatchObject({ ok: false });
  expect(await prisma.encontroAgenda.count()).toBe(0);
});

it("banco impede autoaprovação e alteração da proposta fora das ações", async () => {
  const p = await propostaAgenda();
  await expect(prisma.$executeRaw`UPDATE "PropostaAgendaSegundaChamada" SET motivo='Motivo adulterado diretamente' WHERE id=${p.id}`)
    .rejects.toThrow(/imutável/i);
  await expect(prisma.$executeRaw`INSERT INTO "DecisaoAgendaSegundaChamada" (id,"propostaId","decisorId",aprovada,motivo) VALUES ('auto-decisao-inicial',${p.id},${gestor},true,'Autoaprovação direta indevida')`)
    .rejects.toThrow(/outra|independente/i);
  expect(await prisma.encontroAgenda.count()).toBe(0);
  expect(await prisma.reservaSegundaChamada.count()).toBe(0);
});

it("aprovação direta no banco reconfere aula coletiva conflitante e reverte a decisão", async () => {
  const p = await propostaAgenda();
  await prisma.encontroAgenda.create({ data: { turmaId, professorId: professor, preparadorId: gestor,
    inicio: new Date(p.entrada.inicio), fim: new Date(p.entrada.fim), fusoOrigem: "UTC", status: "PREVISTO", motivo: "Aula coletiva já prevista",
    chaveIdempotencia: "coletiva-antes-sql", entradaHash: "fixture" } });
  await expect(prisma.$executeRaw`INSERT INTO "DecisaoAgendaSegundaChamada" (id,"propostaId","decisorId",aprovada,motivo) VALUES ('conflito-decisao-inicial',${p.id},${administrador},true,'Conferência direta de conflito')`)
    .rejects.toThrow(/conflito|disponibilidade/i);
  expect(await prisma.$queryRaw`SELECT count(*)::int AS total FROM "DecisaoAgendaSegundaChamada" WHERE "propostaId"=${p.id}`).toEqual([{ total: 0 }]);
  expect(await prisma.reservaSegundaChamada.count()).toBe(0);
});

it("fila sem agenda permite Secretaria localizar a fonte e recusa professor ou usuário desativado", async () => {
  await aprovarEDisponibilizar("fila-sem-agenda-visibilidade");
  const secretaria = (await criarUsuario(["SECRETARIA_ACADEMICA"])).id;
  entrar(secretaria);
  const r = await listarSegundasChamadasSemAgenda({});
  expect(r, JSON.stringify(r)).toMatchObject({ ok: true });
  if (!r.ok || !r.dado) throw new Error(JSON.stringify(r));
  expect(r.dado.itens).toHaveLength(1);
  expect(Object.keys(r.dado.itens[0]).sort()).toEqual([
    "propostaSegundaChamadaId", "aluno", "matriculaCodigo", "turma", "codigoAvaliacao", "prazoAte", "situacao",
  ].sort());
  const serializado = JSON.stringify(r.dado);
  expect(serializado).toContain("Aluno segunda chamada");
  expect(serializado).not.toContain("Atestado e comunicação");
  expect(serializado).not.toContain("notas");
  expect(serializado).not.toContain("evidencias");
  expect(serializado).not.toContain("pagamentos");
  entrar(professor);
  expect(await listarSegundasChamadasSemAgenda({})).toMatchObject({ ok: false });
  await prisma.usuario.update({ where: { id: secretaria }, data: { ativo: false } });
  entrar(secretaria);
  expect(await listarSegundasChamadasSemAgenda({})).toMatchObject({ ok: false });
});

it("proposta aguardando decisão fica na fila; agenda aplicada sai dela sem apagar histórico", async () => {
  const p = await propostaAgenda();
  const antes = await listarSegundasChamadasSemAgenda({});
  if (!antes.ok || !antes.dado) throw new Error(JSON.stringify(antes));
  expect(antes.dado.itens).toHaveLength(1);
  entrar(administrador);
  expect(await decidirAgendaInicialSegundaChamada({ propostaId: p.id, propostaHash: p.entradaHash,
    aprovada: true, motivo: "Aplicar a agenda para retirar da fila pendente" })).toMatchObject({ ok: true });
  const depois = await listarSegundasChamadasSemAgenda({});
  if (!depois.ok || !depois.dado) throw new Error(JSON.stringify(depois));
  expect(depois.dado.itens).toHaveLength(0);
  expect(await prisma.propostaSegundaChamada.count()).toBe(1);
  expect(await prisma.reservaSegundaChamada.count()).toBe(1);
  expect(await listarSegundasChamadasSemAgenda({ cursor: { id: "fonte-inexistente", criadaEm: new Date().toISOString() } })).toMatchObject({ ok: false });
});

it("fila pagina fontes sem duplicar itens quando chega uma autorização nova", async () => {
  const origem = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } });
  const criarFonte = async (indice: number) => {
    const aluno = await prisma.aluno.create({ data: { primeiroNome: `Aluno pagina ${indice}`, paisId: origem.paisId } });
    const contrato = await prisma.matricula.create({ data: { alunoId: aluno.id, produtoId: origem.produtoId,
      paisId: origem.paisId, moeda: origem.moeda, status: "ATIVA", ativadaEm: origem.ativadaEm } });
    alocacaoId = (await prisma.alocacaoTurma.create({ data: { alunoId: aluno.id, matriculaId: contrato.id,
      turmaId, criadoEm: new Date("2026-01-01T00:00:00Z") } })).id;
    await aprovarEDisponibilizar(`fila-pagina-${indice}`);
  };
  for (let i = 0; i < 22; i++) await criarFonte(i);
  const primeira = await listarSegundasChamadasSemAgenda({});
  if (!primeira.ok || !primeira.dado) throw new Error(JSON.stringify(primeira));
  expect(primeira.dado.itens).toHaveLength(20);
  expect(primeira.dado.proximoCursor).toBeTruthy();
  // A fonte usada como cursor pode sair da fila antes da leitura da próxima página.
  await prepararCalendario();
  const horario = { propostaSegundaChamadaId: primeira.dado.proximoCursor!.id, professorId: professor,
    inicio: new Date(Date.now() + 60 * 60_000).toISOString(), fim: new Date(Date.now() + 90 * 60_000).toISOString(), fusoOrigem: "UTC" };
  const previa = await consultarPreviaAgendaInicialSegundaChamada(horario);
  if (!previa.ok || !previa.dado) throw new Error(JSON.stringify(previa));
  const propostaCursor = await proporAgendaInicialSegundaChamada({ ...horario, estadoConferido: previa.dado.estadoConferido,
    motivo: "Agendar fonte situada no limite da página", evidencia: "Disponibilidade conferida com aluno e docente",
    chaveIdempotencia: "fila-cursor-agendado" });
  if (!propostaCursor.ok || !propostaCursor.dado) throw new Error(JSON.stringify(propostaCursor));
  entrar(administrador);
  expect(await decidirAgendaInicialSegundaChamada({ propostaId: propostaCursor.dado.id, propostaHash: propostaCursor.dado.entradaHash,
    aprovada: true, motivo: "Aprovação da fonte utilizada como cursor" })).toMatchObject({ ok: true });
  await criarFonte(22);
  const segunda = await listarSegundasChamadasSemAgenda({ cursor: primeira.dado.proximoCursor! });
  if (!segunda.ok || !segunda.dado) throw new Error(JSON.stringify(segunda));
  expect(segunda.dado.itens).toHaveLength(2);
  expect(segunda.dado.proximoCursor).toBeNull();
  const nomes = [...primeira.dado.itens, ...segunda.dado.itens].map(item => item.aluno);
  expect(new Set(nomes).size).toBe(22);
  expect(nomes).not.toContain("Aluno pagina 22");
});

it("fila mostra somente prazo prorrogado aprovado e preserva o nome preferido", async () => {
  const fonte = await aprovarEDisponibilizar("fila-prazo-vigente");
  const m = await prisma.matricula.findUniqueOrThrow({ where: { id: matriculaId } });
  await prisma.aluno.update({ where: { id: m.alunoId }, data: { nomePreferido: "Nome preferido da fila" } });
  const disp = await prisma.disponibilizacaoSegundaChamada.findUniqueOrThrow({ where: { propostaId: fonte.id } });
  const novoPrazo = new Date(disp.prazoAte.getTime() + 3_600_000).toISOString();
  const propostaPrazo = await proporProrrogacaoSegundaChamada({ disponibilizacaoId: disp.id,
    prazoAnterior: disp.prazoAte.toISOString(), novoPrazo, versaoEsperada: 0,
    motivo: "Prazo proposto precisa de conferência independente", chaveIdempotencia: "fila-novo-prazo" });
  if (!propostaPrazo.ok || !propostaPrazo.dado) throw new Error(JSON.stringify(propostaPrazo));
  expect(await listarSegundasChamadasSemAgenda({})).toMatchObject({ ok: true,
    dado: { itens: [{ aluno: "Nome preferido da fila", prazoAte: disp.prazoAte.toISOString() }] } });
  const p = await prisma.propostaProrrogacaoSegundaChamada.findUniqueOrThrow({ where: { id: propostaPrazo.dado.id } });
  entrar(administrador);
  expect(await decidirProrrogacaoSegundaChamada({ propostaId: p.id, propostaHash: p.entradaHash,
    aprovada: true, motivo: "Prazo ampliado após revisão independente" })).toMatchObject({ ok: true });
  expect(await listarSegundasChamadasSemAgenda({})).toMatchObject({ ok: true, dado: { itens: [{ prazoAte: novoPrazo }] } });
});


it("banco recusa criação sem aprovação e alterações diretas de encontro aprovado", async () => {
  const p = await propostaAgenda();
  const dados = { turmaId, matriculaId, professorId: professor, preparadorId: gestor,
    inicio: new Date(p.entrada.inicio), fim: new Date(p.entrada.fim), fusoOrigem: "UTC",
    status: "PREVISTO" as const, finalidade: "SEGUNDA_CHAMADA" as const,
    motivo: "Tentativa de contornar aprovação", chaveIdempotencia: "criacao-direta-proibida", entradaHash: "fixture" };
  await expect(prisma.encontroAgenda.create({ data: dados })).rejects.toThrow(/aplica|aprova/i);
  expect(await prisma.encontroAgenda.count()).toBe(0);
  entrar(administrador);
  const aprovado = await decidirAgendaInicialSegundaChamada({ propostaId: p.id, propostaHash: p.entradaHash,
    aprovada: true, motivo: "Aprovação independente para verificar proteções" });
  expect(aprovado, JSON.stringify(aprovado)).toMatchObject({ ok: true });
  const original = await prisma.encontroAgenda.findFirstOrThrow({ where: { finalidade: "SEGUNDA_CHAMADA" } });
  for (const data of [
    { inicio: new Date(original.inicio.getTime() + 60_000) },
    { fim: new Date(original.fim.getTime() + 60_000) },
    { professorId: gestor }, { matriculaId: null }, { turmaId: null },
    { finalidade: "AULA" as const }, { status: "CANCELADO" as const },
    { status: "MINISTRADO" as const }, { status: "NAO_REALIZADO" as const },
    { status: "IMPEDIDO_ESCOLA" as const },
  ]) {
    await expect(prisma.encontroAgenda.update({ where: { id: original.id }, data })).rejects.toThrow();
  }
  await expect(prisma.encontroAgenda.delete({ where: { id: original.id } })).rejects.toThrow(/apag|exclu/i);
  expect(await prisma.encontroAgenda.findUniqueOrThrow({ where: { id: original.id } })).toEqual(original);
  expect(await prisma.reservaSegundaChamada.count({ where: { status: "RESERVADA" } })).toBe(1);
});

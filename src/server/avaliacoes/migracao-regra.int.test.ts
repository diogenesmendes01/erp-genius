import { beforeEach, expect, it, vi } from "vitest";
const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { regraAvaliacaoTeste } from "@/test/regra-avaliacao";
import { decidirRegraAvaliacaoTx, prepararRegraAvaliacaoTx } from "./regras-tx";
import { consultarMigracoesRegra, consultarPreparacaoMigracao, decidirMigracaoRegra, proporMigracaoRegra, revisarMigracaoRegra } from "./migracao-regra";
import { decidirMigracaoRegraTx } from "./migracao-regra-tx";
let autor: string, outro: string, nivelId: string, turmaId: string, origemId: string, destinoId: string;
const entrar = (id: string) => authMock.mockResolvedValue({ user: { id } });
async function regra(versao: number) {
  const conteudo = regraAvaliacaoTeste(); conteudo.minimoGeral = String(6 + versao / 10);
  const r = await prisma.$transaction(tx => prepararRegraAvaliacaoTx(tx, autor, { nivelId, versaoEsperada: versao - 1, conteudo, motivo: "Regra fictícia para migrar", chaveIdempotencia: `regra-migracao-${nivelId}-${versao}` }));
  const p = await prisma.versaoRegraAvaliacao.findUniqueOrThrow({ where: { id: r.id } });
  await prisma.$transaction(tx => decidirRegraAvaliacaoTx(tx, outro, { regraId: p.id, conteudoHash: p.conteudoHash, aprovada: true, motivo: "Publicação independente" }));
  return p.id;
}
beforeEach(async () => {
  await truncarBanco(); const c = await seedCatalogoMinimo();
  autor = (await criarUsuario(["GERENTE_PEDAGOGICO"])).id; outro = (await criarUsuario(["ADMINISTRADOR"])).id;
  nivelId = (await prisma.nivel.create({ data: { idiomaId: c.idioma.id, codigo: "A1", ordem: 1 } })).id;
  origemId = await regra(1);
  turmaId = (await prisma.turma.create({ data: { nivelId, modalidadeId: c.modalidade.id, dataInicio: new Date("2099-10-01"), dataFim: new Date("2099-12-01") } })).id;
  destinoId = await regra(2); entrar(autor);
});
async function preparar() {
  const r = await revisarMigracaoRegra({ turmaId, destinoId });
  if (!r.ok || !r.dado) throw new Error("Revisão ausente");
  const input = { turmaId, destinoId, estadoHash: r.dado.estadoHash, versaoEsperada: r.dado.versaoEsperada, motivo: "Migrar critérios antes do início", chaveIdempotencia: `proposta-migracao-${r.dado.versaoEsperada}` };
  const p = await proporMigracaoRegra(input);
  if (!p.ok || !p.dado) throw new Error(`Proposta ausente: ${JSON.stringify(p)}`);
  return { id: p.dado.id, estadoHash: r.dado.estadoHash, input };
}
const decidir = (p: { id: string; estadoHash: string }) => ({ propostaId: p.id, estadoHash: p.estadoHash, aprovada: true, motivo: "Impactos conferidos por outra pessoa" });
const atual = () => prisma.turma.findUniqueOrThrow({ where: { id: turmaId } });

it("revisa impactos, preserva proposta e aplica com decisão independente uma única vez", async () => {
  const antes = await atual();
  expect(await revisarMigracaoRegra({ turmaId, destinoId })).toMatchObject({ ok: true, dado: { alteracoes: ["minimoGeral"], origem: { id: origemId }, destino: { id: destinoId } } });
  const p = await preparar();
  expect((await atual()).regraAvaliacaoId).toBe(origemId);
  expect(await proporMigracaoRegra(p.input)).toMatchObject({ ok: true, dado: { id: p.id } });
  expect((await decidirMigracaoRegra(decidir(p))).ok).toBe(false);
  entrar(outro);
  expect(await consultarMigracoesRegra({ turmaId })).toMatchObject({ ok: true, dado: { propostas: [{ podeAprovar: true }] } });
  const r = await decidirMigracaoRegra(decidir(p)); expect(r).toMatchObject({ ok: true, dado: { aplicada: true } });
  expect(await decidirMigracaoRegra(decidir(p))).toEqual(r);
  expect(await atual()).toEqual({ ...antes, regraAvaliacaoId: destinoId });
  expect(await prisma.evento.count({ where: { agregadoId: turmaId, tipo: "MigracaoRegraTurmaAplicada" } })).toBe(1);
  await expect(prisma.propostaMigracaoRegraTurma.update({ where: { id: p.id }, data: { motivo: "Editar" } })).rejects.toThrow("imutáveis");
  await expect(prisma.decisaoMigracaoRegraTurma.deleteMany()).rejects.toThrow("imutáveis");
});

it("rejeição preserva referência e decisão, sem apagar proposta", async () => {
  const p = await preparar(); entrar(outro);
  expect(await decidirMigracaoRegra({ ...decidir(p), aprovada: false })).toMatchObject({ ok: true, dado: { aplicada: false } });
  expect((await atual()).regraAvaliacaoId).toBe(origemId);
  expect(await consultarMigracoesRegra({ turmaId })).toMatchObject({ ok: true, dado: { propostas: [{ decisao: { aprovada: false }, podeDecidir: false }] } });
});

it.each(["status", "agenda", "diario", "evento"])("impede aplicação quando a turma iniciou por %s", async tipo => {
  const p = await preparar();
  if (tipo === "status") await prisma.turma.update({ where: { id: turmaId }, data: { status: "EM_ANDAMENTO" } });
  if (tipo === "agenda") await prisma.encontroAgenda.create({ data: { turmaId, professorId: (await criarUsuario(["PROFESSOR"])).id, preparadorId: autor, inicio: new Date("2020-01-01T10:00:00Z"), fim: new Date("2020-01-01T11:00:00Z"), fusoOrigem: "UTC", status: "PREVISTO", motivo: "Aula sem diário lançado", chaveIdempotencia: "aula-passada-migracao", entradaHash: "fixture" } });
  if (tipo === "diario") await prisma.aulaDiario.create({ data: { turmaId, professorId: autor, ocorridaEm: new Date("2020-01-01"), conteudo: "Histórico de aula" } });
  if (tipo === "evento") await prisma.evento.create({ data: { agregadoTipo: "Turma", agregadoId: turmaId, tipo: "TurmaEmAndamento", autorId: autor } });
  entrar(outro);
  expect((await decidirMigracaoRegra(decidir(p))).ok).toBe(false);
  await expect(prisma.decisaoMigracaoRegraTurma.create({ data: { propostaId: p.id, decisorId: outro, aprovada: true, motivo: "Via banco" } })).rejects.toThrow("iniciou");
  expect(await prisma.decisaoMigracaoRegraTurma.count()).toBe(0);
  expect((await atual()).regraAvaliacaoId).toBe(origemId);
  expect(await consultarMigracoesRegra({ turmaId })).toMatchObject({ ok: true, dado: { propostas: [{ podeAprovar: false, pendencia: expect.any(String) }] } });
});

it("mudança de contexto exige nova proposta e hash da revisão", async () => {
  const p = await preparar();
  await prisma.turma.update({ where: { id: turmaId }, data: { nome: "Contexto alterado" } });
  entrar(outro);
  expect((await decidirMigracaoRegra(decidir(p))).ok).toBe(false);
  entrar(autor); const p2 = await preparar(); entrar(outro);
  expect((await decidirMigracaoRegra({ ...decidir(p2), estadoHash: "0".repeat(64) })).ok).toBe(false);
  expect((await decidirMigracaoRegra(decidir(p))).ok).toBe(false);
  expect((await decidirMigracaoRegra(decidir(p2))).ok).toBe(true);
});

it("nova publicação invalida o destino revisado, sem trocar a regra automaticamente", async () => {
  const p = await preparar(); await regra(3); entrar(outro);
  expect((await decidirMigracaoRegra(decidir(p))).ok).toBe(false);
  expect((await atual()).regraAvaliacaoId).toBe(origemId);
});

it("veda autoaprovação no banco e recusa papéis sem gestão", async () => {
  const p = await preparar();
  await prisma.usuario.update({ where: { id: autor }, data: { papeis: ["ADMINISTRADOR", "GERENTE_PEDAGOGICO"] } });
  await expect(prisma.decisaoMigracaoRegraTurma.create({ data: { propostaId: p.id, decisorId: autor, aprovada: true, motivo: "Via banco" } })).rejects.toThrow("independente");
  entrar((await criarUsuario(["SECRETARIA_ACADEMICA"])).id);
  expect((await revisarMigracaoRegra({ turmaId, destinoId })).ok).toBe(false);
  expect((await proporMigracaoRegra(p.input)).ok).toBe(false);
  expect((await decidirMigracaoRegra(decidir(p))).ok).toBe(false);
  expect((await consultarMigracoesRegra({ turmaId })).ok).toBe(false);
  expect((await consultarPreparacaoMigracao({ turmaId })).ok).toBe(false);
  entrar(autor); await prisma.usuario.update({ where: { id: autor }, data: { ativo: false } });
  expect((await proporMigracaoRegra(p.input)).ok).toBe(false);
});

it("decisões concorrentes produzem apenas um resultado e efeito", async () => {
  const p = await preparar(), terceiro = (await criarUsuario(["GERENTE_PEDAGOGICO"])).id;
  const rs = await Promise.allSettled([
    prisma.$transaction(tx => decidirMigracaoRegraTx(tx, outro, decidir(p))),
    prisma.$transaction(tx => decidirMigracaoRegraTx(tx, terceiro, { ...decidir(p), aprovada: false })),
  ]);
  expect(rs.filter(r => r.status === "fulfilled")).toHaveLength(1);
  expect(await prisma.decisaoMigracaoRegraTurma.count()).toBe(1);
  const d = await prisma.decisaoMigracaoRegraTurma.findFirstOrThrow();
  expect((await atual()).regraAvaliacaoId).toBe(d.aprovada ? destinoId : origemId);
});

it("alocação posterior invalida os impactos conferidos", async () => {
  const p = await preparar();
  const pais = await prisma.pais.findFirstOrThrow();
  const aluno = await prisma.aluno.create({ data: { primeiroNome: "Aluno de teste", paisId: pais.id } });
  await prisma.alocacaoTurma.create({ data: { turmaId, alunoId: aluno.id } });
  entrar(outro);
  expect((await decidirMigracaoRegra(decidir(p))).ok).toBe(false);
  expect((await atual()).regraAvaliacaoId).toBe(origemId);
  expect(await consultarMigracoesRegra({ turmaId })).toMatchObject({ ok: true, dado: { propostas: [{ podeAprovar: false, pendencia: expect.stringContaining("impactos mudaram") }] } });
});

it("turma futura sem versão inicial recebe a primeira vinculação por aprovação", async () => {
  const c = await atual();
  const nivel = await prisma.nivel.findUniqueOrThrow({ where: { id: nivelId } });
  nivelId = (await prisma.nivel.create({ data: { idiomaId: nivel.idiomaId, codigo: "A2", ordem: 2 } })).id;
  turmaId = (await prisma.turma.create({ data: { modalidadeId: c.modalidadeId, nivelId, dataInicio: new Date("2099-10-01") } })).id;
  expect((await atual()).regraAvaliacaoId).toBeNull();
  destinoId = await regra(1);
  const p = await preparar(); entrar(outro);
  expect((await decidirMigracaoRegra(decidir(p))).ok).toBe(true);
  expect((await atual()).regraAvaliacaoId).toBe(destinoId);
  expect((await prisma.propostaMigracaoRegraTurma.findUniqueOrThrow({ where: { id: p.id } })).origemId).toBeNull();
});

it("consulta da tela prepara revisão atual e preserva impactos originais do histórico", async () => {
  const base = await consultarPreparacaoMigracao({ turmaId });
  expect(base).toMatchObject({ ok: true, dado: { pendencia: null, turma: { regraAvaliacao: { id: origemId } }, revisao: { destino: { id: destinoId }, alteracoes: ["minimoGeral"], alocacoesAtivasRevisadas: 0 } } });
  if (!base.ok || !base.dado?.revisao) throw new Error("Revisão ausente");
  const revisao = await revisarMigracaoRegra({ turmaId, destinoId });
  expect(revisao).toMatchObject({ ok: true, dado: { estadoHash: base.dado.revisao.estadoHash } });
  await preparar();
  const pais = await prisma.pais.findFirstOrThrow();
  const aluno = await prisma.aluno.create({ data: { primeiroNome: "Novo aluno", paisId: pais.id } });
  await prisma.alocacaoTurma.create({ data: { turmaId, alunoId: aluno.id } });
  entrar(outro);
  const h = await consultarMigracoesRegra({ turmaId });
  expect(h).toMatchObject({ ok: true, dado: { propostas: [{ alocacoesAtivasRevisadas: 0, podeAprovar: false, alteracoes: ["minimoGeral"] }] } });
  if (!h.ok || !h.dado) throw new Error("Histórico ausente");
  for (const campo of ["snapshot", "entradaHash", "chaveIdempotencia", "alocacoes"]) expect(h.dado.propostas[0]).not.toHaveProperty(campo);
  expect(await consultarPreparacaoMigracao({ turmaId })).toMatchObject({ ok: true, dado: { revisao: { alocacoesAtivasRevisadas: 1 } } });
});

it("consulta da tela explica bloqueios, regra já atual e falta de publicação", async () => {
  const p = await preparar(); entrar(outro);
  expect((await decidirMigracaoRegra(decidir(p))).ok).toBe(true);
  expect(await consultarPreparacaoMigracao({ turmaId })).toMatchObject({ ok: true, dado: { revisao: null, pendencia: expect.stringContaining("última versão") } });
  await regra(3);
  await prisma.turma.update({ where: { id: turmaId }, data: { status: "CONCLUIDA" } });
  expect(await consultarPreparacaoMigracao({ turmaId })).toMatchObject({ ok: true, dado: { revisao: null, pendencia: expect.stringContaining("iniciou") } });
  const t = await atual(), nivel = await prisma.nivel.findUniqueOrThrow({ where: { id: nivelId } });
  const n2 = await prisma.nivel.create({ data: { idiomaId: nivel.idiomaId, codigo: "B1", ordem: 3 } });
  const t2 = await prisma.turma.create({ data: { nivelId: n2.id, modalidadeId: t.modalidadeId, dataInicio: new Date("2099-10-01") } });
  expect(await consultarPreparacaoMigracao({ turmaId: t2.id })).toMatchObject({ ok: true, dado: { destino: null, revisao: null, pendencia: expect.stringContaining("não existe regra publicada") } });
  expect((await consultarPreparacaoMigracao({ turmaId: "ausente" })).ok).toBe(false);
  expect((await consultarMigracoesRegra({ turmaId, pagina: 0 })).ok).toBe(false);
});

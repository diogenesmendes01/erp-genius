import { beforeEach, expect, it, vi } from "vitest";
const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { regraAvaliacaoTeste } from "@/test/regra-avaliacao";
import { prepararRegraAvaliacaoTx, decidirRegraAvaliacaoTx } from "./regras-tx";
import { criarTurma, editarTurma } from "@/server/turmas/acoes";
import { listarTurmas } from "@/server/turmas/consultas";
import { POST } from "@/app/api/turmas/importar/route";
import { COLUNAS_IMPORTACAO_TURMA } from "@/server/turmas/importacao";

let autor: string, aprovador: string, nivelId: string, modalidadeId: string;
beforeEach(async () => {
  await truncarBanco(); const c = await seedCatalogoMinimo(); modalidadeId = c.modalidade.id;
  autor = (await criarUsuario(["ADMINISTRADOR"])).id;
  aprovador = (await criarUsuario(["GERENTE_PEDAGOGICO"])).id;
  nivelId = (await prisma.nivel.create({ data: { idiomaId: c.idioma.id, codigo: "A1", ordem: 1 } })).id;
  authMock.mockResolvedValue({ user: { id: autor } });
});
const entradaTurma = () => ({ modalidadeId, nivelId, diasSemana: [1, 3], horarioInicio: "10:00", horarioFim: "12:00", dataInicio: new Date("2099-10-01T00:00:00Z"), dataFim: new Date("2099-12-01T00:00:00Z"), capacidade: 12 });
async function regra(versao: number, publicar = true) {
  const p = await prisma.$transaction(tx => prepararRegraAvaliacaoTx(tx, autor, { nivelId, versaoEsperada: versao - 1, conteudo: regraAvaliacaoTeste(), motivo: "Regra fictícia para vínculo", chaveIdempotencia: `vinculo-turma-regra-${versao}` }));
  const r = await prisma.versaoRegraAvaliacao.findUniqueOrThrow({ where: { id: p.id } });
  if (publicar) await prisma.$transaction(tx => decidirRegraAvaliacaoTx(tx, aprovador, { regraId: r.id, conteudoHash: r.conteudoHash, aprovada: true, motivo: "Publicação independente de teste" }));
  return r;
}
async function novaTurma() {
  const r = await criarTurma(entradaTurma());
  expect(r.ok).toBe(true);
  if (!r.ok || !r.dado) throw new Error("Turma ausente");
  return prisma.turma.findUniqueOrThrow({ where: { id: r.dado.id } });
}

it("nova turma usa última publicação do nível e mantém a versão após novas publicações", async () => {
  const r1 = await regra(1);
  const t1 = await novaTurma(); expect(t1.regraAvaliacaoId).toBe(r1.id);
  await regra(2, false);
  const t2 = await novaTurma(); expect(t2.regraAvaliacaoId).toBe(r1.id);
  const r3 = await regra(3);
  const t3 = await novaTurma(); expect(t3.regraAvaliacaoId).toBe(r3.id);
  expect((await prisma.turma.findUniqueOrThrow({ where: { id: t1.id } })).regraAvaliacaoId).toBe(r1.id);
  expect((await prisma.turma.findUniqueOrThrow({ where: { id: t2.id } })).regraAvaliacaoId).toBe(r1.id);
  const evento = await prisma.evento.findFirstOrThrow({ where: { agregadoId: t1.id, tipo: "TurmaCriada" } });
  expect(evento.payload).toMatchObject({ regraAvaliacaoId: r1.id });
  expect((await listarTurmas()).find(t => t.id === t1.id)?.regraAvaliacao).toEqual({ id: r1.id, versao: 1 });
});

it("preserva turmas anteriores sem inventar regra histórica ou de outro nível", async () => {
  const anterior = await novaTurma(); expect(anterior.regraAvaliacaoId).toBeNull();
  await regra(1);
  expect((await prisma.turma.findUniqueOrThrow({ where: { id: anterior.id } })).regraAvaliacaoId).toBeNull();
  for (const status of ["PLANEJADA", "EM_ANDAMENTO", "CONCLUIDA"] as const) {
    const t = await prisma.turma.create({ data: { ...entradaTurma(), status, dataInicio: new Date("2020-01-01"), dataFim: new Date("2020-03-01") } });
    expect(t.regraAvaliacaoId).toBeNull();
  }
  const desconhecida = await prisma.turma.create({ data: { modalidadeId, nivelId } });
  expect(desconhecida.regraAvaliacaoId).toBeNull();
  const nivel = await prisma.nivel.findUniqueOrThrow({ where: { id: nivelId } });
  const n2 = await prisma.nivel.create({ data: { idiomaId: nivel.idiomaId, codigo: "A2", ordem: 2 } });
  const outra = await prisma.turma.create({ data: { ...entradaTurma(), nivelId: n2.id } });
  expect(outra.regraAvaliacaoId).toBeNull();
});

it("não permite substituir regra ou nível por edição direta, mesmo antes do início", async () => {
  const r1 = await regra(1), t = await novaTurma(), r2 = await regra(2);
  await expect(prisma.turma.update({ where: { id: t.id }, data: { regraAvaliacaoId: r2.id } })).rejects.toThrow("aprovação específica");
  await expect(prisma.turma.update({ where: { id: t.id }, data: { regraAvaliacaoId: null } })).rejects.toThrow("aprovação específica");
  await expect(prisma.turma.create({ data: { ...entradaTurma(), regraAvaliacaoId: r1.id } })).rejects.toThrow("não informada livremente");
  const nivel = await prisma.nivel.findUniqueOrThrow({ where: { id: nivelId } });
  const n2 = await prisma.nivel.create({ data: { idiomaId: nivel.idiomaId, codigo: "A2", ordem: 2 } });
  expect(await editarTurma(t.id, { ...entradaTurma(), nivelId: n2.id })).toMatchObject({ ok: false, erro: expect.stringContaining("regras de avaliação") });
  await expect(prisma.turma.update({ where: { id: t.id }, data: { nivelId: n2.id } })).rejects.toThrow("edição direta");
  expect((await editarTurma(t.id, { ...entradaTurma(), nome: "Nome atualizado" })).ok).toBe(true);
  expect((await prisma.turma.findUniqueOrThrow({ where: { id: t.id } })).regraAvaliacaoId).toBe(r1.id);
});

it("turmas em andamento e concluídas conservam a publicação vinculada", async () => {
  const r1 = await regra(1), t1 = await novaTurma(), t2 = await novaTurma();
  await prisma.turma.update({ where: { id: t1.id }, data: { status: "EM_ANDAMENTO" } });
  await prisma.turma.update({ where: { id: t2.id }, data: { status: "CONCLUIDA" } });
  const r2 = await regra(2);
  for (const t of [t1, t2]) {
    expect((await prisma.turma.findUniqueOrThrow({ where: { id: t.id } })).regraAvaliacaoId).toBe(r1.id);
    await expect(prisma.turma.update({ where: { id: t.id }, data: { regraAvaliacaoId: r2.id } })).rejects.toThrow("aprovação específica");
  }
});

it("importação XLSX de turma futura usa a mesma publicação e registra sua referência", async () => {
  const r = await regra(1);
  const wb = new ExcelJS.Workbook(), ws = wb.addWorksheet("Turmas");
  ws.addRow(COLUNAS_IMPORTACAO_TURMA.map(c => c.header));
  const valores: Record<string, string> = { nome: "Turma importada teste", modalidade: "Regular", nivel: "Português A1", professor: "", diasSemana: "Seg, Qua", horarioInicio: "22:00", horarioFim: "00:00", dataInicio: "2099-10-01", dataFim: "", capacidade: "12", rolling: "Não" };
  ws.addRow(COLUNAS_IMPORTACAO_TURMA.map(c => valores[c.key]));
  const arquivo = new Uint8Array(await wb.xlsx.writeBuffer());
  const f = new FormData(); f.append("file", new File([arquivo], "turmas-teste.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const response = await POST(new Request("http://localhost/api/turmas/importar", { method: "POST", body: f }));
  expect(await response.json()).toMatchObject({ criadas: 1, erros: [] });
  const t = await prisma.turma.findFirstOrThrow({ where: { nome: valores.nome } });
  expect(t).toMatchObject({ horarioInicio: "22:00", horarioFim: "00:00", dataFim: null });
  expect(t.regraAvaliacaoId).toBe(r.id);
  expect((await prisma.evento.findFirstOrThrow({ where: { agregadoId: t.id, tipo: "TurmaImportada" } })).payload).toMatchObject({ regraAvaliacaoId: r.id });
});

it("importação não descarta silenciosamente uma data final inválida", async () => {
  const wb = new ExcelJS.Workbook(), ws = wb.addWorksheet("Turmas");
  ws.addRow(COLUNAS_IMPORTACAO_TURMA.map(c => c.header));
  const valores: Record<string, string> = { nome: "Data inválida", modalidade: "Regular", nivel: "Português A1", professor: "", diasSemana: "Seg, Qua", horarioInicio: "22:00", horarioFim: "00:00", dataInicio: "2099-10-01", dataFim: "fim-inválido", capacidade: "12", rolling: "Não" };
  ws.addRow(COLUNAS_IMPORTACAO_TURMA.map(c => valores[c.key]));
  const arquivo = new Uint8Array(await wb.xlsx.writeBuffer());
  const form = new FormData();
  form.append("file", new File([arquivo], "turmas-data-invalida.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const response = await POST(new Request("http://localhost/api/turmas/importar", { method: "POST", body: form }));
  expect(await response.json()).toMatchObject({
    criadas: 0,
    erros: [{ linha: 2, motivo: expect.stringContaining("Data final de referência inválida") }],
  });
  expect(await prisma.turma.count()).toBe(0);
});

it("criação concorrente espera publicação em curso e usa a versão confirmada", async () => {
  await regra(1); const r2 = await regra(2, false);
  let liberar!: () => void, publicada!: () => void, iniciou!: () => void;
  const gate = new Promise<void>(r => { liberar = r; });
  const pronta = new Promise<void>(r => { publicada = r; });
  const criando = new Promise<void>(r => { iniciou = r; });
  const publicacao = prisma.$transaction(async tx => {
    await decidirRegraAvaliacaoTx(tx, aprovador, { regraId: r2.id, conteudoHash: r2.conteudoHash, aprovada: true, motivo: "Publicação concorrente de teste" });
    publicada(); await gate;
  });
  await pronta;
  const criacao = prisma.$transaction(tx => { iniciou(); return tx.turma.create({ data: entradaTurma() }); });
  await criando; liberar();
  const [, turma] = await Promise.all([publicacao, criacao]);
  expect(turma.regraAvaliacaoId).toBe(r2.id);
});

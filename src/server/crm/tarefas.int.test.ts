import { describe, it, expect, beforeEach, vi } from "vitest";
import { Papel } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { truncarBanco, criarUsuario, eventosDo } from "@/test/integracao";
import {
  criarTarefa, editarTarefa, concluirTarefa, reabrirTarefa, reagendarTarefa, cancelarTarefa, assumirTarefa, escopoTarefas,
} from "./tarefas";

function logadoComo(id: string) {
  authMock.mockResolvedValue({ user: { id } });
}

let vendedor: Awaited<ReturnType<typeof criarUsuario>>;
let outroVendedor: Awaited<ReturnType<typeof criarUsuario>>;
let gerente: Awaited<ReturnType<typeof criarUsuario>>;
let secretaria: Awaited<ReturnType<typeof criarUsuario>>;
let opDaCarteira: string;
let opDeOutraCarteira: string;

async function nova(titulo = "Ligar") {
  logadoComo(vendedor.id);
  const r = await criarTarefa({ titulo, tipo: "OUTRO" });
  if (!r.ok || !r.dado) throw new Error("criarTarefa falhou");
  return r.dado.id;
}
function idDe(r: { ok: boolean; dado?: { id: string } }): string {
  if (!r.ok || !r.dado) throw new Error("criarTarefa falhou");
  return r.dado.id;
}
const buscar = (id: string) => prisma.tarefa.findUniqueOrThrow({ where: { id } });

beforeEach(async () => {
  await truncarBanco();
  await prisma.configuracaoOperacional.upsert({
    where: { id: "escola" },
    create: { id: "escola", fusoInstitucional: "America/Costa_Rica" },
    update: { fusoInstitucional: "America/Costa_Rica" },
  });
  gerente = await criarUsuario([Papel.GERENTE_COMERCIAL], "Gerente");
  vendedor = await criarUsuario([Papel.VENDEDOR], "Vendedor");
  outroVendedor = await criarUsuario([Papel.VENDEDOR], "Outro");
  secretaria = await criarUsuario([Papel.SECRETARIA_ACADEMICA], "Secretaria");
  await prisma.usuario.update({ where: { id: vendedor.id }, data: { gerenteComercialId: gerente.id } });
  opDaCarteira = (await prisma.oportunidade.create({ data: { nome: "Minha", vendedorDonoId: vendedor.id } })).id;
  opDeOutraCarteira = (await prisma.oportunidade.create({ data: { nome: "Alheia", vendedorDonoId: outroVendedor.id } })).id;
});

describe("criarTarefa", () => {
  it("vendedor cria só para si; o setor vem do papel", async () => {
    logadoComo(vendedor.id);
    const r = await criarTarefa({ titulo: "Ligar", tipo: "LIGACAO", responsavelId: outroVendedor.id, leadId: opDaCarteira, dataCivil: "2026-10-15", hora: "09:00", lembreteAntecedenciaMin: 30 });
    expect(await prisma.tarefa.findUniqueOrThrow({ where: { id: idDe(r) } })).toMatchObject({
      responsavelId: vendedor.id, setor: "COMERCIAL", fusoOrigem: "America/Costa_Rica",
    });
    const t = await buscar(idDe(r));
    expect(t.inicioEm?.toISOString()).toBe("2026-10-15T15:00:00.000Z"); // Costa Rica é UTC-6, sem horário de verão
    expect(t.lembrarEm?.toISOString()).toBe("2026-10-15T14:30:00.000Z");
    expect((await eventosDo("Tarefa", t.id)).map((e) => e.tipo)).toEqual(["TarefaCriada"]);
    expect((await eventosDo("Lead", opDaCarteira)).map((e) => e.tipo)).toEqual(["TarefaCriada"]);
  });

  it("vínculo a oportunidade fora da carteira é recusado", async () => {
    logadoComo(vendedor.id);
    expect(await criarTarefa({ titulo: "X", tipo: "OUTRO", leadId: opDeOutraCarteira })).toEqual({ ok: false, erro: "Oportunidade fora da sua carteira." });
    expect(await prisma.tarefa.count()).toBe(0);
  });

  it("gerente atribui à equipe, mas não a quem não é da equipe", async () => {
    logadoComo(gerente.id);
    const ok = await criarTarefa({ titulo: "Acompanhar", tipo: "OUTRO", responsavelId: vendedor.id });
    expect((await buscar(idDe(ok))).responsavelId).toBe(vendedor.id);
    expect(await criarTarefa({ titulo: "Acompanhar", tipo: "OUTRO", responsavelId: outroVendedor.id })).toEqual({ ok: false, erro: "Você só pode atribuir tarefas à sua equipe." });
    const fila = await criarTarefa({ titulo: "Fila", tipo: "OUTRO", responsavelId: null });
    expect(await buscar(idDe(fila))).toMatchObject({ responsavelId: null, setor: "COMERCIAL" });
  });

  it("horário sem data, título vazio e escola sem fuso são recusados", async () => {
    logadoComo(vendedor.id);
    expect(await criarTarefa({ titulo: "X", tipo: "OUTRO", hora: "09:00" })).toEqual({ ok: false, erro: "Informe a data para definir o horário." });
    expect(await criarTarefa({ titulo: "  ", tipo: "OUTRO" })).toEqual({ ok: false, erro: "Informe o título da tarefa." });
    await prisma.configuracaoOperacional.update({ where: { id: "escola" }, data: { fusoInstitucional: null } });
    expect(await criarTarefa({ titulo: "X", tipo: "OUTRO" })).toEqual({ ok: false, erro: "Configure o fuso institucional da escola antes de criar tarefas." });
  });
});

describe("escopo", () => {
  it("vê as minhas e a fila do setor; equipe só com o interruptor", async () => {
    const minha = await nova("Minha");
    logadoComo(outroVendedor.id);
    const dele = idDe(await criarTarefa({ titulo: "Dele", tipo: "OUTRO" }));
    const filaSec = (await prisma.tarefa.create({ data: { titulo: "Fila", tipo: "OUTRO", setor: "SECRETARIA", fusoOrigem: "America/Costa_Rica" } })).id;
    const ids = async (u: typeof vendedor, equipe: boolean) =>
      (await prisma.tarefa.findMany({ where: await escopoTarefas({ id: u.id, nome: u.nome, papeis: u.papeis }, equipe) })).map((t) => t.id).sort();
    expect(await ids(vendedor, true)).toEqual([minha]);
    expect(await ids(gerente, false)).toEqual([]);
    expect(await ids(gerente, true)).toEqual([minha]);
    expect(await ids(secretaria, false)).toEqual([filaSec]);
    const admin = await criarUsuario([Papel.ADMINISTRADOR], "Admin");
    expect(await ids(admin, false)).toEqual([minha, dele, filaSec].sort());
  });

  it("não edita tarefa fora do escopo", async () => {
    const t = await nova();
    logadoComo(outroVendedor.id);
    expect(await editarTarefa(t, 1, { titulo: "Invasão" })).toEqual({ ok: false, erro: "Tarefa não encontrada." });
  });
});

describe("versão e transições", () => {
  it("versão desatualizada é recusada", async () => {
    const t = await nova();
    expect((await editarTarefa(t, 1, { titulo: "A" })).ok).toBe(true);
    expect(await editarTarefa(t, 1, { titulo: "B" })).toEqual({ ok: false, erro: "Esta tarefa foi alterada por outra pessoa. Recarregue." });
    expect(await buscar(t)).toMatchObject({ titulo: "A", versao: 2 });
    expect((await eventosDo("Tarefa", t)).map((e) => e.tipo)).toEqual(["TarefaCriada", "TarefaEditada"]);
  });

  it("concluir ligação com resultado registra InteracaoRegistrada na oportunidade", async () => {
    logadoComo(vendedor.id);
    const tLigacao = idDe(await criarTarefa({ titulo: "Ligar", tipo: "LIGACAO", leadId: opDaCarteira }));
    expect((await concluirTarefa(tLigacao, 1, "Atendeu, pediu proposta")).ok).toBe(true);
    expect(await buscar(tLigacao)).toMatchObject({ status: "CONCLUIDA", resultado: "Atendeu, pediu proposta", concluidaPorId: vendedor.id });
    const eventos = await eventosDo("Lead", opDaCarteira);
    expect(eventos.map((e) => e.tipo)).toEqual(["TarefaCriada", "TarefaConcluida", "InteracaoRegistrada"]);
    expect(eventos.at(-1)).toMatchObject({ tipo: "InteracaoRegistrada", payload: { resultado: "Atendeu, pediu proposta" } });
    expect(await concluirTarefa(tLigacao, 2, "de novo")).toEqual({ ok: false, erro: "Só tarefas abertas podem ser concluídas." });
  });

  it("reabrir devolve a tarefa à fila de abertas; reagendar recalcula o instante", async () => {
    const t = await nova();
    await concluirTarefa(t, 1);
    expect((await reabrirTarefa(t, 2)).ok).toBe(true);
    expect(await buscar(t)).toMatchObject({ status: "ABERTA", concluidaEm: null, versao: 3 });
    expect((await reagendarTarefa(t, 3, { dataCivil: "2026-11-01", hora: "10:30" })).ok).toBe(true);
    expect((await buscar(t)).inicioEm?.toISOString()).toBe("2026-11-01T16:30:00.000Z");
    expect((await reagendarTarefa(t, 4, { dataCivil: null, hora: null })).ok).toBe(true);
    expect(await buscar(t)).toMatchObject({ dataCivil: null, inicioEm: null });
    expect((await eventosDo("Tarefa", t)).map((e) => e.tipo)).toEqual(["TarefaCriada", "TarefaConcluida", "TarefaReaberta", "TarefaReagendada", "TarefaReagendada"]);
  });

  it("cancelar não apaga; secretaria assume tarefa da fila do setor", async () => {
    const t = await nova();
    await editarTarefa(t, 1, { titulo: "Ajustada" });
    expect(await cancelarTarefa(t, 2, "  ")).toEqual({ ok: false, erro: "Informe o motivo do cancelamento." });
    expect((await cancelarTarefa(t, 2, "Duplicada")).ok).toBe(true);
    expect(await buscar(t)).toMatchObject({ status: "CANCELADA", motivoCancelamento: "Duplicada" });

    const tFilaSecretaria = (await prisma.tarefa.create({ data: { titulo: "Fila", tipo: "OUTRO", setor: "SECRETARIA", fusoOrigem: "America/Costa_Rica" } })).id;
    logadoComo(vendedor.id);
    expect(await assumirTarefa(tFilaSecretaria)).toEqual({ ok: false, erro: "Tarefa não encontrada." });
    logadoComo(secretaria.id);
    expect((await assumirTarefa(tFilaSecretaria)).ok).toBe(true);
    expect((await prisma.tarefa.findUniqueOrThrow({ where: { id: tFilaSecretaria } })).responsavelId).toBe(secretaria.id);
    expect((await eventosDo("Tarefa", tFilaSecretaria)).map((e) => e.tipo)).toEqual(["TarefaAssumida"]);
    expect(await assumirTarefa(tFilaSecretaria)).toEqual({ ok: false, erro: "Esta tarefa já tem responsável." });
  });
});

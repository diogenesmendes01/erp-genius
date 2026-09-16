import { beforeEach, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { criarAvisosAlteracaoAgendaTx, despacharAvisoAlteracaoAgendaInterna } from "./avisos";

const hashContato = (valor: string) => createHash("sha256").update(valor).digest("hex");

let matriculaId: string;
let outraMatriculaId: string;
let alunoId: string;
let professorId: string;
let encontroAId: string;
let encontroBId: string;
let eventoId: string;

async function criarEncontro(chave: string, inicio: Date) {
  return prisma.encontroAgenda.create({ data: {
    matriculaId, professorId, preparadorId: professorId, inicio, fim: new Date(inicio.getTime() + 3_600_000),
    fusoOrigem: "UTC", status: "PREVISTO", motivo: "Alteração aprovada", chaveIdempotencia: chave, entradaHash: "fixture",
  } });
}

beforeEach(async () => {
  await truncarBanco();
  const catalogo = await seedCatalogoMinimo();
  professorId = (await criarUsuario(["PROFESSOR"])).id;
  alunoId = (await prisma.aluno.create({ data: {
    primeiroNome: "Aluno", paisId: catalogo.pais.id, email: "aluno@example.test", telefoneE164: "+5511999999999",
    whatsapp: true, aceitaComunicacoes: true,
  } })).id;
  matriculaId = (await prisma.matricula.create({ data: { alunoId, produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC", status: "ATIVA" } })).id;
  outraMatriculaId = (await prisma.matricula.create({ data: { alunoId, produtoId: catalogo.produto.id, paisId: catalogo.pais.id, moeda: "CRC", status: "ATIVA" } })).id;
  encontroAId = (await criarEncontro("aviso-a", new Date("2026-10-01T10:00:00.000Z"))).id;
  encontroBId = (await criarEncontro("aviso-b", new Date("2026-10-02T10:00:00.000Z"))).id;
  eventoId = (await prisma.evento.create({ data: { tipo: "RemarcacaoParticularDecidida", agregadoTipo: "Matricula", agregadoId: matriculaId, payload: { aprovada: true, encontroOriginalId: encontroAId, encontroNovoId: encontroBId } } })).id;
});

it("não persiste aviso quando a alteração aplicada faz rollback", async () => {
  await expect(prisma.$transaction(async tx => {
    await criarAvisosAlteracaoAgendaTx(tx, { eventoId, matriculaId, encontrosIds: [encontroAId] });
    throw new Error("rollback deliberado");
  })).rejects.toThrow("rollback deliberado");
  expect(await prisma.avisoAlteracaoAgenda.count()).toBe(0);
  expect(await prisma.itemAvisoAlteracaoAgenda.count()).toBe(0);
});

it("consolida todos os encontros da mesma origem e destinatário em chamadas repetidas", async () => {
  await prisma.$transaction(tx => criarAvisosAlteracaoAgendaTx(tx, { eventoId, matriculaId, encontrosIds: [encontroAId] }));
  await prisma.$transaction(tx => criarAvisosAlteracaoAgendaTx(tx, { eventoId, matriculaId, encontrosIds: [encontroBId] }));
  const aviso = await prisma.avisoAlteracaoAgenda.findFirstOrThrow({ where: { eventoId, matriculaId, canal: "EMAIL" }, include: { itens: { orderBy: { encontroId: "asc" } } } });
  expect(aviso.itens.map(item => item.encontroId).sort()).toEqual([encontroAId, encontroBId].sort());
});

it("recusa via SQL um aviso cuja origem aplicada pertence a outra matrícula", async () => {
  const eventoDeOutraMatricula = await prisma.evento.create({ data: { tipo: "RemarcacaoParticularDecidida", agregadoTipo: "Matricula", agregadoId: outraMatriculaId } });
  await expect(prisma.avisoAlteracaoAgenda.create({ data: {
    id: "aviso-origem-incoerente", mudancaId: eventoDeOutraMatricula.id, eventoId: eventoDeOutraMatricula.id,
    matriculaId, alunoId, canal: "EMAIL", contatoHash: hashContato("aluno@example.test"), chave: "origem-incoerente",
  } })).rejects.toThrow();
});

it("faz um único claim de despacho quando dois workers concorrem pelo mesmo aviso", async () => {
  await prisma.$transaction(tx => criarAvisosAlteracaoAgendaTx(tx, { eventoId, matriculaId, encontrosIds: [encontroAId] }));
  const aviso = await prisma.avisoAlteracaoAgenda.findFirstOrThrow({ where: { eventoId, matriculaId, canal: "EMAIL" } });
  let chamadas = 0;
  let liberar: (() => void) | undefined;
  let sinalizarEntrada: (() => void) | undefined;
  const barreira = new Promise<void>(resolve => { liberar = resolve; });
  const entrouNoTransporte = new Promise<void>(resolve => { sinalizarEntrada = resolve; });
  const entregar = async () => {
    chamadas += 1;
    sinalizarEntrada!();
    await barreira;
    return { situacao: "ACEITO" as const, provedorId: `provedor-${chamadas}` };
  };
  const primeira = despacharAvisoAlteracaoAgendaInterna(aviso.id, entregar);
  const segunda = despacharAvisoAlteracaoAgendaInterna(aviso.id, entregar);
  await entrouNoTransporte;
  await new Promise(resolve => setTimeout(resolve, 25));
  liberar!();
  await Promise.all([primeira, segunda]);
  expect(chamadas).toBe(1);
  expect(await prisma.tentativaAvisoAlteracaoAgenda.count({ where: { avisoId: aviso.id, situacao: "INCERTO" } })).toBe(1);
});

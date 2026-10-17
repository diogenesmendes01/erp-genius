import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";
const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { criarNumeroSetor } from "@/test/integracao-whatsapp";
import { garantirAtendimento } from "./atendimentos";
import { transferirAtendimento } from "./acoes-atendimento";
import { encerrarAtendimentoWhatsApp } from "./operacoes-atendimento";

beforeEach(async () => { await truncarBanco(); authMock.mockReset(); });

const comoUsuario = (u: { id: string }) => authMock.mockResolvedValue({ user: { id: u.id } });
const ctx12 = "Pediu histórico escolar";

async function cenario() {
  const v1 = await criarUsuario([Papel.VENDEDOR], "Vend Um");
  const v2 = await criarUsuario([Papel.VENDEDOR], "Vend Dois");
  const gc = await criarUsuario([Papel.GERENTE_COMERCIAL], "Gerente");
  const numero = await criarNumeroSetor({ telefoneE164: "+5511999990001", setores: ["COMERCIAL", "SECRETARIA", "FINANCEIRO"], donoId: v1.id });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50688880001" } });
  const a = await prisma.$transaction((tx) => garantirAtendimento(tx, { numeroId: numero.id, contatoId: contato.id, finalidade: "COMERCIAL", responsavelId: v1.id }));
  return { v1, v2, gc, numero, contato, a };
}
async function alunoComMatricula(codigo: string, telefone: string) {
  const cat = await seedCatalogoMinimo();
  const prof = await criarUsuario([Papel.PROFESSOR], "Prof " + codigo);
  const nivel = await prisma.nivel.create({ data: { idiomaId: cat.idioma.id, codigo: "A1", ordem: 1 } });
  const turma = await prisma.turma.create({ data: { nivelId: nivel.id, modalidadeId: cat.modalidade.id, professorId: prof.id } });
  const aluno = await prisma.aluno.create({ data: { primeiroNome: "Al", sobrenome: "Uno", paisId: cat.pais.id, telefoneE164: telefone, whatsapp: true } });
  const matricula = await prisma.matricula.create({ data: { alunoId: aluno.id, produtoId: cat.produto.id, paisId: cat.pais.id, moeda: "CRC", codigo } });
  return { aluno, turma, matricula };
}
const ler = (id: string) => prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id } });

describe("transferir e encerrar", () => {
  it("transferir = encerrar + abrir com atendimentoOrigemId", async () => {
    const { v1, a, numero } = await cenario();
    comoUsuario(v1);
    const r = await transferirAtendimento({ atendimentoId: a.id, destino: "SECRETARIA", destinoChave: null, contexto: ctx12 });
    expect(r.ok).toBe(true);
    const novo = await ler(r.ok ? r.dado!.novoAtendimentoId : "");
    expect(novo).toMatchObject({ finalidade: "SECRETARIA", atendimentoOrigemId: a.id, conversaId: a.conversaId, responsavelId: null, status: "ABERTO_SEM_RESPONSAVEL" });
    expect(await ler(a.id)).toMatchObject({ status: "ENCERRADO" });
    expect((await ler(a.id)).encerradoEm).not.toBeNull();
    expect(numero.id).toBeTruthy();
    for (const id of [a.id, novo.id]) {
      const ev = await prisma.evento.findMany({ where: { tipo: "AtendimentoTransferido", agregadoId: id } });
      expect(ev).toHaveLength(1);
      expect(ev[0].payload).toEqual({ de: "COMERCIAL", para: "SECRETARIA", origemId: a.id, novoId: novo.id, contexto: ctx12 });
    }
    expect(await prisma.evento.count({ where: { tipo: "AtendimentoEncerrado", agregadoId: a.id } })).toBe(1);
  });

  it("para FINANCEIRO sem matrícula: recusa e não encerra a origem", async () => {
    const { v1, a } = await cenario();
    comoUsuario(v1);
    expect(await transferirAtendimento({ atendimentoId: a.id, destino: "FINANCEIRO", destinoChave: null, contexto: "x".repeat(12) }))
      .toEqual({ ok: false, erro: "Escolha a matrícula do atendimento financeiro." });
    expect((await ler(a.id)).encerradoEm).toBeNull();
  });

  it("setor que o número não atende: recusa pela checagem do número (chave válida)", async () => {
    const { v1, a } = await cenario();
    const { aluno, turma, matricula } = await alunoComMatricula("MAT-S", "+50680001111");
    comoUsuario(v1);
    const r = await transferirAtendimento({ atendimentoId: a.id, destino: "PEDAGOGICO", destinoChave: `PEDAGOGICO:${aluno.id}:${turma.id}:${matricula.id}:ALUNO`, contexto: "x".repeat(12) });
    expect(r).toEqual({ ok: false, erro: "O número deste atendimento não atende o setor escolhido." });
    expect((await ler(a.id)).encerradoEm).toBeNull();
  });

  it("contexto curto, outro vendedor sem alçada e destino igual são recusados", async () => {
    const { v1, v2, a } = await cenario();
    comoUsuario(v1);
    expect((await transferirAtendimento({ atendimentoId: a.id, destino: "SECRETARIA", destinoChave: null, contexto: "curto" })).ok).toBe(false);
    expect((await transferirAtendimento({ atendimentoId: a.id, destino: "COMERCIAL", destinoChave: null, contexto: ctx12 })).ok).toBe(false);
    comoUsuario(v2);
    expect((await transferirAtendimento({ atendimentoId: a.id, destino: "SECRETARIA", destinoChave: null, contexto: ctx12 })).ok).toBe(false);
    expect((await ler(a.id)).encerradoEm).toBeNull();
  });

  it("FINANCEIRO com matrícula: abre o atendimento financeiro ligado à origem", async () => {
    const { v1, a, contato } = await cenario();
    const { aluno, matricula } = await alunoComMatricula("MAT-F", contato.telefoneE164);
    comoUsuario(v1);
    const r = await transferirAtendimento({ atendimentoId: a.id, destino: "FINANCEIRO", destinoChave: `FINANCEIRO:${matricula.id}`, contexto: ctx12 });
    expect(r.ok).toBe(true);
    expect(await ler(r.ok ? r.dado!.novoAtendimentoId : "")).toMatchObject({ finalidade: "FINANCEIRO", matriculaId: matricula.id, alunoId: aluno.id, atendimentoOrigemId: a.id });
  });

  it("FINANCEIRO com contato sem relação com a matrícula: recusa e não encerra a origem", async () => {
    const { v1, a } = await cenario();
    const { matricula } = await alunoComMatricula("MAT-X", "+50680001111");
    comoUsuario(v1);
    const r = await transferirAtendimento({ atendimentoId: a.id, destino: "FINANCEIRO", destinoChave: `FINANCEIRO:${matricula.id}`, contexto: ctx12 });
    expect(r).toEqual({ ok: false, erro: "O contato desta conversa não é o destinatário de cobrança da matrícula escolhida." });
    expect((await ler(a.id)).encerradoEm).toBeNull();
    expect(await prisma.atendimentoWhatsApp.count({ where: { atendimentoOrigemId: a.id } })).toBe(0);
    expect(await prisma.evento.count({ where: { tipo: "AtendimentoTransferido" } })).toBe(0);
  });

  it("erro de trigger do banco (265) desfaz tudo e vira mensagem de regra", async () => {
    const { v1, a, numero } = await cenario();
    await prisma.numeroSetorWhatsApp.create({ data: { numeroId: numero.id, finalidade: "PEDAGOGICO" } });
    const cat = await seedCatalogoMinimo();
    const prof = await criarUsuario([Papel.PROFESSOR], "Prof");
    const nivel = await prisma.nivel.create({ data: { idiomaId: cat.idioma.id, codigo: "A1", ordem: 1 } });
    const turma = await prisma.turma.create({ data: { nivelId: nivel.id, modalidadeId: cat.modalidade.id, professorId: prof.id } });
    const aluno = await prisma.aluno.create({ data: { primeiroNome: "Al", sobrenome: "Uno", paisId: cat.pais.id, telefoneE164: "+50680001111", whatsapp: true } });
    const matricula = await prisma.matricula.create({ data: { alunoId: aluno.id, produtoId: cat.produto.id, paisId: cat.pais.id, moeda: "CRC", codigo: "MAT-P" } });
    comoUsuario(v1);
    // O contato da conversa (+50688880001) não é o telefone do aluno: o banco recusa o destino direto.
    const r = await transferirAtendimento({ atendimentoId: a.id, destino: "PEDAGOGICO", destinoChave: `PEDAGOGICO:${aluno.id}:${turma.id}:${matricula.id}:ALUNO`, contexto: ctx12 });
    expect(r.ok).toBe(false);
    expect(r).toEqual({ ok: false, erro: "Contato pedagógico não corresponde ao aluno ou responsável autorizado." });
    expect((await ler(a.id)).encerradoEm).toBeNull();
    expect(await prisma.atendimentoWhatsApp.count({ where: { atendimentoOrigemId: a.id } })).toBe(0);
    expect(await prisma.evento.count({ where: { tipo: "AtendimentoTransferido" } })).toBe(0);
  });

  it("encerrar cancela a fila do atendimento e marca ENCERRADO", async () => {
    const { gc, a, contato, numero } = await cenario();
    const i = await prisma.intencaoMensagem.create({ data: {
      numeroId: numero.id, atendimentoId: a.id, contatoId: contato.id, corpoRenderizado: "oi", status: "PENDENTE", origem: "HUMANO", autorId: gc.id,
    } });
    comoUsuario(gc);
    expect((await encerrarAtendimentoWhatsApp(a.id)).ok).toBe(true);
    expect(await ler(a.id)).toMatchObject({ status: "ENCERRADO" });
    expect(await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: i.id } })).toMatchObject({ status: "CANCELADA", motivoFalha: "atendimento_encerrado" });
  });
});

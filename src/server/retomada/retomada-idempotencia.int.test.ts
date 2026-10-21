import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

// #166, 5º lote (N3 da R1 do #274): proposta de retomada com chave da tentativa. Sem chave, se outra pessoa
// rejeitasse a proposta entre a tentativa e o reenvio, o reenvio abria uma nova proposta (o servidor não distingue
// esse reenvio de uma nova proposta deliberada com o mesmo texto). Com a chave (marca no `RetomadaSolicitada`), o
// reenvio devolve a proposta original; chave nova continua sendo nova proposta.

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/_shared/sessao", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/_shared/sessao")>();
  const sessao = async () => {
    const id = (await authMock())?.user?.id;
    const usuario = id && await prisma.usuario.findUnique({ where: { id }, select: { id: true, nome: true, ativo: true, papeis: true } });
    if (!usuario?.ativo) throw new original.ErroAutenticacao();
    return usuario;
  };
  return { ...original, exigirSessao: sessao, exigirSessaoComPapel: async (...papeis: Papel[]) => {
    const usuario = await sessao(); original.exigirPapel(usuario, ...papeis); return usuario;
  } };
});

import { prisma } from "@/lib/prisma";
import { criarUsuario, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import type { Resultado } from "@/server/_shared";
import { pausarAluno } from "@/server/alunos/acoes";
import { decidirRetomada, solicitarRetomada } from "./acoes";

let secId: string, finId: string, alunoId: string, outroAlunoId: string;
const entrar = (id: string) => authMock.mockResolvedValue({ user: { id } });
const entrada = { opcao: "MANTER_VENCIMENTOS" as const, motivo: "Retorno acordado com aluno e financeiro" };

function sucesso<T>(r: Resultado<T>) {
  if (!r.ok) throw new Error(r.erro);
  return r.dado!;
}
const propostas = () => prisma.propostaRetomada.count();
const solicitadas = () => prisma.evento.count({ where: { tipo: "RetomadaSolicitada" } });

async function alunoPausado(nome: string) {
  const catalogo = await prisma.pais.findFirstOrThrow();
  const produto = await prisma.produto.findFirstOrThrow();
  const aluno = await prisma.aluno.create({ data: { primeiroNome: nome, paisId: catalogo.id, status: "ATIVO" } });
  await prisma.matricula.create({ data: { alunoId: aluno.id, produtoId: produto.id, paisId: catalogo.id, moeda: "CRC", status: "ATIVA", mesesPlano: 6 } });
  entrar(secId);
  sucesso(await pausarAluno(aluno.id, { motivo: "Pausa a pedido do aluno" }));
  return aluno.id;
}

async function rejeitar(propostaId: string) {
  entrar(finId);
  sucesso(await decidirRetomada(propostaId, { aprovar: false, motivo: "Aguardar a regularização combinada" }));
  entrar(secId);
}

beforeEach(async () => {
  await truncarBanco();
  await prisma.configuracaoOperacional.create({ data: { id: "escola", fusoInstitucional: Intl.DateTimeFormat().resolvedOptions().timeZone } });
  secId = (await criarUsuario([Papel.SECRETARIA_ACADEMICA], "Secretaria")).id;
  finId = (await criarUsuario([Papel.FINANCEIRO], "Financeiro")).id;
  await seedCatalogoMinimo();
  alunoId = await alunoPausado("Pessoa retomada");
  outroAlunoId = await alunoPausado("Outra pessoa");
});

describe("proposta de retomada com chave (#166, N3 da R1 do #274)", () => {
  it("o reenvio com a mesma chave, inclusive simultâneo, devolve a mesma proposta", async () => {
    const comChave = { ...entrada, chaveIdempotencia: "chave-retomada-01" };
    const [a, b] = await Promise.all([solicitarRetomada(alunoId, comChave), solicitarRetomada(alunoId, comChave)]);
    expect(a.ok && b.ok, JSON.stringify([a, b])).toBe(true);
    expect(b).toEqual(a);
    expect(await propostas()).toBe(1);
    expect(await solicitadas()).toBe(1);
  });

  it("depois da rejeição, o reenvio da mesma tentativa devolve a proposta original sem abrir outra", async () => {
    const comChave = { ...entrada, chaveIdempotencia: "chave-retomada-02" };
    const { propostaId, status } = sucesso(await solicitarRetomada(alunoId, comChave));
    expect(status).toBe("PENDENTE");
    await rejeitar(propostaId);
    // O status real, não o de uma proposta nova (#282, C3): a tela avisa que já foi decidida.
    expect(sucesso(await solicitarRetomada(alunoId, comChave))).toEqual({ propostaId, status: "REJEITADA" });
    expect(await propostas()).toBe(1);
    expect(await solicitadas()).toBe(1);
  });

  it("chave nova depois da rejeição é nova proposta; sem chave, o comportamento de antes", async () => {
    const { propostaId } = sucesso(await solicitarRetomada(alunoId, { ...entrada, chaveIdempotencia: "chave-retomada-03" }));
    await rejeitar(propostaId);
    const nova = sucesso(await solicitarRetomada(alunoId, { ...entrada, chaveIdempotencia: "chave-retomada-04" }));
    expect(nova.propostaId).not.toBe(propostaId);
    await rejeitar(nova.propostaId);
    expect(sucesso(await solicitarRetomada(alunoId, entrada)).propostaId).not.toBe(nova.propostaId);
    expect(await propostas()).toBe(3);
  });

  it("recusa a mesma chave com outra entrada ou outro aluno, sem gravar e sem revelar o aluno", async () => {
    const comChave = { ...entrada, chaveIdempotencia: "chave-retomada-05" };
    sucesso(await solicitarRetomada(alunoId, comChave));
    const outroMotivo = await solicitarRetomada(alunoId, { ...comChave, motivo: "Outro motivo informado depois" });
    expect(outroMotivo.ok).toBe(false);
    if (!outroMotivo.ok) expect(outroMotivo.erro).toMatch(/tentativa já foi usada/);
    expect(await solicitarRetomada(outroAlunoId, comChave)).toEqual(outroMotivo);
    expect(await solicitarRetomada("aluno-que-nao-existe", comChave)).toEqual(outroMotivo);
    expect(await propostas()).toBe(1);
    expect(await solicitadas()).toBe(1);
  });

  it("a chave é do autor: outra pessoa com a mesma chave segue as regras de sempre", async () => {
    const comChave = { ...entrada, chaveIdempotencia: "chave-retomada-06" };
    sucesso(await solicitarRetomada(alunoId, comChave));
    entrar(finId);
    const deOutro = await solicitarRetomada(alunoId, comChave);
    expect(deOutro.ok).toBe(false);
    if (!deOutro.ok) expect(deOutro.erro).toMatch(/proposta de retomada pendente/);
    expect(await propostas()).toBe(1);
  });
});

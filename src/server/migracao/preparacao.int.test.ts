import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("@/server/_shared/sessao", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/_shared/sessao")>();
  const { prisma } = await import("@/lib/prisma");
  async function sessao() {
    const id = (await authMock())?.user?.id;
    const usuario = id && await prisma.usuario.findUnique({ where: { id }, select: { id: true, nome: true, ativo: true, papeis: true } });
    if (!usuario?.ativo) throw new original.ErroAutenticacao();
    return usuario;
  }
  return { ...original, exigirSessao: sessao, exigirSessaoComPapel: async (...papeis: Papel[]) => { const usuario = await sessao(); original.exigirPapel(usuario, ...papeis); return usuario; } };
});

import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { prepararLoteMigracao } from "./acoes";
import { consultarLotesPreparacaoMigracao } from "./consultas";

let adminId: string;
const entrar = (id: string) => authMock.mockResolvedValue({ user: { id } });
const aluno = (id: string, nome = "Ana Lima") => ({ id, nome, email: "ana@example.test", documento: "DOC-1", pais: "BR", fuso: "America/Sao_Paulo" });
const linha = (linhaOrigem: string, id: string, nome = "Ana Lima") => ({ linhaOrigem, tipoEntrada: "CADASTRO" as const, aluno: aluno(id, nome), dadosAdicionais: { planilha: "Letícia" } });
const lote = (chaveLote: string, linhas: ReturnType<typeof linha>[]) => ({ origem: "OPERACIONAL_LETICIA", chaveLote, linhas });

beforeEach(async () => { await truncarBanco(); adminId = (await criarUsuario([Papel.ADMINISTRADOR], "Admin migração")).id; entrar(adminId); });

describe("M01 preparação de migração", () => {
  it("preserva células inválidas, não cria entidades de destino e repete sem duplicar", async () => {
    const entrada = lote("celulas-1", [{ ...linha("alunos!2", "aluno-1"), aluno: { ...aluno("aluno-1"), email: "invalido" } }, linha("alunos!3", "aluno-2", "Bia Lima")]);
    const primeiro = await prepararLoteMigracao(entrada);
    expect(primeiro).toMatchObject({ ok: true, dado: { repetido: false, estado: "COM_PENDENCIAS" } });
    const loteSalvo = await prisma.lotePreparacaoMigracao.findUniqueOrThrow({ where: { origem_chaveLote: { origem: entrada.origem, chaveLote: entrada.chaveLote } }, include: { linhas: { include: { pendencias: true } } } });
    expect(loteSalvo.linhas).toHaveLength(2);
    expect(loteSalvo.linhas.find((item) => item.linhaOrigem === "alunos!2")?.dadosOrigem).toMatchObject({ aluno: { email: "invalido" } });
    expect(loteSalvo.linhas.find((item) => item.linhaOrigem === "alunos!2")?.pendencias.map((p) => p.codigo)).toContain("EMAIL_INVALIDO");
    expect(loteSalvo.linhas.find((item) => item.linhaOrigem === "alunos!3")?.pendencias).toEqual([]);
    expect(await Promise.all([prisma.aluno.count(), prisma.matricula.count(), prisma.cobranca.count(), prisma.recebimento.count(), prisma.alocacaoTurma.count()])).toEqual([0, 0, 0, 0, 0]);
    expect(await prepararLoteMigracao(entrada)).toMatchObject({ ok: true, dado: { loteId: loteSalvo.id, repetido: true } });
    expect(await prisma.linhaPreparacaoMigracao.count()).toBe(2);
    expect(await prisma.evento.count({ where: { agregadoTipo: "LotePreparacaoMigracao" } })).toBe(1);
    expect(await consultarLotesPreparacaoMigracao()).toMatchObject({ ok: true, dado: { itens: [expect.objectContaining({ id: loteSalvo.id, linhas: 2, pendencias: 1 })] } });
  });

  it("preserva tentativa divergente da mesma linha sem reescrever a fotografia", async () => {
    const original = lote("replay-divergente", [linha("alunos!2", "aluno-1")]);
    expect((await prepararLoteMigracao(original)).ok).toBe(true);
    const divergente = lote("replay-divergente", [linha("alunos!2", "aluno-1", "Outro nome")]);
    expect(await prepararLoteMigracao(divergente)).toMatchObject({ ok: true, dado: { revisaoNecessaria: true, estado: "COM_PENDENCIAS" } });
    const salvo = await prisma.lotePreparacaoMigracao.findUniqueOrThrow({ where: { origem_chaveLote: { origem: original.origem, chaveLote: original.chaveLote } }, include: { linhas: true, conflitosEntrada: true } });
    expect(salvo.linhas).toHaveLength(1); expect(salvo.linhas[0]?.dadosOrigem).toMatchObject({ aluno: { nome: "Ana Lima" } });
    expect(salvo.conflitosEntrada).toHaveLength(1); expect(salvo.conflitosEntrada[0]?.dadosConflitantes).toMatchObject({ aluno: { nome: "Outro nome" } });
    const consulta = await (await import("./consultas")).consultarLotePreparacaoMigracao(salvo.id);
    expect(consulta).toMatchObject({ ok: true, dado: { preparadoPor: { nome: "Admin migração" }, linhas: [expect.objectContaining({ entradaHash: salvo.linhas[0]?.entradaHash, dadosOrigem: expect.objectContaining({ aluno: expect.objectContaining({ nome: "Ana Lima" }) }) })], conflitosEntrada: [expect.objectContaining({ dadosConflitantes: expect.objectContaining({ aluno: expect.objectContaining({ nome: "Outro nome" }) }), registradoPorNome: "Admin migração" })] } });
  });

  it("registra uma linha omitida no reenvio sem apagar a fotografia original", async () => {
    const original = lote("replay-omissao", [linha("alunos!2", "aluno-1"), linha("alunos!3", "aluno-2", "Bia")]);
    await prepararLoteMigracao(original);
    await prepararLoteMigracao(lote("replay-omissao", [linha("alunos!2", "aluno-1")]));
    const salvo = await prisma.lotePreparacaoMigracao.findUniqueOrThrow({ where: { origem_chaveLote: { origem: original.origem, chaveLote: original.chaveLote } }, include: { linhas: true, conflitosEntrada: true } });
    expect(salvo.linhas).toHaveLength(2);
    expect(salvo.conflitosEntrada).toEqual(expect.arrayContaining([expect.objectContaining({ linhaOrigem: "alunos!3", codigo: "LINHA_ORIGEM_AUSENTE_NO_REENVIO", dadosConflitantes: { ausenteDoReenvio: true } })]));
  });

  it("marca todas as linhas de uma colisão tripla e serializa lotes concorrentes da mesma origem", async () => {
    expect((await prepararLoteMigracao(lote("tripla", [linha("a!1", "mesmo", "Ana"), linha("a!2", "mesmo", "Bia"), linha("a!3", "mesmo", "Cris")])))).toMatchObject({ ok: true });
    const tripla = await prisma.lotePreparacaoMigracao.findUniqueOrThrow({ where: { origem_chaveLote: { origem: "OPERACIONAL_LETICIA", chaveLote: "tripla" } }, include: { linhas: true } });
    expect(tripla.linhas.every((item) => item.estado === "COLISAO_ORIGEM")).toBe(true);
    const [primeiro, segundo] = await Promise.all([prepararLoteMigracao(lote("concorrente-a", [linha("b!1", "concorrente", "Ana")])), prepararLoteMigracao(lote("concorrente-b", [linha("b!2", "concorrente", "Bia")] ))]);
    expect(primeiro.ok && segundo.ok).toBe(true);
    const concorrentes = await prisma.linhaPreparacaoMigracao.findMany({ where: { alunoOrigemId: "concorrente" } });
    expect(concorrentes).toHaveLength(2); expect(concorrentes.every((item) => item.estado === "COLISAO_ORIGEM")).toBe(true);
  });

  it("recusa Administração revogada antes de gravar qualquer lote", async () => {
    await prisma.usuario.update({ where: { id: adminId }, data: { ativo: false } });
    expect(await prepararLoteMigracao(lote("revogado", [linha("a!1", "a")]))).toMatchObject({ ok: false });
    expect(await prisma.lotePreparacaoMigracao.count()).toBe(0);
  });

  it("protege fotografia, estados e evidências contra SQL direto", async () => {
    await prepararLoteMigracao(lote("imutavel", [{ ...linha("a!1", "a"), aluno: { ...aluno("a"), email: "invalido" } } ]));
    const salvo = await prisma.lotePreparacaoMigracao.findUniqueOrThrow({ where: { origem_chaveLote: { origem: "OPERACIONAL_LETICIA", chaveLote: "imutavel" } }, include: { linhas: { include: { pendencias: true } } } });
    const linhaSalva = salvo.linhas[0]!;
    await expect(prisma.lotePreparacaoMigracao.update({ where: { id: salvo.id }, data: { chaveLote: "alterado" } })).rejects.toThrow();
    await expect(prisma.linhaPreparacaoMigracao.update({ where: { id: linhaSalva.id }, data: { estado: "PRONTA_PARA_REVISAO" } })).rejects.toThrow();
    await expect(prisma.pendenciaCampoPreparacaoMigracao.update({ where: { id: linhaSalva.pendencias[0]!.id }, data: { detalhe: "ocultar" } })).rejects.toThrow();
    await expect(prisma.linhaPreparacaoMigracao.delete({ where: { id: linhaSalva.id } })).rejects.toThrow();
  });
});

import { afterAll, afterEach, beforeEach, expect, it, vi } from "vitest";
import { Papel, type Prisma } from "@prisma/client";

const sessao = vi.hoisted(() => ({ id: "" }));
vi.mock("@/server/_shared/sessao", async original => {
  const o = await original<typeof import("@/server/_shared/sessao")>();
  return { ...o, exigirSessao: async () => {
    const usuario = await o.carregarUsuarioFresco(sessao.id);
    if (!usuario) throw new o.ErroAutenticacao();
    return usuario;
  } };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { escopoComercialAtual } from "@/server/_shared/escopo-comercial";
import { listarOpcoesAtendimento } from "./operacoes-atendimento";

afterAll(() => prisma.$disconnect());

let sequencia = 0;
const fetchBloqueado = vi.fn(() => { throw new Error("Envio externo inesperado no teste de opções."); });
beforeEach(async () => {
  vi.stubGlobal("fetch", fetchBloqueado);
  fetchBloqueado.mockClear();
  await truncarBanco();
  sessao.id = "";
});
afterEach(() => {
  try { expect(fetchBloqueado).not.toHaveBeenCalled(); }
  finally { vi.unstubAllGlobals(); }
});
async function lead(dados: Partial<Prisma.OportunidadeUncheckedCreateInput> = {}) {
  return prisma.oportunidade.create({ data: { codigo: `L-OPCOES-OR-${++sequencia}`, nome: "Lead fictício opções", ...dados } });
}
async function foto() {
  return {
    usuarios: await prisma.usuario.findMany({ orderBy: { id: "asc" } }),
    leads: await prisma.oportunidade.findMany({ orderBy: { id: "asc" } }),
    pessoas: await prisma.pessoa.findMany({ orderBy: { id: "asc" } }),
    numeros: await prisma.numeroWhatsApp.findMany({ orderBy: { id: "asc" } }),
    contatos: await prisma.contatoWhatsApp.findMany({ orderBy: { id: "asc" } }),
    conversas: await prisma.conversaWhatsApp.findMany({ orderBy: { id: "asc" } }),
    atendimentos: await prisma.atendimentoWhatsApp.findMany({ orderBy: { id: "asc" } }),
    eventos: await prisma.evento.findMany({ orderBy: { id: "asc" } }),
    mensagens: await prisma.mensagemWhatsApp.findMany({ orderBy: { id: "asc" } }),
    intencoes: await prisma.intencaoMensagem.findMany({ orderBy: { id: "asc" } }),
  };
}

it("ADMIN com escopo canônico vazio lista lead comercial não experimental sem escrever", async () => {
  const admin = await criarUsuario([Papel.ADMINISTRADOR], "Admin opções"), vendedor = await criarUsuario([Papel.VENDEDOR], "Dono opções");
  const l = await lead({ vendedorDonoId: vendedor.id, etapa: "NOVO", professorExperimentalId: null });
  sessao.id = admin.id;
  const ator = await prisma.usuario.findUniqueOrThrow({ where: { id: admin.id } });
  expect(ator.ativo).toBe(true); expect(ator.papeis).toEqual([Papel.ADMINISTRADOR]);
  expect(await prisma.$transaction(tx => escopoComercialAtual(ator, tx))).toEqual({});
  expect(l).toMatchObject({ vendedorDonoId: vendedor.id, etapa: "NOVO", professorExperimentalId: null });
  const antes = await foto(), opcoes = await listarOpcoesAtendimento();
  expect(opcoes.comercial).toBe(true);
  expect(opcoes.destinos.map(d => d.chave)).toEqual([`COMERCIAL:${l.id}`]);
  expect(await foto()).toEqual(antes);
});

it("VEN lista carteira própria e recusa outro owner mantendo OR restritivo", async () => {
  const vendedor = await criarUsuario([Papel.VENDEDOR], "VEN opções"), outro = await criarUsuario([Papel.VENDEDOR], "Outro dono");
  const proprio = await lead({ vendedorDonoId: vendedor.id, etapa: "NOVO" }), alheio = await lead({ vendedorDonoId: outro.id, etapa: "NOVO" });
  sessao.id = vendedor.id;
  const ator = await prisma.usuario.findUniqueOrThrow({ where: { id: vendedor.id } });
  expect(ator.ativo).toBe(true); expect(ator.papeis).toEqual([Papel.VENDEDOR]);
  const scope = await prisma.$transaction(tx => escopoComercialAtual(ator, tx));
  expect(await prisma.oportunidade.count({ where: { AND: [{ id: proprio.id }, scope] } })).toBe(1);
  expect(await prisma.oportunidade.count({ where: { AND: [{ id: alheio.id }, scope] } })).toBe(0);
  const antes = await foto(), opcoes = await listarOpcoesAtendimento();
  expect(opcoes.comercial).toBe(true);
  expect(opcoes.destinos.map(d => d.chave)).toEqual([`COMERCIAL:${proprio.id}`]);
  expect(await foto()).toEqual(antes);
});

it("PROF só recebe experimental próprio agendado, sem comercial nem outro professor/etapa", async () => {
  const professor = await criarUsuario([Papel.PROFESSOR], "Professor opções"), outro = await criarUsuario([Papel.PROFESSOR], "Outro professor"), vendedor = await criarUsuario([Papel.VENDEDOR], "Dono comercial");
  const permitido = await lead({ vendedorDonoId: vendedor.id, professorExperimentalId: professor.id, etapa: "EXPERIMENTAL_AGENDADA" });
  await lead({ vendedorDonoId: vendedor.id, professorExperimentalId: outro.id, etapa: "EXPERIMENTAL_AGENDADA" });
  await lead({ vendedorDonoId: vendedor.id, professorExperimentalId: professor.id, etapa: "NOVO" });
  sessao.id = professor.id;
  const ator = await prisma.usuario.findUniqueOrThrow({ where: { id: professor.id } });
  expect(ator.ativo).toBe(true); expect(ator.papeis).toEqual([Papel.PROFESSOR]);
  expect(permitido).toMatchObject({ vendedorDonoId: vendedor.id, professorExperimentalId: professor.id, etapa: "EXPERIMENTAL_AGENDADA" });
  const antes = await foto(), opcoes = await listarOpcoesAtendimento();
  expect(opcoes.comercial).toBe(false);
  expect(opcoes.destinos.map(d => ({ chave: d.chave, finalidade: d.finalidade }))).toEqual([{ chave: `PEDAGOGICO:${permitido.id}`, finalidade: "PEDAGOGICO" }]);
  expect(await foto()).toEqual(antes);
});

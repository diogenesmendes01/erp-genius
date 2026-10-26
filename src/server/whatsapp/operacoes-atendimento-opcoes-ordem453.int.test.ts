import { afterAll, afterEach, beforeEach, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";
const sessao = vi.hoisted(() => ({ id: "" }));
vi.mock("@/server/_shared/sessao", async original => {
  const o = await original<typeof import("@/server/_shared/sessao")>();
  return { ...o, exigirSessao: async () => {
    const u = await o.carregarUsuarioFresco(sessao.id);
    if (!u) throw new o.ErroAutenticacao();
    return u;
  } };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { escopoComercialAtual } from "@/server/_shared/escopo-comercial";
import { listarOpcoesAtendimento } from "./operacoes-atendimento";

let fetchGuard: ReturnType<typeof vi.spyOn>;
beforeEach(async () => {
  fetchGuard = vi.spyOn(globalThis, "fetch").mockImplementation(async () => { throw Error("C3: transporte externo inesperado"); });
  await truncarBanco(); sessao.id = "";
});
afterEach(() => { try { expect(fetchGuard).not.toHaveBeenCalled(); } finally { vi.restoreAllMocks(); } });
afterAll(() => prisma.$disconnect());
async function foto() {
  return {
    usuarios: await prisma.usuario.findMany({ orderBy: { id: "asc" } }),
    leads: await prisma.oportunidade.findMany({ orderBy: { id: "asc" } }),
    numeros: await prisma.numeroWhatsApp.findMany({ orderBy: { id: "asc" } }),
    pessoas: await prisma.pessoa.findMany({ orderBy: { id: "asc" } }),
    contatos: await prisma.contatoWhatsApp.findMany({ orderBy: { id: "asc" } }),
    conversas: await prisma.conversaWhatsApp.findMany({ orderBy: { id: "asc" } }),
    atendimentos: await prisma.atendimentoWhatsApp.findMany({ orderBy: { id: "asc" } }),
    eventos: await prisma.evento.findMany({ orderBy: { id: "asc" } }),
    mensagens: await prisma.mensagemWhatsApp.findMany({ orderBy: { id: "asc" } }),
    intencoes: await prisma.intencaoMensagem.findMany({ orderBy: { id: "asc" } }),
  };
}
it("C3 SQL: mais de 200 leads e empates retornam top200 por criação/id desc sem COUNT nem escrita", async () => {
  const admin = await criarUsuario([Papel.ADMINISTRADOR], "Admin fictício C3"); sessao.id = admin.id;
  const ator = await prisma.usuario.findUniqueOrThrow({ where: { id: admin.id } });
  expect(await prisma.$transaction(tx => escopoComercialAtual(ator, tx))).toEqual({});
  const rows = Array.from({ length: 207 }, (_, i) => ({ id: `c3-top-${String(i).padStart(4, "0")}`, nome: `Cadastro fictício ${i}`, criadoEm: new Date(Date.UTC(2026, 0, 1, 0, 0, i % 3)) }));
  await prisma.oportunidade.createMany({ data: rows });
  const esperado = [...rows].sort((a, b) => b.criadoEm.getTime() - a.criadoEm.getTime() || (a.id < b.id ? 1 : -1)).slice(0, 200).map(r => `COMERCIAL:${r.id}`);
  const antes = await foto(), count = vi.spyOn(prisma.oportunidade, "count");
  const primeira = await listarOpcoesAtendimento(), segunda = await listarOpcoesAtendimento();
  expect(primeira.comercial).toBe(true);
  expect(primeira.destinos.map(d => d.chave)).toEqual(esperado);
  expect(segunda).toEqual(primeira); expect(primeira.destinos).toHaveLength(200);
  expect(count).not.toHaveBeenCalled(); expect(await foto()).toEqual(antes);
});
it.each(["VEN", "EQUIPE", "MISTO"] as const)("C3 SQL: %s conserva carteira/count e experimental próprio sem escrita", async perfil => {
  const ator = await criarUsuario(perfil === "EQUIPE" ? [Papel.GERENTE_COMERCIAL] : perfil === "MISTO" ? [Papel.VENDEDOR, Papel.PROFESSOR] : [Papel.VENDEDOR], `Ator fictício ${perfil}`);
  const membro = await criarUsuario([Papel.VENDEDOR], "Membro fictício C3"), outro = await criarUsuario([Papel.VENDEDOR], "Outro fictício C3");
  if (perfil === "EQUIPE") await prisma.usuario.update({ where: { id: membro.id }, data: { gerenteComercialId: ator.id } });
  const donoId = perfil === "EQUIPE" ? membro.id : ator.id;
  const permitido = await prisma.oportunidade.create({ data: { nome: "Permitido fictício C3", vendedorDonoId: donoId, criadoEm: new Date("2026-01-03T00:00:00Z") } });
  const alheio = await prisma.oportunidade.create({ data: { nome: "Alheio fictício C3", vendedorDonoId: outro.id, criadoEm: new Date("2026-01-04T00:00:00Z") } });
  const experimental = perfil === "MISTO" ? await prisma.oportunidade.create({ data: { nome: "Experimental fictício C3", vendedorDonoId: outro.id, professorExperimentalId: ator.id, etapa: "EXPERIMENTAL_AGENDADA", criadoEm: new Date("2026-01-02T00:00:00Z") } }) : null;
  sessao.id = ator.id;
  const atual = await prisma.usuario.findUniqueOrThrow({ where: { id: ator.id } });
  const scope = await prisma.$transaction(tx => escopoComercialAtual(atual, tx));
  expect(Object.keys(scope).length).toBeGreaterThan(0);
  expect(await prisma.oportunidade.count({ where: { AND: [{ id: permitido.id }, scope] } })).toBe(1);
  expect(await prisma.oportunidade.count({ where: { AND: [{ id: alheio.id }, scope] } })).toBe(0);
  const antes = await foto(), count = vi.spyOn(prisma.oportunidade, "count"), r = await listarOpcoesAtendimento();
  expect(r.destinos.map(d => d.chave)).toEqual([`COMERCIAL:${permitido.id}`, ...(experimental ? [`PEDAGOGICO:${experimental.id}`] : [])]);
  expect(count).toHaveBeenCalledTimes(experimental ? 2 : 1);
  expect(await foto()).toEqual(antes);
});
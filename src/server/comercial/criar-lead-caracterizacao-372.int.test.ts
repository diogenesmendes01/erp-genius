import { beforeAll, beforeEach, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";
const sessao = vi.hoisted(() => ({ usuarioId: "" }));
vi.mock("@/server/_shared/sessao", async original => {
 const o = await original<typeof import("@/server/_shared/sessao")>();
 return { ...o, exigirSessao: async () => { const u = await o.carregarUsuarioFresco(sessao.usuarioId); if (!u) throw new o.ErroAutenticacao(); return u; } };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { criarLead } from "./acoes";
import { prisma } from "@/lib/prisma";
import * as codigos from "@/lib/codigo";
import { criarUsuario, truncarBanco } from "@/test/integracao";
let vendedor: Awaited<ReturnType<typeof criarUsuario>>, gerente: Awaited<ReturnType<typeof criarUsuario>>, admin: Awaited<ReturnType<typeof criarUsuario>>;
beforeAll(async () => {
 await truncarBanco(); vendedor = await criarUsuario([Papel.VENDEDOR], "Vendedor fictício"); gerente = await criarUsuario([Papel.GERENTE_COMERCIAL], "Gestor fictício"); admin = await criarUsuario([Papel.ADMINISTRADOR], "Admin fictício");
 await prisma.usuario.update({ where: { id: vendedor.id }, data: { gerenteComercialId: gerente.id } });
});
beforeEach(() => { sessao.usuarioId = vendedor.id; vi.restoreAllMocks(); });
it("global CRM conserva código singleton, defaults e payloads de criação/atribuição", async () => {
 const codigo = vi.spyOn(codigos, "gerarCodigo");
 const r = await criarLead({ nome: "Pessoa fictícia CRM", telefoneE164: "+506 8888-9999", origemCanal: "OUTRO", vendedorDonoId: admin.id });
 expect(r.ok).toBe(true); if (!r.ok || !r.dado) throw new Error("Resultado sem id");
 expect(codigo).toHaveBeenCalledExactlyOnceWith("lead"); codigo.mockRestore();
 const lead = await prisma.oportunidade.findUniqueOrThrow({ where: { id: r.dado.id } });
 expect(lead).toMatchObject({ nome: "Pessoa fictícia CRM", telefoneE164: "+50688889999", etapa: "NOVO", segmento: "ADULTO", temperatura: "MORNO", b2b: false, vendedorDonoId: vendedor.id, origemCanal: "OUTRO", empresaId: null });
 expect(lead.codigo).toMatch(/^L-\d{6,}$/); expect(lead.pessoaId).not.toBeNull();
 const eventos = await prisma.evento.findMany({ where: { agregadoTipo: "Lead", agregadoId: lead.id }, orderBy: { criadoEm: "asc" } });
 expect(eventos).toHaveLength(2); expect(eventos.map(e => ({ tipo: e.tipo, autorId: e.autorId, payload: e.payload }))).toEqual(expect.arrayContaining([
  { tipo: "LeadCriado", autorId: vendedor.id, payload: { codigo: lead.codigo, nome: lead.nome, segmento: "ADULTO", b2b: false, pessoaId: lead.pessoaId, empresaId: null } },
  { tipo: "LeadAtribuido", autorId: vendedor.id, payload: { de: null, para: vendedor.id } },
 ]));
});
it("global Admin pode criar sem dono e não recebe atribuição implícita", async () => {
 sessao.usuarioId = admin.id; const r = await criarLead({ nome: "Sem dono fictício" }); expect(r.ok).toBe(true); if (!r.ok || !r.dado) throw new Error("Resultado sem id");
 expect((await prisma.oportunidade.findUniqueOrThrow({ where: { id: r.dado.id } })).vendedorDonoId).toBeNull();
 expect(await prisma.evento.count({ where: { agregadoId: r.dado.id, tipo: "LeadAtribuido" } })).toBe(0);
});
it("global GC sem vendedor selecionado recusa sem oportunidade ou evento", async () => {
 sessao.usuarioId = gerente.id; const antes = await prisma.evento.count();
 expect(await criarLead({ nome: "GC sem dono fictício" })).toEqual({ ok: false, erro: "Selecione um vendedor da sua equipe." });
 expect(await prisma.oportunidade.count({ where: { nome: "GC sem dono fictício" } })).toBe(0); expect(await prisma.evento.count()).toBe(antes);
});
it("global GC atribui ao vendedor ativo de sua equipe, sem virar dono", async () => {
 sessao.usuarioId = gerente.id; const r = await criarLead({ nome: "Equipe fictícia", vendedorDonoId: vendedor.id }); expect(r.ok).toBe(true); if (!r.ok || !r.dado) throw new Error("Resultado sem id");
 expect((await prisma.oportunidade.findUniqueOrThrow({ where: { id: r.dado.id } })).vendedorDonoId).toBe(vendedor.id);
});

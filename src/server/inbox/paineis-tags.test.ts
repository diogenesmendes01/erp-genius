import { beforeEach, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";
import type { UsuarioSessao } from "@/server/_shared";
const m = vi.hoisted(() => ({ buscar: vi.fn(), tags: vi.fn(), escopo: vi.fn(), ver: vi.fn(), acoes: vi.fn(), envio: vi.fn(), aria: vi.fn(), oportunidade: vi.fn(), disponiveis: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { atendimentoWhatsApp: { findFirst: m.buscar }, pessoaTag: { findMany: m.tags }, oportunidade: { findUnique: m.oportunidade }, tag: { findMany: m.disponiveis } } }));
vi.mock("@/server/whatsapp/escopo", () => ({ escopoAtendimentos: m.escopo }));
vi.mock("@/server/whatsapp/atendimentos", () => ({ atendimentoVisivel: m.envio }));
vi.mock("@/server/whatsapp/consultas-inbox", () => ({ carregarAcoesContatoInbox: m.acoes, carregarAriaDoAtendimento: m.aria, podeVerLeadNaThread: m.ver, cobrancaAtivaDoAtendimento: vi.fn() }));
import { carregarPainel } from "./paineis";
const u = { id: "u1", nome: "Vendedor", papeis: [Papel.VENDEDOR] } as UsuarioSessao;
const registro = (extra = {}) => ({ id: "a1", finalidade: "COMERCIAL", leadId: "l1", aluno: null, lead: { id: "l1", nome: "Lead", etapa: "NOVO", valorPrevisto: null, pessoaId: "p1", pessoa: { responsavel: null } }, matricula: null, conversa: { contatoId: "c1", contato: { pessoaId: "p1", nomeExibicao: null, nomePerfil: null, telefoneE164: "+550000000001", responsavel: null } }, ...extra });
const oportunidade = (pessoa: unknown = { id: "p1", responsavel: null }) => ({ id: "l1", nome: "Lead", b2b: false, planoPrevisto: null, pessoa, empresa: null, participantes: [] });
beforeEach(() => { vi.resetAllMocks(); m.escopo.mockResolvedValue({ id: "a1" }); m.buscar.mockResolvedValue(registro()); m.ver.mockResolvedValue(true); m.oportunidade.mockResolvedValue(oportunidade()); m.disponiveis.mockResolvedValue([]); m.tags.mockResolvedValue([{ tag: { id: "ingles", nome: "Inglês" }, criadoPorId: "autor" }, { tag: { id: "noite", nome: "Noite" }, criadoPorId: null }]); m.acoes.mockResolvedValue({ podeVincular: true }); m.envio.mockResolvedValue({ id: "a1" }); m.aria.mockResolvedValue({ pausada: true, }); });
it("tags só depois do escopo e pessoa autorizada; retorno mínimo/marcaD20/ordem", async () => {
 const r = await carregarPainel(u, "a1"); expect(r?.tags).toEqual([{ id: "ingles", rotulo: "Inglês", ia: false }, { id: "noite", rotulo: "Noite", ia: true }]);
 expect(m.buscar).toHaveBeenCalledWith(expect.objectContaining({ where: { AND: [{ id: "a1" }, { id: "a1" }] } }));
 expect(m.tags).toHaveBeenCalledWith({ where: { pessoaId: "p1" }, orderBy: { tag: { nome: "asc" } }, select: { criadoPorId: true, tag: { select: { id: true, nome: true } } } });
 expect(m.tags.mock.invocationCallOrder[0]).toBeGreaterThan(m.ver.mock.invocationCallOrder[0]);
 expect(r).toMatchObject({ podeEnviar: true, acoes: { podeVincular: true }, aria: { pausada: true } });
});
it("fora do escopo nem consulta tags/ações", async () => { m.buscar.mockResolvedValue(null); expect(await carregarPainel(u, "a1")).toBeNull(); expect(m.tags).not.toHaveBeenCalled(); expect(m.acoes).not.toHaveBeenCalled(); });
it("lead oculto não consulta pessoa mesmo com acesso pela linha", async () => { m.ver.mockResolvedValue(false); expect(await carregarPainel(u, "a1")).toMatchObject({ pessoaId: null, tags: [] }); expect(m.tags).not.toHaveBeenCalled(); });
it.each([null, { responsavel: { id: "legal" } }])("sem pessoa ou responsável legal não consulta tags (%j)", async pessoa => { m.oportunidade.mockResolvedValue(oportunidade(pessoa)); m.buscar.mockResolvedValue(registro({ lead: { id: "l1", nome: "Lead", etapa: "NOVO", valorPrevisto: null, pessoaId: pessoa ? "p1" : null, pessoa } })); expect(await carregarPainel(u, "a1")).toMatchObject({ tags: [] }); expect(m.tags).not.toHaveBeenCalled(); });
it.each(["FINANCEIRO", "SECRETARIA", "PEDAGOGICO"])("%s nunca consulta tags comerciais", async finalidade => { m.buscar.mockResolvedValue(registro({ finalidade })); expect(await carregarPainel(u, "a1")).toMatchObject({ tags: [] }); expect(m.tags).not.toHaveBeenCalled(); });
it("convite revogado/lead negado não herda tags da resposta anterior", async () => { expect((await carregarPainel(u,"a1"))?.tags).toHaveLength(2); m.ver.mockResolvedValue(false); expect((await carregarPainel(u,"a1"))?.tags).toEqual([]); expect(m.tags).toHaveBeenCalledTimes(1); });

it.each([null, { responsavel: { id: "legal" } }])("catálogo ativo não é consultado sem identidade, apesar de editarTags (%j)", async pessoa => {
  m.oportunidade.mockResolvedValue(oportunidade(pessoa));
  m.disponiveis.mockResolvedValue([{ id: "tag-ativa", nome: "Ativa", cor: "NEUTRA" }]);
  const r = await carregarPainel(u, "a1");
  expect(r?.cabecalho).toMatchObject({ pessoaId: null, capacidades: { veLead: true, editarTags: true } });
  expect(m.disponiveis).not.toHaveBeenCalled();
  expect(r?.cabecalho?.tagsDisponiveis).toEqual([]);
});

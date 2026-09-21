import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel } from "@prisma/client";

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/_shared/sessao", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/_shared/sessao")>();
  const sessao = async () => {
    const id = (await authMock())?.user?.id;
    const u = id && await prisma.usuario.findUnique({ where: { id }, select: { id: true, nome: true, ativo: true, papeis: true } });
    if (!u?.ativo) throw new original.ErroAutenticacao();
    return u;
  };
  return { ...original, exigirSessao: sessao, exigirSessaoComPapel: async (...papeis: Papel[]) => {
    const u = await sessao(); original.exigirPapel(u, ...papeis); return u;
  } };
});

import { prisma } from "@/lib/prisma";
import { criarUsuario as usuarioTeste, eventosDo, seedCatalogoMinimo, truncarBanco } from "@/test/integracao";
import { criarUsuario, editarUsuario } from "./acoes";
import { concederCobertura, revogarCobertura } from "./coberturas";
import { exigirCapacidade } from "@/server/_shared/capacidades";
import { listarLeads } from "@/server/comercial/consultas";
import { atribuirDono } from "@/server/comercial/acoes";
import { garantirAtendimento } from "@/server/whatsapp/atendimentos";

let adm: Awaited<ReturnType<typeof usuarioTeste>>, gerente: typeof adm, outraEquipe: typeof adm, titular: typeof adm, substituto: typeof adm, alheio: typeof adm;
let lead: Awaited<ReturnType<typeof prisma.lead.create>>;
const entrar = (id: string) => authMock.mockResolvedValue({ user: { id } });
const formulario = (u: typeof adm) => ({ nome: u.nome, email: u.email, papeis: u.papeis, limiteDescontoTaxaPct: Number(u.limiteDescontoTaxaPct ?? 0), limiteDescontoMensalidadePct: Number(u.limiteDescontoMensalidadePct ?? 0), permissoes: [], gerenteComercialId: u.gerenteComercialId });

beforeEach(async () => {
  await truncarBanco();
  [adm, gerente, outraEquipe, titular, substituto, alheio] = await Promise.all([
    usuarioTeste([Papel.ADMINISTRADOR]), usuarioTeste([Papel.GERENTE_COMERCIAL]), usuarioTeste([Papel.GERENTE_COMERCIAL]),
    usuarioTeste([Papel.VENDEDOR]), usuarioTeste([Papel.VENDEDOR]), usuarioTeste([Papel.VENDEDOR]),
  ]);
  await prisma.usuario.updateMany({ where: { id: { in: [titular.id, substituto.id] } }, data: { gerenteComercialId: gerente.id } });
  await prisma.usuario.update({ where: { id: alheio.id }, data: { gerenteComercialId: outraEquipe.id } });
  lead = await prisma.lead.create({ data: { nome: "Carteira titular", vendedorDonoId: titular.id } });
  await prisma.lead.create({ data: { nome: "Outra equipe", vendedorDonoId: alheio.id } });
});

describe("administração de capacidades e alçadas (AC06/AC20)", () => {
  it("gerente não cria usuário nem concede permissão; administrador grava concessões auditadas", async () => {
    const input = { nome: "Pessoa nova", email: "nova@genius.test", senha: "senha-teste", papeis: [Papel.VENDEDOR], permissoes: ["dados.exportar_leads" as const], gerenteComercialId: gerente.id, limiteDescontoTaxaPct: 7, limiteDescontoMensalidadePct: 3 };
    entrar(gerente.id);
    expect((await criarUsuario(input)).ok).toBe(false);
    expect((await editarUsuario(titular.id, { ...formulario(titular), permissoes: ["dados.exportar_leads"] })).ok).toBe(false);
    entrar(adm.id);
    const r = await criarUsuario(input);
    expect(r.ok, JSON.stringify(r)).toBe(true);
    if (!r.ok) return;
    const u = await prisma.usuario.findUniqueOrThrow({ where: { id: r.dado!.id } });
    expect(u.permissoes).toEqual(["dados.exportar_leads"]);
    expect(Number(u.limiteDescontoTaxaPct)).toBe(7);
    expect(u.gerenteComercialId).toBe(gerente.id);
    expect((await eventosDo("Usuario", u.id))[0].payload).toMatchObject({ permissoes: ["dados.exportar_leads"], limiteTaxa: 7, limiteMensalidade: 3 });
  });

  it("administrador não aumenta sua alçada, adiciona papel ou concede a si uma capacidade", async () => {
    entrar(adm.id);
    for (const mudanca of [{ limiteDescontoTaxaPct: 10 }, { limiteDescontoMensalidadePct: 10 }, { papeis: [Papel.ADMINISTRADOR, Papel.FINANCEIRO] }, { permissoes: ["pagamento.caixa" as const] }]) {
      const r = await editarUsuario(adm.id, { ...formulario(adm), ...mudanca });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.erro).toContain("Outro administrador");
    }
    expect(await eventosDo("Usuario", adm.id)).toHaveLength(0);
    expect((await prisma.usuario.findUniqueOrThrow({ where: { id: adm.id } })).limiteDescontoTaxaPct).toBeNull();
    const direcao = await usuarioTeste([Papel.ADMINISTRADOR]); entrar(direcao.id);
    expect((await editarUsuario(adm.id, { ...formulario(adm), limiteDescontoTaxaPct: 10 })).ok).toBe(true);
    expect((await prisma.usuario.findUniqueOrThrow({ where: { id: adm.id } })).alcadaAlteradaEm).not.toBeNull();
  });

  it("não aceita gerente inexistente, sem papel ou inativo", async () => {
    entrar(adm.id);
    for (const gerenteComercialId of ["inexistente", titular.id]) expect((await editarUsuario(substituto.id, { ...formulario(substituto), gerenteComercialId })).ok).toBe(false);
    await prisma.usuario.update({ where: { id: gerente.id }, data: { ativo: false } });
    expect((await editarUsuario(substituto.id, { ...formulario(substituto), gerenteComercialId: gerente.id })).ok).toBe(false);
  });

  it("revogar capacidade ou desativar depois do login bloqueia a próxima operação", async () => {
    await prisma.usuario.update({ where: { id: titular.id }, data: { permissoes: ["dados.exportar_leads"] } });
    await expect(exigirCapacidade(titular, "dados.exportar_leads")).resolves.toBeUndefined();
    await prisma.usuario.update({ where: { id: titular.id }, data: { permissoes: [] } });
    await expect(exigirCapacidade(titular, "dados.exportar_leads")).rejects.toThrow("permissão específica");
    entrar(adm.id);
    await prisma.usuario.update({ where: { id: adm.id }, data: { ativo: false } });
    expect((await editarUsuario(titular.id, formulario(titular))).ok).toBe(false);
    await expect(exigirCapacidade(adm, "dados.exportar_leads")).rejects.toThrow();
  });
});

describe("equipe e cobertura temporária (AC02/AC07/AC08)", () => {
  const periodo = () => ({ titularId: titular.id, substitutoId: substituto.id, inicio: new Date(Date.now() - 60000).toISOString(), fim: new Date(Date.now() + 60000).toISOString(), motivo: "Cobertura de férias" });

  it("gerente vê só sua equipe; filtro alheio não aumenta o conjunto", async () => {
    expect((await listarLeads(gerente)).map((l) => l.id)).toEqual([lead.id]);
    expect(await listarLeads(gerente, { vendedorId: alheio.id })).toHaveLength(0);
    await prisma.usuario.update({ where: { id: titular.id }, data: { gerenteComercialId: outraEquipe.id } });
    expect(await listarLeads(gerente)).toHaveLength(0);
  });

  it("cobertura respeita início, término e revogação, sem conceder exportação/transferência", async () => {
    entrar(gerente.id);
    expect((await concederCobertura({ ...periodo(), inicio: new Date(Date.now() + 30000).toISOString() })).ok).toBe(true);
    const cobertura = await prisma.coberturaCarteira.findFirstOrThrow();
    expect(await listarLeads(substituto)).toHaveLength(0);
    await prisma.coberturaCarteira.update({ where: { id: cobertura.id }, data: { inicio: new Date(Date.now() - 1000) } });
    expect((await listarLeads(substituto)).map((l) => l.id)).toEqual([lead.id]);
    await expect(exigirCapacidade(substituto, "dados.exportar_leads")).rejects.toThrow();
    entrar(substituto.id);
    expect((await atribuirDono(lead.id, substituto.id, "Cobertura não transfere carteira")).ok).toBe(false);
    await prisma.coberturaCarteira.update({ where: { id: cobertura.id }, data: { fim: new Date(Date.now() - 1) } });
    expect(await listarLeads(substituto)).toHaveLength(0);
    await prisma.coberturaCarteira.update({ where: { id: cobertura.id }, data: { fim: new Date(Date.now() + 60000) } });
    entrar(gerente.id); expect((await revogarCobertura(cobertura.id)).ok).toBe(true);
    expect(await listarLeads(substituto)).toHaveLength(0);
    expect((await eventosDo("CoberturaCarteira", cobertura.id)).map((e) => e.tipo)).toEqual(["CoberturaConcedida", "CoberturaRevogada"]);
  });

  it("não concede nem revoga cobertura de outra equipe por ID direto", async () => {
    entrar(gerente.id);
    expect((await concederCobertura({ ...periodo(), substitutoId: alheio.id })).ok).toBe(false);
    entrar(adm.id); expect((await concederCobertura({ ...periodo(), substitutoId: alheio.id })).ok).toBe(true);
    const cobertura = await prisma.coberturaCarteira.findFirstOrThrow();
    entrar(gerente.id); expect((await revogarCobertura(cobertura.id)).ok).toBe(false);
    expect((await prisma.coberturaCarteira.findUniqueOrThrow({ where: { id: cobertura.id } })).revogadaEm).toBeNull();
  });

  it("transferência atualiza atendimento e cancela intenção humana, preservando autoria/comissão", async () => {
    const cat = await seedCatalogoMinimo();
    const aluno = await prisma.aluno.create({ data: { primeiroNome: "Aluno", paisId: cat.pais.id } });
    const m = await prisma.matricula.create({ data: { alunoId: aluno.id, leadId: lead.id, produtoId: cat.produto.id, paisId: cat.pais.id, moeda: "CRC", comissoes: { create: { vendedorId: titular.id, percentual: 10, valor: 20, moeda: "CRC" } } } });
    const numero = await prisma.numeroWhatsApp.create({ data: { telefoneE164: "+5511987654321", rotulo: "Comercial", driver: "BAILEYS", finalidade: "VENDAS" } });
    const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50688888888", leadId: lead.id } });
    const atendimento = await prisma.$transaction((tx) => garantirAtendimento(tx, { numeroId: numero.id, contatoId: contato.id, finalidade: "COMERCIAL", leadId: lead.id }));
    const intencao = await prisma.intencaoMensagem.create({ data: { numeroId: numero.id, contatoId: contato.id, atendimentoId: atendimento.id, origem: "HUMANO", autorId: titular.id, corpoRenderizado: "Mensagem anterior" } });
    entrar(gerente.id);
    expect((await atribuirDono(lead.id, alheio.id, "Destino fora da equipe")).ok).toBe(false);
    expect((await atribuirDono(lead.id, substituto.id, "Redistribuição autorizada")).ok).toBe(true);
    expect((await prisma.atendimentoWhatsApp.findUniqueOrThrow({ where: { id: atendimento.id } })).responsavelId).toBe(substituto.id);
    const depois = await prisma.intencaoMensagem.findUniqueOrThrow({ where: { id: intencao.id } });
    expect(depois.status).toBe("CANCELADA"); expect(depois.autorId).toBe(titular.id);
    expect((await prisma.comissao.findFirstOrThrow({ where: { matriculaId: m.id } })).vendedorId).toBe(titular.id);
    expect(await listarLeads(titular)).toHaveLength(0);
    expect((await listarLeads(substituto)).map((l) => l.id)).toEqual([lead.id]);
    expect((await eventosDo("Lead", lead.id)).find((e) => e.tipo === "LeadAtribuido")?.payload).toMatchObject({ de: titular.id, para: substituto.id });
  });
});

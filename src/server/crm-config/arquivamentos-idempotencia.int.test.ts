import { beforeEach, describe, expect, it, vi } from "vitest";
import { DriverWhatsApp, Papel } from "@prisma/client";

// #166, 5º lote: ações que levam um registro a um estado-alvo, idempotentes por natureza. O reenvio de quem já fez a
// mesma ação devolve ok sem outro Evento (antes: erro, ou dois Eventos no clique duplo). Se o estado veio de outra
// pessoa, a ação segue recusada como antes. Cobre: arquivar tag e campo (CRM), cancelar tarefa, revogar cobertura de
// carteira, registrar e remover opt-out do WhatsApp. O arquivamento de fonte da Aria está em `fontes.int.test.ts`.

const sessao = vi.hoisted(() => ({ usuarioId: "" }));
vi.mock("@/server/_shared/sessao", async (original) => {
  const o = await original<typeof import("@/server/_shared/sessao")>();
  const exigirSessao = async () => {
    const u = await o.carregarUsuarioFresco(sessao.usuarioId);
    if (!u) throw new o.ErroAutenticacao();
    return u;
  };
  return { ...o, exigirSessao, exigirSessaoComPapel: async (...papeis: Papel[]) => { const u = await exigirSessao(); o.exigirPapel(u, ...papeis); return u; } };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { criarUsuario, truncarBanco } from "@/test/integracao";
import { arquivarCampo, arquivarTag } from "./tags-campos";
import { cancelarTarefa, criarTarefa } from "@/server/crm/tarefas";
import { revogarCobertura } from "@/server/acesso/coberturas";
import { registrarOptOutContato, removerOptOutContato } from "@/server/whatsapp/acoes";
import { garantirAtendimento } from "@/server/whatsapp/atendimentos";

let adminId: string, admin2Id: string, gerenteId: string, vendedorId: string, vendedor2Id: string;
const eventos = (tipo: string) => prisma.evento.count({ where: { tipo } });
const entrar = (id: string) => { sessao.usuarioId = id; };

beforeEach(async () => {
  await truncarBanco();
  await prisma.configuracaoOperacional.create({ data: { id: "escola", fusoInstitucional: "America/Costa_Rica" } });
  adminId = (await criarUsuario([Papel.ADMINISTRADOR], "Admin")).id;
  admin2Id = (await criarUsuario([Papel.ADMINISTRADOR], "Admin 2")).id;
  gerenteId = (await criarUsuario([Papel.GERENTE_COMERCIAL], "Gerente")).id;
  vendedorId = (await criarUsuario([Papel.VENDEDOR], "Vendedor")).id;
  vendedor2Id = (await criarUsuario([Papel.VENDEDOR], "Vendedor 2")).id;
  await prisma.usuario.updateMany({ where: { id: { in: [vendedorId, vendedor2Id] } }, data: { gerenteComercialId: gerenteId } });
  entrar(adminId);
});

describe("arquivar tag e campo repetido (#166)", () => {
  it("a mesma tag, inclusive em clique duplo, é arquivada com um Evento; outra pessoa segue recusada", async () => {
    const tag = await prisma.tag.create({ data: { nome: "Inglês", grupo: "Interesse", cor: "INFO" } });
    const [a, b] = await Promise.all([arquivarTag(tag.id), arquivarTag(tag.id)]);
    expect([a.ok, b.ok], JSON.stringify([a, b])).toEqual([true, true]);
    expect((await arquivarTag(tag.id)).ok).toBe(true);
    expect(await eventos("TagArquivada")).toBe(1);
    entrar(admin2Id);
    expect(await arquivarTag(tag.id)).toEqual({ ok: false, erro: "Tag já arquivada." });
  });

  it("o mesmo campo é arquivado com um Evento; o reenvio com outro nome segue recusado", async () => {
    const campo = await prisma.campoPersonalizado.create({ data: { nome: "Observação", tipo: "TEXTO", alvo: "PESSOA", opcoes: [], obrigatorio: false } });
    const [a, b] = await Promise.all([arquivarCampo(campo.id, "Observação"), arquivarCampo(campo.id, "Observação")]);
    expect([a.ok, b.ok], JSON.stringify([a, b])).toEqual([true, true]);
    expect(await arquivarCampo(campo.id, "Outro")).toEqual({ ok: false, erro: "Campo já arquivado." });
    expect(await eventos("CampoArquivado")).toBe(1);
  });
});

describe("cancelar tarefa repetido (#166)", () => {
  it("o mesmo cancelamento, com a versão já vencida, devolve ok com um Evento; outro motivo segue recusado", async () => {
    entrar(vendedorId);
    const r = await criarTarefa({ titulo: "Ligar", tipo: "OUTRO" });
    if (!r.ok || !r.dado) throw new Error(JSON.stringify(r));
    const { versao } = await prisma.tarefa.findUniqueOrThrow({ where: { id: r.dado.id } });
    const [a, b] = await Promise.all([cancelarTarefa(r.dado.id, versao, "Cliente desistiu"), cancelarTarefa(r.dado.id, versao, "Cliente desistiu")]);
    expect([a.ok, b.ok], JSON.stringify([a, b])).toEqual([true, true]);
    expect((await cancelarTarefa(r.dado.id, versao, "Cliente desistiu")).ok).toBe(true);
    expect(await eventos("TarefaCancelada")).toBe(1);
    expect(await cancelarTarefa(r.dado.id, versao, "Outro motivo")).toEqual({ ok: false, erro: "Só tarefas abertas podem ser canceladas." });
  });
});

describe("revogar cobertura repetido (#166)", () => {
  it("o clique duplo grava um CoberturaRevogada", async () => {
    const cobertura = await prisma.coberturaCarteira.create({ data: {
      titularId: vendedorId, substitutoId: vendedor2Id, inicio: new Date(Date.now() - 60000), fim: new Date(Date.now() + 3600000), motivo: "Cobertura de férias", concedenteId: gerenteId,
    } });
    entrar(gerenteId);
    const [a, b] = await Promise.all([revogarCobertura(cobertura.id), revogarCobertura(cobertura.id)]);
    expect([a.ok, b.ok], JSON.stringify([a, b])).toEqual([true, true]);
    expect((await revogarCobertura(cobertura.id)).ok).toBe(true);
    expect(await eventos("CoberturaRevogada")).toBe(1);
  });
});

describe("opt-out do WhatsApp repetido (#166)", () => {
  async function contato() {
    const numero = await prisma.numeroWhatsApp.create({ data: { telefoneE164: "+5511988880000", rotulo: "Vendas (teste)", driver: DriverWhatsApp.BAILEYS, finalidade: "VENDAS", providerRef: "inst-teste", donoId: null } });
    const c = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50611112222", nomeExibicao: "Cliente" } });
    await prisma.conversaWhatsApp.create({ data: { numeroId: numero.id, contatoId: c.id, ultimaMensagemEm: new Date() } });
    await prisma.$transaction((tx) => garantirAtendimento(tx, { numeroId: numero.id, contatoId: c.id, finalidade: "COMERCIAL", responsavelId: null }));
    return c.id;
  }

  it("registrar: o clique duplo e o reenvio de quem registrou devolvem ok com um Evento; outra pessoa segue recusada", async () => {
    const id = await contato();
    const [a, b] = await Promise.all([registrarOptOutContato(id), registrarOptOutContato(id)]);
    expect([a.ok, b.ok], JSON.stringify([a, b])).toEqual([true, true]);
    expect((await registrarOptOutContato(id)).ok).toBe(true);
    expect(await eventos("OptOutRegistrado")).toBe(1);
    entrar(admin2Id);
    expect(await registrarOptOutContato(id)).toEqual({ ok: false, erro: "Contato já está em opt-out." });
  });

  it("remover: a mesma remoção, com a mesma evidência, devolve ok com um Evento; outra evidência segue recusada", async () => {
    const id = await contato();
    await registrarOptOutContato(id);
    const evidencia = "Contato pediu por e-mail para voltar a receber";
    const [a, b] = await Promise.all([removerOptOutContato(id, evidencia), removerOptOutContato(id, evidencia)]);
    expect([a.ok, b.ok], JSON.stringify([a, b])).toEqual([true, true]);
    expect(await removerOptOutContato(id, "Outra evidência registrada")).toEqual({ ok: false, erro: "Contato não está em opt-out." });
    expect(await eventos("OptOutRemovido")).toBe(1);
  });
});

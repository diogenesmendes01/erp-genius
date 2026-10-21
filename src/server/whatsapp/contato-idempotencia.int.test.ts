import { beforeEach, describe, expect, it, vi } from "vitest";
import { DriverWhatsApp, Papel } from "@prisma/client";

// #166, 7º lote: vincular, renomear e desvincular o contato pelo Inbox são idempotentes por natureza. O reenvio de quem
// já fez a mesma operação (o último Evento do contato é dele, com a mesma entrada) devolve ok sem outro Evento; a
// linha travada serializa o clique duplo. Se outra pessoa mudou o contato no intervalo, segue o comportamento de antes.
// Sessão substituída, como nos outros `*-idempotencia`: o import dinâmico do Auth.js não aguenta chamadas paralelas.

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
import { garantirAtendimento } from "./atendimentos";
import { editarNomeContatoWhatsApp, vincularContatoWhatsApp } from "./acoes";
import { desvincularContatoWhatsApp } from "./desvincular-contato";

const MOTIVO = "Vinculado à oportunidade errada pelo atendente";
const entrar = (u: { id: string }) => { sessao.usuarioId = u.id; };
const eventos = (tipo: string) => prisma.evento.count({ where: { tipo } });

async function comercial() {
  const vendedor = await criarUsuario([Papel.VENDEDOR], "Vendedor");
  const gerente = await criarUsuario([Papel.GERENTE_COMERCIAL], "Gerente");
  const admin = await criarUsuario([Papel.ADMINISTRADOR], "Admin");
  await prisma.usuario.update({ where: { id: vendedor.id }, data: { gerenteComercialId: gerente.id } });
  const numero = await prisma.numeroWhatsApp.create({
    data: { telefoneE164: "+5511988881000", rotulo: "Vendas", driver: DriverWhatsApp.MOTOR, finalidade: "VENDAS", providerRef: "inst-idem7", donoId: vendedor.id },
  });
  const lead = await prisma.oportunidade.create({ data: { nome: "Lead", vendedorDonoId: vendedor.id, telefoneE164: "+50611113333" } });
  const contato = await prisma.contatoWhatsApp.create({ data: { telefoneE164: "+50611113333", nomeExibicao: "Cliente", leadId: lead.id } });
  const at = await prisma.$transaction((tx) => garantirAtendimento(tx, { numeroId: numero.id, contatoId: contato.id, finalidade: "COMERCIAL", leadId: lead.id, responsavelId: vendedor.id }));
  return { vendedor, gerente, admin, lead, contato, at };
}

let c: Awaited<ReturnType<typeof comercial>>;
beforeEach(async () => {
  await truncarBanco();
  c = await comercial();
  entrar(c.gerente);
});

describe("desvincular o contato repetido (#166)", () => {
  it("o clique duplo grava um ContatoDesvinculado; outro motivo, ou outra pessoa, segue recusado", async () => {
    const entrada = { atendimentoId: c.at.id, alvo: { tipo: "lead" as const, id: c.lead.id }, motivo: MOTIVO };
    const [a, b] = await Promise.all([desvincularContatoWhatsApp(entrada), desvincularContatoWhatsApp(entrada)]);
    expect([a.ok, b.ok], JSON.stringify([a, b])).toEqual([true, true]);
    expect((await desvincularContatoWhatsApp(entrada)).ok).toBe(true);
    expect((await desvincularContatoWhatsApp({ ...entrada, motivo: `${MOTIVO}, outra vez` })).ok).toBe(false);
    entrar(c.admin);
    expect(await desvincularContatoWhatsApp(entrada))
      .toEqual({ ok: false, erro: "Este contato não está mais vinculado a esse cadastro. Recarregue a conversa." });
    expect(await eventos("ContatoDesvinculado")).toBe(1);
  });
});

describe("vincular o contato repetido (#166)", () => {
  it("o mesmo vínculo, inclusive em clique duplo, grava um ContatoVinculado", async () => {
    expect((await desvincularContatoWhatsApp({ atendimentoId: c.at.id, alvo: { tipo: "lead", id: c.lead.id }, motivo: MOTIVO })).ok).toBe(true);
    const entrada = { contatoId: c.contato.id, atendimentoId: c.at.id, alvo: { tipo: "lead" as const, id: c.lead.id } };
    const [a, b] = await Promise.all([vincularContatoWhatsApp(entrada), vincularContatoWhatsApp(entrada)]);
    expect([a.ok, b.ok], JSON.stringify([a, b])).toEqual([true, true]);
    expect((await vincularContatoWhatsApp(entrada)).ok).toBe(true);
    expect((await prisma.contatoWhatsApp.findUniqueOrThrow({ where: { id: c.contato.id } })).leadId).toBe(c.lead.id);
    expect(await eventos("ContatoVinculado")).toBe(1);
  });
});

describe("renomear o contato repetido (#166)", () => {
  it("a mesma troca, de quem a fez, devolve ok com um Evento; depois de outra pessoa renomear, segue recusada", async () => {
    const entrada = { atendimentoId: c.at.id, nome: "Cliente Novo", nomeAnterior: "Cliente" };
    const [a, b] = await Promise.all([editarNomeContatoWhatsApp(entrada), editarNomeContatoWhatsApp(entrada)]);
    expect([a.ok, b.ok], JSON.stringify([a, b])).toEqual([true, true]);
    expect((await editarNomeContatoWhatsApp(entrada)).ok).toBe(true);
    expect(await eventos("ContatoRenomeado")).toBe(1);
    entrar(c.admin);
    expect((await editarNomeContatoWhatsApp({ atendimentoId: c.at.id, nome: "Cliente Final", nomeAnterior: "Cliente Novo" })).ok).toBe(true);
    entrar(c.gerente);
    expect(await editarNomeContatoWhatsApp(entrada))
      .toEqual({ ok: false, erro: "O nome do contato mudou enquanto você editava. Recarregue a conversa e tente de novo." });
    expect(await eventos("ContatoRenomeado")).toBe(2);
  });
});
